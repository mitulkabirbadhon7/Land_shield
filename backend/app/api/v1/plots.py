from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.schemas.plots import ChainItem, PlotOut
from app.services.deeds import verify_deed
from app.utils.privacy import person_view

router = APIRouter(prefix="/plots", tags=["plots"])


def _to_plot_out(plot: Plot, db: Session, viewer: User | None = None) -> PlotOut:
    initial_owner = db.get(Person, plot.initial_owner_id) if plot.initial_owner_id else None
    current_owner = db.get(Person, plot.current_owner_id) if plot.current_owner_id else None

    p_init = person_view(initial_owner, viewer)
    p_curr = person_view(current_owner, viewer)

    flags = plot.flags or []

    return PlotOut(
        id=plot.id,
        mouza=plot.mouza,
        upazila=plot.upazila,
        district=plot.district,
        dag_no=plot.dag_no,
        area_decimal=plot.area_decimal,
        land_type=plot.land_type,
        flags=flags,
        initial_owner_id=p_init.identifier if not p_init.is_masked else None,
        current_owner_id=p_curr.identifier if not p_curr.is_masked else None,
        initial_owner_name=p_init.name,
        current_owner_name=p_curr.name,
        initial_owner_masked=p_init.name,
        current_owner_masked=p_curr.name,
        is_khas="KHAS" in flags,
        is_acquisition="ACQUISITION" in flags,
        is_disputed="DISPUTED" in flags,
    )


@router.get("/search", response_model=list[PlotOut])
def search_plots(
    mouza: str | None = Query(None, description="Mouza name filter"),
    dag_no: str | None = Query(None, description="Dag number filter"),
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search land plots by mouza and/or dag number with public name masking."""
    stmt = select(Plot)
    if mouza and mouza.strip():
        stmt = stmt.where(Plot.mouza.ilike(f"%{mouza.strip()}%"))
    if dag_no and dag_no.strip():
        stmt = stmt.where(Plot.dag_no == dag_no.strip())

    plots = db.scalars(stmt).all()
    return [_to_plot_out(plot, db, viewer=current_user) for plot in plots]


@router.get("/{id}", response_model=PlotOut)
def get_plot(
    id: int,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve plot summary with privacy-masked owner names."""
    plot = db.get(Plot, id)
    if plot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found",
        )
    return _to_plot_out(plot, db, viewer=current_user)


@router.get("/{id}/chain", response_model=list[ChainItem])
def get_plot_chain(
    id: int,
    current_user: User | None = Depends(get_current_user),
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
        p_buyer = person_view(buyer, viewer=current_user)
        buyer_masked = p_buyer.name

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
