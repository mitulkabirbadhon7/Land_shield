from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class RiskFindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rule_id: str
    sub_code: str | None = None
    layer: str
    severity: str
    deed_no: str | None = None
    text: str


class MutationSummary(BaseModel):
    total_deeds: int = 0
    mutated_deeds: int = 0
    pending_mutations: int = 0
    missing_mutations: int = 0


class RiskReportOut(BaseModel):
    mode: str = "PLOT"
    score: int
    level: str
    has_critical: bool
    findings: list[RiskFindingOut] = Field(default_factory=list)
    chain_ok: bool = True
    flags: list[str] = Field(default_factory=list)
    mutation_summary: MutationSummary = Field(default_factory=MutationSummary)


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deed_id: int | None = None
    plot_id: int
    rule_id: str
    severity: str
    reasons: list[str] = Field(default_factory=list)
    status: str
    created_at: datetime


class AlertUpdate(BaseModel):
    status: str
