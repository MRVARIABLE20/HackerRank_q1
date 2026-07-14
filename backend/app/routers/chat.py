"""OpenRouter-backed chat — delegates to per-strategy modules in app/rag/."""
from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import CurrentUser, get_current_user
from ..db import get_session
from ..models import AuditLog, KBDocument
from ..schemas import ChatRequest, ChatResponse, Citation
from ..rag import REGISTRY
from ..rag.core import (
    _EMBED_MODEL, _select_relevant, _single_doc_questions, _mentions_doc,
    _call_openrouter, _parse_json_from_llm,
)

_LOW_RELEVANCE = 0.15   # cosine similarity below this triggers a warning

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# Maps each strategy key → the KB category it should query from
STRATEGY_CATEGORY: dict[str, str] = {
    "naive":       "01 Naive RAG",
    "bm25":        "02 BM25 RAG",
    "hybrid":      "03 Hybrid RAG",
    "self_rag":    "04 Self-RAG",
    "corrective":  "05 Corrective RAG",
    "graph":       "06 Graph RAG",
    "speculative": "07 Speculative RAG",
    "rag_fusion":  "08 RAG-Fusion",
    "adaptive":    "09 Adaptive RAG",
    "agentic":     "10 Agentic RAG",
    "multihop":    "11 Multi-hop RAG",
    "sql":         "12 SQL RAG",
    "multimodal":  "13 Multimodal RAG",
    "modular":     "14 Modular RAG",
}


def _normalize_question(q: str) -> str:
    """Loose normalization so two questions that only differ in punctuation,
    quoting, or case are still recognised as "the same question"."""
    return re.sub(r"[^\w\s]", "", q.lower()).strip()


def _genai_contextual_followups(
    query: str,
    answer: str,
    focus_doc: Optional[KBDocument],
    ordered_docs: List[KBDocument],
    excluded: set[str],
) -> List[str]:
    """Generate up to 3 follow-up questions grounded in THIS specific answer.

    Unlike the rule-based templates (which only slot a doc title into a fixed
    phrasing), these are produced by the LLM from the actual question + answer,
    so they reference the concrete details just discussed. Returns [] on any
    failure so the caller can fall back to the deterministic templates —
    contextual when possible, never broken.
    """
    if focus_doc is not None:
        doc_hint = (
            f'The user is focused on the document "{focus_doc.title}". '
            "EVERY follow-up must be about that specific document."
        )
    elif ordered_docs:
        titles = "; ".join(f'"{d.title}"' for d in ordered_docs[:3])
        doc_hint = f"Relevant documents just used: {titles}."
    else:
        return []

    prompt = (
        f'A user asked: "{query}"\n\n'
        f'They received this answer:\n"""\n{answer[:1500]}\n"""\n\n'
        f"{doc_hint}\n\n"
        "Suggest exactly 3 follow-up questions the user would naturally ask NEXT "
        "to go deeper. Rules:\n"
        "- Ground each in SPECIFIC details actually mentioned in the answer above\n"
        "- Each must explore a genuinely different angle — not a reword of the original question\n"
        "- Keep them concise and answerable from the same documents\n\n"
        'Return ONLY JSON: {"followups": ["q1", "q2", "q3"]}'
    )
    try:
        raw = _call_openrouter(
            prompt,
            system=(
                "You propose concise, specific follow-up questions grounded strictly in the "
                "provided discussion. Output only the requested JSON."
            ),
            temperature=0.6,
        )
        data = _parse_json_from_llm(raw)
        out: List[str] = []
        seen: set[str] = set()
        for q in data.get("followups", []):
            if not isinstance(q, str):
                continue
            q = q.strip()
            n = _normalize_question(q)
            if not n or n in excluded or n in seen:
                continue
            seen.add(n)
            out.append(q)
        return out[:3]
    except Exception:
        log.warning("Contextual follow-up generation failed; falling back to templates", exc_info=True)
        return []


# ── Main endpoint ──────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ChatResponse:
    trace_id = uuid.uuid4().hex[:16]
    strategy_key = body.rag_strategy.strip().lower()

    # Only query docs belonging to this strategy's category
    category = STRATEGY_CATEGORY.get(strategy_key)
    if category:
        all_docs = session.query(KBDocument).filter(KBDocument.category == category).all()
    else:
        all_docs = session.query(KBDocument).all()
    fn = REGISTRY.get(strategy_key, REGISTRY["naive"])

    # ── Modular RAG: pre-fetch each sub-module's own knowledge base ──────────
    # Modular routes numerical/visual/relational queries to specialised modules.
    # Each module must search its OWN category's documents, not Modular's docs.
    modular_extra: dict = {}
    if strategy_key == "modular":
        for sub_key, sub_cat in [
            ("sql",        "12 SQL RAG"),
            ("multimodal", "13 Multimodal RAG"),
            ("graph",      "06 Graph RAG"),
            ("corrective", "05 Corrective RAG"),
        ]:
            modular_extra[sub_key] = (
                session.query(KBDocument).filter(KBDocument.category == sub_cat).all()
            )

    # ── Relevance pre-check ──────────────────────────────────────────────────
    warning: Optional[str] = None
    cat_label = category or "the knowledge base"

    # For Modular RAG, validate relevance against the combined pool of all
    # possible sub-strategy knowledge bases so valid routable queries (e.g.
    # "total revenue" → SQL module) don't trigger false warnings.
    check_pool = all_docs
    if modular_extra:
        sub_docs_flat = [d for dlist in modular_extra.values() for d in dlist]
        check_pool = all_docs + sub_docs_flat
        cat_label = "Modular RAG (SQL, Multimodal, Graph, Corrective, Hybrid)"

    if not check_pool:
        warning = (
            f"No documents are seeded for '{cat_label}'. "
            "Please add documents to this RAG strategy category before querying."
        )
    else:
        pre = _select_relevant(body.query, check_pool, top_k=1)
        if not pre:
            warning = (
                f"No documents could be retrieved from '{cat_label}'. "
                "The knowledge base may be empty or unavailable."
            )
        elif pre[0][1] < _LOW_RELEVANCE:
            score = pre[0][1]
            warning = (
                f"No relevant documents found in '{cat_label}' for your query "
                f"(best match: {score:.2f} — threshold: {_LOW_RELEVANCE:.2f}). "
                "Your question does not appear to match the knowledge base for this RAG strategy. "
                "Try rephrasing or switching to a different strategy."
            )

    if modular_extra:
        answer, picks, meta = fn(body.query, all_docs, extra_docs=modular_extra)
    else:
        answer, picks, meta = fn(body.query, all_docs)

    # ── Strategy-specific warnings (override if no pre-check warning set) ───
    if not warning:
        if meta.get("retrieve_decision") == "NO_RETRIEVE":
            warning = (
                "Self-RAG decided retrieval was unnecessary — "
                "this answer comes from general LLM knowledge, not your documents. "
                "Rephrase as a specific factual question to trigger document retrieval."
            )
        elif meta.get("routed_to") == "direct_llm":
            warning = (
                "Adaptive RAG classified this as a general knowledge query (class 0) "
                "and skipped document retrieval. Ask a more specific question about "
                "the knowledge base to get a document-grounded answer."
            )
        elif (
            strategy_key == "sql" or meta.get("routed_to") == "sql"
        ) and meta.get("rows_returned", -1) == 0:
            warning = (
                "SQL query returned 0 rows — no data matched your query in the available tables. "
                "Check that you are asking about data that exists in the SQL knowledge base, "
                "and use exact or partial column values."
            )

    # Ensure base keys always present
    meta.setdefault("model", _EMBED_MODEL)
    meta.setdefault("k", len(picks))
    meta.setdefault("top_score", round(float(picks[0][1]), 3) if picks else 0.0)
    meta.setdefault("scores", [round(float(s), 3) for _, s in picks])

    citations: List[Citation] = []
    for d, score in picks:
        raw = d.content.strip()
        if raw.startswith("__VIDEO__:"):
            fname = raw[len("__VIDEO__:"):].split("\n")[0].strip().rsplit("/", 1)[-1]
            snippet = f"[Video: {fname}]"
        elif raw.startswith("data:video/"):
            snippet = f"[Video: {d.title}]"
        elif raw.startswith("data:image/"):
            mime_end = raw.index(";") if ";" in raw else 20
            snippet = f"[Embedded image ({raw[5:mime_end]})]"
        else:
            snippet = raw.replace("\n", " ")
            snippet = snippet[:240] + "…" if len(snippet) > 240 else snippet
        citations.append(Citation(
            doc_id=str(d.id),
            source_uri=f"kb://{d.category}/{d.id}",
            page=None,
            snippet=snippet,
            score=float(score),
            classification="internal",
            department=d.category,
        ))

    # ── Contextual "explore further" follow-ups ─────────────────────────────
    # Derived from the docs actually cited in THIS answer (not a static,
    # category-wide list) so they stay relevant to what was just discussed.
    #
    # When the user is clearly discussing ONE document — the query names it, or
    # one cited doc dominates retrieval — every follow-up targets THAT document,
    # walking its phrasing variants. Only a broad query that touches several
    # documents evenly spreads follow-ups across all of them.
    #
    # Non-repetition is guaranteed across the whole conversation: the frontend
    # sends every question already asked via `asked_questions`; we exclude all
    # of them plus the current query, and return FEWER chips rather than repeat.
    excluded = {_normalize_question(q) for q in body.asked_questions}
    excluded.add(_normalize_question(body.query))

    ordered_docs: List[KBDocument] = []
    seen_doc_ids: set[int] = set()
    for d, _score in picks:
        if d.id not in seen_doc_ids:
            seen_doc_ids.add(d.id)
            ordered_docs.append(d)

    # Identify the document under discussion, if any.
    focus_doc: Optional[KBDocument] = None
    for d in ordered_docs:                                   # 1) query names a doc
        if _mentions_doc(body.query, d.title):
            focus_doc = d
            break
    if focus_doc is None and picks:                          # 2) top citation dominates
        top_score = picks[0][1]
        second_score = picks[1][1] if len(picks) > 1 else 0.0
        if top_score > 0 and top_score >= 1.5 * second_score:
            focus_doc = ordered_docs[0]

    # Primary: genuinely contextual follow-ups from the LLM, grounded in this
    # answer. Falls through to the deterministic templates below if it fails or
    # returns fewer than 3 (so we're contextual when possible, never empty).
    followup_questions: List[str] = _genai_contextual_followups(
        body.query, answer, focus_doc, ordered_docs, excluded
    )
    chosen_norm: set[str] = {_normalize_question(q) for q in followup_questions}
    query_seed = sum(map(ord, body.query))

    def _try_add(doc: KBDocument, variant: int) -> None:
        if len(followup_questions) >= 3:
            return
        _q_s, candidate = _single_doc_questions(doc.title, doc.content, query_seed + doc.id + variant)
        cnorm = _normalize_question(candidate)
        if cnorm in excluded or cnorm in chosen_norm:
            return
        chosen_norm.add(cnorm)
        followup_questions.append(candidate)

    if len(followup_questions) >= 3:
        pass  # LLM already produced a full contextual set
    elif focus_doc is not None:
        # Fill every slot from the focused doc (up to its 6 variants)…
        for variant in range(6):
            if len(followup_questions) >= 3:
                break
            _try_add(focus_doc, variant)
        # …then borrow from other cited docs only if it ran dry (kept the
        # conversation on one doc for many turns), so chips never run to zero
        # while other relevant documents still have unused questions.
        if len(followup_questions) < 3:
            for d in ordered_docs:
                if d.id == focus_doc.id:
                    continue
                for variant in range(6):
                    if len(followup_questions) >= 3:
                        break
                    _try_add(d, variant)
                if len(followup_questions) >= 3:
                    break
    else:
        # Broad query → spread across all cited docs (variant outer, doc inner).
        for variant in range(6):
            if len(followup_questions) >= 3:
                break
            for d in ordered_docs:
                if len(followup_questions) >= 3:
                    break
                _try_add(d, variant)

    confidence = float(picks[0][1]) if picks else 0.0
    session.add(AuditLog(
        ts=datetime.utcnow(),
        user_email=user.email,
        user_roles=user.roles,
        query=body.query,
        retrieved_doc_ids=[c.doc_id for c in citations],
        denied_doc_count=0,
        confidence=confidence,
        answer_hash=hashlib.sha256(answer.encode()).hexdigest()[:32],
        trace_id=trace_id,
    ))
    session.commit()

    return ChatResponse(
        answer=answer,
        citations=citations,
        confidence=confidence,
        trace_id=trace_id,
        router_decision=meta,
        verifier_verdict={},
        denied_doc_count=0,
        warning=warning,
        followup_questions=followup_questions,
    )
