from __future__ import annotations

import logging
from typing import Any
import numpy as np

logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "transfers_30d",
    "days_since_last_transfer",
    "area_ratio",
    "seller_is_ledger_holder",
    "price_vs_area_median",
    "mutation_lag_days",
    "buyer_seller_repeat",
    "distinct_buyers_90d",
    "reg_hour",
    "flag_count",
    "lineage_issue_count",
    "circular_transfer",
]

FEATURE_LABELS: dict[str, dict[str, str]] = {
    "transfers_30d": {
        "en": "Frequent transfers in 30 days",
        "bn": "৩০ দিনে ঘনঘন হস্তান্তর",
    },
    "days_since_last_transfer": {
        "en": "Rapid consecutive transfer",
        "bn": "অল্প সময়ের ব্যবধানে পরবর্তী হস্তান্তর",
    },
    "area_ratio": {
        "en": "Transferred area ratio to total plot",
        "bn": "জমির মোট পরিমাণের তুলনায় হস্তান্তরিত অংশের অনুপাত",
    },
    "seller_is_ledger_holder": {
        "en": "Seller not identified in previous ledger chain",
        "bn": "লেজার চেইনে বিক্রেতার মালিকানা অপ্রমাণিত",
    },
    "price_vs_area_median": {
        "en": "Transaction price severely deviates from area median",
        "bn": "জমির মূল্য এলাকার গড় মূল্যের চেয়ে অস্বাভাবিক কম বা বেশি",
    },
    "mutation_lag_days": {
        "en": "Unresolved mutation backlog lag",
        "bn": "দীর্ঘদিন যাবত অনিষ্পন্ন নামজারি",
    },
    "buyer_seller_repeat": {
        "en": "Repeated transactions between same parties",
        "bn": "একই পক্ষদ্বয়ের মধ্যে পুনরাবৃত্ত হস্তান্তর",
    },
    "distinct_buyers_90d": {
        "en": "Multiple distinct buyers within 90 days",
        "bn": "৯০ দিনে একাধিক ভিন্ন ব্যক্তির কাছে বিক্রি",
    },
    "reg_hour": {
        "en": "Registration executed outside standard office hours",
        "bn": "অফিস সময়ের বাইরে অস্বাভাবিক সময়ে রেজিস্ট্রেশন",
    },
    "flag_count": {
        "en": "Plot is flagged for government dispute or acquisition",
        "bn": "খাস বা অধিগ্রহণকৃত জমি হিসেবে চিহ্নিত",
    },
    "lineage_issue_count": {
        "en": "Historical survey lineage discontinuity",
        "bn": "সার্ভে খতিয়ানের ধারাবাহিকতায় অনুপস্থিত বা অসঙ্গতি",
    },
    "circular_transfer": {
        "en": "Circular transfer cycle (re-acquisition by prior seller)",
        "bn": "বৃত্তাকার হস্তান্তর (পূর্ববর্তী মালিকের কাছে পুনরায় হস্তান্তর)",
    },
}


def explain_prediction(
    model: Any,
    feature_dict: dict[str, Any],
    top_k: int = 3,
    explainer: Any | None = None,
) -> list[dict[str, Any]]:
    """Generates explainable top-k feature contributions using SHAP (or feature attribution fallback).

    Returns a list of dictionaries with bilingual labels and descriptions.
    """
    x_vec = np.array([[float(feature_dict.get(c, 0.0)) for c in FEATURE_COLS]], dtype=np.float32)

    importances: np.ndarray | None = None

    if explainer is not None:
        try:
            shap_out = explainer.shap_values(x_vec)
            if isinstance(shap_out, list):
                # Binary classification list: [class_0, class_1]
                pos_vals = shap_out[1] if len(shap_out) > 1 else shap_out[0]
            elif isinstance(shap_out, np.ndarray):
                if shap_out.ndim == 3 and shap_out.shape[-1] == 2:
                    pos_vals = shap_out[:, :, 1]
                else:
                    pos_vals = shap_out
            else:
                pos_vals = np.array(shap_out)
            importances = np.asarray(pos_vals).flatten()
        except Exception as e:
            logger.warning("SHAP explanation failed, using fallback attribution: %s", e)

    if importances is None:
        # Fallback using feature importances and normalized feature presence
        raw_imp = getattr(model, "feature_importances_", None)
        if raw_imp is not None:
            importances = np.array(raw_imp, dtype=float) * x_vec.flatten()
        else:
            importances = x_vec.flatten()

    # Sort descending by importance (features pushing risk highest)
    indices = np.argsort(importances)[::-1]
    top_indices = indices[:top_k]

    results: list[dict[str, Any]] = []
    for idx in top_indices:
        col = FEATURE_COLS[idx]
        val = feature_dict.get(col, 0.0)
        imp = float(importances[idx])
        labels = FEATURE_LABELS.get(col, {"en": col, "bn": col})

        results.append({
            "feature": col,
            "value": val,
            "importance": round(imp, 4),
            "label_en": labels["en"],
            "label_bn": labels["bn"],
            "reason_en": f"{labels['en']} ({col}={val})",
            "reason_bn": f"{labels['bn']} ({col}={val})",
        })

    return results


def format_shap_reasons(explanations: list[dict[str, Any]], lang: str = "en") -> list[str]:
    """Formats explanation dicts into user-facing bilingual reason strings."""
    key = "reason_bn" if lang == "bn" else "reason_en"
    return [exp.get(key, exp.get("reason_en", "")) for exp in explanations]
