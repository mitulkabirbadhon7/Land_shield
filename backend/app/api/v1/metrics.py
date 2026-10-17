import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="", tags=["metrics"])

METRICS_PATH = Path("data/metrics/metrics.json")


@router.get("/metrics")
def get_evaluation_metrics():
    """Public endpoint serving empirical evaluation metrics across 300 benchmark plots."""
    if not METRICS_PATH.exists():
        # Fallback to backend/data/metrics/metrics.json if run from different cwd
        alt_path = Path(__file__).resolve().parent.parent.parent.parent / "data" / "metrics" / "metrics.json"
        if alt_path.exists():
            return json.loads(alt_path.read_text(encoding="utf-8"))

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation metrics not generated yet. Run 'python backend/scripts/evaluate.py' first.",
        )

    try:
        return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read metrics payload: {exc}",
        )
