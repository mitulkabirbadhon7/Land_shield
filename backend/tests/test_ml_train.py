import os
import time
from pathlib import Path
import joblib
import pytest

from app.ml.explainer import FEATURE_COLS, explain_prediction, format_shap_reasons
from ml.train import train_and_evaluate


def test_ml_training_and_artifact_generation(tmp_path):
    # Verify training executes within 30s
    start_time = time.time()
    summary = train_and_evaluate()
    elapsed = time.time() - start_time

    assert elapsed < 30.0, f"Training took too long: {elapsed:.2f}s"
    assert "comparison" in summary
    assert "rules_only" in summary["comparison"]
    assert "ml_only" in summary["comparison"]
    assert "hybrid" in summary["comparison"]

    # Verify model artifact exists and is smaller than 10MB
    candidates = [
        Path("app/ml/model.joblib"),
        Path("backend/app/ml/model.joblib"),
        Path(__file__).resolve().parent.parent / "app" / "ml" / "model.joblib",
    ]
    model_path = next((p for p in candidates if p.exists()), candidates[0])
    assert model_path.exists(), "app/ml/model.joblib was not generated"
    file_size_mb = model_path.stat().st_size / (1024 * 1024)
    assert file_size_mb < 10.0, f"Model file too large: {file_size_mb:.2f}MB"

    # Verify joblib loading and components
    artifact = joblib.load(model_path)
    assert "model" in artifact
    assert "explainer" in artifact
    assert "iso_forest" in artifact
    assert artifact["feature_cols"] == FEATURE_COLS

    # Verify explainer output
    sample_features = {
        "transfers_30d": 3,
        "days_since_last_transfer": 2.5,
        "area_ratio": 1.0,
        "seller_is_ledger_holder": 1,
        "price_vs_area_median": 0.20,
        "mutation_lag_days": 10.0,
        "buyer_seller_repeat": 0,
        "distinct_buyers_90d": 2,
        "reg_hour": 2,
        "flag_count": 0,
        "lineage_issue_count": 0,
        "circular_transfer": 1,
    }

    explanations = explain_prediction(
        artifact["model"],
        sample_features,
        top_k=3,
        explainer=artifact["explainer"],
    )

    assert len(explanations) == 3
    for exp in explanations:
        assert "feature" in exp
        assert "value" in exp
        assert "importance" in exp
        assert "label_en" in exp
        assert "label_bn" in exp
        assert "reason_en" in exp
        assert "reason_bn" in exp

    # Verify format_shap_reasons
    reasons_en = format_shap_reasons(explanations, lang="en")
    reasons_bn = format_shap_reasons(explanations, lang="bn")

    assert len(reasons_en) == 3
    assert len(reasons_bn) == 3
    assert all(isinstance(r, str) and len(r) > 0 for r in reasons_en)
    assert all(isinstance(r, str) and len(r) > 0 for r in reasons_bn)
