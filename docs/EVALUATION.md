# LandShield Empirical Evaluation Report

Generated: 2026-10-18T17:58:06.726091+00:00 | Benchmark: 300 Synthetic Plots (210 Clean, 90 Anomalous)

## 1. Executive Summary

LandShield's multi-layered fraud detection engine was empirically evaluated across a representative benchmark dataset of 300 land plots with verified ground truth labels.

| Metric | Medium Threshold (Score >= 40) | High Threshold (Score >= 70) | Target |
|---|---|---|---|
| **Precision** | **100.0%** | **100.0%** | > 90% |
| **Recall** | **100.0%** | **100.0%** | > 95% |
| **False-Positive Rate (FPR)** | **0.0%** | **0.0%** | < 5% |
| **F1-Score** | **1.0000** | **1.0000** | > 0.90 |

---

## 2. Detection Performance by Fraud Category

| Category | Vector Focus | Detection Count | Detection Rate |
|---|---|---|---|
| **DOUBLE_SALE** | Rule R1 (Unmutated / conflicting sale) | 15/15 (100.0%) | 100% |
| **STRANGER_SELLER** | Rule R2 (Unauthorized deed transfer) | 15/15 (100.0%) | 100% |
| **GOV_RESTRICTION** | Rule R5 (Khas / Vested / Acquisition) | 15/15 (100.0%) | 100% |
| **LINEAGE_GAP** | Rule R7 (Missing historical survey link) | 15/15 (100.0%) | 100% |
| **LINEAGE_AREA_GROWTH** | Rule R7 (Survey area expansion > 5%) | 15/15 (100.0%) | 100% |
| **RECONCILE_MISMATCH** | Rule R8 (AC Land owner vs deed ledger) | 15/15 (100.0%) | 100% |

---

## 3. False-Positive Analysis

- **Total False Positives**: 0
- **FPR on Clean Plots**: 0.00%
- **Design Philosophy**: LandShield prioritizes citizen protection. Clean plots with established historical survey continuity and single, legitimate deed records consistently score LOW (0-15), avoiding undue friction for legitimate land transactions.

---

## 4. Verification & Reproducibility
- Command: `python backend/scripts/evaluate.py` or `make evaluate`
- API Endpoint: `GET /metrics` serves live evaluated metrics JSON.
