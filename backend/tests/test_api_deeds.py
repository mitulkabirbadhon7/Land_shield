import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token, hash_password


@pytest.fixture
def test_setup(db_session: Session):
    # Create registrar user
    reg_user = User(
        name="Sub Registrar",
        username="reg_tester",
        role="registrar",
        password_hash=hash_password("password123"),
    )
    # Create officer user
    off_user = User(
        name="Land Officer",
        username="off_tester",
        role="officer",
        password_hash=hash_password("password123"),
    )
    # Create synthetic persons
    seller = Person(
        display_name="মোহাম্মদ রফিকুল ইসলাম",
        is_synthetic=True,
    )
    buyer = Person(
        display_name="আনিসুর রহমান খাঁন",
        is_synthetic=True,
    )
    db_session.add_all([reg_user, off_user, seller, buyer])
    db_session.flush()

    plot = Plot(
        mouza="ধানমন্ডি",
        upazila="ধানমন্ডি",
        district="ঢাকা",
        dag_no="1045",
        area_decimal=25.0,
        land_type="residential",
        flags=[],
        initial_owner_id=seller.id,
        current_owner_id=seller.id,
    )
    db_session.add(plot)
    db_session.flush()

    reg_token = create_access_token(sub=reg_user.username, role=reg_user.role)
    off_token = create_access_token(sub=off_user.username, role=off_user.role)

    return {
        "reg_user": reg_user,
        "off_user": off_user,
        "seller": seller,
        "buyer": buyer,
        "plot": plot,
        "reg_token": reg_token,
        "off_token": off_token,
    }


def test_post_deeds_requires_registrar(client: TestClient, test_setup: dict):
    payload = {
        "plot_id": test_setup["plot"].id,
        "seller_id": test_setup["seller"].id,
        "buyer_id": test_setup["buyer"].id,
        "area_sold": 10.0,
        "deed_type": "SALE",
        "sub_registry": "MIR",
    }

    # 1. Without auth -> 401
    res_no_auth = client.post("/api/v1/deeds", json=payload)
    assert res_no_auth.status_code == 401

    # 2. With officer auth -> 403
    res_wrong_role = client.post(
        "/api/v1/deeds",
        json=payload,
        headers={"Authorization": f"Bearer {test_setup['off_token']}"},
    )
    assert res_wrong_role.status_code == 403


def test_registrar_create_deed_and_verify(client: TestClient, test_setup: dict):
    payload = {
        "plot_id": test_setup["plot"].id,
        "seller_id": test_setup["seller"].id,
        "buyer_id": test_setup["buyer"].id,
        "area_sold": 12.5,
        "deed_type": "SALE",
        "sub_registry": "MIR",
    }

    res = client.post(
        "/api/v1/deeds",
        json=payload,
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )
    assert res.status_code == 201
    data = res.json()

    assert "deed" in data
    assert "verify" in data

    deed = data["deed"]
    verify = data["verify"]

    assert deed["area_sold"] == 12.5
    assert deed["plot_id"] == test_setup["plot"].id
    assert verify["status"] == "VALID"
    assert verify["chain_position"] == 1

    # Check masking of seller and buyer names
    assert test_setup["seller"].display_name not in deed["seller_name"]
    assert test_setup["buyer"].display_name not in deed["buyer_name"]
    assert "***" in deed["seller_name"]
    assert "***" in deed["buyer_name"]


def test_invalid_deed_body_and_domain_error_returns_422(client: TestClient, test_setup: dict):
    reg_headers = {"Authorization": f"Bearer {test_setup['reg_token']}"}

    # Negative area -> Pydantic validation error (422)
    res_neg_area = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": test_setup["plot"].id,
            "seller_id": test_setup["seller"].id,
            "buyer_id": test_setup["buyer"].id,
            "area_sold": -5.0,
        },
        headers=reg_headers,
    )
    assert res_neg_area.status_code == 422

    # Non-existent plot_id -> DomainError mapped to 422 {"code": "INVALID", ...}
    res_domain_err = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": 999999,
            "seller_id": test_setup["seller"].id,
            "buyer_id": test_setup["buyer"].id,
            "area_sold": 5.0,
        },
        headers=reg_headers,
    )
    assert res_domain_err.status_code == 422
    err_json = res_domain_err.json()
    assert err_json.get("code") == "INVALID"
    assert "does not exist" in err_json.get("detail", "").lower()


def test_public_verify_deed_endpoint(client: TestClient, test_setup: dict):
    # 1. Register a deed first
    reg_res = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": test_setup["plot"].id,
            "seller_id": test_setup["seller"].id,
            "buyer_id": test_setup["buyer"].id,
            "area_sold": 8.0,
        },
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )
    assert reg_res.status_code == 201
    deed_no = reg_res.json()["deed"]["deed_no"]

    # 2. Public verification (no auth)
    verify_res = client.get(f"/api/v1/deeds/{deed_no}/verify")
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    assert v_data["status"] == "VALID"
    assert v_data["deed_no"] == deed_no

    # 3. Unknown deed verification -> UNKNOWN (200 with status UNKNOWN)
    unknown_res = client.get("/api/v1/deeds/UNKNOWN-2026-999999/verify")
    assert unknown_res.status_code == 200
    assert unknown_res.json()["status"] == "UNKNOWN"


def test_registrar_qr_endpoint(client: TestClient, test_setup: dict):
    # 1. Register a deed
    reg_res = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": test_setup["plot"].id,
            "seller_id": test_setup["seller"].id,
            "buyer_id": test_setup["buyer"].id,
            "area_sold": 6.0,
        },
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )
    deed_no = reg_res.json()["deed"]["deed_no"]

    # 2. Unauthenticated -> 401
    res_no_auth = client.get(f"/api/v1/deeds/{deed_no}/qr")
    assert res_no_auth.status_code == 401

    # 3. Wrong role -> 403
    res_wrong_role = client.get(
        f"/api/v1/deeds/{deed_no}/qr",
        headers={"Authorization": f"Bearer {test_setup['off_token']}"},
    )
    assert res_wrong_role.status_code == 403

    # 4. Registrar -> 200 with PNG image bytes
    res_qr = client.get(
        f"/api/v1/deeds/{deed_no}/qr",
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )
    assert res_qr.status_code == 200
    assert res_qr.headers["content-type"] == "image/png"
    assert res_qr.content.startswith(b"\x89PNG")

    # 5. Non-existent deed -> 404
    res_not_found = client.get(
        "/api/v1/deeds/NONEXISTENT-2026-000000/qr",
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )
    assert res_not_found.status_code == 404


def test_public_plot_endpoints_and_masking(client: TestClient, test_setup: dict):
    plot_id = test_setup["plot"].id

    # 1. GET /plots/{id} (public)
    res_plot = client.get(f"/api/v1/plots/{plot_id}")
    assert res_plot.status_code == 200
    p_data = res_plot.json()
    assert p_data["dag_no"] == "1045"
    assert p_data["mouza"] == "ধানমন্ডি"
    # Verify owner names are masked
    assert test_setup["seller"].display_name not in p_data["initial_owner_name"]
    assert "***" in p_data["initial_owner_name"]
    assert "***" in p_data["current_owner_name"]

    # 2. Register two deeds to build a chain
    client.post(
        "/api/v1/deeds",
        json={
            "plot_id": plot_id,
            "seller_id": test_setup["seller"].id,
            "buyer_id": test_setup["buyer"].id,
            "area_sold": 5.0,
        },
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )
    client.post(
        "/api/v1/deeds",
        json={
            "plot_id": plot_id,
            "seller_id": test_setup["buyer"].id,
            "buyer_id": test_setup["seller"].id,
            "area_sold": 5.0,
        },
        headers={"Authorization": f"Bearer {test_setup['reg_token']}"},
    )

    # 3. GET /plots/{id}/chain (public)
    res_chain = client.get(f"/api/v1/plots/{plot_id}/chain")
    assert res_chain.status_code == 200
    chain = res_chain.json()
    assert len(chain) == 2
    assert chain[0]["seq"] == 1
    assert chain[1]["seq"] == 2
    # Verify chain properties
    for item in chain:
        assert "deed_no" in item
        assert "date" in item
        assert "buyer" in item
        assert "deed_status" in item
        assert "verify_status" in item
        # Masked buyer name
        assert "***" in item["buyer"]
        assert test_setup["seller"].display_name != item["buyer"]
        assert test_setup["buyer"].display_name != item["buyer"]

    # 4. GET /plots/search?mouza=&dag_no= (public)
    res_search = client.get("/api/v1/plots/search?mouza=ধানমন্ডি&dag_no=1045")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert len(search_data) >= 1
    assert search_data[0]["dag_no"] == "1045"
    assert "***" in search_data[0]["initial_owner_name"]

    # 5. Non-existent plot -> 404
    assert client.get("/api/v1/plots/999999").status_code == 404
    assert client.get("/api/v1/plots/999999/chain").status_code == 404
