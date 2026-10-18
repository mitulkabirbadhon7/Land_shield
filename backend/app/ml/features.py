from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.deed import Deed
from app.models.khatian import Khatian
from app.models.mutation import Mutation
from app.models.plot import Plot
from app.services.lineage import check_lineage
from app.services.reconcile import reconcile_plot


@dataclass
class DealRecord:
    deed_no: str
    registered_at: datetime
    seller_id: int
    buyer_id: int
    area_sold: float
    price_bdt: float | None = None
    deed_type: str = "SALE"
    status: str = "ACTIVE"


def features_from_history(
    history: list[DealRecord],
    subject: DealRecord | None,
    plot_context: dict[str, Any],
) -> dict[str, Any]:
    """Pure function extracting tabular ML features from deed history and plot context.

    Used identically during training dataset generation and real-time live serving.
    """
    total_area = float(plot_context.get("area_decimal", 10.0))
    if total_area <= 0:
        total_area = 10.0

    if subject is None:
        if history:
            subject = history[-1]
            past_deals = history[:-1]
        else:
            subject = DealRecord(
                deed_no="DUMMY",
                registered_at=datetime.now(timezone.utc),
                seller_id=0,
                buyer_id=0,
                area_sold=total_area,
            )
            past_deals = []
    else:
        # Filter past deals that occurred strictly before subject
        past_deals = [d for d in history if d.deed_no != subject.deed_no and d.registered_at <= subject.registered_at]

    # Sort past deals chronologically
    past_deals.sort(key=lambda d: d.registered_at)

    subj_time = subject.registered_at
    if subj_time.tzinfo is None:
        subj_time = subj_time.replace(tzinfo=timezone.utc)

    # 1. transfers_30d: count of prior transfers on plot in 30 days
    t30_cutoff = subj_time - timedelta(days=30)
    transfers_30d = sum(
        1 for d in past_deals
        if (d.registered_at.replace(tzinfo=timezone.utc) if d.registered_at.tzinfo is None else d.registered_at) >= t30_cutoff
    )

    # 2. days_since_last_transfer
    if past_deals:
        last_t = past_deals[-1].registered_at
        if last_t.tzinfo is None:
            last_t = last_t.replace(tzinfo=timezone.utc)
        days_since_last_transfer = max(0.0, (subj_time - last_t).total_seconds() / 86400.0)
    else:
        days_since_last_transfer = 999.0

    # 3. area_ratio
    area_ratio = round(float(subject.area_sold) / total_area, 4)

    # 4. seller_is_ledger_holder
    genesis_owner_id = plot_context.get("initial_owner_id")
    prior_buyers = {d.buyer_id for d in past_deals}
    seller_is_ledger_holder = 1 if (subject.seller_id in prior_buyers or subject.seller_id == genesis_owner_id) else 0

    # 5. price_vs_area_median
    median_unit_price = float(plot_context.get("area_median_price", 100000.0))
    if subject.price_bdt and subject.area_sold > 0 and median_unit_price > 0:
        actual_unit_price = float(subject.price_bdt) / float(subject.area_sold)
        price_vs_area_median = round(actual_unit_price / median_unit_price, 4)
    else:
        price_vs_area_median = 1.0

    # 6. mutation_lag_days
    mutations = plot_context.get("mutations", [])
    if mutations:
        # Find oldest mutation or lag
        mutation_lag_days = float(plot_context.get("mutation_lag_days", 0.0))
    else:
        mutation_lag_days = 0.0

    # 7. buyer_seller_repeat
    buyer_seller_repeat = sum(
        1 for d in past_deals
        if d.seller_id == subject.seller_id and d.buyer_id == subject.buyer_id
    )

    # 8. distinct_buyers_90d
    t90_cutoff = subj_time - timedelta(days=90)
    buyers_90d = {
        d.buyer_id for d in past_deals
        if (d.registered_at.replace(tzinfo=timezone.utc) if d.registered_at.tzinfo is None else d.registered_at) >= t90_cutoff
    }
    distinct_buyers_90d = len(buyers_90d)

    # 9. reg_hour
    reg_hour = subj_time.hour

    # 10. flag_count
    flag_count = len(plot_context.get("flags", []))

    # 11. lineage_issue_count
    lineage_issue_count = len(plot_context.get("lineage_issues", []))

    # 12. circular_transfer (e.g. A->B->C->A within 60 days)
    t60_cutoff = subj_time - timedelta(days=60)
    prior_sellers_60d = {
        d.seller_id for d in past_deals
        if (d.registered_at.replace(tzinfo=timezone.utc) if d.registered_at.tzinfo is None else d.registered_at) >= t60_cutoff
    }
    circular_transfer = 1 if subject.buyer_id in prior_sellers_60d else 0

    return {
        "transfers_30d": transfers_30d,
        "days_since_last_transfer": round(days_since_last_transfer, 2),
        "area_ratio": area_ratio,
        "seller_is_ledger_holder": seller_is_ledger_holder,
        "price_vs_area_median": price_vs_area_median,
        "mutation_lag_days": round(mutation_lag_days, 2),
        "buyer_seller_repeat": buyer_seller_repeat,
        "distinct_buyers_90d": distinct_buyers_90d,
        "reg_hour": reg_hour,
        "flag_count": flag_count,
        "lineage_issue_count": lineage_issue_count,
        "circular_transfer": circular_transfer,
    }


def history_from_db(
    db: Session,
    plot: Plot,
    subject: Deed | None = None,
) -> tuple[list[DealRecord], DealRecord | None, dict[str, Any]]:
    """Live database adapter extracting DealRecord history and plot context for a plot."""
    # Deeds on plot
    deeds = db.scalars(
        select(Deed).where(Deed.plot_id == plot.id).order_by(Deed.registered_at.asc())
    ).all()

    deal_records: list[DealRecord] = []
    subject_deal: DealRecord | None = None

    for d in deeds:
        reg_at = d.registered_at if isinstance(d.registered_at, datetime) else datetime.fromisoformat(str(d.registered_at))
        rec = DealRecord(
            deed_no=d.deed_no,
            registered_at=reg_at,
            seller_id=d.seller_id,
            buyer_id=d.buyer_id,
            area_sold=float(d.area_sold),
            price_bdt=float(d.price_bdt) if d.price_bdt is not None else None,
            deed_type=d.deed_type,
            status=d.status,
        )
        deal_records.append(rec)
        if subject is not None and d.deed_no == subject.deed_no:
            subject_deal = rec

    if subject is not None and subject_deal is None:
        reg_at = subject.registered_at if isinstance(subject.registered_at, datetime) else datetime.fromisoformat(str(subject.registered_at))
        subject_deal = DealRecord(
            deed_no=subject.deed_no,
            registered_at=reg_at,
            seller_id=subject.seller_id,
            buyer_id=subject.buyer_id,
            area_sold=float(subject.area_sold),
            price_bdt=float(subject.price_bdt) if subject.price_bdt is not None else None,
            deed_type=subject.deed_type,
            status=subject.status,
        )

    # Lineage issues
    khatians = db.scalars(
        select(Khatian).where(Khatian.plot_id == plot.id).order_by(Khatian.id.asc())
    ).all()
    lineage_issues = check_lineage(khatians) if khatians else []

    # Reconcile issues
    reconcile_issues = reconcile_plot(db, plot)

    # Active mutations
    mutations = db.scalars(
        select(Mutation).where(Mutation.plot_id == plot.id)
    ).all()

    mutation_lag = 0.0
    now = datetime.now(timezone.utc)
    for m in mutations:
        if m.state in ("AUTO_CHECKED", "UNDER_REVIEW"):
            m_time = m.created_at if m.created_at.tzinfo else m.created_at.replace(tzinfo=timezone.utc)
            lag = (now - m_time).total_seconds() / 86400.0
            mutation_lag = max(mutation_lag, lag)

    plot_context: dict[str, Any] = {
        "plot_id": plot.id,
        "area_decimal": float(plot.area_decimal),
        "initial_owner_id": plot.initial_owner_id,
        "flags": plot.flags or [],
        "lineage_issues": lineage_issues,
        "reconcile_issues": reconcile_issues,
        "mutations": mutations,
        "mutation_lag_days": mutation_lag,
        "area_median_price": 100000.0,
    }

    return deal_records, subject_deal, plot_context
