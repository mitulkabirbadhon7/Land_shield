from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.signing_key import SigningKey
from app.schemas.keys import SigningKeyOut

router = APIRouter(prefix="/keys", tags=["keys"])


@router.get("", response_model=list[SigningKeyOut])
def list_signing_keys(db: Session = Depends(get_db)) -> list[SigningKeyOut]:
    """Public registry of active and retired Ed25519 system public signing keys."""
    keys = db.scalars(select(SigningKey).order_by(SigningKey.id.asc())).all()
    return [
        SigningKeyOut(
            key_id=k.key_id,
            public_key_hex=k.public_key_hex,
            status=k.status,
            created_at=k.created_at.isoformat() if k.created_at else None,
        )
        for k in keys
    ]
