from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token
from app.services.crypto import load_or_create_key
from app.services.fraud.explain import explain
from app.services.pipeline.base import AnalysisContext
from app.services.pipeline.engine import assess
from app.services.pipeline.registry import get_layers
from app.services.reconcile import ReconcileLayer, reconcile_plot
from scripts.seed import seed_data
from scripts.seed_phase2 import seed_phase2


@pytest.fixture
def seeded_p2_db(db_session: Session) -> Session:
    """Fixture that loads Phase 1 and Phase 2 seed data."""
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    seed_phase2(db_session)
    return db_session


@pytest.fixture
def auth_tokens(seeded_p2_db: Session) -> dict[str, str]:
    officer = seeded_p2_db.scalars(select(User).where(User.role == "officer")).first()
    admin = seeded_p2_db.scalars(select(User).where(User.role == "admin")).first()
    registrar = seeded_p2_db.scalars(select(User).where(User.role == "registrar")).first()
    citizen = seeded_p2_db.scalars(select(User).where(User.role == "citizen")).first()

    if citizen is None:
        citizen = User(
            name="Demo Citizen",
            username="citizen1",
            role="citizen",
            password_hash="dummy_hash",
        )
        seeded_p2_db.add(citizen)
        seeded_p2_db.flush()

    return {
        "officer": create_access_token(officer.username, "officer"),
        "admin": create_access_token(admin.username, "admin"),
        "registrar": create_access_token(registrar.username, "registrar"),
        "citizen": create_access_token(citizen.username, "citizen"),
    }


# -----------------------------------------------------------------------------
# 1. Rule R8 Unit Tests on Canonical Benchmark Scenarios
# -----------------------------------------------------------------------------

def test_r1_scenario_owner_mismatch(seeded_p2_db: Session):
    """Scenario R1 (Plot 24): detects OWNER_MISMATCH between plot and mutation record."""
    plot = seeded_p2_db.get(Plot, 24)
    assert plot is not None

    issues = reconcile_plot(seeded_p2_db, plot)
    sub_codes = [issue[0] for issue in issues]
    assert "OWNER_MISMATCH" in sub_codes

    # Verify bilingual explanation
    for issue in issues:
        if issue[0] == "OWNER_MISMATCH":
            finding_dict = {"rule_id": "R8", "sub_code": "OWNER_MISMATCH", "reasons": [issue[1]]}
            exp_en = explain(finding_dict, lang="en")
            exp_bn = explain(finding_dict, lang="bn")
            assert "Recorded owner in AC Land office differs" in exp_en
            assert "সহকারী কমিশনার (ভূমি) অফিসের রেকর্ডভুক্ত মালিকের সাথে" in exp_bn


def test_r2_scenario_mutation_stalled(seeded_p2_db: Session):
    """Scenario R2 (Plot 25): detects MUTATION_STALLED in review > 90 days."""
    plot = seeded_p2_db.get(Plot, 25)
    assert plot is not None

    # Reference time beyond 90 days of the seed reference date
    now = datetime(2026, 10, 15, tzinfo=timezone.utc)
    issues = reconcile_plot(seeded_p2_db, plot, now=now)
    sub_codes = [issue[0] for issue in issues]
    assert "MUTATION_STALLED" in sub_codes


def test_r3_scenario_area_not_conserved(seeded_p2_db: Session):
    """Scenario R3 (Plot 26): detects AREA_NOT_CONSERVED when record holdings sum != plot area."""
    plot = seeded_p2_db.get(Plot, 26)
    assert plot is not None

    issues = reconcile_plot(seeded_p2_db, plot)
    sub_codes = [issue[0] for issue in issues]
    assert "AREA_NOT_CONSERVED" in sub_codes


def test_clean_plots_yield_zero_reconciliation_issues(seeded_p2_db: Session):
    """Clean plots (C1 Plot 27, S6 Plot 6, S7 Plot 7, S8 Plot 8) must yield 0 reconciliation issues."""
    for plot_id in [27, 6, 7, 8]:
        plot = seeded_p2_db.get(Plot, plot_id)
        if plot:
            issues = reconcile_plot(seeded_p2_db, plot)
            assert len(issues) == 0, f"Plot {plot_id} was expected to be clean, got issues: {issues}"


# -----------------------------------------------------------------------------
# 2. Pipeline Integration & Feature Flag Bypass
# -----------------------------------------------------------------------------

def test_reconcile_layer_pipeline_integration(seeded_p2_db: Session):
    """ReconcileLayer runs and emits decisive HIGH findings when feature_reconcile=True."""
    plot = seeded_p2_db.get(Plot, 24)
    ctx = AnalysisContext(db=seeded_p2_db, plot=plot)

    # With flag enabled
    settings.feature_reconcile = True
    layers = get_layers()
    report = assess(ctx, layers)

    assert "reconcile" in report["layers_run"]
    r8_findings = [f for f in report["findings"] if f.get("rule_id") == "R8"]
    assert len(r8_findings) >= 1
    assert r8_findings[0]["sub_code"] == "OWNER_MISMATCH"
    assert r8_findings[0]["severity"] == "HIGH"
    assert r8_findings[0]["weight"] == 35
    assert r8_findings[0]["decisive"] is True


def test_reconcile_layer_flag_disabled(seeded_p2_db: Session):
    """ReconcileLayer is bypassed completely when feature_reconcile=False."""
    plot = seeded_p2_db.get(Plot, 24)
    ctx = AnalysisContext(db=seeded_p2_db, plot=plot)

    try:
        settings.feature_reconcile = False
        layers = get_layers()
        report = assess(ctx, layers)

        assert "reconcile" not in report["layers_run"]
        r8_findings = [f for f in report["findings"] if f.get("rule_id") == "R8"]
        assert len(r8_findings) == 0
    finally:
        settings.feature_reconcile = True


# -----------------------------------------------------------------------------
# 3. RBAC & API Endpoint Verification
# -----------------------------------------------------------------------------

def test_reconcile_api_rbac(client: TestClient, seeded_p2_db: Session, auth_tokens: dict[str, str]):
    """Reconcile endpoints enforce strict officer/admin RBAC."""
    # Unauthenticated -> 401
    res = client.get("/api/v1/reconcile")
    assert res.status_code == 401

    res = client.get("/api/v1/reconcile/24")
    assert res.status_code == 401

    # Citizen -> 403
    citizen_headers = {"Authorization": f"Bearer {auth_tokens['citizen']}"}
    res = client.get("/api/v1/reconcile", headers=citizen_headers)
    assert res.status_code == 403

    res = client.get("/api/v1/reconcile/24", headers=citizen_headers)
    assert res.status_code == 403

    # Registrar -> 403
    registrar_headers = {"Authorization": f"Bearer {auth_tokens['registrar']}"}
    res = client.get("/api/v1/reconcile", headers=registrar_headers)
    assert res.status_code == 403

    res = client.get("/api/v1/reconcile/24", headers=registrar_headers)
    assert res.status_code == 403

    # Officer -> 200
    officer_headers = {"Authorization": f"Bearer {auth_tokens['officer']}"}
    res = client.get("/api/v1/reconcile", headers=officer_headers)
    assert res.status_code == 200

    res = client.get("/api/v1/reconcile/24", headers=officer_headers)
    assert res.status_code == 200

    # Admin -> 200
    admin_headers = {"Authorization": f"Bearer {auth_tokens['admin']}"}
    res = client.get("/api/v1/reconcile", headers=admin_headers)
    assert res.status_code == 200


def test_reconcile_detail_endpoint_content(client: TestClient, seeded_p2_db: Session, auth_tokens: dict[str, str]):
    """Detailed reconciliation returns plot metadata, holdings, stalled list, issues, and status."""
    headers = {"Authorization": f"Bearer {auth_tokens['officer']}"}

    # Test Plot 24 (R1 Discrepancy)
    res = client.get("/api/v1/reconcile/24", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["plot_id"] == 24
    assert data["status"] == "DISCREPANCY"
    assert data["is_clean"] is False
    assert len(data["issues"]) >= 1
    issue = data["issues"][0]
    assert issue["sub_code"] == "OWNER_MISMATCH"
    assert issue["rule_id"] == "R8"
    assert "message_bn" in issue and "message_en" in issue
    assert "ledger_holdings" in data
    assert "record_holdings" in data

    # Test Plot 27 (Clean Plot C1)
    res_clean = client.get("/api/v1/reconcile/27", headers=headers)
    assert res_clean.status_code == 200
    data_clean = res_clean.json()
    assert data_clean["plot_id"] == 27
    assert data_clean["status"] == "ALIGNED"
    assert data_clean["is_clean"] is True
    assert len(data_clean["issues"]) == 0


def test_reconcile_list_filtering(client: TestClient, seeded_p2_db: Session, auth_tokens: dict[str, str]):
    """List endpoint correctly filters by discrepancy type and handles pagination."""
    headers = {"Authorization": f"Bearer {auth_tokens['officer']}"}

    res = client.get("/api/v1/reconcile?type=OWNER_MISMATCH", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert "OWNER_MISMATCH" in item["sub_codes"]
