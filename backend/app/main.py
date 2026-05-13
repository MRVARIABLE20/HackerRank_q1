"""FastAPI entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db
from .seed import seed_if_empty
from .routers import admin_docs as admin_docs_router
from .routers import audit as audit_router
from .routers import auth as auth_router
from .routers import chat as chat_router
from .routers import kb_docs as kb_docs_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
_settings = get_settings()

app = FastAPI(title="Enterprise RAG Intelligence", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    seed_if_empty()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "env": _settings.app_env}


app.include_router(auth_router.router)
app.include_router(chat_router.router)
app.include_router(audit_router.router)
app.include_router(admin_docs_router.router)
app.include_router(kb_docs_router.router)
