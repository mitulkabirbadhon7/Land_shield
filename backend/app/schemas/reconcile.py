from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class ReconcileIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sub_code: str
    severity: str = "HIGH"
    rule_id: str = "R8"
    message_bn: str
    message_en: str
    details: dict[str, Any] = Field(default_factory=dict)


class StalledMutationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mutation_id: int
    state: str
    days_stalled: int
    created_at: str
    updated_at: str | None = None


class PlotReconcileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    dag_no: str
    mouza: str
    upazila: str
    district: str
    area_decimal: float
    current_owner_id: int | None
    record_owner_id: int | None
    record_holdings: dict[str, float]
    ledger_holdings: dict[str, float]
    stalled_mutations: list[StalledMutationOut] = Field(default_factory=list)
    issues: list[ReconcileIssueOut]
    status: str = "ALIGNED"
    is_clean: bool


class ReconcileSummaryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plot_id: int
    dag_no: str
    mouza: str
    upazila: str
    district: str
    area_decimal: float
    issues_count: int
    sub_codes: list[str]


class ReconcileListOut(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ReconcileSummaryItem]
