"""User-accessible KB endpoints.

Any authenticated user can:
  GET  /kb/docs                — list all KB documents (read only)
  POST /kb/docs                — add a new document (tagged with their email)
  DELETE /kb/docs/{id}         — delete their own entry
                                 (admins may delete any entry)

Admins continue to have full PATCH / category management via /admin/docs.
"""
from __future__ import annotations

import datetime as dt
import logging
import threading
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

from ..auth import CurrentUser, get_current_user
from ..db import get_session
from ..models import KBDocument
from ..schemas import KB_CATEGORIES, KBDocCreate, KBDocOut
from ..rag import core as rag_core
from ..rag import sql
from ..rag.core import _call_openrouter, _parse_json_from_llm

router = APIRouter(prefix="/kb/docs", tags=["kb"])

# ── Strategy → category mapping ───────────────────────────────────────────────
_STRATEGY_CATEGORY: dict[str, str] = {
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

def _cache_key(docs: list[KBDocument]) -> tuple:
    return tuple(sorted(d.id for d in docs))


def _build_doc_descriptions(docs: list[KBDocument]) -> str:
    lines = []
    for d in docs:
        c = (d.content or "").strip()
        if c.startswith("__PDF__:"):
            lines.append(f"• [PDF] {d.title}")
        elif c.startswith("__VIDEO__:") or c.startswith("data:video/"):
            lines.append(f"• [Video] {d.title}")
        elif c.startswith("data:image"):
            lines.append(f"• [Image] {d.title}")
        else:
            snippet = c[:500].replace("\n", " ").strip()
            lines.append(f"• {d.title} — {snippet}")
    return "\n".join(lines)


def _rule_based_suggestions(docs: list[KBDocument], strategy: str) -> dict:
    """Fallback: derive questions from document content type and title.

    `docs` is expected newest-first (see callers) so that if a category has
    more than 4 documents, the [:4] slice below keeps the newest additions
    instead of silently dropping them in favour of older ones.
    """
    seen: set[str] = set()
    starters: list[str] = []
    followups: list[str] = []
    for doc in docs:
        q_s, q_f = rag_core._single_doc_questions(doc.title, doc.content, doc.id)
        if q_s not in seen:
            seen.add(q_s)
            starters.append(q_s)
        if q_f not in seen:
            seen.add(q_f)
            followups.append(q_f)
    return {"start": starters[:4], "followup": followups[:4]}


def _background_genai_refresh(docs_data: list[dict], strategy: str, key: tuple) -> None:
    """Run in a daemon thread: call LLM with plain dicts (no ORM session), update cache."""
    try:
        lines = []
        for d in docs_data:
            c = (d.get("content") or "").strip()
            if c.startswith("__PDF__:"):
                lines.append(f"• [PDF] {d['title']}")
            elif c.startswith("__VIDEO__:") or c.startswith("data:video/"):
                lines.append(f"• [Video] {d['title']}")
            elif c.startswith("data:image"):
                lines.append(f"• [Image] {d['title']}")
            else:
                snippet = c[:500].replace("\n", " ").strip()
                lines.append(f"• {d['title']} — {snippet}")
        docs_text = "\n".join(lines)
        prompt = (
            f"These are the actual documents stored in the '{strategy}' RAG knowledge base, "
            f"listed NEWEST first:\n\n"
            f"{docs_text}\n\n"
            "Generate exactly 4 STARTER questions and 4 FOLLOW-UP questions that a user "
            "might realistically ask about the specific content above.\n\n"
            "Rules:\n"
            "- Every question MUST reference specific information from the documents listed\n"
            "- Do NOT write generic questions like 'What topics does this cover?'\n"
            "- Cover as many DIFFERENT documents as possible — do not focus on only 2-3\n"
            "- The FIRST document listed was added most recently — dedicate at least one "
            "STARTER question specifically to it\n"
            "- Starter questions: open an interesting line of enquiry about a specific document\n"
            "- Follow-up questions: dig deeper — comparisons, edge cases, specific numbers\n\n"
            "Return ONLY valid JSON, no markdown:\n"
            '{"start": ["q1","q2","q3","q4"], "followup": ["q1","q2","q3","q4"]}'
        )
        raw = _call_openrouter(
            prompt,
            system=(
                "You generate concise, document-specific questions for an enterprise RAG chatbot. "
                "Each question must be grounded in the exact documents provided. "
                "Always return valid JSON matching the requested schema."
            ),
            temperature=0.7,
        )
        data = _parse_json_from_llm(raw)
        start    = [q for q in data.get("start",    []) if isinstance(q, str)][:4]
        followup = [q for q in data.get("followup", []) if isinstance(q, str)][:4]
        if start:
            # Hard guarantee: the newest document (docs_data[0], since callers list
            # newest-first) always gets a dedicated question, regardless of whether
            # the LLM's 8 questions happened to cover it — otherwise a doc a user
            # just added could go un-suggested indefinitely once a category grows
            # past a handful of documents.
            newest = docs_data[0] if docs_data else None
            if newest and not any(rag_core._mentions_doc(q, newest["title"]) for q in start + followup):
                q_s, q_f = rag_core._single_doc_questions(newest["title"], newest.get("content", ""), 0)
                start = [q_s] + start[:3]
                followup = [q_f] + followup[:3]
            rag_core._suggestions_cache[key] = {"start": start, "followup": followup}
            log.info("GenAI suggestions cached for strategy=%s start=%d", strategy, len(start))
    except Exception:
        log.warning("Background GenAI refresh failed for strategy=%s", strategy, exc_info=True)
    finally:
        rag_core._suggestions_inflight.discard(key)


@router.get("/suggestions")
def get_suggestions(
    strategy: str = "naive",
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Return document-specific suggestion chips for the given strategy's KB.

    First visit: rule-based questions returned immediately (fast, no LLM).
    Subsequent visits: GenAI-enhanced questions served from cache.
    Always returns empty lists only when no documents exist for this strategy.
    """
    try:
        category = _STRATEGY_CATEGORY.get(strategy.strip().lower())
        if not category:
            return {"start": [], "followup": []}

        # Newest-first: when a category has more than 4-8 docs, this ensures a
        # just-added document is one of the ones actually offered to the LLM/
        # rule-based generator, instead of being silently crowded out by older ones.
        docs = (
            session.query(KBDocument)
            .filter(KBDocument.category == category)
            .order_by(KBDocument.created_at.desc())
            .limit(8)
            .all()
        )
        log.info("suggestions: strategy=%s docs_found=%d", strategy, len(docs))
        if not docs:
            return {"start": [], "followup": []}

        key = _cache_key(docs)

        # Cache hit → return GenAI-enhanced questions
        if key in rag_core._suggestions_cache:
            log.info("suggestions: cache hit for strategy=%s", strategy)
            return rag_core._suggestions_cache[key]

        # Cache miss → return rule-based immediately, refresh with GenAI in background.
        # Skip spawning a new thread if one is already in flight for this exact doc
        # set (e.g. rapid strategy switching before the first refresh completes).
        result = _rule_based_suggestions(docs, strategy)
        log.info("suggestions: rule-based start=%d followup=%d", len(result.get("start", [])), len(result.get("followup", [])))

        if key not in rag_core._suggestions_inflight:
            rag_core._suggestions_inflight.add(key)
            docs_data = [{"title": d.title or "", "content": d.content or ""} for d in docs]
            threading.Thread(
                target=_background_genai_refresh,
                args=(docs_data, strategy, key),
                daemon=True,
            ).start()

        return result
    except Exception:
        log.exception("suggestions: unexpected error for strategy=%s", strategy)
        return {"start": [], "followup": []}


def prewarm_suggestions() -> None:
    """Warm the suggestions cache for every strategy that has documents.

    Called once at server startup so the first real user to open a strategy
    already gets GenAI-quality questions instead of the rule-based fallback —
    without this, whoever hits a strategy first always sees the fallback while
    the background refresh (10-25s) is still running. Runs sequentially in a
    single background thread so it doesn't fire 14 concurrent LLM calls.
    """
    def _worker() -> None:
        from ..db import SessionLocal
        session = SessionLocal()
        try:
            for strategy, category in _STRATEGY_CATEGORY.items():
                docs = (
                    session.query(KBDocument)
                    .filter(KBDocument.category == category)
                    .order_by(KBDocument.created_at.desc())
                    .limit(8)
                    .all()
                )
                if not docs:
                    continue
                key = _cache_key(docs)
                if key in rag_core._suggestions_cache or key in rag_core._suggestions_inflight:
                    continue
                rag_core._suggestions_inflight.add(key)
                docs_data = [{"title": d.title or "", "content": d.content or ""} for d in docs]
                _background_genai_refresh(docs_data, strategy, key)  # sequential — blocks this worker only
        except Exception:
            log.warning("Suggestions pre-warm failed", exc_info=True)
        finally:
            session.close()

    threading.Thread(target=_worker, daemon=True).start()
    log.info("Suggestions pre-warm started for %d strategies", len(_STRATEGY_CATEGORY))


def _to_out(doc: KBDocument, full: bool = True) -> KBDocOut:
    content = doc.content if full else rag_core._truncate_for_overview(doc.content)
    return KBDocOut(
        id=doc.id,
        category=doc.category,
        title=doc.title,
        content=content,
        created_by=doc.created_by,
        created_at=doc.created_at.isoformat(),
        updated_at=doc.updated_at.isoformat(),
    )


@router.get("", response_model=List[KBDocOut])
def list_docs(
    category: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[KBDocOut]:
    q = session.query(KBDocument)
    if category:
        q = q.filter(KBDocument.category == category)
    docs = q.order_by(KBDocument.created_at.desc()).all()
    # Listing all categories (collapsed overview, titles only) truncates heavy
    # video/image content; listing one category (an opened accordion section)
    # returns it in full. See admin_docs.py's list_docs for the same pattern.
    return [_to_out(d, full=bool(category)) for d in docs]


@router.post("", response_model=KBDocOut, status_code=status.HTTP_201_CREATED)
def create_doc(
    body: KBDocCreate,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> KBDocOut:
    if body.category not in KB_CATEGORIES:
        raise HTTPException(400, f"category must be one of {KB_CATEGORIES}")
    doc = KBDocument(
        category=body.category,
        title=body.title,
        content=body.content,
        created_by=user.email,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    # Adding a doc changes the category's doc-id set, so any cached suggestions
    # for it are keyed to a now-stale set and would never be served again —
    # clear them so the new doc is reflected on the next suggestions request.
    rag_core._suggestions_cache.clear()
    sql.sync_kb_doc_to_disk(doc.id, doc.category, doc.content)
    log.info("KB doc created id=%d; embedding will be computed on next query", doc.id)
    return _to_out(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_doc(
    doc_id: int,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    doc = session.get(KBDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    # Users can only delete their own entries; admins can delete anything.
    is_admin = "admin" in [r.lower() for r in user.roles]
    if not is_admin and doc.created_by != user.email:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You can only delete documents you created.",
        )
    rag_core._embed_cache.pop(doc.id, None)
    rag_core._image_caption_cache.pop(doc.id, None)
    rag_core._video_understanding_cache.pop(doc.id, None)
    rag_core._suggestions_cache.clear()  # deleted doc changes the category's doc-id set
    sql.remove_kb_doc_from_disk(doc.id)
    session.delete(doc)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
