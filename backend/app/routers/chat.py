"""OpenRouter-backed chat that answers from admin-curated KB documents.

This replaces the heavyweight Qdrant/Gemini LangGraph pipeline with a simple,
working chat for the admin portal demo. It:
  1. Loads all KBDocument rows (admin-curated).
  2. Encodes the query + each document title+excerpt via OpenRouter
     text-embedding-3-small and ranks by cosine similarity.
  3. Sends the top-K most semantically relevant docs as context to the LLM.
  4. Writes an audit-log row.
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
import uuid
from datetime import datetime
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..config import get_settings
from ..db import get_session
from ..models import AuditLog, KBDocument
from ..schemas import ChatRequest, ChatResponse, Citation

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

_TOP_K = 6
_EMBED_MODEL = "openai/text-embedding-3-small"
# In-process cache: doc_id → embedding vector (list[float])
_embed_cache: dict[int, list[float]] = {}


# ── Embedding helpers ──────────────────────────────────────────────────────────

def _embed(texts: list[str]) -> list[list[float]]:
    """Call OpenRouter embeddings endpoint; returns one vector per input text."""
    cfg = get_settings()
    if not cfg.openrouter_api_key:
        raise HTTPException(500, "OPENROUTER_API_KEY not configured on the server")
    try:
        r = httpx.post(
            f"{cfg.openrouter_base_url}/embeddings",
            headers={
                "Authorization": f"Bearer {cfg.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json={"model": _EMBED_MODEL, "input": texts},
            timeout=30.0,
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Embedding request failed: {e}") from e
    if r.status_code >= 400:
        log.error("Embedding API %d: %s", r.status_code, r.text[:400])
        raise HTTPException(502, f"Embedding API error {r.status_code}")
    items = r.json()["data"]
    items.sort(key=lambda x: x["index"])
    return [item["embedding"] for item in items]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _doc_text(doc: KBDocument) -> str:
    """Representative text for a document: title + first 512 chars of content."""
    excerpt = doc.content.strip()[:512].replace("\n", " ")
    return f"{doc.title}. {excerpt}"


def _select_relevant(query: str, docs: List[KBDocument]) -> List[tuple[KBDocument, float]]:
    """Rank docs by cosine similarity to the query embedding. Returns top-K."""
    if not docs:
        return []

    # Embed the query
    query_vec = _embed([query])[0]

    # Embed documents not yet in cache
    uncached = [d for d in docs if d.id not in _embed_cache]
    if uncached:
        texts = [_doc_text(d) for d in uncached]
        # Batch in chunks of 100 (API limit)
        for i in range(0, len(texts), 100):
            batch_docs = uncached[i:i + 100]
            batch_vecs = _embed(texts[i:i + 100])
            for doc, vec in zip(batch_docs, batch_vecs):
                _embed_cache[doc.id] = vec
        log.info("Embedded %d new documents (cache size: %d)", len(uncached), len(_embed_cache))

    # Score by cosine similarity
    scored: List[tuple[KBDocument, float]] = []
    for d in docs:
        vec = _embed_cache.get(d.id)
        if vec is None:
            continue
        score = _cosine(query_vec, vec)
        scored.append((d, score))

    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[:_TOP_K]


def _build_prompt(query: str, picks: List[tuple[KBDocument, float]]) -> str:
    if not picks:
        return (
            "You are the Enterprise RAG assistant. The admin has not yet uploaded any "
            "documents. Politely tell the user the knowledge base is empty and ask the "
            "admin to add documents in the Admin Portal.\n\n"
            f"User question: {query}"
        )
    ctx_blocks = []
    for d, _ in picks:
        ctx_blocks.append(
            f"[doc:{d.id}] (category: {d.category}) {d.title}\n{d.content.strip()}"
        )
    context = "\n\n---\n\n".join(ctx_blocks)
    return (
        "You are the Enterprise RAG assistant. Answer the user's question using ONLY the "
        "facts in the CONTEXT below. If the context does not contain the answer, say so "
        "honestly. Cite sources inline using [doc:<id>] markers that appear in the context.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"USER QUESTION: {query}\n\n"
        "Answer concisely and include [doc:<id>] citations where appropriate."
    )


def _call_openrouter(prompt: str) -> str:
    cfg = get_settings()
    if not cfg.openrouter_api_key:
        raise HTTPException(500, "OPENROUTER_API_KEY not configured on the server")
    headers = {
        "Authorization": f"Bearer {cfg.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5175",
        "X-Title": "Enterprise RAG Intelligence",
    }
    payload = {
        "model": cfg.openrouter_model,
        "messages": [
            {"role": "system", "content": "You are a precise enterprise knowledge assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    try:
        r = httpx.post(
            f"{cfg.openrouter_base_url}/chat/completions",
            json=payload,
            headers=headers,
            timeout=60.0,
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"OpenRouter request failed: {e}") from e
    if r.status_code >= 400:
        log.error("OpenRouter %d: %s", r.status_code, r.text[:500])
        raise HTTPException(502, f"OpenRouter error {r.status_code}: {r.text[:300]}")
    data = r.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise HTTPException(502, f"Malformed OpenRouter response: {e}") from e


@router.post("", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ChatResponse:
    trace_id = uuid.uuid4().hex[:16]
    all_docs = session.query(KBDocument).all()
    picks = _select_relevant(body.query, all_docs)
    prompt = _build_prompt(body.query, picks)
    answer = _call_openrouter(prompt)

    citations: List[Citation] = []
    for d, score in picks:
        snippet = d.content.strip().replace("\n", " ")
        if len(snippet) > 240:
            snippet = snippet[:240] + "…"
        citations.append(
            Citation(
                doc_id=str(d.id),
                source_uri=f"kb://{d.category}/{d.id}",
                page=None,
                snippet=snippet,
                score=float(score),
                classification="internal",
                department=d.category,
            )
        )

    # Confidence = cosine similarity of the best-matching document (0.0 – 1.0)
    confidence = float(picks[0][1]) if picks else 0.0
    audit = AuditLog(
        ts=datetime.utcnow(),
        user_email=user.email,
        user_roles=user.roles,
        query=body.query,
        retrieved_doc_ids=[c.doc_id for c in citations],
        denied_doc_count=0,
        confidence=confidence,
        answer_hash=hashlib.sha256(answer.encode("utf-8")).hexdigest()[:32],
        trace_id=trace_id,
    )
    session.add(audit)
    session.commit()

    return ChatResponse(
        answer=answer,
        citations=citations,
        confidence=confidence,
        trace_id=trace_id,
        router_decision={
            "strategy": "semantic_embedding",
            "model": _EMBED_MODEL,
            "k": len(picks),
            "top_score": round(float(picks[0][1]), 3) if picks else 0,
            "scores": [round(float(s), 3) for _, s in picks],
        },
        verifier_verdict={},
        denied_doc_count=0,
    )
