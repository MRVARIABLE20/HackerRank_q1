"""Serves raw files from seeding_data/ so the frontend can embed PDFs in iframes.

All seeded files are publicly available documents (Gutenberg, arXiv, Vega datasets)
so no authentication is required for this endpoint.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/seed-files", tags=["seed-files"])

# seeding_data/ is three levels up from backend/app/routers/
_SEED_DATA_DIR = Path(__file__).parent.parent.parent.parent / "seeding_data"


@router.get("/{file_path:path}")
async def serve_seed_file(file_path: str) -> FileResponse:
    """Return a raw file from seeding_data/. Used by the frontend to embed PDFs and videos."""
    # Prevent path traversal
    resolved = (_SEED_DATA_DIR / file_path).resolve()
    if not str(resolved).startswith(str(_SEED_DATA_DIR.resolve())):
        raise HTTPException(400, "Invalid path")
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(
        str(resolved),
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )
