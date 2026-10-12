from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session

from app.errors import FraudBlocked
from app.models.alert import Alert
from app.models.audit import AuditLog
from app.models.plot import Plot
from app.services.pipeline.base import AnalysisContext, DealSubject
from app.services.pipeline.engine import assess
from app.services.pipeline.registry import get_layers


def pre_register_check(db: Session, proposed: dict[str, Any]) -> None:
    """Run fraud detection pipeline on a proposed deed before registration.

    If blocked: creates Alert and AuditLog rows, commits them so they persist,
    and raises FraudBlocked(report), which maps to HTTP 409.
    """
    plot = db.get(Plot, proposed["plot_id"])
    if plot is None:
        return

    now = datetime.now(timezone.utc)
    subject = DealSubject(
        seller_id=proposed["seller_id"],
        buyer_id=proposed["buyer_id"],
        area_sold=float(proposed["area_sold"]),
        at=now,
    )

    ctx = AnalysisContext(
        db=db,
        plot=plot,
        now=now,
        proposed=subject,
        signer_key=proposed.get("signer_key"),
    )
    report = assess(ctx, get_layers())

    if report.get("blocked"):
        critical_findings = [f for f in report["findings"] if f.get("severity") == "CRITICAL"]
        rule_ids = sorted(list(set(f["rule_id"] for f in critical_findings)))
        all_reasons = [r for f in critical_findings for r in f.get("reasons", [])]

        alert = Alert(
            plot_id=plot.id,
            rule_id=",".join(rule_ids) if rule_ids else "FRAUD_BLOCK",
            severity="CRITICAL",
            reasons=all_reasons,
            status="OPEN",
        )
        audit = AuditLog(
            action="PRE_REGISTER_BLOCKED",
            entity="plot",
            entity_id=plot.id,
            detail=f"Registration blocked by critical fraud rules: {','.join(rule_ids)}",
        )
        db.add_all([alert, audit])
        db.commit()

        raise FraudBlocked(report)
