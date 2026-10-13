from __future__ import annotations
from pydantic import BaseModel, ConfigDict


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    masked_nid_hash: str | None = None
    is_synthetic: bool = True
