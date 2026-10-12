from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_role
from app.models.deed import Deed
from app.models.user import User
from app.services.audit import log

router = APIRouter(prefix="/dev", tags=["dev"])


@router.get("/status")
def get_dev_status(
    current_user: User = Depends(require_role("admin")),
) -> dict[str, bool]:
    """Check demo mode status (Admin only). Returns false when disabled so UI can hide dev panel."""
    return {"demo_mode": bool(settings.demo_mode)}


@router.post("/tamper/{deed_no}")
def tamper_deed(
    deed_no: str,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Tamper Lab: modify deed payload area without re-signing to simulate forgery (Admin + Demo Mode only)."""
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev endpoints disabled when DEMO_MODE is false",
        )

    deed = db.scalars(select(Deed).where(Deed.deed_no == deed_no.strip())).first()
    if not deed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deed not found")

    if deed.tamper_backup is not None:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "ALREADY_TAMPERED"},
        )

    # Save original payload
    deed.tamper_backup = deed.payload_json

    # Parse and tamper area_sold by +1.0
    payload = json.loads(deed.payload_json)
    original_area = float(payload.get("area_sold", deed.area_sold))
    tampered_area = round(original_area + 1.0, 2)
    payload["area_sold"] = tampered_area

    deed.payload_json = json.dumps(payload, ensure_ascii=False)
    deed.area_sold = tampered_area

    log(
        db,
        actor=current_user,
        action="DEMO_TAMPER",
        entity="deed",
        entity_id=deed.id,
        detail="demo tamper",
    )
    db.commit()
    db.refresh(deed)

    return {
        "status": "tampered",
        "deed_no": deed.deed_no,
        "original_area": original_area,
        "tampered_area": tampered_area,
    }


@router.post("/restore/{deed_no}")
def restore_deed(
    deed_no: str,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Restore tampered deed payload to its original authentic state (Admin + Demo Mode only)."""
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev endpoints disabled when DEMO_MODE is false",
        )

    deed = db.scalars(select(Deed).where(Deed.deed_no == deed_no.strip())).first()
    if not deed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deed not found")

    if deed.tamper_backup is None:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "NOT_TAMPERED"},
        )

    # Restore authentic payload
    deed.payload_json = deed.tamper_backup
    try:
        restored_payload = json.loads(deed.tamper_backup)
        deed.area_sold = float(restored_payload.get("area_sold", deed.area_sold))
    except Exception:
        pass

    deed.tamper_backup = None

    log(
        db,
        actor=current_user,
        action="DEMO_RESTORE",
        entity="deed",
        entity_id=deed.id,
        detail="demo restore",
    )
    db.commit()
    db.refresh(deed)

    return {
        "status": "restored",
        "deed_no": deed.deed_no,
        "area_sold": deed.area_sold,
    }
