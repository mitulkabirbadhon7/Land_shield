import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.person import Person
from app.models.user import User
from app.security import create_access_token, hash_password


@pytest.fixture
def meta_test_setup(db_session: Session):
    reg_user = User(
        name="Sub Registrar",
        username="registrar_user",
        role="registrar",
        password_hash=hash_password("Pass123!"),
    )
    admin_user = User(
        name="System Admin",
        username="admin_user",
        role="admin",
        password_hash=hash_password("Pass123!"),
    )
    officer_user = User(
        name="Land Officer",
        username="officer_user",
        role="officer",
        password_hash=hash_password("Pass123!"),
    )
    p1 = Person(display_name="মোহাম্মদ রফিকুল ইসলাম", is_synthetic=True)
    p2 = Person(display_name="ফাতেমা বেগম", is_synthetic=True)
    p3 = Person(display_name="আনিসুর রহমান খাঁন", is_synthetic=True)

    db_session.add_all([reg_user, admin_user, officer_user, p1, p2, p3])
    db_session.commit()

    return {
        "registrar_token": create_access_token(sub=reg_user.username, role=reg_user.role),
        "admin_token": create_access_token(sub=admin_user.username, role=admin_user.role),
        "officer_token": create_access_token(sub=officer_user.username, role=officer_user.role),
        "p1_id": p1.id,
        "p2_id": p2.id,
        "p3_id": p3.id,
    }


def test_meta_endpoint_unauthorized(client: TestClient):
    res = client.get("/api/v1/meta")
    assert res.status_code == 401


def test_meta_endpoint_success(client: TestClient, meta_test_setup: dict):
    headers = {"Authorization": f"Bearer {meta_test_setup['registrar_token']}"}
    res = client.get("/api/v1/meta", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "deed_types" in data
    assert "sub_registries" in data
    assert "SALE" in data["deed_types"]
    assert any(sr["code"] == "MIR" for sr in data["sub_registries"])


def test_persons_search_unauthorized(client: TestClient):
    res = client.get("/api/v1/persons/search")
    assert res.status_code == 401


def test_persons_search_officer_forbidden(client: TestClient, meta_test_setup: dict):
    headers = {"Authorization": f"Bearer {meta_test_setup['officer_token']}"}
    res = client.get("/api/v1/persons/search", headers=headers)
    assert res.status_code == 403


def test_persons_search_registrar_success(client: TestClient, meta_test_setup: dict):
    headers = {"Authorization": f"Bearer {meta_test_setup['registrar_token']}"}

    # Empty query returns list
    res = client.get("/api/v1/persons/search", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3

    # Search by Bangla name substring
    res = client.get("/api/v1/persons/search?q=ফাতেমা", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["display_name"] == "ফাতেমা বেগম"
    assert data[0]["id"] == meta_test_setup["p2_id"]

    # Search by ID
    target_id = meta_test_setup["p1_id"]
    res = client.get(f"/api/v1/persons/search?q={target_id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert any(p["id"] == target_id for p in data)


def test_persons_search_admin_success(client: TestClient, meta_test_setup: dict):
    headers = {"Authorization": f"Bearer {meta_test_setup['admin_token']}"}
    res = client.get("/api/v1/persons/search", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) >= 3
