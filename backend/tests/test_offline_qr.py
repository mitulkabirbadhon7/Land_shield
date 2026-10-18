import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import DomainError
from app.models.deed import Deed
from app.models.plot import Plot
from app.models.signing_key import SigningKey
from app.models.user import User
from app.security import create_access_token
from app.services.crypto import (
    key_id,
    load_or_create_key,
    public_key_hex,
)
from app.services.deeds import register_deed
from app.services.offline_qr import (
    build_offline_payload,
    decode_offline_payload,
    qr_offline_png,
    verify_offline_payload,
)
from scripts.seed import seed_data
from scripts.seed_phase2 import seed_phase2


@pytest.fixture
def seeded_p2_db(db_session: Session) -> Session:
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    seed_phase2(db_session)
    return db_session


@pytest.fixture
def auth_tokens(seeded_p2_db: Session) -> dict[str, str]:
    registrar = seeded_p2_db.scalars(select(User).where(User.role == "registrar")).first()
    admin = seeded_p2_db.scalars(select(User).where(User.role == "admin")).first()
    citizen = seeded_p2_db.scalars(select(User).where(User.role == "citizen")).first()

    if citizen is None:
        citizen = User(
            name="Demo Citizen",
            username="citizen1",
            role="citizen",
            password_hash="test",
        )
        seeded_p2_db.add(citizen)
        seeded_p2_db.flush()

    return {
        "registrar": create_access_token(registrar.username, "registrar"),
        "admin": create_access_token(admin.username, "admin"),
        "citizen": create_access_token(citizen.username, "citizen"),
    }


# -----------------------------------------------------------------------------
# 1. Round-Trip Verification & Cryptographic Checks
# -----------------------------------------------------------------------------

def test_offline_qr_round_trip_verification(seeded_p2_db: Session):
    """Offline payload generation and round-trip verification using PyNaCl."""
    sk = load_or_create_key(settings.signing_key_path)
    k_id = key_id(sk)
    pub_hex = public_key_hex(sk)

    plot = seeded_p2_db.get(Plot, 1)
    deed = register_deed(
        seeded_p2_db,
        sk,
        plot_id=plot.id,
        seller_id=plot.initial_owner_id,
        buyer_id=plot.initial_owner_id + 1,
        area_sold=5.0,
        deed_type="SALE",
        sub_registry="MIR",
        skip_fraud=True,
    )
    seeded_p2_db.flush()

    # Build payload
    payload_b64 = build_offline_payload(deed)
    assert isinstance(payload_b64, str)
    assert len(payload_b64) > 50

    # Decode and assert schema fields
    data = decode_offline_payload(payload_b64)
    assert data["v"] == 1
    assert data["hash"] == deed.deed_hash
    assert data["sig"] == deed.signature
    assert data["key_id"] == k_id

    # Verify against public keys cache
    status, verified_data = verify_offline_payload(payload_b64, {k_id: pub_hex})
    assert status == "AUTHENTIC"
    assert verified_data is not None


def test_build_payload_refuses_tampered_deed_data(seeded_p2_db: Session):
    """build_offline_payload raises DomainError if payload_json does not match deed_hash."""
    deed = seeded_p2_db.scalars(select(Deed)).first()
    assert deed is not None

    # Deliberately corrupt stored payload_json
    deed.payload_json = deed.payload_json[:-2] + ',"tampered":true}'

    with pytest.raises(DomainError) as exc_info:
        build_offline_payload(deed)
    assert "integrity failure" in str(exc_info.value).lower()


def test_verify_detects_tampered_and_unknown_keys():
    """verify_offline_payload rejects tampered hash, tampered sig, and unknown keys."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    vector_path = repo_root / "frontend" / "tests" / "fixtures" / "offline_vector.json"
    assert vector_path.exists()

    vectors = json.loads(vector_path.read_text(encoding="utf-8"))
    pk = vectors["primary_key"]
    trusted_keys = {pk["key_id"]: pk["public_key_hex"]}

    # 1. Authentic
    status, _ = verify_offline_payload(vectors["authentic"]["payload_b64"], trusted_keys)
    assert status == "AUTHENTIC"

    # 2. Tampered hash
    status_bad_hash, _ = verify_offline_payload(vectors["tampered_hash"]["payload_b64"], trusted_keys)
    assert status_bad_hash == "NOT_AUTHENTIC"

    # 3. Tampered signature
    status_bad_sig, _ = verify_offline_payload(vectors["tampered_sig"]["payload_b64"], trusted_keys)
    assert status_bad_sig == "NOT_AUTHENTIC"

    # 4. Unknown key
    status_unknown, _ = verify_offline_payload(vectors["unknown_key"]["payload_b64"], trusted_keys)
    assert status_unknown == "KEY_UNKNOWN"


def test_qr_offline_png_generates_valid_image():
    """qr_offline_png produces valid PNG image bytes with standard magic header."""
    png_bytes = qr_offline_png("test_offline_payload_sample_string_12345")
    assert isinstance(png_bytes, bytes)
    assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n")


# -----------------------------------------------------------------------------
# 2. API Endpoints: Keys Registry, Certificate, and Offline QR
# -----------------------------------------------------------------------------

def test_keys_registry_endpoint(client: TestClient, seeded_p2_db: Session):
    """GET /api/v1/keys returns active public keys list."""
    res = client.get("/api/v1/keys")
    assert res.status_code == 200
    keys_list = res.json()
    assert len(keys_list) >= 1
    assert "key_id" in keys_list[0]
    assert "public_key_hex" in keys_list[0]
    assert keys_list[0]["status"] == "ACTIVE"

    # Test root alias
    res_root = client.get("/keys")
    assert res_root.status_code == 200


def test_deed_certificate_endpoint(client: TestClient, seeded_p2_db: Session):
    """GET /api/v1/deeds/{deed_no}/certificate returns online URL and Base64 offline payload."""
    deed = seeded_p2_db.scalars(select(Deed)).first()
    assert deed is not None

    res = client.get(f"/api/v1/deeds/{deed.deed_no}/certificate")
    assert res.status_code == 200
    cert = res.json()
    assert cert["deed_no"] == deed.deed_no
    assert "online_verify_url" in cert
    assert "offline_payload" in cert
    assert cert["deed_hash"] == deed.deed_hash
    assert cert["key_id"] == (deed.signer_key_id or "")


def test_deed_qr_offline_rbac_and_feature_flag(
    client: TestClient,
    seeded_p2_db: Session,
    auth_tokens: dict[str, str],
):
    """GET /deeds/{deed_no}/qr-offline enforces RBAC and respects FEATURE_OFFLINE_QR."""
    deed = seeded_p2_db.scalars(select(Deed)).first()
    assert deed is not None

    # 1. Unauthenticated -> 401
    res = client.get(f"/api/v1/deeds/{deed.deed_no}/qr-offline")
    assert res.status_code == 401

    # 2. Citizen -> 403
    citizen_headers = {"Authorization": f"Bearer {auth_tokens['citizen']}"}
    res = client.get(f"/api/v1/deeds/{deed.deed_no}/qr-offline", headers=citizen_headers)
    assert res.status_code == 403

    # 3. Registrar -> 200 PNG
    registrar_headers = {"Authorization": f"Bearer {auth_tokens['registrar']}"}
    res = client.get(f"/api/v1/deeds/{deed.deed_no}/qr-offline", headers=registrar_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert res.content.startswith(b"\x89PNG\r\n\x1a\n")

    # 4. Feature flag disabled -> 404
    try:
        settings.feature_offline_qr = False
        res_disabled = client.get(f"/api/v1/deeds/{deed.deed_no}/qr-offline", headers=registrar_headers)
        assert res_disabled.status_code == 404
    finally:
        settings.feature_offline_qr = True
