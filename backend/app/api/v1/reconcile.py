from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models.plot import Plot
from app.models.user import User
from app.schemas.reconcile import (
    PlotReconcileOut,
    ReconcileIssueOut,
    ReconcileListOut,
    ReconcileSummaryItem,
    StalledMutationOut,
)
from app.services.fraud.explain import TEMPLATES
from app.services.holdings import largest_holder, ledger_holdings, record_holdings
from app.services.reconcile import _normalize_dt, reconcile_plot, stalled_mutations

router = APIRouter(prefix="/reconcile", tags=["reconciliation"])


@router.get("", response_model=ReconcileListOut)
def list_reconciliation_discrepancies(
    district: str | None = Query(None, description="Filter by district name"),
    type: str | None = Query(None, alias="type", description="Filter by discrepancy type"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=50, description="Items per page"),
    current_user: User = Depends(require_role("officer", "admin")),
    db: Session = Depends(get_db),
) -> ReconcileListOut:
    """Paginated list of land plots with flagged cross-office discrepancies (Officer/Admin only)."""
    stmt = select(Plot).order_by(Plot.id)
    if district:
        stmt = stmt.where(Plot.district.ilike(f"%{district.strip()}%"))

    plots = db.scalars(stmt).all()
    flagged_items: list[ReconcileSummaryItem] = []
    now = datetime.now(timezone.utc)

    for p in plots:
        issues = reconcile_plot(db, p, now=now)
        if not issues:
            continue

        sub_codes = [issue[0] for issue in issues]
        if type and type.upper() not in sub_codes:
            continue

        flagged_items.append(
            ReconcileSummaryItem(
                plot_id=p.id,
                dag_no=p.dag_no,
                mouza=p.mouza,
                upazila=p.upazila,
                district=p.district,
                area_decimal=float(p.area_decimal),
                issues_count=len(issues),
                sub_codes=sub_codes,
            )
        )

    total = len(flagged_items)
    start = (page - 1) * size
    end = start + size
    paginated_items = flagged_items[start:end]

    return ReconcileListOut(
        total=total,
        page=page,
        page_size=size,
        items=paginated_items,
    )


@router.get("/{plot_id}", response_model=PlotReconcileOut)
def get_plot_reconciliation(
    plot_id: int,
    current_user: User = Depends(require_role("officer", "admin")),
    db: Session = Depends(get_db),
) -> PlotReconcileOut:
    """Detailed cross-office reconciliation audit for a specific plot (Officer/Admin only)."""
    plot = db.get(Plot, plot_id)
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")

    now = datetime.now(timezone.utc)
    raw_issues = reconcile_plot(db, plot, now=now)
    rec = record_holdings(db, plot, as_of=now)
    led = ledger_holdings(db, plot)

    top_record_owner = largest_holder(rec)

    issues_out: list[ReconcileIssueOut] = []
    for sub_code, default_msg, details in raw_issues:
        tmpl = TEMPLATES.get(sub_code, {})
        msg_en = tmpl.get("en", default_msg)
        msg_bn = tmpl.get("bn", default_msg)

        issues_out.append(
            ReconcileIssueOut(
                sub_code=sub_code,
                severity="HIGH",
                rule_id="R8",
                message_bn=msg_bn,
                message_en=msg_en,
                details=details,
            )
        )

    raw_stalled = stalled_mutations(db, plot, now=now)
    stalled_out: list[StalledMutationOut] = []
    for sm in raw_stalled:
        dt = _normalize_dt(sm.updated_at or sm.created_at)
        days = max(0, (now - dt).days)
        stalled_out.append(
            StalledMutationOut(
                mutation_id=sm.id,
                state=sm.state,
                days_stalled=days,
                created_at=sm.created_at.isoformat() if sm.created_at else "",
                updated_at=sm.updated_at.isoformat() if sm.updated_at else None,
            )
        )

    # Convert holding keys to strings for JSON schema serialization
    rec_str = {str(k): v for k, v in rec.items()}
    led_str = {str(k): v for k, v in led.items()}

    return PlotReconcileOut(
        plot_id=plot.id,
        dag_no=plot.dag_no,
        mouza=plot.mouza,
        upazila=plot.upazila,
        district=plot.district,
        area_decimal=float(plot.area_decimal),
        current_owner_id=plot.current_owner_id,
        record_owner_id=top_record_owner,
        record_holdings=rec_str,
        ledger_holdings=led_str,
        stalled_mutations=stalled_out,
        issues=issues_out,
        status="DISCREPANCY" if len(issues_out) > 0 else "ALIGNED",
        is_clean=len(issues_out) == 0,
    )
