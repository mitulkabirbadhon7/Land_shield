from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.v1.auth import limiter
from app.config import settings
from app.db import get_db
from app.models.plot import Plot
from app.schemas.reports import DueDiligenceReportOut, DueDiligenceRequest
from app.services.agent.report import generate_due_diligence_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/due-diligence", response_model=DueDiligenceReportOut)
@limiter.limit("5/minute")
def post_due_diligence_report(
    request: Request,
    body: DueDiligenceRequest,
    db: Session = Depends(get_db),
) -> DueDiligenceReportOut:
    """Public endpoint to generate an explainable AI due-diligence summary for a plot."""
    if not settings.feature_agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Due-Diligence feature is disabled",
        )

    plot = db.get(Plot, body.plot_id)
    if not plot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found",
        )

    report_dict = generate_due_diligence_report(db, body.plot_id, lang=body.lang)
    return DueDiligenceReportOut.model_validate(report_dict)
