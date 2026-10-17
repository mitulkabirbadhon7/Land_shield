from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class KhatianOwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    share: float = 1.0


class LineageNodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    survey_type: str
    khatian_no: str
    dag_no: str
    area_decimal: float
    parent_id: int | None = None
    created_at: str | None = None
    owners: list[KhatianOwnerOut] = Field(default_factory=list)


class LineageEdgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    source: int = Field(..., alias="from")
    to: int
    type: str


class LineageIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sub_code: str
    rule_id: str = "R7"
    severity: str = "HIGH"
    message_bn: str
    message_en: str
    details: dict[str, Any] = Field(default_factory=dict)


class LineageGraphOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    lineage_available: bool
    nodes: list[LineageNodeOut] = Field(default_factory=list)
    edges: list[LineageEdgeOut] = Field(default_factory=list)
    issues: list[LineageIssueOut] = Field(default_factory=list)
    status: str = "ALIGNED"
