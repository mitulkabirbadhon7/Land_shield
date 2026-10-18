import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.models.plot import Plot
from app.services.agent.report import (
    _REPORT_CACHE,
    build_template_report,
    gather_facts,
    generate_due_diligence_report,
)
from app.services.crypto import load_or_create_key
from app.services.llm.client import FakeLLM
from scripts.seed import seed_data
from scripts.seed_phase2 import seed_phase2


@pytest.fixture
def seeded_p2_db(db_session: Session) -> Session:
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    seed_phase2(db_session)
    return db_session


@pytest.fixture(autouse=True)
def clear_cache():
    _REPORT_CACHE.clear()
    yield
    _REPORT_CACHE.clear()


# -----------------------------------------------------------------------------
# 1. Fact Gathering & Template Report
# -----------------------------------------------------------------------------

def test_gather_facts_structure(seeded_p2_db: Session):
    """gather_facts collects all verified facts from rules, lineage, and reconcile."""
    facts = gather_facts(seeded_p2_db, 24)
    assert facts["plot_id"] == 24
    assert "dag_no" in facts
    assert "mouza" in facts
    assert "engine_score" in facts
    assert "engine_level" in facts
    assert "findings" in facts
    assert facts["reconcile_issues_count"] >= 1


def test_template_report_generation(seeded_p2_db: Session):
    """build_template_report creates natural text summary without LLM."""
    facts = gather_facts(seeded_p2_db, 27)  # Clean plot C1
    rep = build_template_report(facts, fact_hash="dummy_hash", lang="bn")

    assert rep["plot_id"] == 27
    assert rep["risk_level"] == "LOW"
    assert rep["source"] == "template"
    assert "মালিকানা রেকর্ড সুরক্ষিত" in rep["summary_bn"]
    assert len(rep["recommended_actions"]) >= 1


# -----------------------------------------------------------------------------
# 2. Score Enforcement & Prompt Injection Resilience
# -----------------------------------------------------------------------------

def test_post_validation_score_enforcement_overrides_llm(seeded_p2_db: Session):
    """The LLM cannot alter risk level: engine strictly overrides attempts to downgrade HIGH to LOW."""
    # Plot 24 has HIGH risk from OWNER_MISMATCH
    fake_client = FakeLLM(mode="prompt_injection_attempt")

    report = generate_due_diligence_report(
        seeded_p2_db,
        plot_id=24,
        lang="bn",
        client=fake_client,
    )

    # Invariant: despite fake LLM outputting risk_level="LOW", report MUST be HIGH
    assert report["risk_level"] == "HIGH"
    assert report["risk_score"] >= 35
    assert report["source"] == "llm"


def test_fallback_to_template_on_llm_timeout(seeded_p2_db: Session):
    """Gracefully falls back to template mode when the LLM client times out."""
    fake_client = FakeLLM(mode="timeout")

    report = generate_due_diligence_report(
        seeded_p2_db,
        plot_id=24,
        lang="bn",
        client=fake_client,
    )

    assert report["source"] == "template"
    assert report["risk_level"] == "HIGH"


def test_fallback_to_template_on_malformed_json(seeded_p2_db: Session):
    """Gracefully falls back to template mode when LLM outputs unparseable JSON."""
    fake_client = FakeLLM(mode="malformed_json")

    report = generate_due_diligence_report(
        seeded_p2_db,
        plot_id=24,
        lang="bn",
        client=fake_client,
    )

    assert report["source"] == "template"


def test_fallback_to_template_when_api_key_unset(seeded_p2_db: Session):
    """When LLM API key is empty/unset, defaults directly to deterministic template."""
    orig_key = settings.llm_api_key
    try:
        settings.llm_api_key = ""
        report = generate_due_diligence_report(
            seeded_p2_db,
            plot_id=27,
            lang="bn",
            client=None,
        )
        assert report["source"] == "template"
    finally:
        settings.llm_api_key = orig_key


# -----------------------------------------------------------------------------
# 3. 10-Minute Caching & API Endpoint
# -----------------------------------------------------------------------------

def test_due_diligence_report_caching(seeded_p2_db: Session):
    """Subsequent calls for the same plot return the cached report matching fact_hash."""
    rep1 = generate_due_diligence_report(seeded_p2_db, plot_id=27, lang="bn")
    rep2 = generate_due_diligence_report(seeded_p2_db, plot_id=27, lang="bn")

    assert rep1["fact_hash"] == rep2["fact_hash"]
    assert rep1["generated_at"] == rep2["generated_at"]


def test_due_diligence_api_endpoint(client: TestClient, seeded_p2_db: Session):
    """POST /api/v1/reports/due-diligence generates report successfully."""
    payload = {"plot_id": 27, "lang": "bn"}
    res = client.post("/api/v1/reports/due-diligence", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["plot_id"] == 27
    assert data["risk_level"] == "LOW"
    assert "summary_bn" in data and "summary_en" in data
    assert "recommended_actions" in data
    assert "disclaimer" in data


def test_due_diligence_api_feature_flag_disabled(client: TestClient, seeded_p2_db: Session):
    """Endpoint returns 404 when feature_agent is False."""
    try:
        settings.feature_agent = False
        res = client.post("/api/v1/reports/due-diligence", json={"plot_id": 27, "lang": "bn"})
        assert res.status_code == 404
    finally:
        settings.feature_agent = True


def test_due_diligence_nonexistent_plot_404(client: TestClient, seeded_p2_db: Session):
    """Non-existent plot ID returns 404."""
    res = client.post("/api/v1/reports/due-diligence", json={"plot_id": 99999, "lang": "bn"})
    assert res.status_code == 404
