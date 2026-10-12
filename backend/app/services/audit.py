from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User


def log(
    db: Session,
    actor: User | int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    detail: str | None = None,
) -> AuditLog:
    """Record an immutable audit log entry into the database."""
    actor_id: int | None = None
    if isinstance(actor, User):
        actor_id = actor.id
    elif isinstance(actor, int):
        actor_id = actor

    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail=detail,
        at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.flush()
    return entry
