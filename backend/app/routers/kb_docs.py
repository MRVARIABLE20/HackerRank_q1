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
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

from ..auth import CurrentUser, get_current_user
from ..db import get_session
from ..models import KBDocument
from ..schemas import KB_CATEGORIES, KBDocCreate, KBDocOut
from . import chat as chat_router  # noqa: E402  (import after package init)

router = APIRouter(prefix="/kb/docs", tags=["kb"])


def _to_out(doc: KBDocument) -> KBDocOut:
    return KBDocOut(
        id=doc.id,
        category=doc.category,
        title=doc.title,
        content=doc.content,
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
    return [_to_out(d) for d in q.order_by(KBDocument.created_at.desc()).all()]


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
    # New document — no stale cache entry, but log for observability
    log.info("KB doc created id=%d; embedding will be computed on next query", doc.id)
    return _to_out(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doc(
    doc_id: int,
    user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
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
    chat_router._embed_cache.pop(doc.id, None)
    session.delete(doc)
    session.commit()
