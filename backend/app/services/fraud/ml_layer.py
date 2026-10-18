from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.config import settings
from app.ml.explainer import FEATURE_COLS, explain_prediction, format_shap_reasons
from app.ml.features import DealRecord, features_from_history, history_from_db
from app.services.pipeline.base import AnalysisContext, Finding, Layer

logger = logging.getLogger(__name__)


class MLLayer(Layer):
    name = "ml"
    enabled_flag = "FEATURE_ML"

    def __init__(self, model_path: Path | str | None = None) -> None:
        self.model = None
        self.explainer = None
        self.iso_forest = None
        self.feature_cols = FEATURE_COLS
        self.model_loaded = False

        self._load_model(model_path)

    def _load_model(self, model_path: Path | str | None = None) -> None:
        if model_path is not None:
            candidates = [Path(model_path)]
        else:
            candidates = [
                Path("backend/app/ml/model.joblib"),
                Path("app/ml/model.joblib"),
                Path(__file__).resolve().parent.parent.parent / "ml" / "model.joblib",
                Path(__file__).resolve().parent.parent / "ml" / "model.joblib",
            ]

        found_path = None
        for p in candidates:
            if p.exists():
                found_path = p
                break

        if not found_path:
            logger.warning("ML Advisory Layer: model artifact not found. Layer will gracefully bypass.")
            return

        try:
            artifact = joblib.load(found_path)
            self.model = artifact.get("model")
            self.explainer = artifact.get("explainer")
            self.iso_forest = artifact.get("iso_forest")
            self.feature_cols = artifact.get("feature_cols", FEATURE_COLS)
            self.model_loaded = True
            logger.info("ML Advisory Layer: successfully loaded model from %s", found_path)
        except Exception as exc:
            logger.warning("ML Advisory Layer: failed to load model from %s: %s. Layer will bypass.", found_path, exc)
            self.model = None
            self.model_loaded = False

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        if not self.model_loaded or self.model is None:
            return []

        subject_deal: DealRecord | None = None
        if ctx.proposed is not None:
            prop_time = ctx.proposed.at
            if isinstance(prop_time, str):
                prop_time = datetime.fromisoformat(prop_time)
            if prop_time.tzinfo is None:
                prop_time = prop_time.replace(tzinfo=timezone.utc)

            subject_deal = DealRecord(
                deed_no=ctx.proposed.deed_no or "PROPOSED",
                registered_at=prop_time,
                seller_id=ctx.proposed.seller_id,
                buyer_id=ctx.proposed.buyer_id,
                area_sold=float(ctx.proposed.area_sold),
                price_bdt=getattr(ctx.proposed, "price_bdt", None),
                deed_type="SALE",
                status="ACTIVE",
            )

        # Extract history and context from DB
        history_deals, subject_from_db, plot_context = history_from_db(
            ctx.db, ctx.plot, subject=None
        )

        active_subject = subject_deal or subject_from_db

        feat_dict = features_from_history(history_deals, active_subject, plot_context)

        # Construct vector for prediction
        x_vec = np.array([[float(feat_dict.get(c, 0.0)) for c in self.feature_cols]], dtype=np.float32)

        try:
            prob_arr = self.model.predict_proba(x_vec)
            prob = float(prob_arr[:, 1][0]) if prob_arr.ndim == 2 else float(prob_arr[0])
        except Exception as exc:
            logger.warning("ML model inference failed: %s", exc)
            return []

        explanations = explain_prediction(
            self.model,
            feat_dict,
            top_k=3,
            explainer=self.explainer,
        )

        reasons = format_shap_reasons(explanations, lang="en")

        # Save ml payload on context for assess() integration
        ctx.ml_result = {
            "probability": round(prob, 4),
            "top_reasons": explanations,
            "feature_values": feat_dict,
        }

        finding = Finding(
            layer="ml",
            rule_id="ML1",
            severity="INFO",
            weight=0,
            decisive=False,
            reasons=reasons,
            sub_code="ML_ANOMALY_ADVISORY" if prob >= 0.85 else "ML_NORMAL",
        )

        return [finding]
