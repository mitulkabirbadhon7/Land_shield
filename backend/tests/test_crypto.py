import pytest
from app.services.crypto import (
    canonical,
    sha256_hex,
    load_or_create_key,
    key_id,
    public_key_hex,
    sign_hash,
    verify_sig,
    build_deed_payload,
)

def test_canonical_key_ordering():
    # Two dictionaries with identical keys and values inserted in different orders
    dict1 = {"b": 2, "a": 1, "c": 3}
    dict2 = {"c": 3, "a": 1, "b": 2}
    assert canonical(dict1) == canonical(dict2)
    assert sha256_hex(canonical(dict1)) == sha256_hex(canonical(dict2))

def test_canonical_field_change_changes_hash():
    dict1 = {"deed_no": "DDM-2026-0001", "area": 10.0}
    dict2 = {"deed_no": "DDM-2026-0001", "area": 10.1}
    assert canonical(dict1) != canonical(dict2)
    assert sha256_hex(canonical(dict1)) != sha256_hex(canonical(dict2))

def test_canonical_bangla_utf8_consistency():
    bangla_payload = {
        "mouza": "তেজগাঁও",
        "sub_registry": "ঢাকা সদর",
        "area_sold": 5.25
    }
    encoded = canonical(bangla_payload)
    # Ensure UTF-8 bytes contain raw Bangla characters, not escaped unicode
    assert "তেজগাঁও".encode("utf-8") in encoded
    hash_val = sha256_hex(encoded)
    assert len(hash_val) == 64
    # Recomputing produces identical hash
    assert sha256_hex(canonical(bangla_payload)) == hash_val

def test_key_generation_and_persistence(tmp_path):
    key_file = tmp_path / "keys" / "test_registrar.key"
    sk1 = load_or_create_key(key_file)
    pub1 = public_key_hex(sk1)
    kid1 = key_id(sk1)

    assert key_file.exists()
    assert len(pub1) == 64
    assert len(kid1) == 16

    # Load existing key file
    sk2 = load_or_create_key(key_file)
    pub2 = public_key_hex(sk2)
    kid2 = key_id(sk2)

    assert pub1 == pub2
    assert kid1 == kid2

def test_sign_and_verify_signature(tmp_path):
    key_file = tmp_path / "registrar.key"
    sk = load_or_create_key(key_file)
    pub_hex = public_key_hex(sk)

    payload = build_deed_payload(
        deed_no="DDM-2026-000123",
        plot_id=10,
        seller_id=1,
        buyer_id=2,
        area_sold=3.5,
        deed_type="sale",
        sub_registry="Gulshan",
        registered_at="2026-10-12T10:00:00Z"
    )
    raw_canonical = canonical(payload)
    hash_val = sha256_hex(raw_canonical)

    sig_hex = sign_hash(sk, hash_val)
    assert len(sig_hex) == 128

    # Valid verification
    assert verify_sig(pub_hex, hash_val, sig_hex) is True

    # Altered hash must fail verification
    altered_hash = sha256_hex(b"tampered payload")
    assert verify_sig(pub_hex, altered_hash, sig_hex) is False

def test_verify_sig_error_handling():
    # Garbage hex or invalid lengths should return False, never raise
    assert verify_sig("not_a_hex", "not_a_hex", "not_a_hex") is False
    assert verify_sig("00" * 32, "00" * 32, "00" * 64) is False
    assert verify_sig("", "", "") is False
    assert verify_sig("1234", "1234", "1234") is False

def test_build_deed_payload_validation():
    valid_args = {
        "deed_no": "DDM-2026-000001",
        "plot_id": 1,
        "seller_id": 2,
        "buyer_id": 3,
        "area_sold": 4.5,
        "deed_type": "sale",
        "sub_registry=" : "Tejgaon",
        "registered_at": "2026-10-12T00:00:00Z"
    }

    # Missing field
    with pytest.raises(ValueError, match="Missing required deed fields"):
        build_deed_payload(deed_no="D1", plot_id=1)

    # Extra field
    with pytest.raises(ValueError, match="Unexpected deed fields"):
        build_deed_payload(
            deed_no="D1",
            plot_id=1,
            seller_id=2,
            buyer_id=3,
            area_sold=4.5,
            deed_type="sale",
            sub_registry="Tejgaon",
            registered_at="2026-10-12T00:00:00Z",
            extra_field="unauthorized"
        )
