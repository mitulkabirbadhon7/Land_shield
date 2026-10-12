from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.plot import Plot
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent

TOLERANCE = 1e-6


def _normalize_dt(val: datetime | str | None) -> datetime | None:
    """Normalize a datetime or ISO string to UTC-aware datetime for safe comparisons."""
    if val is None:
        return None
    if isinstance(val, str):
        val = datetime.fromisoformat(val)
    if val.tzinfo is None:
        return val.replace(tzinfo=timezone.utc)
    return val.astimezone(timezone.utc)


def ledger_holdings(
    db: Session,
    plot: Plot,
    before_seq: int | None = None,
) -> dict[int, float]:
    """Calculate current land holdings from the ledger view in sequence order.

    Starts with {plot.initial_owner_id: plot.area_decimal}.
    Applies ACTIVE deeds in seq order: seller -= area_sold, buyer += area_sold.
    """
    holdings: dict[int, float] = {plot.initial_owner_id: float(plot.area_decimal)}

    stmt = (
        select(LedgerEntry, Deed)
        .join(Deed, LedgerEntry.deed_id == Deed.id)
        .where(LedgerEntry.plot_id == plot.id)
    )
    if before_seq is not None:
        stmt = stmt.where(LedgerEntry.seq < before_seq)
    stmt = stmt.order_by(LedgerEntry.seq.asc())

    rows = db.execute(stmt).all()
    for _entry, deed in rows:
        if deed.status != "ACTIVE":
            continue
        area = float(deed.area_sold)
        holdings[deed.seller_id] = holdings.get(deed.seller_id, 0.0) - area
        holdings[deed.buyer_id] = holdings.get(deed.buyer_id, 0.0) + area

    # Normalize floating point inaccuracies against tolerance
    for pid in list(holdings.keys()):
        if abs(holdings[pid]) < TOLERANCE:
            holdings[pid] = 0.0
        else:
            holdings[pid] = round(holdings[pid], 6)

    return holdings


def record_holdings(
    db: Session,
    plot: Plot,
    as_of: datetime | str | None = None,
    before_seq: int | None = None,
) -> dict[int, float]:
    """Calculate official record holdings: only deeds whose Mutation reached KHATIAN_UPDATED.

    Completion time is the MutationEvent(to_state="KHATIAN_UPDATED").at.
    If as_of is provided, only deeds completed at or before as_of are included.
    """
    holdings: dict[int, float] = {plot.initial_owner_id: float(plot.area_decimal)}

    stmt = (
        select(LedgerEntry, Deed)
        .join(Deed, LedgerEntry.deed_id == Deed.id)
        .where(LedgerEntry.plot_id == plot.id)
    )
    if before_seq is not None:
        stmt = stmt.where(LedgerEntry.seq < before_seq)
    stmt = stmt.order_by(LedgerEntry.seq.asc())

    rows = db.execute(stmt).all()
    as_of_dt = _normalize_dt(as_of)

    for _entry, deed in rows:
        if deed.status != "ACTIVE":
            continue

        # Look up MutationEvent reaching KHATIAN_UPDATED
        event_stmt = (
            select(MutationEvent)
            .join(Mutation, MutationEvent.mutation_id == Mutation.id)
            .where(
                Mutation.deed_id == deed.id,
                MutationEvent.to_state == "KHATIAN_UPDATED",
            )
            .order_by(MutationEvent.at.asc())
        )
        event = db.scalars(event_stmt).first()
        if event is None:
            continue

        if as_of_dt is not None:
            event_dt = _normalize_dt(event.at)
            if event_dt is None or event_dt > as_of_dt:
                continue

        area = float(deed.area_sold)
        holdings[deed.seller_id] = holdings.get(deed.seller_id, 0.0) - area
        holdings[deed.buyer_id] = holdings.get(deed.buyer_id, 0.0) + area

    for pid in list(holdings.keys()):
        if abs(holdings[pid]) < TOLERANCE:
            holdings[pid] = 0.0
        else:
            holdings[pid] = round(holdings[pid], 6)

    return holdings


def largest_holder(holdings: dict[int, float]) -> int | None:
    """Return person_id with the largest holding area > TOLERANCE, or None."""
    positive = {pid: area for pid, area in holdings.items() if area > TOLERANCE}
    if not positive:
        return None
    return max(positive.keys(), key=lambda pid: positive[pid])


def recompute_current_owner(db: Session, plot: Plot) -> int | None:
    """Set and return plot.current_owner_id from official record_holdings. Caller commits."""
    rec = record_holdings(db, plot)
    owner_id = largest_holder(rec)
    plot.current_owner_id = owner_id
    db.flush()
    return owner_id
