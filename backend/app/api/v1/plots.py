from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.models.person import Person
from app.models.plot import Plot
from app.schemas.plots import ChainItem, PlotOut
from app.services.deeds import verify_deed
from app.services.holdings import largest_holder, ledger_holdings
from app.utils.masking import mask_name

router = APIRouter(prefix="/plots", tags=["plots"])


def _to_plot_out(plot: Plot, db: Session) -> PlotOut:
    initial_owner = db.get(Person, plot.initial_owner_id) if plot.initial_owner_id else None

    # Calculate live holding balances from ledger
    holdings = ledger_holdings(db, plot)
    largest_id = largest_holder(holdings)

    # Check for fraudulent overselling (negative balance anywhere in holdings)
    has_negative = any(area < -1e-6 for area in holdings.values())

    # Resolve active current owner: use current_owner_id if positive balance, else largest holder
    active_owner_id = plot.current_owner_id
    if not active_owner_id or holdings.get(active_owner_id, 0.0) <= 0:
        if largest_id:
            active_owner_id = largest_id

    current_owner = db.get(Person, active_owner_id) if active_owner_id else None
    curr_holding = holdings.get(active_owner_id, float(plot.area_decimal)) if active_owner_id else float(plot.area_decimal)

    if has_negative:
        # Fraudulent overselling: total sold is sum of positive buyer holdings (exceeds plot area)
        total_sold = round(sum(area for area in holdings.values() if area > 0), 2)
        remaining = 0.0
    else:
        # Legitimate plot: remaining is active owner's holding; sold is area held by other buyers
        remaining = round(max(0.0, curr_holding), 2)
        total_sold = round(sum(area for pid, area in holdings.items() if pid != active_owner_id and area > 0), 2)

    return PlotOut(
        id=plot.id,
        mouza=plot.mouza,
        upazila=plot.upazila,
        district=plot.district,
        dag_no=plot.dag_no,
        area_decimal=plot.area_decimal,
        remaining_decimal=remaining,
        sold_decimal=total_sold,
        land_type=plot.land_type,
        flags=plot.flags or [],
        initial_owner_id=plot.initial_owner_id,
        current_owner_id=plot.current_owner_id,
        initial_owner_name=mask_name(initial_owner.display_name if initial_owner else None),
        current_owner_name=mask_name(current_owner.display_name if current_owner else None),
    )


@router.get("/search", response_model=list[PlotOut])
def search_plots(
    mouza: str | None = Query(None, description="Mouza name filter"),
    dag_no: str | None = Query(None, description="Dag number filter"),
    db: Session = Depends(get_db),
):
    """Search land plots by mouza and/or dag number with public name masking."""
    stmt = select(Plot)
    if mouza and mouza.strip():
        stmt = stmt.where(Plot.mouza.ilike(f"%{mouza.strip()}%"))
    if dag_no and dag_no.strip():
        stmt = stmt.where(Plot.dag_no == dag_no.strip())

    plots = db.scalars(stmt).all()
    return [_to_plot_out(plot, db) for plot in plots]


@router.get("/{id}", response_model=PlotOut)
def get_plot(
    id: int,
    db: Session = Depends(get_db),
):
    """Retrieve plot summary with privacy-masked owner names."""
    plot = db.get(Plot, id)
    if plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found",
        )
    return _to_plot_out(plot, db)


@router.get("/{id}/chain", response_model=list[ChainItem])
def get_plot_chain(
    id: int,
    db: Session = Depends(get_db),
):
    """Retrieve full chronological ownership chain with masked buyer names and verification statuses."""
    plot = db.get(Plot, id)
    if plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found",
        )

    stmt = select(LedgerEntry).where(LedgerEntry.plot_id == id).order_by(LedgerEntry.seq.asc())
    entries = db.scalars(stmt).all()

    chain: list[ChainItem] = []
    for entry in entries:
        deed = db.get(Deed, entry.deed_id)
        if not deed:
            continue

        buyer = db.get(Person, deed.buyer_id)
        buyer_masked = mask_name(buyer.display_name if buyer else None)

        reg_at = deed.registered_at.isoformat() if hasattr(deed.registered_at, "isoformat") else str(deed.registered_at)
        v_res = verify_deed(db, deed.deed_no)

        chain.append(
            ChainItem(
                seq=entry.seq,
                deed_no=deed.deed_no,
                date=reg_at,
                buyer=buyer_masked,
                deed_status=deed.status,
                verify_status=v_res.get("status", "UNKNOWN"),
                area_sold=deed.area_sold,
            )
        )

    return chain
