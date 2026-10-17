from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.mutation import Mutation
from app.models.plot import Plot
from app.services.holdings import TOLERANCE, record_holdings
from app.services.pipeline.base import AnalysisContext, Finding, Layer


def _normalize_dt(val: datetime | str | None) -> datetime:
    if val is None:
        return datetime.now(timezone.utc)
    if isinstance(val, str):
        val = datetime.fromisoformat(val)
    if val.tzinfo is None:
        return val.replace(tzinfo=timezone.utc)
    return val.astimezone(timezone.utc)


def stalled_mutations(
    db: Session,
    plot: Plot,
    mutation_days: int | None = None,
    now: datetime | None = None,
) -> list[Mutation]:
    """Find mutations on the plot that have been in AUTO_CHECKED or UNDER_REVIEW longer than mutation_days."""
    limit_days = mutation_days if mutation_days is not None else settings.mutation_days
    cutoff = _normalize_dt(now) - timedelta(days=limit_days)

    stmt = select(Mutation).where(
        Mutation.plot_id == plot.id,
        Mutation.state.in_(["AUTO_CHECKED", "UNDER_REVIEW"]),
    )
    mutations = db.scalars(stmt).all()

    stalled: list[Mutation] = []
    for m in mutations:
        dt = _normalize_dt(m.updated_at or m.created_at)
        if dt <= cutoff:
            stalled.append(m)

    return stalled


def reconcile_plot(
    db: Session,
    plot: Plot,
    now: datetime | None = None,
) -> list[tuple[str, str, dict[str, Any]]]:
    """Audit cross-office alignment between AC Land records and Sub-Registry deed ledger.

    Sub-codes:
    - OWNER_MISMATCH: plot.current_owner_id differs from largest record holder (ties skipped)
    - MUTATION_STALLED: active mutation stalled in AUTO_CHECKED/UNDER_REVIEW > mutation_days
    - AREA_NOT_CONSERVED: sum of record holdings differs from plot.area_decimal by > TOLERANCE
    """
    issues: list[tuple[str, str, dict[str, Any]]] = []
    now_dt = _normalize_dt(now)
    rec = record_holdings(db, plot, as_of=now_dt)

    # 1. OWNER_MISMATCH
    positive = {pid: area for pid, area in rec.items() if area > TOLERANCE}
    if positive:
        max_area = max(positive.values())
        top_candidates = [pid for pid, area in positive.items() if abs(area - max_area) <= TOLERANCE]
        # Only evaluate if there is a unique largest record holder (ties skipped per TRD 6C)
        if len(top_candidates) == 1:
            top_owner_id = top_candidates[0]
            if plot.current_owner_id != top_owner_id:
                issues.append((
                    "OWNER_MISMATCH",
                    f"Plot recorded owner ({plot.current_owner_id}) differs from mutation-derived owner ({top_owner_id})",
                    {"expected_owner_id": top_owner_id, "actual_owner_id": plot.current_owner_id},
                ))

    # 2. MUTATION_STALLED
    stalled = stalled_mutations(db, plot, settings.mutation_days, now_dt)
    for m in stalled:
        issues.append((
            "MUTATION_STALLED",
            f"Mutation application #{m.id} has been stalled in status {m.state} beyond statutory time limit",
            {"mutation_id": m.id, "state": m.state},
        ))

    # 3. AREA_NOT_CONSERVED
    sum_holdings = sum(rec.values())
    if abs(sum_holdings - float(plot.area_decimal)) > TOLERANCE:
        issues.append((
            "AREA_NOT_CONSERVED",
            f"Record holdings ({round(sum_holdings, 4)} decimals) do not equal documented plot area ({plot.area_decimal} decimals)",
            {"holdings_sum": round(sum_holdings, 4), "plot_area": float(plot.area_decimal)},
        ))

    return issues


class ReconcileLayer(Layer):
    name = "reconcile"
    enabled_flag = "feature_reconcile"

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        findings: list[Finding] = []
        issues = reconcile_plot(ctx.db, ctx.plot, now=ctx.now)

        for sub_code, msg, _details in issues:
            findings.append(
                Finding(
                    layer="reconcile",
                    rule_id="R8",
                    sub_code=sub_code,
                    severity="HIGH",
                    weight=35,
                    decisive=True,
                    reasons=[msg],
                )
            )

        return findings
