import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.deed import Deed
from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token
from app.utils.privacy import PersonView, is_staff_viewer, person_view
from scripts.seed import seed_data
from scripts.seed_phase2 import seed_phase2


@pytest.fixture
def seeded_env(db_session: Session):
    seed_data(db_session)
    seed_phase2(db_session)
    db_session.commit()

    officer_token = create_access_token("officer1", role="officer")
    registrar_token = create_access_token("registrar1", role="registrar")
    admin_token = create_access_token("admin1", role="admin")

    return {
        "officer_token": officer_token,
        "registrar_token": registrar_token,
        "admin_token": admin_token,
    }


def test_person_view_helper_anonymous():
    p = Person(display_name="মোহাম্মদ রফিক", masked_nid_hash="nid_hash_secret_123")
    p.id = 42

    pv = person_view(p, viewer=None)
    assert isinstance(pv, PersonView)
    assert pv.is_masked is True
    assert pv.name != "মোহাম্মদ রফিক"
    assert "***" in pv.name
    assert pv.identifier is None  # Excluded for anonymous citizens
    assert str(pv) == pv.name
    assert pv["name"] == pv.name


def test_person_view_helper_staff():
    p = Person(display_name="মোহাম্মদ রফিক", masked_nid_hash="nid_hash_secret_123")
    p.id = 42

    # Test with string roles
    for role in ["registrar", "officer", "admin"]:
        pv = person_view(p, viewer=role)
        assert pv.is_masked is False
        assert pv.name == "মোহাম্মদ রফিক"
        assert pv.identifier == 42

    # Test with User model
    staff_user = User(username="officer1", role="officer")
    pv_user = person_view(p, viewer=staff_user)
    assert pv_user.is_masked is False
    assert pv_user.name == "মোহাম্মদ রফিক"
    assert pv_user.identifier == 42


def test_person_view_types_and_none():
    assert person_view(None).name == ""
    assert person_view(None).identifier is None

    # String input
    pv_str = person_view("আব্দুল কালাম", viewer=None)
    assert "***" in pv_str.name
    assert pv_str.name != "আব্দুল কালাম"

    # Dict input
    pv_dict = person_view({"display_name": "করিম খান", "id": 99}, viewer="admin")
    assert pv_dict.name == "করিম খান"
    assert pv_dict.identifier == 99


def test_data_policy_header_present(client: TestClient, seeded_env: dict):
    endpoints = [
        "/api/v1/features",
        "/api/v1/plots/1",
        "/api/v1/keys",
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.headers.get("X-Data-Policy") == "synthetic-demo", f"Missing header on {ep}"


def test_public_endpoints_leak_audit(client: TestClient, db_session: Session, seeded_env: dict):
    """Exhaustive privacy sweep: ensures unmasked names and NID hashes never leak in public JSON."""
    persons = db_session.scalars(select(Person)).all()
    assert len(persons) > 0

    unmasked_names = [p.display_name for p in persons if len(p.display_name.strip()) > 3]
    nid_hashes = [p.masked_nid_hash for p in persons if p.masked_nid_hash]

    first_deed = db_session.scalars(select(Deed)).first()
    sample_deed_no = first_deed.deed_no if first_deed else "MIR-2026-000001"

    public_calls = [
        ("GET", "/api/v1/plots/1", None),
        ("GET", "/api/v1/plots/1/chain", None),
        ("GET", "/api/v1/plots/search?mouza=মিরপুর", None),
        ("GET", f"/api/v1/deeds/{sample_deed_no}/verify", None),
        ("GET", f"/api/v1/deeds/{sample_deed_no}/certificate", None),
        ("GET", "/api/v1/lineage/1", None),
        ("POST", "/api/v1/reports/due-diligence", {"plot_id": 1, "lang": "bn"}),
        ("GET", "/api/v1/features", None),
        ("GET", "/api/v1/keys", None),
    ]

    for method, path, body in public_calls:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json=body)

        assert res.status_code == 200, f"Endpoint {path} failed with {res.status_code}: {res.text}"
        payload_text = res.text

        # Verify no raw unmasked name appears
        for name in unmasked_names:
            assert name not in payload_text, f"LEAK: Unmasked name '{name}' found in public endpoint {path}"

        # Verify no NID hash appears
        for h in nid_hashes:
            assert h not in payload_text, f"LEAK: NID hash '{h}' found in public endpoint {path}"


def test_public_plot_out_excludes_internal_ids(client: TestClient, seeded_env: dict):
    resp = client.get("/api/v1/plots/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["initial_owner_id"] is None
    assert data["current_owner_id"] is None
    assert "***" in data["initial_owner_name"]


def test_staff_sees_unmasked_names(client: TestClient, seeded_env: dict):
    resp = client.get(
        "/api/v1/plots/1",
        headers={"Authorization": f"Bearer {seeded_env['officer_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "***" not in data["initial_owner_name"]
    assert data["initial_owner_id"] is not None
