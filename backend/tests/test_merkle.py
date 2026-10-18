import hashlib
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger import LedgerEntry
from app.models.merkle import MerkleRoot
from app.models.plot import Plot
from app.security import create_access_token
from app.services.merkle import build_daily_root, merkle_root, verify_daily_root
from scripts.seed import seed_data
from scripts.seed_phase2 import seed_phase2


@pytest.fixture
def merkle_env(db_session: Session):
    seed_data(db_session)
    seed_phase2(db_session)
    db_session.commit()

    admin_token = create_access_token("admin1", role="admin")
    officer_token = create_access_token("officer1", role="officer")

    return {
        "admin_token": admin_token,
        "officer_token": officer_token,
    }


def test_merkle_tree_empty_and_leaf_vectors():
    # 0 leaves: sha256 of empty bytes
    empty_root = merkle_root([])
    assert empty_root == hashlib.sha256(b"").hexdigest()

    # 1 leaf: root is the leaf itself
    h1 = hashlib.sha256(b"leaf1").hexdigest()
    b1 = bytes.fromhex(h1)
    assert merkle_root([h1]) == h1

    # 2 leaves: sha256(b1 + b2)
    h2 = hashlib.sha256(b"leaf2").hexdigest()
    b2 = bytes.fromhex(h2)
    expected_2 = hashlib.sha256(b1 + b2).hexdigest()
    assert merkle_root([h1, h2]) == expected_2

    # 3 leaves: b1+b2, b3+b3 -> parent1, parent2 -> sha256(parent1 + parent2)
    h3 = hashlib.sha256(b"leaf3").hexdigest()
    b3 = bytes.fromhex(h3)
    p1 = hashlib.sha256(b1 + b2).digest()
    p2 = hashlib.sha256(b3 + b3).digest()
    expected_3 = hashlib.sha256(p1 + p2).hexdigest()
    assert merkle_root([h1, h2, h3]) == expected_3


def test_build_daily_root_and_verification_match(db_session: Session, merkle_env: dict):
    # Determine test date from existing entries
    latest_entry = db_session.scalars(select(LedgerEntry).order_by(LedgerEntry.id.desc())).first()
    assert latest_entry is not None
    test_date = latest_entry.created_at.strftime("%Y-%m-%d")

    # 1. Build daily root
    record = build_daily_root(db_session, test_date)
    assert record.id is not None
    assert record.entry_count > 0
    assert record.max_entry_id == latest_entry.id
    assert len(record.root) == 64
    assert len(record.signature) == 128

    # 2. Verify daily root
    result = verify_daily_root(db_session, test_date)
    assert result["status"] == "MATCH"
    assert result["root_match"] is True
    assert result["sig_valid"] is True
    assert result["stored_root"] == record.root
    assert result["recomputed_root"] == record.root


def test_tamper_detection_when_ledger_entry_altered(db_session: Session, merkle_env: dict):
    latest_entry = db_session.scalars(select(LedgerEntry).order_by(LedgerEntry.id.desc())).first()
    test_date = latest_entry.created_at.strftime("%Y-%m-%d")

    # Build initial valid root
    build_daily_root(db_session, test_date)
    assert verify_daily_root(db_session, test_date)["status"] == "MATCH"

    # Directly tamper with an intermediate ledger entry hash in SQLite
    first_entry = db_session.scalars(select(LedgerEntry).order_by(LedgerEntry.id.asc())).first()
    original_hash = first_entry.entry_hash
    first_entry.entry_hash = "deadbeef" * 8
    db_session.flush()

    # Verify fails with MISMATCH
    tampered_result = verify_daily_root(db_session, test_date)
    assert tampered_result["status"] == "MISMATCH"
    assert tampered_result["root_match"] is False

    # Restore original hash
    first_entry.entry_hash = original_hash
    db_session.flush()
    assert verify_daily_root(db_session, test_date)["status"] == "MATCH"


def test_tamper_detection_when_signature_altered(db_session: Session, merkle_env: dict):
    latest_entry = db_session.scalars(select(LedgerEntry).order_by(LedgerEntry.id.desc())).first()
    test_date = latest_entry.created_at.strftime("%Y-%m-%d")

    record = build_daily_root(db_session, test_date)
    assert verify_daily_root(db_session, test_date)["status"] == "MATCH"

    # Corrupt signature in database
    record.signature = "a" * 128
    db_session.flush()

    result = verify_daily_root(db_session, test_date)
    assert result["status"] == "MISMATCH"
    assert result["sig_valid"] is False


def test_build_daily_root_idempotency(db_session: Session, merkle_env: dict):
    test_date = "2026-10-15"
    r1 = build_daily_root(db_session, test_date)
    initial_id = r1.id
    initial_root = r1.root

    # Re-run same date
    r2 = build_daily_root(db_session, test_date)
    assert r2.id == initial_id
    assert r2.root == initial_root

    # Verify table count has not grown
    count = len(db_session.scalars(select(MerkleRoot).where(MerkleRoot.date == test_date)).all())
    assert count == 1


def test_transparency_api_endpoints(client: TestClient, db_session: Session, merkle_env: dict):
    test_date = "2026-10-16"

    # 1. Unauthenticated run -> 401
    res_unauth = client.post("/api/v1/admin/merkle/run", json={"date": test_date})
    assert res_unauth.status_code == 401

    # 2. Officer role -> 403 (admin required)
    res_officer = client.post(
        "/api/v1/admin/merkle/run",
        json={"date": test_date},
        headers={"Authorization": f"Bearer {merkle_env['officer_token']}"},
    )
    assert res_officer.status_code == 403

    # 3. Admin role -> 200 OK
    res_admin = client.post(
        "/api/v1/admin/merkle/run",
        json={"date": test_date},
        headers={"Authorization": f"Bearer {merkle_env['admin_token']}"},
    )
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["date"] == test_date
    assert data["status"] == "MATCH"
    assert len(data["root"]) == 64

    # 4. Public list: GET /transparency
    res_list = client.get("/api/v1/transparency")
    assert res_list.status_code == 200
    items = res_list.json()
    assert len(items) >= 1
    assert any(i["date"] == test_date for i in items)

    # 5. Public verification: GET /transparency/{date}/verify
    res_verify = client.get(f"/api/v1/transparency/{test_date}/verify")
    assert res_verify.status_code == 200
    v_data = res_verify.json()
    assert v_data["status"] == "MATCH"
    assert v_data["root_match"] is True
    assert v_data["sig_valid"] is True

    # 6. Non-existent date verification -> 404
    assert client.get("/api/v1/transparency/1999-01-01/verify").status_code == 404
