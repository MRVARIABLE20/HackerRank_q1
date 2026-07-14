"""Bootstrap seed: creates admin user and KB documents on first run.

Called automatically from app startup — safe to call multiple times (idempotent).
No manual steps needed when moving the project to a new machine.

KB documents are seeded from the seeding_data/ folder in the project root.
Supported formats: .txt  .csv  .tsv  .json  .md  .pdf (PyMuPDF text extraction)
PNG/JPG are stored as base64 data URLs so the frontend can render them as <img> elements.
MP4/WebM/OGV are stored as __VIDEO__: file-refs served via /seed-files/.
"""
from __future__ import annotations

import base64
import json
import logging
import mimetypes
from pathlib import Path

from .auth import hash_password
from .db import SessionLocal
from .models import KBDocument, Role, User
from .schemas import KB_CATEGORIES

log = logging.getLogger(__name__)

ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "admin123"
ADMIN_FULL_NAME = "System Administrator"

# Auto-seeded docs are tagged with this author so they can be cleanly
# re-synced without ever touching documents a real user or admin added.
SEED_CREATED_BY = "system@seed"

# seeding_data/ lives at project root: three levels up from backend/app/seed.py
_SEED_DATA_DIR = Path(__file__).parent.parent.parent / "seeding_data"

FOLDER_TO_CATEGORY: list[tuple[str, str]] = [
    ("01_naive_rag",         "01 Naive RAG"),
    ("02_bm25_rag",          "02 BM25 RAG"),
    ("03_hybrid_rag",        "03 Hybrid RAG"),
    ("04_self_rag",          "04 Self-RAG"),
    ("05_corrective_rag",    "05 Corrective RAG"),
    ("06_graph_rag",         "06 Graph RAG"),
    ("07_speculative_rag",   "07 Speculative RAG"),
    ("08_rag_fusion",        "08 RAG-Fusion"),
    ("09_adaptive_rag",      "09 Adaptive RAG"),
    ("10_agentic_rag",       "10 Agentic RAG"),
    ("11_multihop_rag",      "11 Multi-hop RAG"),
    ("12_sql_rag",           "12 SQL RAG"),
    ("13_multimodal_rag",    "13 Multimodal RAG"),
    ("14_modular_rag",       "14 Modular RAG"),
]

TEXT_EXTENSIONS = {".txt", ".csv", ".tsv", ".json", ".md"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogv", ".ogg"}
MAX_CONTENT_CHARS = 49_000  # soft limit for extracted text; images stored as data URLs

# Magic prefixes stored in doc content so the frontend can render the right player.
# PDF:   __PDF__:folder_name/filename.pdf\n\n{extracted text}
# Video: __VIDEO__:folder_name/filename.mp4
PDF_REF_PREFIX = "__PDF__:"
VIDEO_REF_PREFIX = "__VIDEO__:"


# ── File readers ──────────────────────────────────────────────────────────────

def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _read_json(path: Path) -> str:
    with open(path, encoding="utf-8") as f:
        return json.dumps(json.load(f), indent=2)


def _read_pdf(path: Path) -> str:
    """Extract text layer from a PDF using PyMuPDF (fitz). Truncates to MAX_CONTENT_CHARS."""
    try:
        import fitz  # pymupdf
    except ImportError:
        log.warning("Seed: pymupdf not installed — skipping PDF %s", path.name)
        return ""

    try:
        doc = fitz.open(str(path))
        pages_text: list[str] = []
        for page_num, page in enumerate(doc, 1):
            text = page.get_text().strip()
            if text:
                pages_text.append(f"--- Page {page_num} ---\n{text}")
        doc.close()
        full_text = "\n\n".join(pages_text)
        if len(full_text) > MAX_CONTENT_CHARS:
            full_text = full_text[:MAX_CONTENT_CHARS] + "\n\n[Content truncated — full PDF available in seeding_data/]"
        return full_text
    except Exception as exc:
        log.warning("Seed: failed to read PDF %s — %s", path.name, exc)
        return ""


def _read_file(path: Path, folder_name: str = "") -> str:
    if path.suffix.lower() == ".json":
        return _read_json(path)
    if path.suffix.lower() == ".pdf":
        extracted = _read_pdf(path)
        # Prefix with a file-ref so the frontend can render an <iframe>
        # while still storing the extracted text for RAG/search.
        ref = f"{folder_name}/{path.name}" if folder_name else path.name
        return f"{PDF_REF_PREFIX}{ref}\n\n{extracted}"
    return _read_text(path)


# ── Title helpers ─────────────────────────────────────────────────────────────

_FORMAT_LABEL: dict[str, str] = {
    ".tsv": "TSV",
    ".csv": "CSV",
    ".json": "JSON",
    ".png": "PNG",
    ".jpg": "JPG",
    ".jpeg": "JPG",
    ".pdf": "PDF",
    ".mp4": "MP4",
    ".webm": "WebM",
    ".ogv": "OGV",
    ".ogg": "OGG",
}

def _file_title(path: Path) -> str:
    """Human title for a file.  TSV / image files get a format suffix to avoid
    collisions when the same stem exists as another extension (e.g. penguins.csv
    vs penguins.tsv, or when two images share a base name).

    NOTE: periods in the stem (e.g. arxiv version 2103.00020) are preserved so
    titles stay stable across seed runs — changing this format creates duplicates."""
    base = path.stem.replace("_", " ").title()
    ext = path.suffix.lower()
    label = _FORMAT_LABEL.get(ext)
    # Always disambiguate TSV, image, and video formats; leave TXT/MD/CSV/JSON/PDF bare
    if label and ext in {".tsv", ".png", ".jpg", ".jpeg", ".mp4", ".webm", ".ogv", ".ogg"}:
        return f"{base} ({label})"
    return base


def _image_data_url(path: Path) -> str:
    """Return a base64 data URL for an image file (PNG/JPG/JPEG).
    The frontend renders this directly as an <img> element."""
    mime, _ = mimetypes.guess_type(str(path))
    mime = mime or ("image/png" if path.suffix.lower() == ".png" else "image/jpeg")
    raw = path.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _collect_disk_titles() -> set[str]:
    """Return the set of titles that would be seeded from seeding_data/ right now."""
    titles: set[str] = set()
    if not _SEED_DATA_DIR.exists():
        return titles
    all_ext = TEXT_EXTENSIONS | {".pdf"} | IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
    for folder_name, category in FOLDER_TO_CATEGORY:
        if category not in KB_CATEGORIES:
            continue
        folder_path = _SEED_DATA_DIR / folder_name
        if not folder_path.exists():
            continue
        for f in folder_path.glob("*"):
            if f.suffix.lower() in all_ext:
                titles.add(_file_title(f))
    return titles


# ── Main entry point ──────────────────────────────────────────────────────────

def seed_if_empty() -> None:
    """Idempotent: creates admin user + roles + KB docs.

    Seed docs are tagged with SEED_CREATED_BY so they can be re-synced without
    ever touching documents a real user or admin added.

    Behaviour:
    - First run under this scheme → clears any legacy admin-authored seed rows
      (one-time) and inserts all supported files from seeding_data/.
    - Seed docs already match seeding_data/ → only refreshes stale formats in place.
    - Seed files added/removed/renamed → re-syncs seed-owned docs (force_reseed).
    """
    session = SessionLocal()
    try:
        # ── Admin role + user ────────────────────────────────────────────────
        admin_role = session.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(name="admin")
            session.add(admin_role)
            session.flush()
            log.info("Seed: created role 'admin'")

        user_obj = session.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not user_obj:
            user_obj = User(
                email=ADMIN_EMAIL,
                full_name=ADMIN_FULL_NAME,
                password_hash=hash_password(ADMIN_PASSWORD),
                department="general",
                roles=[admin_role],
            )
            session.add(user_obj)
            log.info("Seed: created admin user %s (password: %s)", ADMIN_EMAIL, ADMIN_PASSWORD)
        else:
            if admin_role not in user_obj.roles:
                user_obj.roles.append(admin_role)

        session.commit()

        # ── KB documents ─────────────────────────────────────────────────────
        if not _SEED_DATA_DIR.exists():
            log.warning("Seed: seeding_data/ not found at %s — skipping KB seed", _SEED_DATA_DIR)
            return

        disk_titles = _collect_disk_titles()
        if not disk_titles:
            log.info("Seed: no seedable files found in seeding_data/ — skipping")
            return

        # Titles of docs previously written by the auto-seeder (current scheme).
        seed_titles = {
            row.title for row in
            session.query(KBDocument).filter(KBDocument.created_by == SEED_CREATED_BY).all()
        }

        if seed_titles and seed_titles == disk_titles:
            # In sync — just make sure stored formats are current (cheap, in-place).
            _migrate_stale_images(session)
            _migrate_stale_pdfs(session)
            log.info("Seed: %d seed documents already in sync with seeding_data/", len(seed_titles))
            return

        # Fresh DB, first run under this scheme, or seed files changed → clean reseed.
        seeded = force_reseed(session)
        log.info("Seed: synced seed documents (%d now present)", seeded)

    except Exception:
        session.rollback()
        log.exception("Seed failed — server will continue without seed data")
    finally:
        session.close()


# ── Doc-building + insert helpers ─────────────────────────────────────────────

def _build_doc_content(file: Path, folder_name: str) -> str | None:
    """Return the content string to store for a file, or None if it should be skipped.

    - images  → base64 data URL (rendered as <img>), never truncated
    - pdf     → "__PDF__:folder/file.pdf\\n\\n{extracted text}" (rendered as <iframe>)
    - text    → raw text, truncated to MAX_CONTENT_CHARS
    """
    ext = file.suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        try:
            return _image_data_url(file)  # must NOT truncate — would corrupt base64
        except Exception as exc:
            log.warning("Seed: failed to encode image %s — %s", file.name, exc)
            return None
    if ext == ".pdf":
        content = _read_file(file, folder_name)  # length already bounded in _read_pdf
        return content if content and content.strip() else None
    if ext in VIDEO_EXTENSIONS:
        # Store only the path ref — video is served directly from /seed-files/
        ref = f"{folder_name}/{file.name}" if folder_name else file.name
        return f"{VIDEO_REF_PREFIX}{ref}"
    if ext in TEXT_EXTENSIONS:
        content = _read_file(file, folder_name)
        if not content or not content.strip():
            return None
        return content[:MAX_CONTENT_CHARS] if len(content) > MAX_CONTENT_CHARS else content
    return None


def _insert_all_from_disk(session, existing_titles: set[str]) -> int:
    """Insert every supported seeding_data file whose title isn't already present.
    Seed docs are tagged with SEED_CREATED_BY. Returns the number inserted."""
    supported = TEXT_EXTENSIONS | IMAGE_EXTENSIONS | {".pdf"} | VIDEO_EXTENSIONS
    seeded = 0
    for folder_name, category in FOLDER_TO_CATEGORY:
        if category not in KB_CATEGORIES:
            continue
        folder_path = _SEED_DATA_DIR / folder_name
        if not folder_path.exists():
            log.debug("Seed: folder %s not found — skipping", folder_path)
            continue
        for file in sorted(folder_path.glob("*")):
            if file.suffix.lower() not in supported:
                continue
            title = _file_title(file)
            if title in existing_titles:
                continue
            content = _build_doc_content(file, folder_name)
            if content is None:
                log.warning("Seed: %s produced no content — skipping", file.name)
                continue
            session.add(KBDocument(
                category=category,
                title=title,
                content=content,
                created_by=SEED_CREATED_BY,
            ))
            existing_titles.add(title)
            seeded += 1
    session.commit()
    return seeded


def force_reseed(session) -> int:
    """Delete every auto-seeded doc and reinsert fresh from seeding_data/.

    Docs added by real users or admins are preserved. Returns the number inserted.
    Works whether triggered by startup or the admin 'Reseed' button."""
    # One-time legacy cleanup: before anything was seeded under the current scheme,
    # auto-seed rows were authored by admin@gmail.com (and drifted into duplicates
    # across old/new title formats). Clear those exactly once — real admin-added
    # docs are indistinguishable at this point, but at setup time there are none.
    has_new_scheme = (
        session.query(KBDocument)
        .filter(KBDocument.created_by == SEED_CREATED_BY)
        .first() is not None
    )
    if not has_new_scheme:
        legacy = (
            session.query(KBDocument)
            .filter(KBDocument.created_by == ADMIN_EMAIL)
            .delete(synchronize_session=False)
        )
        session.commit()
        if legacy:
            log.info("Reseed: removed %d legacy admin-authored seed docs (one-time cleanup)", legacy)

    deleted = (
        session.query(KBDocument)
        .filter(KBDocument.created_by == SEED_CREATED_BY)
        .delete(synchronize_session=False)
    )
    session.commit()
    if deleted:
        log.info("Reseed: deleted %d existing seed docs", deleted)
    seeded = _insert_all_from_disk(session, set())
    log.info("Reseed: inserted %d fresh seed docs from seeding_data/", seeded)
    return seeded


# ── In-place format migrations (used when titles already match) ───────────────

def _migrate_stale_images(session) -> None:
    """Update any seed image doc that still holds a text stub instead of a data URL."""
    image_files: dict[str, Path] = {}
    if _SEED_DATA_DIR.exists():
        for folder_name, category in FOLDER_TO_CATEGORY:
            if category not in KB_CATEGORIES:
                continue
            folder_path = _SEED_DATA_DIR / folder_name
            if not folder_path.exists():
                continue
            for file in folder_path.glob("*"):
                if file.suffix.lower() in IMAGE_EXTENSIONS:
                    image_files[_file_title(file)] = file

    if not image_files:
        return

    updated = 0
    for row in session.query(KBDocument).filter(KBDocument.title.in_(list(image_files.keys()))).all():
        if row.content.startswith("data:image/"):
            continue
        file = image_files.get(row.title)
        if not file:
            continue
        try:
            row.content = _image_data_url(file)
            session.add(row)
            updated += 1
        except Exception as exc:
            log.warning("Seed: failed to migrate image %s — %s", row.title, exc)

    if updated:
        session.commit()
        log.info("Seed: migrated %d image docs to base64 data URLs", updated)


def _migrate_stale_pdfs(session) -> None:
    """Add the __PDF__:path prefix to existing PDF docs that are missing it."""
    pdf_files: dict[str, tuple[str, str]] = {}
    if _SEED_DATA_DIR.exists():
        for folder_name, category in FOLDER_TO_CATEGORY:
            if category not in KB_CATEGORIES:
                continue
            folder_path = _SEED_DATA_DIR / folder_name
            if not folder_path.exists():
                continue
            for f in folder_path.glob("*.pdf"):
                pdf_files[_file_title(f)] = (folder_name, f.name)

    if not pdf_files:
        return

    updated = 0
    for row in session.query(KBDocument).filter(KBDocument.title.in_(list(pdf_files.keys()))).all():
        if row.content.startswith(PDF_REF_PREFIX):
            continue
        folder_name, filename = pdf_files[row.title]
        row.content = f"{PDF_REF_PREFIX}{folder_name}/{filename}\n\n{row.content}"
        session.add(row)
        updated += 1

    if updated:
        session.commit()
        log.info("Seed: migrated %d PDF docs to include file-ref prefix", updated)
