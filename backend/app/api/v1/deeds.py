from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_role
from app.models.deed import Deed
from app.models.person import Person
from app.models.user import User
from app.schemas.deeds import DeedCreate, DeedOut, DeedRegistrationResponse, VerifyOut
from app.services.crypto import load_or_create_key
from app.services.deeds import register_deed, verify_deed
from app.services.qr import build_qr_url, qr_png
from app.utils.masking import mask_name

router = APIRouter(prefix="/deeds", tags=["deeds"])


@router.post("", response_model=DeedRegistrationResponse, status_code=status.HTTP_201_CREATED)
def create_deed(
    body: DeedCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("registrar")),
):
    """Register a new land deed, digitally sign it with Ed25519, and append to the plot's hash chain.

    Accessible only to Sub-Registrars and Administrators.
    Note: In S08, a pre-registration fraud check will return HTTP 409 FRAUD_BLOCKED
    if the transaction violates double-selling, unowned land, or critical integrity rules.
    """
    signer_key = load_or_create_key(settings.signing_key_path)

    deed = register_deed(
        db,
        signer_key,
        plot_id=body.plot_id,
        seller_id=body.seller_id,
        buyer_id=body.buyer_id,
        area_sold=body.area_sold,
        deed_type=body.deed_type,
        sub_registry=body.sub_registry,
    )
    db.commit()
    db.refresh(deed)

    verify_res = verify_deed(db, deed.deed_no, configured_key=signer_key)

    seller = db.get(Person, deed.seller_id)
    buyer = db.get(Person, deed.buyer_id)

    deed_out = DeedOut(
        id=deed.id,
        deed_no=deed.deed_no,
        plot_id=deed.plot_id,
        seller_id=deed.seller_id,
        buyer_id=deed.buyer_id,
        seller_name=mask_name(seller.display_name if seller else None),
        buyer_name=mask_name(buyer.display_name if buyer else None),
        area_sold=deed.area_sold,
        deed_type=deed.deed_type,
        sub_registry=deed.sub_registry,
        registered_at=deed.registered_at.isoformat() if hasattr(deed.registered_at, "isoformat") else str(deed.registered_at),
        deed_hash=deed.deed_hash,
        signer_key_id=deed.signer_key_id,
        status=deed.status,
    )

    return DeedRegistrationResponse(
        deed=deed_out,
        verify=VerifyOut(**verify_res),
    )


@router.get("/{deed_no}/verify", response_model=VerifyOut)
def verify_deed_endpoint(
    deed_no: str,
    db: Session = Depends(get_db),
):
    """Public verification endpoint returning cryptographic integrity, chain validity, and deed status."""
    signer_key = None
    try:
        signer_key = load_or_create_key(settings.signing_key_path)
    except Exception:
        pass

    result = verify_deed(db, deed_no, configured_key=signer_key)
    return VerifyOut(**result)


@router.get("/{deed_no}/qr")
def get_deed_qr(
    deed_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("registrar")),
):
    """Generate and return a PNG QR code for the given deed number. Registrar-only access."""
    stmt = select(Deed).where(Deed.deed_no == deed_no)
    deed = db.scalars(stmt).first()
    if deed is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deed not found",
        )

    qr_url = build_qr_url(deed.deed_no, deed.deed_hash)
    png_bytes = qr_png(qr_url)
    return Response(content=png_bytes, media_type="image/png")
