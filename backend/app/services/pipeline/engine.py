import logging
from dataclasses import asdict
from typing import Any

from app.services.pipeline.base import AnalysisContext, Finding, Layer

logger = logging.getLogger(__name__)

SEVERITY_RANKS = {
    "INFO": 0,
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}
RANK_TO_SEVERITY = {v: k for k, v in SEVERITY_RANKS.items()}


def level_from_score(score: int) -> str:
    """Calculate categorical risk level from score per TRD 6A."""
    if score >= 85:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 25:
        return "MEDIUM"
    return "LOW"


def apply_ml_bump(level: str, ml_findings: list[Finding], ml_prob: float) -> str:
    """Enforce strict advisory scoring boundary per TRD 6A:
    ML probability >= 0.85 can elevate risk by at most 1 tier (LOW -> MEDIUM, MEDIUM -> HIGH).
    ML never lowers the risk level and CANNOT set CRITICAL or BLOCKED.
    """
    if ml_prob >= 0.85:
        if level == "LOW":
            return "MEDIUM"
        if level == "MEDIUM":
            return "HIGH"
    return level


def assess(ctx: AnalysisContext, layers: list[Layer]) -> dict[str, Any]:
    """Execute all enabled pipeline layers, aggregate findings, and produce risk assessment report."""
    findings: list[Finding] = []
    layers_run: list[str] = []
    layers_dict: dict[str, list[dict[str, Any]]] = {}

    for layer in layers:
        if not layer.is_enabled():
            continue
        layers_run.append(layer.name)
        layers_dict[layer.name] = []
        try:
            layer_findings = layer.analyze(ctx)
            findings.extend(layer_findings)
            layers_dict[layer.name] = [asdict(f) for f in layer_findings]
        except Exception as exc:
            logger.warning("Pipeline layer %s failed during analysis: %s", layer.name, exc)

    decisive_findings = [f for f in findings if f.decisive]

    # Score calculation: sum of decisive weights capped at 100
    raw_score = sum(f.weight for f in decisive_findings)
    score = min(100, max(0, raw_score))

    # Base level from score
    calculated_level = level_from_score(score)

    # Floor severity: highest severity among decisive findings raises the baseline
    max_decisive_rank = max(
        (SEVERITY_RANKS.get(f.severity.upper(), 0) for f in decisive_findings),
        default=0,
    )
    score_rank = SEVERITY_RANKS.get(calculated_level, 0)
    final_rank = max(score_rank, max_decisive_rank)
    level = RANK_TO_SEVERITY.get(final_rank, calculated_level)

    # ML Advisory Bump
    ml_result = getattr(ctx, "ml_result", None)
    ml_prob = ml_result.get("probability", 0.0) if ml_result else 0.0
    ml_findings = [f for f in findings if f.layer == "ml"]
    level = apply_ml_bump(level, ml_findings, ml_prob)

    findings_data = [asdict(f) for f in findings]
    lineage_available = getattr(ctx, "lineage_available", False)

    report: dict[str, Any] = {
        "mode": ctx.mode,
        "score": score,
        "level": level,
        "findings": findings_data,
        "layers": layers_dict,
        "layers_run": layers_run,
        "lineage_available": lineage_available,
        "ml": {
            "probability": ml_result["probability"],
            "top_reasons": ml_result.get("top_reasons", []),
        } if ml_result else None,
    }

    has_critical = any(f.severity.upper() == "CRITICAL" for f in decisive_findings)

    if ctx.mode == "PROPOSED":
        report["blocked"] = has_critical
    else:
        report["has_critical"] = has_critical

    return report
