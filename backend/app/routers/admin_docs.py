"""Admin portal: CRUD over KB documents that the chatbot answers from."""
from __future__ import annotations

import datetime as dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import CurrentUser, require_roles
from ..db import get_session
from ..models import KBDocument
from ..schemas import KB_CATEGORIES, KBDocCreate, KBDocOut, KBDocUpdate
from . import chat as chat_router  # noqa: E402

router = APIRouter(prefix="/admin/docs", tags=["admin"])


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


@router.get("/categories")
def categories() -> dict:
    """Return the fixed set of categories shown in the admin portal."""
    return {
        "categories": [
            {"id": "pdfs",        "label": "PDFs & internal documents"},
            {"id": "sql_csv",     "label": "SQL/CSV databases"},
            {"id": "json_logs",   "label": "JSON logs & audit trails"},
            {"id": "technical",   "label": "Technical reports"},
            {"id": "compliance",  "label": "Compliance records"},
            {"id": "operational", "label": "Operational datasets"},
        ]
    }


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
    return [_to_out(d) for d in docs]


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
    chat_router._embed_cache.pop(doc_id, None)  # evict stale embedding
    doc.updated_at = dt.datetime.utcnow()
    session.commit()
    session.refresh(doc)
    return _to_out(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doc(
    doc_id: int,
    user: CurrentUser = Depends(require_roles("admin")),
    session: Session = Depends(get_session),
) -> None:
    doc = session.get(KBDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    chat_router._embed_cache.pop(doc_id, None)  # evict embedding
    session.delete(doc)
    session.commit()
