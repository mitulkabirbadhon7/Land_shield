from __future__ import annotations
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class MerkleRunRequest(BaseModel):
    date: str | None = Field(default=None, description="Date in YYYY-MM-DD format (defaults to UTC today)")


class MerkleRootOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: str
    root: str
    entry_count: int
    max_entry_id: int
    signature: str
    status: str = "MATCH"
    created_at: str


class MerkleVerifyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: str
    status: str
    root_match: bool
    sig_valid: bool
    stored_root: str
    recomputed_root: str | None = None
    entry_count: int | None = None
    max_entry_id: int | None = None
    signature: str | None = None
    detail: str | None = None
    created_at: str | None = None
