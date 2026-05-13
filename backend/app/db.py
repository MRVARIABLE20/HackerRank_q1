"""DB session + bootstrap."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings
from .models import Base

_settings = get_settings()
_db_url = _settings.database_url

# For SQLite with a relative path, anchor it to the backend directory so the
# DB location does not depend on the process's CWD.
if _db_url.startswith("sqlite:///./"):
    backend_dir = Path(__file__).parent.parent.resolve()
    rel = _db_url.removeprefix("sqlite:///./")
    abs_path = (backend_dir / rel).as_posix()
    _db_url = f"sqlite:///{abs_path}"

_connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
_engine = create_engine(_db_url, pool_pre_ping=True, future=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    Base.metadata.create_all(_engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    s = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def get_session() -> Iterator[Session]:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
