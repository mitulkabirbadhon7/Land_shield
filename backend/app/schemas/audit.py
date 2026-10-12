from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: int | None = None
    action: str
    entity: str
    entity_id: int | None = None
    at: datetime
    detail: str | None = None
