from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class DueDiligenceRequest(BaseModel):
    plot_id: int
    lang: str = "bn"


class DueDiligenceFinding(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rule_id: str
    severity: str
    title: str
    description: str


class DueDiligenceReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    risk_level: str
    risk_score: int
    summary_bn: str
    summary_en: str
    key_findings: list[DueDiligenceFinding] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    disclaimer: str
    source: str = "template"  # "llm" | "template"
    generated_at: str
    fact_hash: str
