from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.deed import Deed
from app.models.mutation import Mutation
from app.models.plot import Plot
from app.schemas.risk import AnalysisReportOut, MutationSummary, RiskFindingOut, RiskReportOut
from app.services.deeds import verify_chain
from app.services.fraud.explain import explain
from app.services.pipeline.base import AnalysisContext
from app.services.pipeline.engine import assess
from app.services.pipeline.registry import get_layers

router = APIRouter(tags=["risk"])


def _assess_plot_risk(
    plot_id: int,
    lang: str,
    db: Session,
    extended: bool = False,
) -> RiskReportOut | AnalysisReportOut:
    plot = db.get(Plot, plot_id)
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")

    ctx = AnalysisContext(
        db=db,
        plot=plot,
        now=datetime.now(timezone.utc),
        proposed=None,
    )

    layers = get_layers()
    report = assess(ctx, layers)

    # Check cryptographic ledger integrity
    chain_ok, _reason, _broken_seq = verify_chain(db, plot.id)

    # Build mutation summary for active deeds on plot
    active_deeds = db.scalars(
        select(Deed).where(Deed.plot_id == plot.id, Deed.status == "ACTIVE")
    ).all()
    total_deeds = len(active_deeds)
    mutated_deeds = 0
    pending_mutations = 0

    for deed in active_deeds:
        mutations = db.scalars(
            select(Mutation).where(Mutation.deed_id == deed.id)
        ).all()
        if any(m.state == "KHATIAN_UPDATED" for m in mutations):
            mutated_deeds += 1
        elif any(m.state in ["SUBMITTED", "AUTO_CHECKED", "UNDER_REVIEW", "APPROVED"] for m in mutations):
            pending_mutations += 1

    latest_mutation_state: str | None = None
    if active_deeds:
        latest_deed = active_deeds[-1]
        latest_m = db.scalars(
            select(Mutation)
            .where(Mutation.deed_id == latest_deed.id)
            .order_by(Mutation.created_at.desc())
        ).first()
        if latest_m:
            latest_mutation_state = latest_m.state
        else:
            latest_mutation_state = "NONE"
    else:
        latest_mutation_state = "GENESIS"

    if latest_mutation_state == "KHATIAN_UPDATED":
        missing_mutations = 0
    else:
        missing_mutations = max(0, total_deeds - mutated_deeds - pending_mutations)

    # Format findings with natural bilingual explanations
    findings_out: list[RiskFindingOut] = []
    for f in report.get("findings", []):
        text = explain(f, lang=lang)
        findings_out.append(
            RiskFindingOut(
                rule_id=f.get("rule_id", ""),
                sub_code=f.get("sub_code"),
                layer=f.get("layer", ""),
                severity=f.get("severity", ""),
                deed_no=f.get("deed_no"),
                text=text,
            )
        )

    base_args = {
        "mode": "PLOT",
        "score": report.get("score", 0),
        "level": report.get("level", "LOW"),
        "has_critical": report.get("has_critical", False),
        "findings": findings_out,
        "chain_ok": chain_ok,
        "flags": plot.flags or [],
        "mutation_summary": MutationSummary(
            total_deeds=total_deeds,
            mutated_deeds=mutated_deeds,
            pending_mutations=pending_mutations,
            missing_mutations=missing_mutations,
            latest_mutation_state=latest_mutation_state,
        ),
    }

    if extended:
        layers_out: dict[str, list[RiskFindingOut]] = {}
        for layer_name, layer_raw_findings in report.get("layers", {}).items():
            layers_out[layer_name] = [
                RiskFindingOut(
                    rule_id=f.get("rule_id", ""),
                    sub_code=f.get("sub_code"),
                    layer=f.get("layer", ""),
                    severity=f.get("severity", ""),
                    deed_no=f.get("deed_no"),
                    text=explain(f, lang=lang),
                )
                for f in layer_raw_findings
            ]
        return AnalysisReportOut(
            **base_args,
            layers=layers_out,
            layers_run=report.get("layers_run", []),
            lineage_available=report.get("lineage_available", False),
        )

    return RiskReportOut(**base_args)


@router.get("/risk/plot/{plot_id}", response_model=RiskReportOut)
def get_plot_risk(
    plot_id: int,
    lang: str = Query("bn", pattern="^(bn|en)$"),
    db: Session = Depends(get_db),
) -> RiskReportOut:
    """Public risk assessment for a specific land plot."""
    return _assess_plot_risk(plot_id=plot_id, lang=lang, db=db, extended=False)


@router.get("/analysis/plot/{plot_id}", response_model=AnalysisReportOut)
def get_plot_analysis(
    plot_id: int,
    lang: str = Query("bn", pattern="^(bn|en)$"),
    db: Session = Depends(get_db),
) -> AnalysisReportOut:
    """Public extended analysis carrying layers, layers_run, and lineage_available."""
    return _assess_plot_risk(plot_id=plot_id, lang=lang, db=db, extended=True)

