"""Admin portal: CRUD over KB documents that the chatbot answers from."""
from __future__ import annotations

import datetime as dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..auth import CurrentUser, require_roles
from ..db import get_session
from ..models import KBDocument
from ..rag import core as rag_core
from ..rag import sql
from ..schemas import KB_CATEGORIES, KBDocCreate, KBDocOut, KBDocUpdate

router = APIRouter(prefix="/admin/docs", tags=["admin"])


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


@router.get("/categories")
def categories(user: CurrentUser = Depends(require_roles("admin"))) -> dict:
    """Return the RAG-strategy categories — admin only."""
    from ..schemas import KB_CATEGORIES
    return {"categories": [{"id": c, "label": c} for c in KB_CATEGORIES]}


@router.get("", response_model=List[KBDocOut])
def list_docs(
    category: Optional[str] = None,
    user: CurrentUser = Depends(require_roles("admin")),
    session: Session = Depends(get_session),
) -> List[KBDocOut]:
    q = session.query(KBDocument)
    if category:
        q = q.filter(KBDocument.category == category)
    docs = q.order_by(KBDocument.created_at.desc()).all()
    # Listing a SINGLE category (the KB page opening one accordion section)
    # needs full content to render. Listing ALL categories (the collapsed
    # overview, which only shows titles) doesn't — truncating heavy
    # video/image payloads there is what keeps that call fast.
    return [_to_out(d, full=bool(category)) for d in docs]


@router.post("", response_model=KBDocOut, status_code=status.HTTP_201_CREATED)
def create_doc(
    body: KBDocCreate,
    user: CurrentUser = Depends(require_roles("admin")),
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
    rag_core._suggestions_cache.clear()  # new doc changes the category's doc-id set
    sql.sync_kb_doc_to_disk(doc.id, doc.category, doc.content)
    return _to_out(doc)


@router.patch("/{doc_id}", response_model=KBDocOut)
def update_doc(
    doc_id: int,
    body: KBDocUpdate,
    user: CurrentUser = Depends(require_roles("admin")),
    session: Session = Depends(get_session),
) -> KBDocOut:
    doc = session.get(KBDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if body.category is not None:
        if body.category not in KB_CATEGORIES:
            raise HTTPException(400, f"category must be one of {KB_CATEGORIES}")
        doc.category = body.category
    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    rag_core._embed_cache.pop(doc_id, None)  # evict stale embedding
    rag_core._image_caption_cache.pop(doc_id, None)
    rag_core._video_understanding_cache.pop(doc_id, None)
    # Editing keeps the same doc id, so the suggestions cache key (sorted ids)
    # wouldn't change on its own — clear explicitly or edited content would
    # keep serving suggestions generated from the pre-edit text forever.
    rag_core._suggestions_cache.clear()
    # Keep the on-disk CSV mirror in sync — handles content edits, and category
    # changes into or out of "12 SQL RAG" (sync_kb_doc_to_disk removes any
    # stale mirror itself when the category/content no longer qualifies).
    sql.sync_kb_doc_to_disk(doc.id, doc.category, doc.content)
    doc.updated_at = dt.datetime.utcnow()
    session.commit()
    session.refresh(doc)
    return _to_out(doc)


@router.post("/reseed", status_code=200)
def reseed(
    user: CurrentUser = Depends(require_roles("admin")),
    session: Session = Depends(get_session),
) -> dict:
    """Clean-reseed the KB from seeding_data/: deletes all auto-seeded docs and
    reinserts them fresh in their correct formats (PDF iframe, image, table, etc.).
    Documents added by real users/admins are preserved."""
    from ..seed import force_reseed
    inserted = force_reseed(session)
    rag_core._embed_cache.clear()  # embeddings for old doc ids are now stale
    rag_core._image_caption_cache.clear()
    rag_core._video_understanding_cache.clear()
    rag_core._suggestions_cache.clear()
    total = session.query(KBDocument).count()
    return {"status": "ok", "inserted": inserted, "total_docs": total}


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_doc(
    doc_id: int,
    user: CurrentUser = Depends(require_roles("admin")),
    session: Session = Depends(get_session),
) -> Response:
    doc = session.get(KBDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    rag_core._embed_cache.pop(doc_id, None)  # evict embedding
    rag_core._image_caption_cache.pop(doc_id, None)
    rag_core._video_understanding_cache.pop(doc_id, None)
    rag_core._suggestions_cache.clear()  # deleted doc changes the category's doc-id set
    sql.remove_kb_doc_from_disk(doc_id)
    session.delete(doc)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
