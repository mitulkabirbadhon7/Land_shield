import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.audit import AuditLog
from app.models.deed import Deed
from app.models.user import User
from app.security import create_access_token
from app.services.crypto import load_or_create_key
from scripts.seed import seed_data


@pytest.fixture
def seeded_db(db_session: Session):
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    return db_session


@pytest.fixture
def tokens(seeded_db: Session):
    officer = seeded_db.scalars(select(User).where(User.role == "officer")).first()
    registrar = seeded_db.scalars(select(User).where(User.role == "registrar")).first()
    admin = seeded_db.scalars(select(User).where(User.role == "admin")).first()

    return {
        "officer": create_access_token(officer.username, "officer"),
        "registrar": create_access_token(registrar.username, "registrar"),
        "admin": create_access_token(admin.username, "admin"),
    }


# -----------------------------------------------------------------------------
# 1. Tamper Lab Demo Lifecycle (Tamper, 409, Restore, 409, Verification)
# -----------------------------------------------------------------------------

def test_tamper_then_verify_and_restore_lifecycle(client: TestClient, seeded_db: Session, tokens: dict):
    deed = seeded_db.scalars(select(Deed).where(Deed.deed_no == "DHAKA-2026-000010")).first()
    assert deed is not None
    deed_no = deed.deed_no
    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}


    # Verify initially valid
    verify_init = client.get(f"/api/v1/deeds/{deed_no}/verify")
    assert verify_init.status_code == 200
    assert verify_init.json()["status"] == "VALID"

    # 1. Tamper deed area
    res_tamper = client.post(f"/api/v1/dev/tamper/{deed_no}", headers=admin_headers)
    assert res_tamper.status_code == 200
    assert res_tamper.json()["status"] == "tampered"

    # Verify now fails with TAMPERED or HASH_MISMATCH
    verify_tampered = client.get(f"/api/v1/deeds/{deed_no}/verify")
    assert verify_tampered.status_code == 200
    assert verify_tampered.json()["status"] in ["TAMPERED", "HASH_MISMATCH"]

    # 2. Second tamper returns 409 ALREADY_TAMPERED
    res_tamper_2 = client.post(f"/api/v1/dev/tamper/{deed_no}", headers=admin_headers)
    assert res_tamper_2.status_code == 409
    assert res_tamper_2.json()["code"] == "ALREADY_TAMPERED"

    # 3. Restore deed
    res_restore = client.post(f"/api/v1/dev/restore/{deed_no}", headers=admin_headers)
    assert res_restore.status_code == 200
    assert res_restore.json()["status"] == "restored"

    # Verify again returns VALID
    verify_restored = client.get(f"/api/v1/deeds/{deed_no}/verify")
    assert verify_restored.status_code == 200
    assert verify_restored.json()["status"] == "VALID"

    # 4. Restore without tamper returns 409 NOT_TAMPERED
    res_restore_2 = client.post(f"/api/v1/dev/restore/{deed_no}", headers=admin_headers)
    assert res_restore_2.status_code == 409
    assert res_restore_2.json()["code"] == "NOT_TAMPERED"


# -----------------------------------------------------------------------------
# 2. Dev RBAC and DEMO_MODE Disabled Checks
# -----------------------------------------------------------------------------

def test_dev_routes_rbac_and_demo_mode_false(client: TestClient, seeded_db: Session, tokens: dict, monkeypatch: pytest.MonkeyPatch):
    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
    reg_headers = {"Authorization": f"Bearer {tokens['registrar']}"}
    off_headers = {"Authorization": f"Bearer {tokens['officer']}"}

    # 1. Unauthenticated -> 401
    assert client.get("/api/v1/dev/status").status_code == 401
    assert client.post("/api/v1/dev/tamper/DHAKA-2026-000009").status_code == 401
    assert client.post("/api/v1/dev/restore/DHAKA-2026-000009").status_code == 401

    # 2. Non-admin (Registrar / Officer) -> 403
    assert client.get("/api/v1/dev/status", headers=reg_headers).status_code == 403
    assert client.post("/api/v1/dev/tamper/DHAKA-2026-000009", headers=off_headers).status_code == 403

    # 3. /dev/status returns {"demo_mode": bool}
    res_status = client.get("/api/v1/dev/status", headers=admin_headers)
    assert res_status.status_code == 200
    assert "demo_mode" in res_status.json()

    # 4. When DEMO_MODE is false:
    monkeypatch.setattr(settings, "demo_mode", False)
    # /dev/status returns false (so UI can hide panel)
    assert client.get("/api/v1/dev/status", headers=admin_headers).json()["demo_mode"] is False
    # All other dev endpoints return 404
    assert client.post("/api/v1/dev/tamper/DHAKA-2026-000009", headers=admin_headers).status_code == 404
    assert client.post("/api/v1/dev/restore/DHAKA-2026-000009", headers=admin_headers).status_code == 404


# -----------------------------------------------------------------------------
# 3. Security Headers Middleware & Generic 500 Handler
# -----------------------------------------------------------------------------

def test_security_headers_present_on_all_responses(client: TestClient):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert res.headers.get("X-Data-Policy") == "synthetic-demo"


def test_generic_500_handler_does_not_swallow_typed_exceptions(client: TestClient, tokens: dict):
    # Verify FraudBlocked still returns 409 (not 500)
    res_blocked = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": 1,
            "seller_id": 1,
            "buyer_id": 99,
            "area_sold": 30.0,
            "deed_type": "SALE",
            "sub_registry": "MIR",
        },
        headers={"Authorization": f"Bearer {tokens['registrar']}"},
    )
    assert res_blocked.status_code == 409
    assert res_blocked.json()["code"] == "FRAUD_BLOCKED"

    # Verify DomainError still returns 422 (not 500)
    res_domain = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": 999999,
            "seller_id": 1,
            "buyer_id": 2,
            "area_sold": 10.0,
        },
        headers={"Authorization": f"Bearer {tokens['registrar']}"},
    )
    assert res_domain.status_code == 422
    assert res_domain.json()["code"] == "INVALID"


# -----------------------------------------------------------------------------
# 4. Audit Log Retrieval & End-to-End Persistence
# -----------------------------------------------------------------------------

def test_audit_logs_retrieval_and_persistence(client: TestClient, seeded_db: Session, tokens: dict):
    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
    off_headers = {"Authorization": f"Bearer {tokens['officer']}"}

    # 1. Non-admin forbidden from /audit
    assert client.get("/api/v1/audit", headers=off_headers).status_code == 403

    # 2. Admin retrieves paginated audit logs
    res = client.get("/api/v1/audit?limit=10&offset=0", headers=admin_headers)
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)

    # Check page / size query works
    res_page = client.get("/api/v1/audit?page=1&size=5", headers=admin_headers)
    assert res_page.status_code == 200
    assert len(res_page.json()) <= 5


# -----------------------------------------------------------------------------
# 5. Public Rate Limiting
# -----------------------------------------------------------------------------

def test_public_rate_limiting_triggers_429(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    from app.api.v1.auth import limiter
    monkeypatch.setattr(settings, "RATE_LIMIT", "2/minute")
    limiter.reset()

    try:
        statuses = []
        for _ in range(4):
            res = client.get("/api/v1/deeds/DHAKA-2026-000009/verify")
            statuses.append(res.status_code)

        assert 429 in statuses
        assert statuses[-1] == 429
    finally:
        limiter.reset()
