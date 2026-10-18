from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class MutationCreate(BaseModel):
    deed_id: int
    applicant_id: int | None = None
    auto_check: bool = True


class MutationTransition(BaseModel):
    to_state: str
    note: str | None = None


class MutationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_state: str
    to_state: str
    actor_id: int | None = None
    note: str | None = None
    at: datetime


class MutationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deed_id: int
    deed_no: str | None = None
    plot_id: int
    state: str
    applicant_id: int | None = None
    applicant_name: str | None = None
    officer_id: int | None = None
    requires_override: bool = False
    created_at: datetime
    updated_at: datetime
    events: list[MutationEventOut] = Field(default_factory=list)
    auto_check_json: dict[str, Any] | None = None
