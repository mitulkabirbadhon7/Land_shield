from __future__ import annotations
from pydantic import BaseModel


class SubRegistryOut(BaseModel):
    code: str
    name: str


class MetaOut(BaseModel):
    deed_types: list[str]
    sub_registries: list[SubRegistryOut]
