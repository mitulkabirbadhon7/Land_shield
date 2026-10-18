import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="", tags=["metrics"])

def _get_metrics_path() -> Path | None:
    repo_root = Path(__file__).resolve().parents[4]
    candidates = [
        Path("data/metrics/metrics.json"),
        repo_root / "data" / "metrics" / "metrics.json",
        Path(__file__).resolve().parents[3] / "data" / "metrics" / "metrics.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


@router.get("/metrics")
def get_evaluation_metrics():
    """Public endpoint serving empirical evaluation metrics across 300 benchmark plots."""
    target_path = _get_metrics_path()
    if not target_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evaluation metrics not generated yet. Run 'python backend/scripts/evaluate.py' first.",
        )

    try:
        return json.loads(target_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read metrics payload: {exc}",
        )
