from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.plot import Plot
from app.models.user import User
from app.schemas.lineage import LineageGraphOut
from app.services.lineage import get_lineage

router = APIRouter(prefix="/lineage", tags=["lineage"])


@router.get("/{plot_id}", response_model=LineageGraphOut)
def get_plot_survey_lineage(
    plot_id: int,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LineageGraphOut:
    """Public endpoint to view historical survey lineage DAG and continuity audit for a plot."""
    plot = db.get(Plot, plot_id)
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")

    lineage_data = get_lineage(db, plot_id, viewer=current_user)
    return LineageGraphOut.model_validate(lineage_data)
