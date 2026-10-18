from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.alert import Alert
from app.models.deed import Deed
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token, hash_password
from app.services.crypto import load_or_create_key
from scripts.seed import seed_data


@pytest.fixture
def seeded_db(db_session: Session):
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    return db_session


@pytest.fixture
def tokens(seeded_db: Session):
    # Ensure officer, admin, and registrar users exist
    officer = seeded_db.scalars(select(User).where(User.role == "officer")).first()
    admin = seeded_db.scalars(select(User).where(User.role == "admin")).first()
    registrar = seeded_db.scalars(select(User).where(User.role == "registrar")).first()

    return {
        "officer": create_access_token(officer.username, "officer"),
        "admin": create_access_token(admin.username, "admin"),
        "registrar": create_access_token(registrar.username, "registrar"),
    }


# -----------------------------------------------------------------------------
# 1. Scenarios S1 - S8 Verification via Risk API
# -----------------------------------------------------------------------------

def test_risk_api_s1_double_sale(client: TestClient, seeded_db: Session):
    # S1 is Plot 1: Second deed DHAKA-2026-000002 has double sale
    res = client.get("/api/v1/risk/plot/1?lang=en")
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "PLOT"
    assert "blocked" not in data
    assert data["has_critical"] is True
    assert data["score"] >= 60

    r1_findings = [f for f in data["findings"] if f["rule_id"] == "R1"]
    assert len(r1_findings) > 0
    double_sale = [f for f in r1_findings if f["sub_code"] == "DOUBLE_SALE"]
    assert len(double_sale) == 1
    assert double_sale[0]["deed_no"] == "DHAKA-2026-000002"
    assert "Double-sale" in double_sale[0]["text"]
    assert "DHAKA-2026-000002" in double_sale[0]["text"]


def test_risk_api_s2_seller_not_owner(client: TestClient, seeded_db: Session):
    # S2 is Plot 2: Stranger sells land -> R2 NOT_OWNER
    res = client.get("/api/v1/risk/plot/2?lang=en")
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "PLOT"
    assert data["has_critical"] is True

    r2_findings = [f for f in data["findings"] if f["rule_id"] == "R2"]
    assert len(r2_findings) == 1
    assert r2_findings[0]["sub_code"] == "NOT_OWNER"
    assert r2_findings[0]["deed_no"] == "DHAKA-2026-000003"
    assert "not the owner" in r2_findings[0]["text"].lower()


def test_risk_api_s3_missing_mutation(client: TestClient, seeded_db: Session):
    # S3 is Plot 3: Active deed registered 120 days ago with no completed mutation
    res = client.get("/api/v1/risk/plot/3?lang=en")
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "PLOT"
    assert data["level"] in ["MEDIUM", "HIGH"]
    assert data["has_critical"] is False

    r3_findings = [f for f in data["findings"] if f["rule_id"] == "R3"]
    assert len(r3_findings) == 1
    assert r3_findings[0]["sub_code"] == "MISSING_MUTATION"
    assert r3_findings[0]["deed_no"] == "DHAKA-2026-000004"
    assert "90 days" in r3_findings[0]["text"]


def test_risk_api_s4_rapid_transfers(client: TestClient, seeded_db: Session):
    # S4 is Plot 4: 4 deeds within 20 days -> R4 RAPID_TRANSFERS, no R1/R2
    res = client.get("/api/v1/risk/plot/4?lang=en")
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "PLOT"
    assert data["level"] in ["HIGH", "CRITICAL"]

    r4_findings = [f for f in data["findings"] if f["rule_id"] == "R4"]
    assert len(r4_findings) == 1
    assert r4_findings[0]["sub_code"] == "RAPID_TRANSFERS"

    # Confirm no false positive R1 or R2
    assert not any(f["rule_id"] in ["R1", "R2"] for f in data["findings"])


def test_risk_api_s5_flagged_land(client: TestClient, seeded_db: Session):
    # S5 is Plot 5: khas/disputed flags and open case -> R6 FLAGGED_LAND
    res = client.get("/api/v1/risk/plot/5?lang=en")
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "PLOT"
    assert "khas" in [f.lower() for f in data["flags"]]

    r6_findings = [f for f in data["findings"] if f["rule_id"] == "R6"]
    assert len(r6_findings) == 1
    assert r6_findings[0]["sub_code"] == "FLAGGED_LAND"
    assert "Restricted or disputed" in r6_findings[0]["text"]


def test_risk_api_s6_clean_land_deal(client: TestClient, seeded_db: Session):
    # S6 is Plot 6: Fully mutated sequential transfers -> clean, LOW risk
    res = client.get("/api/v1/risk/plot/6?lang=en")
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "PLOT"
    assert data["score"] == 0
    assert data["level"] == "LOW"
    assert data["has_critical"] is False
    assert len(data["findings"]) == 0
    assert data["chain_ok"] is True
    assert data["mutation_summary"]["total_deeds"] == 2
    assert data["mutation_summary"]["mutated_deeds"] == 2


def test_risk_api_s7_and_s8_no_r1_r2(client: TestClient, seeded_db: Session):
    # S7: Legit pending resale; S8: Partial sales -> no R1 / R2 false positives
    for plot_id in [7, 8]:
        res = client.get(f"/api/v1/risk/plot/{plot_id}")
        assert res.status_code == 200
        data = res.json()
        assert not any(f["rule_id"] in ["R1", "R2"] for f in data["findings"])


# -----------------------------------------------------------------------------
# 2. Bilingual Explanations & Aliasing
# -----------------------------------------------------------------------------

def test_risk_api_bilingual_explanations(client: TestClient, seeded_db: Session):
    # Bengali (default)
    res_bn = client.get("/api/v1/risk/plot/1?lang=bn")
    assert res_bn.status_code == 200
    data_bn = res_bn.json()
    finding_bn = next(f for f in data_bn["findings"] if f["sub_code"] == "DOUBLE_SALE")
    assert "দলিল DHAKA-2026-000002" in finding_bn["text"]
    assert "দ্বৈত বিক্রয়" in finding_bn["text"]

    # English
    res_en = client.get("/api/v1/risk/plot/1?lang=en")
    assert res_en.status_code == 200
    data_en = res_en.json()
    finding_en = next(f for f in data_en["findings"] if f["sub_code"] == "DOUBLE_SALE")
    assert "Deed DHAKA-2026-000002" in finding_en["text"]
    assert "Double-sale" in finding_en["text"]


def test_risk_api_alias_and_masked_public(client: TestClient, seeded_db: Session):
    # Public access without auth
    res_risk = client.get("/api/v1/risk/plot/1")
    assert res_risk.status_code == 200

    # /api/v1/analysis/plot/1 returns common base risk fields plus extended Phase 2 payload
    res_analysis = client.get("/api/v1/analysis/plot/1")
    assert res_analysis.status_code == 200
    risk_data = res_risk.json()
    analysis_data = res_analysis.json()
    for k in ["mode", "score", "level", "has_critical", "findings", "chain_ok", "flags", "mutation_summary"]:
        assert risk_data[k] == analysis_data[k]
    assert "layers_run" in analysis_data

    # Root path also works
    res_root = client.get("/risk/plot/1")
    assert res_root.status_code == 200
    assert res_root.json() == res_risk.json()

    # Non-existent plot returns 404
    res_404 = client.get("/api/v1/risk/plot/999999")
    assert res_404.status_code == 404


# -----------------------------------------------------------------------------
# 3. Alerts RBAC and Status Management
# -----------------------------------------------------------------------------

def test_alerts_rbac_and_patch(client: TestClient, seeded_db: Session, tokens: dict):
    # Insert a test alert
    alert = Alert(
        plot_id=1,
        rule_id="R1",
        severity="CRITICAL",
        reasons=["Double sale attempt"],
        status="OPEN",
    )
    seeded_db.add(alert)
    seeded_db.commit()
    seeded_db.refresh(alert)
    alert_id = alert.id

    # 1. Unauthenticated -> 401
    res_unauth = client.get("/api/v1/alerts")
    assert res_unauth.status_code == 401

    # 2. Registrar role -> 403
    res_reg = client.get(
        "/api/v1/alerts",
        headers={"Authorization": f"Bearer {tokens['registrar']}"},
    )
    assert res_reg.status_code == 403

    # 3. Officer role -> 200 OK
    res_off = client.get(
        "/api/v1/alerts",
        headers={"Authorization": f"Bearer {tokens['officer']}"},
    )
    assert res_off.status_code == 200
    alerts_list = res_off.json()
    assert any(a["id"] == alert_id for a in alerts_list)

    # 4. Filters work
    res_filtered = client.get(
        "/api/v1/alerts?status=OPEN&severity=CRITICAL",
        headers={"Authorization": f"Bearer {tokens['officer']}"},
    )
    assert res_filtered.status_code == 200
    assert all(a["status"] == "OPEN" and a["severity"] == "CRITICAL" for a in res_filtered.json())

    # 5. Officer PATCH alert status to ACK
    res_patch_ack = client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={"status": "ACK"},
        headers={"Authorization": f"Bearer {tokens['officer']}"},
    )
    assert res_patch_ack.status_code == 200
    assert res_patch_ack.json()["status"] == "ACK"

    # 6. Admin PATCH alert status to RESOLVED
    res_patch_res = client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={"status": "RESOLVED"},
        headers={"Authorization": f"Bearer {tokens['admin']}"},
    )
    assert res_patch_res.status_code == 200
    assert res_patch_res.json()["status"] == "RESOLVED"

    # 7. Invalid status -> 422
    res_invalid = client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={"status": "INVALID_STATUS"},
        headers={"Authorization": f"Bearer {tokens['admin']}"},
    )
    assert res_invalid.status_code == 422


def test_risk_api_latest_mutation_state_and_clean_summary(client: TestClient, seeded_db: Session):
    # S6 has all completed mutations -> latest_mutation_state must be KHATIAN_UPDATED and missing_mutations must be 0
    res = client.get("/api/v1/risk/plot/6")
    assert res.status_code == 200
    data = res.json()
    summary = data["mutation_summary"]
    assert summary["latest_mutation_state"] == "KHATIAN_UPDATED"
    assert summary["missing_mutations"] == 0
    assert summary["mutated_deeds"] >= 1
