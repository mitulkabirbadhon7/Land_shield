from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class IngestDraftOut(BaseModel):
    id: int
    document_type: str
    image_ref: str
    extracted: dict[str, Any]
    confidence: dict[str, Any]
    status: str
    reviewer_id: int | None = None
    created_at: str


class RejectDraftRequest(BaseModel):
    reason: str = Field(..., min_length=2, max_length=500)


class IngestApprovalResponse(BaseModel):
    status: str
    draft_id: int
    created_khatian_id: int | None = None
    prefill_deed_payload: dict[str, Any] | None = None
    message: str
