from datetime import datetime, timezone
import nacl.signing
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.audit import AuditLog
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token, hash_password
from app.services.fraud.integrity import IntegrityLayer
from app.services.fraud.rules import RulesLayer
from app.services.pipeline.base import AnalysisContext, DealSubject, Finding, Layer
from app.services.pipeline.engine import assess, level_from_score
from app.services.pipeline.registry import get_layers
from scripts.seed import seed_data


from app.config import settings
from app.services.crypto import load_or_create_key


@pytest.fixture
def seeded_db(db_session: Session):
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    return db_session


# -----------------------------------------------------------------------------
# 1. Pipeline Engine Logic Tests
# -----------------------------------------------------------------------------

def test_engine_score_levels_and_capping():
    assert level_from_score(0) == "LOW"
    assert level_from_score(24) == "LOW"
    assert level_from_score(25) == "MEDIUM"
    assert level_from_score(59) == "MEDIUM"
    assert level_from_score(60) == "HIGH"
    assert level_from_score(84) == "HIGH"
    assert level_from_score(85) == "CRITICAL"
    assert level_from_score(100) == "CRITICAL"


def test_engine_logic_floor_and_advisory(db_session: Session):
    plot = Plot(
        mouza="টেস্ট", upazila="টেস্ট", district="ঢাকা",
        dag_no="101", area_decimal=20.0, land_type="residential",
        flags=[], initial_owner_id=1, current_owner_id=1,
    )
    ctx = AnalysisContext(db=db_session, plot=plot)

    class CustomDecisiveLayer(Layer):
        name = "custom_decisive"
        def analyze(self, c):
            return [
                # Score 30 would normally be MEDIUM, but CRITICAL severity raises floor
                Finding(
                    layer="custom", rule_id="C1", severity="CRITICAL",
                    weight=30, decisive=True, reasons=["Critical finding"],
                )
            ]

    class AdvisoryLayer(Layer):
        name = "custom_advisory"
        def analyze(self, c):
            return [
                # Advisory finding with high weight should NOT affect score
                Finding(
                    layer="ml", rule_id="ML1", severity="HIGH",
                    weight=50, decisive=False, reasons=["Advisory score"],
                )
            ]

    report = assess(ctx, [CustomDecisiveLayer(), AdvisoryLayer()])
    assert report["score"] == 30
    assert report["level"] == "CRITICAL"  # Floor applied
    assert report["mode"] == "PLOT"
    assert report["has_critical"] is True
    assert len(report["findings"]) == 2


def test_engine_skips_failing_layer(db_session: Session):
    plot = Plot(
        mouza="টেস্ট", upazila="টেস্ট", district="ঢাকা",
        dag_no="102", area_decimal=20.0, land_type="residential",
        flags=[], initial_owner_id=1, current_owner_id=1,
    )
    ctx = AnalysisContext(db=db_session, plot=plot)

    class BrokenLayer(Layer):
        name = "broken"
        def analyze(self, c):
            raise RuntimeError("Database connection timed out")

    class WorkingLayer(Layer):
        name = "working"
        def analyze(self, c):
            return [
                Finding(
                    layer="working", rule_id="W1", severity="LOW",
                    weight=10, decisive=True, reasons=["All good"],
                )
            ]

    # Broken layer must not crash assess
    report = assess(ctx, [BrokenLayer(), WorkingLayer()])
    assert report["score"] == 10
    assert report["level"] == "LOW"
    assert len(report["findings"]) == 1


def test_engine_mode_fields(db_session: Session):
    plot = Plot(
        mouza="টেস্ট", upazila="টেস্ট", district="ঢাকা",
        dag_no="103", area_decimal=20.0, land_type="residential",
        flags=[], initial_owner_id=1, current_owner_id=1,
    )

    class DummyCriticalLayer(Layer):
        name = "dummy"
        def analyze(self, c):
            return [Finding("dummy", "D1", "CRITICAL", 60, True, ["Critical"])]

    # 1. PLOT mode (proposed is None)
    ctx_plot = AnalysisContext(db=db_session, plot=plot, proposed=None)
    rep_plot = assess(ctx_plot, [DummyCriticalLayer()])
    assert rep_plot["mode"] == "PLOT"
    assert "has_critical" in rep_plot
    assert rep_plot["has_critical"] is True
    assert "blocked" not in rep_plot

    # 2. PROPOSED mode (proposed is set)
    subject = DealSubject(seller_id=1, buyer_id=2, area_sold=10.0, at=datetime.now(timezone.utc))
    ctx_prop = AnalysisContext(db=db_session, plot=plot, proposed=subject)
    rep_prop = assess(ctx_prop, [DummyCriticalLayer()])
    assert rep_prop["mode"] == "PROPOSED"
    assert "blocked" in rep_prop
    assert rep_prop["blocked"] is True
    assert "has_critical" not in rep_prop


# -----------------------------------------------------------------------------
# 2. Seeded Scenarios (S1, S2, S6, S7, S8) & R5 Tamper Tests
# -----------------------------------------------------------------------------

def test_scenario_s1_double_sale_fires_r1_not_r2(seeded_db: Session):
    # Plot 1 in seeded dataset is S1
    plot = seeded_db.get(Plot, 1)
    assert plot is not None

    rules_layer = RulesLayer()
    ctx = AnalysisContext(db=seeded_db, plot=plot)
    findings = rules_layer.analyze(ctx)

    # S1 target deed is DHAKA-2026-000002
    s1_findings = [f for f in findings if f.deed_no == "DHAKA-2026-000002"]
    assert len(s1_findings) == 1

    f = s1_findings[0]
    assert f.rule_id == "R1"
    assert "R1_DOUBLE_SALE" in f.reasons[0]
    assert f.severity == "CRITICAL"

    # Confirm R2 did NOT fire for this deed
    assert not any(f.rule_id == "R2" for f in s1_findings)


def test_scenario_s2_not_owner_fires_r2_not_r1(seeded_db: Session):
    # Plot 2 in seeded dataset is S2
    plot = seeded_db.get(Plot, 2)
    assert plot is not None

    rules_layer = RulesLayer()
    ctx = AnalysisContext(db=seeded_db, plot=plot)
    findings = rules_layer.analyze(ctx)

    # S2 target deed is DHAKA-2026-000003
    s2_findings = [f for f in findings if f.deed_no == "DHAKA-2026-000003"]
    assert len(s2_findings) == 1

    f = s2_findings[0]
    assert f.rule_id == "R2"
    assert "R2_SELLER_NOT_OWNER" in f.reasons[0]
    assert f.severity == "CRITICAL"

    # Confirm R1 did NOT fire
    assert not any(f.rule_id == "R1" for f in s2_findings)


def test_scenario_s6_clean_not_blocked(seeded_db: Session):
    plot = seeded_db.get(Plot, 6)
    ctx = AnalysisContext(db=seeded_db, plot=plot)

    report = assess(ctx, get_layers())
    # S6 clean deals should not have critical findings
    critical_findings = [f for f in report["findings"] if f["severity"] == "CRITICAL"]
    assert len(critical_findings) == 0
    assert report["has_critical"] is False


def test_scenario_s7_legit_pending_resale_not_blocked(seeded_db: Session):
    plot = seeded_db.get(Plot, 7)
    ctx = AnalysisContext(db=seeded_db, plot=plot)

    rules_layer = RulesLayer()
    findings = rules_layer.analyze(ctx)

    # Target deed DHAKA-2026-000012 (B reselling to C) must NOT fire R1 or R2
    target_findings = [f for f in findings if f.deed_no == "DHAKA-2026-000012"]
    assert len(target_findings) == 0


def test_scenario_s8_partial_sales_not_blocked(seeded_db: Session):
    plot = seeded_db.get(Plot, 8)
    ctx = AnalysisContext(db=seeded_db, plot=plot)

    rules_layer = RulesLayer()
    findings = rules_layer.analyze(ctx)
    assert len(findings) == 0


def test_integrity_layer_r5_on_tampered_plot(seeded_db: Session):
    plot = seeded_db.get(Plot, 6)
    deed = seeded_db.scalars(select(Deed).where(Deed.plot_id == plot.id)).first()
    assert deed is not None

    # Tamper payload text
    deed.payload_json = deed.payload_json.replace("sale", "gift")
    seeded_db.flush()

    integrity_layer = IntegrityLayer()
    ctx = AnalysisContext(db=seeded_db, plot=plot)
    findings = integrity_layer.analyze(ctx)

    r5_findings = [f for f in findings if f.rule_id == "R5"]
    assert len(r5_findings) >= 1
    assert any("HASH_MISMATCH" in r for f in r5_findings for r in f.reasons)
    assert r5_findings[0].severity == "CRITICAL"
    assert r5_findings[0].weight == 100


# -----------------------------------------------------------------------------
# 3. API Integration: POST /api/v1/deeds 409 Fraud Blocking Tests
# -----------------------------------------------------------------------------

def test_api_post_deeds_double_sale_blocked_with_409(client: TestClient, seeded_db: Session):
    # Setup registrar token
    reg_user = seeded_db.scalars(select(User).where(User.username == "registrar1")).first()
    token = create_access_token(sub=reg_user.username, role=reg_user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # Plot 1: Initial owner has sold full area in deed 1 (unmutated).
    # Attempting to sell area from the initial owner again must trigger R1_DOUBLE_SALE and HTTP 409.
    plot = seeded_db.get(Plot, 1)
    first_deed = seeded_db.scalars(select(Deed).where(Deed.plot_id == plot.id)).first()

    deed_count_before = len(seeded_db.scalars(select(Deed).where(Deed.plot_id == plot.id)).all())
    ledger_count_before = len(seeded_db.scalars(select(LedgerEntry).where(LedgerEntry.plot_id == plot.id)).all())
    alert_count_before = len(seeded_db.scalars(select(Alert).where(Alert.plot_id == plot.id)).all())

    double_sale_payload = {
        "plot_id": plot.id,
        "seller_id": first_deed.seller_id,
        "buyer_id": 99,  # another buyer
        "area_sold": float(first_deed.area_sold),
        "deed_type": "SALE",
        "sub_registry": "MIR",
    }

    response = client.post("/api/v1/deeds", json=double_sale_payload, headers=headers)
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "FRAUD_BLOCKED"
    assert "report" in body
    report = body["report"]
    assert report["blocked"] is True
    assert report["level"] == "CRITICAL"
    assert any(f["rule_id"] == "R1" for f in report["findings"])

    # Verify no new deed or ledger entry was created
    deed_count_after = len(seeded_db.scalars(select(Deed).where(Deed.plot_id == plot.id)).all())
    ledger_count_after = len(seeded_db.scalars(select(LedgerEntry).where(LedgerEntry.plot_id == plot.id)).all())
    assert deed_count_after == deed_count_before
    assert ledger_count_after == ledger_count_before

    # Verify Alert and AuditLog rows were persisted
    alerts = seeded_db.scalars(select(Alert).where(Alert.plot_id == plot.id)).all()
    assert len(alerts) == alert_count_before + 1
    new_alert = alerts[-1]
    assert new_alert.severity == "CRITICAL"
    assert "R1" in new_alert.rule_id
    assert new_alert.status == "OPEN"

    audits = seeded_db.scalars(select(AuditLog).where(AuditLog.entity_id == plot.id)).all()
    assert len(audits) >= 1
    assert any(a.action == "PRE_REGISTER_BLOCKED" for a in audits)


def test_api_post_deeds_clean_registration_succeeds_201(client: TestClient, seeded_db: Session):
    reg_user = seeded_db.scalars(select(User).where(User.username == "registrar1")).first()
    token = create_access_token(sub=reg_user.username, role=reg_user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # Plot 8 (S8) has 10 decimals remaining for the initial owner
    plot = seeded_db.get(Plot, 8)
    initial_owner_id = plot.initial_owner_id

    # Register clean sale of 5 decimals (well within remaining 10)
    clean_payload = {
        "plot_id": plot.id,
        "seller_id": initial_owner_id,
        "buyer_id": 50,
        "area_sold": 5.0,
        "deed_type": "SALE",
        "sub_registry": "MIR",
    }

    response = client.post("/api/v1/deeds", json=clean_payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["deed"]["area_sold"] == 5.0
    assert data["verify"]["status"] == "VALID"
