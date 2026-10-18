from fastapi import APIRouter
from app.config import settings
from app.schemas.features import FeaturesOut

router = APIRouter(tags=["features"])


@router.get("/features", response_model=FeaturesOut)
def get_features() -> FeaturesOut:
    """Public endpoint returning runtime feature flags."""
    return FeaturesOut(
        feature_reconcile=settings.is_reconcile_enabled,
        feature_lineage=settings.is_lineage_enabled,
        feature_offline_qr=settings.is_offline_qr_enabled,
        feature_agent=settings.is_agent_enabled,
        feature_transparency=settings.is_transparency_enabled,
        feature_ml=settings.is_ml_enabled,
        feature_ocr=settings.is_ocr_enabled,
    )
