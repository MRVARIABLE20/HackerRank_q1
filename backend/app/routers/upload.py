"""Admin: multipart video upload → stored entirely in the database.

The video is base64-encoded and stored as a `data:video/<mime>;base64,...` data
URI directly in KBDocument.content — the same pattern already used for images.
No file is written to disk, so deleting the KB entry deletes the video with it
(no orphaned files, no drift from the seeding_data/ bootstrap scan).
"""
from __future__ import annotations

import base64
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..auth import CurrentUser, require_roles
from ..db import get_session
from ..models import KBDocument
from ..rag import core as rag_core
from ..schemas import KB_CATEGORIES

router = APIRouter(prefix="/uploads", tags=["uploads"])

_VIDEO_MIME: dict[str, str] = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
}

# Base64 inflates raw bytes by ~33%; this keeps DB rows, list-KB API responses,
# and browser memory usage reasonable now that videos live fully in the DB.
_MAX_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/video", status_code=status.HTTP_201_CREATED)
async def upload_video(
    category: str = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_roles("admin")),
    session: Session = Depends(get_session),
) -> dict:
    """Upload a video, base64-encode it, and store it inline in the KB document."""
    ext = Path(file.filename or "").suffix.lower()
    mime = _VIDEO_MIME.get(ext)
    if not mime:
        raise HTTPException(400, f"Unsupported format '{ext}'. Allowed: {', '.join(sorted(_VIDEO_MIME))}")
    if category not in KB_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if not title.strip():
        raise HTTPException(400, "Title is required")

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(413, f"Video too large — max {_MAX_BYTES // 1024 // 1024} MB (got {len(data) // 1024 // 1024} MB)")

    content = f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"

    doc = KBDocument(
        category=category,
        title=title.strip(),
        content=content,
        created_by=user.email,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    rag_core._suggestions_cache.clear()  # new doc changes the category's doc-id set
    return {
        "id":         doc.id,
        "category":   doc.category,
        "title":      doc.title,
        "content":    doc.content,
        "created_by": doc.created_by,
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat(),
    }
