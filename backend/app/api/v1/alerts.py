from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models.alert import Alert
from app.models.user import User
from app.schemas.risk import AlertOut, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])

ALLOWED_ALERT_STATUSES = {"OPEN", "ACK", "RESOLVED", "DISMISSED"}


@router.get("", response_model=list[AlertOut])
def get_alerts(
    status: str | None = Query(None),
    severity: str | None = Query(None),
    current_user: User = Depends(require_role("officer", "admin")),
    db: Session = Depends(get_db),
) -> list[Alert]:
    """Retrieve system alerts with optional status and severity filters (Officer/Admin only)."""
    stmt = select(Alert)
    if status:
        stmt = stmt.where(Alert.status == status.upper())
    if severity:
        stmt = stmt.where(Alert.severity == severity.upper())

    stmt = stmt.order_by(Alert.created_at.desc())
    return list(db.scalars(stmt).all())


@router.patch("/{alert_id}", response_model=AlertOut)
def update_alert_status(
    alert_id: int,
    payload: AlertUpdate,
    current_user: User = Depends(require_role("officer", "admin")),
    db: Session = Depends(get_db),
) -> Alert:
    """Update status of an alert (e.g. to ACK or RESOLVED) (Officer/Admin only)."""
    target_status = payload.status.strip().upper()
    if target_status not in ALLOWED_ALERT_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid alert status '{payload.status}'. Allowed values: {sorted(ALLOWED_ALERT_STATUSES)}",
        )

    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = target_status
    db.commit()
    db.refresh(alert)
    return alert
