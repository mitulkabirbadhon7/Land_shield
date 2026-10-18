import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.models.plot import Plot
from app.services.crypto import load_or_create_key
from app.services.fraud.explain import explain
from app.services.lineage import LineageLayer, check_lineage, get_lineage
from app.services.pipeline.base import AnalysisContext
from app.services.pipeline.engine import assess
from app.services.pipeline.registry import get_layers
from scripts.seed import seed_data
from scripts.seed_phase2 import seed_phase2


@pytest.fixture
def seeded_p2_db(db_session: Session) -> Session:
    """Fixture that initializes Phase 1 & Phase 2 seeds in test database."""
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    seed_phase2(db_session)
    return db_session


# -----------------------------------------------------------------------------
# 1. Canonical Benchmark Scenarios (L1, L2, L3, C1)
# -----------------------------------------------------------------------------

def test_l1_scenario_missing_generation(seeded_p2_db: Session):
    """Scenario L1 (Plot 21): detects MISSING_GENERATION (CS -> RS -> BS skips SA)."""
    lineage = get_lineage(seeded_p2_db, 21)
    assert lineage["lineage_available"] is True
    assert lineage["status"] == "DISCREPANCY"

    sub_codes = [issue["sub_code"] for issue in lineage["issues"]]
    assert "MISSING_GENERATION" in sub_codes

    # Verify bilingual explanation
    l1_issue = next(i for i in lineage["issues"] if i["sub_code"] == "MISSING_GENERATION")
    finding_dict = {"rule_id": "R7", "sub_code": "MISSING_GENERATION", "reasons": [l1_issue["message_en"]]}
    exp_en = explain(finding_dict, lang="en")
    exp_bn = explain(finding_dict, lang="bn")
    assert "Survey lineage gap" in exp_en
    assert "জরিপ ধারাবাহিকতায় বিরতি" in exp_bn


def test_l2_scenario_orphan_khatian(seeded_p2_db: Session):
    """Scenario L2 (Plot 22): detects ORPHAN khatian in non-earliest survey without parent."""
    lineage = get_lineage(seeded_p2_db, 22)
    assert lineage["lineage_available"] is True
    assert lineage["status"] == "DISCREPANCY"

    sub_codes = [issue["sub_code"] for issue in lineage["issues"]]
    assert "ORPHAN" in sub_codes

    l2_issue = next(i for i in lineage["issues"] if i["sub_code"] == "ORPHAN")
    finding_dict = {"rule_id": "R7", "sub_code": "ORPHAN", "reasons": [l2_issue["message_en"]]}
    exp_en = explain(finding_dict, lang="en")
    exp_bn = explain(finding_dict, lang="bn")
    assert "Orphan survey record" in exp_en
    assert "মূলহীন জরিপ খতিয়ান" in exp_bn


def test_l3_scenario_area_growth(seeded_p2_db: Session):
    """Scenario L3 (Plot 23): detects AREA_GROWTH (area grows 20 -> 35 decimals, > 5%)."""
    lineage = get_lineage(seeded_p2_db, 23)
    assert lineage["lineage_available"] is True
    assert lineage["status"] == "DISCREPANCY"

    sub_codes = [issue["sub_code"] for issue in lineage["issues"]]
    assert "AREA_GROWTH" in sub_codes

    l3_issue = next(i for i in lineage["issues"] if i["sub_code"] == "AREA_GROWTH")
    finding_dict = {"rule_id": "R7", "sub_code": "AREA_GROWTH", "reasons": [l3_issue["message_en"]]}
    exp_en = explain(finding_dict, lang="en")
    exp_bn = explain(finding_dict, lang="bn")
    assert "Unjustified area expansion" in exp_en
    assert "জমির অযৌক্তিক বৃদ্ধি" in exp_bn


def test_c1_scenario_clean_survey_chain(seeded_p2_db: Session):
    """Scenario C1 (Plot 27): uninterrupted CS->SA->RS->BS survey chain with 0 findings."""
    lineage = get_lineage(seeded_p2_db, 27)
    assert lineage["lineage_available"] is True
    assert lineage["status"] == "ALIGNED"
    assert len(lineage["issues"]) == 0
    assert len(lineage["nodes"]) == 4
    assert len(lineage["edges"]) == 3


def test_un_surveyed_plot_returns_no_findings(seeded_p2_db: Session):
    """Plots without khatians must return lineage_available=False with 0 findings."""
    plot = Plot(
        dag_no="9999",
        mouza="নিঝুমদ্বীপ",
        upazila="হাতিয়া",
        district="নোয়াখালী",
        area_decimal=25.0,
        land_type="agricultural",
        initial_owner_id=1,
    )
    seeded_p2_db.add(plot)
    seeded_p2_db.flush()

    lineage = get_lineage(seeded_p2_db, plot.id)
    assert lineage["lineage_available"] is False
    assert len(lineage["issues"]) == 0
    assert len(lineage["nodes"]) == 0

    ctx = AnalysisContext(db=seeded_p2_db, plot=plot)
    layer = LineageLayer()
    findings = layer.analyze(ctx)
    assert len(findings) == 0
    assert ctx.lineage_available is False


# -----------------------------------------------------------------------------
# 2. Pipeline Integration & Feature Flag Bypass
# -----------------------------------------------------------------------------

def test_lineage_layer_pipeline_integration(seeded_p2_db: Session):
    """LineageLayer runs and emits decisive HIGH findings with weight 35 when enabled."""
    plot = seeded_p2_db.get(Plot, 21)
    ctx = AnalysisContext(db=seeded_p2_db, plot=plot)

    settings.feature_lineage = True
    layers = get_layers()
    report = assess(ctx, layers)

    assert "lineage" in report["layers_run"]
    assert report["lineage_available"] is True

    r7_findings = [f for f in report["findings"] if f.get("rule_id") == "R7"]
    assert len(r7_findings) >= 1
    assert r7_findings[0]["sub_code"] == "MISSING_GENERATION"
    assert r7_findings[0]["severity"] == "HIGH"
    assert r7_findings[0]["weight"] == 35
    assert r7_findings[0]["decisive"] is True


def test_lineage_layer_flag_disabled(seeded_p2_db: Session):
    """LineageLayer is bypassed completely when feature_lineage=False."""
    plot = seeded_p2_db.get(Plot, 21)
    ctx = AnalysisContext(db=seeded_p2_db, plot=plot)

    try:
        settings.feature_lineage = False
        layers = get_layers()
        report = assess(ctx, layers)

        assert "lineage" not in report["layers_run"]
        r7_findings = [f for f in report["findings"] if f.get("rule_id") == "R7"]
        assert len(r7_findings) == 0
    finally:
        settings.feature_lineage = True


# -----------------------------------------------------------------------------
# 3. Public API Endpoint & Privacy Name Masking
# -----------------------------------------------------------------------------

def test_lineage_public_endpoint(client: TestClient, seeded_p2_db: Session):
    """Public endpoint GET /api/v1/lineage/{plot_id} returns graph payload without authentication."""
    res = client.get("/api/v1/lineage/27")
    assert res.status_code == 200
    data = res.json()
    assert data["plot_id"] == 27
    assert data["lineage_available"] is True
    assert len(data["nodes"]) == 4
    assert len(data["edges"]) == 3
    assert data["status"] == "ALIGNED"

    # Also test root mount /lineage/{plot_id}
    res_root = client.get("/lineage/27")
    assert res_root.status_code == 200


def test_lineage_public_owner_name_masking(client: TestClient, seeded_p2_db: Session):
    """Public lineage payload must strictly mask all citizen owner names."""
    res = client.get("/api/v1/lineage/27")
    assert res.status_code == 200
    data = res.json()

    for node in data["nodes"]:
        for owner in node.get("owners", []):
            name = owner.get("name", "")
            if name:
                assert "***" in name, f"Owner name was not masked: {name}"


def test_lineage_nonexistent_plot_404(client: TestClient, seeded_p2_db: Session):
    """Non-existent plot returns 404."""
    res = client.get("/api/v1/lineage/99999")
    assert res.status_code == 404
