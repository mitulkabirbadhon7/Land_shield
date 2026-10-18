"""Model Training & Explainability Pipeline for LandShield Phase 2.

Trains baseline IsolationForest and balanced LightGBMClassifier on synthetic transfer records.
Evaluates Rules-Only vs. ML-Only vs. Hybrid performance.
Exports model artifact to backend/app/ml/model.joblib (<10MB) and metrics to ml/metrics.json.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import IsolationForest
from sklearn.metrics import auc, confusion_matrix, precision_recall_curve, precision_recall_fscore_support

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.ml.explainer import FEATURE_COLS, explain_prediction

logger = logging.getLogger("ml_train")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def find_dataset_path() -> Path:
    candidates = [
        Path("ml/data/transfers.csv"),
        Path("backend/ml/data/transfers.csv"),
        Path(__file__).resolve().parent / "data" / "transfers.csv",
        Path(__file__).resolve().parent.parent.parent / "ml" / "data" / "transfers.csv",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError(f"transfers.csv not found in candidate paths: {[str(c) for c in candidates]}")


def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray | None = None) -> dict[str, float]:
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0

    res = {
        "precision": round(float(p), 4),
        "recall": round(float(r), 4),
        "f1": round(float(f1), 4),
        "fpr": round(fpr, 4),
        "tp": int(tp),
        "fp": int(fp),
        "tn": int(tn),
        "fn": int(fn),
    }

    if y_prob is not None:
        precisions, recalls, _ = precision_recall_curve(y_true, y_prob)
        pr_auc = auc(recalls, precisions)
        res["pr_auc"] = round(float(pr_auc), 4)

    return res


def train_and_evaluate(dataset_csv: Path | None = None) -> dict[str, Any]:
    csv_path = dataset_csv or find_dataset_path()
    logger.info("Loading transfer dataset from: %s", csv_path)

    df = pd.read_csv(csv_path)
    train_df = df[df["split"] == "train"].copy()
    test_df = df[df["split"] == "test"].copy()

    logger.info("Dataset shape: %d rows | Train: %d | Test: %d", len(df), len(train_df), len(test_df))

    X_train = train_df[FEATURE_COLS].astype(float)
    y_train = train_df["label"].astype(int).values

    X_test = test_df[FEATURE_COLS].astype(float)
    y_test = test_df["label"].astype(int).values

    # 1. Train Baseline Isolation Forest
    logger.info("Training baseline Isolation Forest...")
    iso_forest = IsolationForest(contamination=0.12, random_state=42)
    iso_forest.fit(X_train)

    # 2. Train LightGBM Classifier
    logger.info("Training balanced LightGBM Classifier...")
    clf = lgb.LGBMClassifier(
        n_estimators=80,
        learning_rate=0.05,
        class_weight="balanced",
        random_state=42,
        verbose=-1,
        max_depth=5,
        num_leaves=20,
    )
    clf.fit(X_train, y_train)

    # 3. Model Evaluations on Test Split
    y_test_prob = clf.predict_proba(X_test)[:, 1]
    y_test_pred_ml = (y_test_prob >= 0.50).astype(int)

    ml_metrics = calculate_metrics(y_test, y_test_pred_ml, y_test_prob)

    # Rules-Only logic evaluation
    # Rules trigger on ledger discontinuity, rapid transfer count, government flags, lineage breaks, or mutation backlog
    rules_flag = (
        (X_test["seller_is_ledger_holder"] == 0)
        | (X_test["transfers_30d"] >= 3)
        | (X_test["flag_count"] > 0)
        | (X_test["lineage_issue_count"] > 0)
        | (X_test["mutation_lag_days"] > 90)
    ).astype(int).values

    rules_metrics = calculate_metrics(y_test, rules_flag)

    # Hybrid logic: Rules flag OR ML confidence >= 0.85
    hybrid_flag = (rules_flag | (y_test_prob >= 0.85)).astype(int)
    hybrid_metrics = calculate_metrics(y_test, hybrid_flag)

    logger.info("--- EVALUATION COMPARISON ---")
    logger.info(
        "Rules-Only  : Precision=%.4f, Recall=%.4f, F1=%.4f, FPR=%.4f",
        rules_metrics["precision"], rules_metrics["recall"], rules_metrics["f1"], rules_metrics["fpr"]
    )
    logger.info(
        "ML-Only     : Precision=%.4f, Recall=%.4f, F1=%.4f, PR-AUC=%.4f, FPR=%.4f",
        ml_metrics["precision"], ml_metrics["recall"], ml_metrics["f1"], ml_metrics.get("pr_auc", 0.0), ml_metrics["fpr"]
    )
    logger.info(
        "Hybrid      : Precision=%.4f, Recall=%.4f, F1=%.4f, FPR=%.4f",
        hybrid_metrics["precision"], hybrid_metrics["recall"], hybrid_metrics["f1"], hybrid_metrics["fpr"]
    )

    # 4. Fit SHAP Explainer
    logger.info("Fitting SHAP TreeExplainer...")
    shap_explainer = shap.TreeExplainer(clf)

    # Verify explainer on first test sample
    sample_feat = X_test.iloc[0].to_dict()
    sample_exp = explain_prediction(clf, sample_feat, top_k=3, explainer=shap_explainer)
    logger.info("Sample SHAP top feature: %s", sample_exp[0] if sample_exp else "None")

    # 5. Save Artifacts
    model_artifact = {
        "model": clf,
        "explainer": shap_explainer,
        "iso_forest": iso_forest,
        "feature_cols": FEATURE_COLS,
        "metrics": {
            "rules_only": rules_metrics,
            "ml_only": ml_metrics,
            "hybrid": hybrid_metrics,
        },
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }

    # Save to backend/app/ml/model.joblib
    model_path = backend_root / "app" / "ml" / "model.joblib"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model_artifact, model_path, compress=3)
    file_size_mb = model_path.stat().st_size / (1024 * 1024)
    logger.info("Saved model artifact to %s (%.2f MB)", model_path, file_size_mb)
    assert file_size_mb < 10.0, f"Model artifact exceeds 10MB limit: {file_size_mb:.2f} MB"

    # Export metrics JSON
    summary_metrics = {
        "dataset": {
            "total_records": len(df),
            "train_records": len(train_df),
            "test_records": len(test_df),
            "total_anomalies": int(df["label"].sum()),
            "anomaly_rate": round(float(df["label"].mean()), 4),
        },
        "comparison": {
            "rules_only": rules_metrics,
            "ml_only": ml_metrics,
            "hybrid": hybrid_metrics,
        },
        "feature_columns": FEATURE_COLS,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    repo_root = backend_root.parent
    metrics_export_paths = [
        backend_root / "ml" / "metrics.json",
        repo_root / "ml" / "metrics.json",
    ]
    for mp in metrics_export_paths:
        mp.parent.mkdir(parents=True, exist_ok=True)
        with open(mp, "w", encoding="utf-8") as f:
            json.dump(summary_metrics, f, indent=2)
        logger.info("Saved metrics to %s", mp)

    return summary_metrics


if __name__ == "__main__":
    train_and_evaluate()
