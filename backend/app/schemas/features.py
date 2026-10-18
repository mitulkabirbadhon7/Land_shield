from pydantic import BaseModel


class FeaturesOut(BaseModel):
    feature_reconcile: bool
    feature_lineage: bool
    feature_offline_qr: bool
    feature_agent: bool
    feature_transparency: bool
    feature_ml: bool
    feature_ocr: bool
