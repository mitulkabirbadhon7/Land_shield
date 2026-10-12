from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session

from app.config import settings
from app.models.plot import Plot


@dataclass
class Finding:
    layer: str          # "integrity" | "rules" | "lineage" | "reconcile" | "ml"
    rule_id: str        # e.g. "R1", "R2", "R5"
    severity: str       # "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    weight: int
    decisive: bool      # True = affects score and can block; False = advisory
    reasons: list[str] = field(default_factory=list)
    deed_no: str | None = None


@dataclass
class DealSubject:
    seller_id: int
    buyer_id: int
    area_sold: float
    at: datetime | str
    seq: int | None = None
    deed_no: str | None = None


class AnalysisContext:
    def __init__(
        self,
        db: Session,
        plot: Plot,
        now: datetime | None = None,
        proposed: DealSubject | None = None,
        signer_key: Any = None,
    ) -> None:
        self.db = db
        self.plot = plot
        self.now = now or datetime.now(timezone.utc)
        self.proposed = proposed
        self.signer_key = signer_key

    @property
    def mode(self) -> str:
        """Evaluation mode: PROPOSED for pre-registration checks; PLOT for history assessment."""
        return "PROPOSED" if self.proposed is not None else "PLOT"


class Layer:
    name: str = ""
    enabled_flag: str = ""

    def is_enabled(self) -> bool:
        if not self.enabled_flag:
            return True
        return bool(getattr(settings, self.enabled_flag.lower(), True))

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        raise NotImplementedError
