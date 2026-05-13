"""Pydantic schemas for API contracts."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=128)
    department: str = Field(default="general", max_length=64)
    role: str = Field(default="intern")  # intern | analyst | manager


class SignupResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    roles: list[str]
    department: str
    full_name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    roles: List[str]
    department: str


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    stream: bool = False


class Citation(BaseModel):
    doc_id: str
    source_uri: str
    page: Optional[int] = None
    snippet: str
    score: float
    classification: str
    department: str


class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    confidence: float = 0.0
    trace_id: str
    router_decision: dict = {}
    verifier_verdict: dict = {}
    denied_doc_count: int = 0


class AuditEntry(BaseModel):
    ts: str
    user_email: str
    user_roles: List[str]
    query: str
    retrieved_doc_ids: List[str]
    denied_doc_count: int
    confidence: float
    trace_id: str


# --- Knowledge-base (admin-curated docs) ---

KB_CATEGORIES = [
    "pdfs",            # PDFs & internal documents
    "sql_csv",         # SQL/CSV databases
    "json_logs",       # JSON logs & audit trails
    "technical",       # Technical reports
    "compliance",      # Compliance records
    "operational",     # Operational datasets
]


class KBDocCreate(BaseModel):
    category: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=50000)


class KBDocUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


class KBDocOut(BaseModel):
    id: int
    category: str
    title: str
    content: str
    created_by: str
    created_at: str
    updated_at: str
