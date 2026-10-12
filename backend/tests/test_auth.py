from datetime import timedelta
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.v1.auth import limiter
from app.config import settings
from app.deps import require_role
from app.main import app, lifespan
from app.models.user import User
from app.security import create_access_token, hash_password


# Add dummy protected routes to app for RBAC testing
@app.get("/api/v1/test/dummy-officer")
def dummy_officer_route(user: User = Depends(require_role("officer"))):
    return {"user": user.username, "role": user.role}


@app.get("/api/v1/test/dummy-registrar")
def dummy_registrar_route(user: User = Depends(require_role("registrar"))):
    return {"user": user.username, "role": user.role}


def test_login_success(client: TestClient, db_session: Session):
    pwd_hash = hash_password("CorrectPassword123!")
    user = User(
        name="Officer Demo",
        username="officer_demo",
        role="officer",
        password_hash=pwd_hash,
    )
    db_session.add(user)
    db_session.flush()

    response = client.post(
        "/api/v1/auth/login",
        json={"username": "officer_demo", "password": "CorrectPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "officer"
    assert data["name"] == "Officer Demo"


def test_login_failure(client: TestClient, db_session: Session):
    pwd_hash = hash_password("CorrectPassword123!")
    user = User(
        name="Registrar Demo",
        username="registrar_demo",
        role="registrar",
        password_hash=pwd_hash,
    )
    db_session.add(user)
    db_session.flush()

    # Wrong password
    res_wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"username": "registrar_demo", "password": "WrongPassword!"},
    )
    assert res_wrong_pw.status_code == 401
    assert res_wrong_pw.json()["detail"] == "Invalid username or password"

    # Nonexistent user
    res_no_user = client.post(
        "/api/v1/auth/login",
        json={"username": "ghost_user", "password": "AnyPassword123!"},
    )
    assert res_no_user.status_code == 401
    assert res_no_user.json()["detail"] == "Invalid username or password"


def test_protected_dummy_route_rbac(client: TestClient, db_session: Session):
    # Setup two users: registrar and officer
    u_reg = User(name="Reg", username="reg_user", role="registrar", password_hash=hash_password("pw"))
    u_off = User(name="Off", username="off_user", role="officer", password_hash=hash_password("pw"))
    db_session.add_all([u_reg, u_off])
    db_session.flush()

    # 1. Unauthenticated -> 401
    res_no_token = client.get("/api/v1/test/dummy-officer")
    assert res_no_token.status_code == 401

    # 2. Authenticated as wrong role (registrar) -> 403
    reg_token = create_access_token(sub=u_reg.username, role=u_reg.role)
    res_wrong_role = client.get(
        "/api/v1/test/dummy-officer",
        headers={"Authorization": f"Bearer {reg_token}"},
    )
    assert res_wrong_role.status_code == 403
    assert "forbidden" in res_wrong_role.json()["detail"].lower()

    # 3. Authenticated as right role (officer) -> 200
    off_token = create_access_token(sub=u_off.username, role=u_off.role)
    res_right_role = client.get(
        "/api/v1/test/dummy-officer",
        headers={"Authorization": f"Bearer {off_token}"},
    )
    assert res_right_role.status_code == 200
    assert res_right_role.json() == {"user": "off_user", "role": "officer"}


def test_token_expiry_check(client: TestClient, db_session: Session):
    user = User(name="Off", username="off_exp", role="officer", password_hash=hash_password("pw"))
    db_session.add(user)
    db_session.flush()

    # Generate an already expired token (negative timedelta)
    expired_token = create_access_token(
        sub=user.username,
        role=user.role,
        expires_delta=timedelta(seconds=-10),
    )

    res = client.get(
        "/api/v1/test/dummy-officer",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    assert "invalid or expired" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_startup_refusal_on_insecure_jwt_secret():
    orig_demo = settings.demo_mode
    orig_secret = settings.jwt_secret
    try:
        settings.demo_mode = False
        settings.jwt_secret = "change-me"
        with pytest.raises(RuntimeError, match="Refusing to run"):
            async with lifespan(app):
                pass
    finally:
        settings.demo_mode = orig_demo
        settings.jwt_secret = orig_secret


def test_admin_bypasses_role_checks(client: TestClient, db_session: Session):
    pwd_hash = hash_password("AdminPass123!")
    admin_user = User(
        name="Admin Demo",
        username="admin1",
        role="admin",
        password_hash=pwd_hash,
    )
    db_session.add(admin_user)
    db_session.flush()

    # 1. Login as admin1 to get token
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin1", "password": "AdminPass123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Call registrar-protected route with admin token -> 200
    res_reg = client.get("/api/v1/test/dummy-registrar", headers=headers)
    assert res_reg.status_code == 200
    assert res_reg.json() == {"user": "admin1", "role": "admin"}

    # 3. Call officer-protected route with admin token -> 200
    res_off = client.get("/api/v1/test/dummy-officer", headers=headers)
    assert res_off.status_code == 200
    assert res_off.json() == {"user": "admin1", "role": "admin"}


def test_login_rate_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "RATE_LIMIT", "2/minute")
    limiter.reset()

    try:
        statuses = []
        for _ in range(3):
            res = client.post(
                "/api/v1/auth/login",
                json={"username": "nonexistent_user", "password": "any_password"},
            )
            statuses.append(res.status_code)

        assert 429 in statuses
        assert statuses[-1] == 429
    finally:
        limiter.reset()
