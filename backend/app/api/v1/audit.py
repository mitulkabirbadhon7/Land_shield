from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    page: int | None = Query(None, ge=1),
    size: int | None = Query(None, ge=1, le=100),
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    """Retrieve immutable system audit log entries with pagination (Admin only)."""
    if page is not None:
        effective_limit = size or limit
        effective_offset = (page - 1) * effective_limit
    else:
        effective_limit = limit
        effective_offset = offset

    stmt = (
        select(AuditLog)
        .order_by(AuditLog.at.desc(), AuditLog.id.desc())
        .offset(effective_offset)
        .limit(effective_limit)
    )
    return list(db.scalars(stmt).all())
