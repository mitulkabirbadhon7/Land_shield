from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_role
from app.models.merkle import MerkleRoot
from app.models.user import User
from app.schemas.transparency import MerkleRootOut, MerkleRunRequest, MerkleVerifyOut
from app.services.merkle import build_daily_root, verify_daily_root

router = APIRouter(prefix="", tags=["transparency"])


def _check_transparency_enabled():
    if not getattr(settings, "feature_transparency", True):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transparency log feature is disabled",
        )


@router.post("/admin/merkle/run", response_model=MerkleRootOut)
def run_daily_merkle_compilation(
    payload: MerkleRunRequest | None = None,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MerkleRootOut:
    """Admin-only endpoint to compile, sign, and commit an immutable daily Merkle root."""
    _check_transparency_enabled()
    target_date = payload.date if (payload and payload.date) else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    record = build_daily_root(db=db, date_str=target_date)
    return MerkleRootOut(
        id=record.id,
        date=record.date,
        root=record.root,
        entry_count=record.entry_count,
        max_entry_id=record.max_entry_id,
        signature=record.signature,
        status="MATCH",
        created_at=record.created_at.isoformat(),
    )


@router.get("/transparency", response_model=list[MerkleRootOut])
def list_transparency_roots(
    db: Session = Depends(get_db),
) -> list[MerkleRootOut]:
    """Public endpoint returning chronological list of published daily roots and audit verification status."""
    _check_transparency_enabled()
    stmt = select(MerkleRoot).order_by(MerkleRoot.date.asc())
    roots = db.scalars(stmt).all()

    out: list[MerkleRootOut] = []
    for r in roots:
        # Quick verification of status
        verification = verify_daily_root(db, r.date)
        out.append(
            MerkleRootOut(
                id=r.id,
                date=r.date,
                root=r.root,
                entry_count=r.entry_count,
                max_entry_id=r.max_entry_id,
                signature=r.signature,
                status=verification.get("status", "MATCH"),
                created_at=r.created_at.isoformat(),
            )
        )
    return out


@router.get("/transparency/{date}/verify", response_model=MerkleVerifyOut)
def verify_transparency_root(
    date: str,
    db: Session = Depends(get_db),
) -> MerkleVerifyOut:
    """Public endpoint re-verifying daily Merkle root against live ledger history on demand."""
    _check_transparency_enabled()
    res = verify_daily_root(db, date)
    if res.get("status") == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No Merkle root published for date '{date}'",
        )
    return MerkleVerifyOut.model_validate(res)
