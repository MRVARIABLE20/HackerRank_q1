"""Admin/auditor: paginated audit log access."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..auth import CurrentUser, require_roles
from ..db import get_session
from ..models import AuditLog
from ..schemas import AuditEntry

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=List[AuditEntry])
def list_audit(
    limit: int = Query(50, le=200),
    user: CurrentUser = Depends(require_roles("admin", "auditor")),
    session: Session = Depends(get_session),
) -> List[AuditEntry]:
    rows = session.query(AuditLog).order_by(desc(AuditLog.ts)).limit(limit).all()
    return [
        AuditEntry(
            ts=r.ts.isoformat(),
            user_email=r.user_email,
            user_roles=r.user_roles or [],
            query=r.query,
            retrieved_doc_ids=r.retrieved_doc_ids or [],
            denied_doc_count=r.denied_doc_count,
            confidence=r.confidence,
            trace_id=r.trace_id,
        )
        for r in rows
    ]
