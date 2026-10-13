from __future__ import annotations
from fastapi import APIRouter, Depends

from app.deps import require_role
from app.models.user import User
from app.schemas.meta import MetaOut, SubRegistryOut

router = APIRouter(prefix="/meta", tags=["meta"])

SUB_REGISTRIES = [
    SubRegistryOut(code="MIR", name="মিরপুর (Mirpur)"),
    SubRegistryOut(code="DHAKA", name="ঢাকা সদর (Dhaka Sadar)"),
    SubRegistryOut(code="SAVAR", name="সাভার (Savar)"),
    SubRegistryOut(code="GUL", name="গুলশান (Gulshan)"),
    SubRegistryOut(code="UTT", name="উত্তরা (Uttara)"),
]

DEED_TYPES = ["SALE", "GIFT", "HEIR", "MORTGAGE"]


@router.get("", response_model=MetaOut)
@router.get("/", response_model=MetaOut, include_in_schema=False)
def get_metadata(
    current_user: User = Depends(require_role("registrar", "officer", "admin")),
) -> MetaOut:
    """Return registration metadata: allowed deed types and sub-registry offices."""
    return MetaOut(
        deed_types=DEED_TYPES,
        sub_registries=SUB_REGISTRIES,
    )
