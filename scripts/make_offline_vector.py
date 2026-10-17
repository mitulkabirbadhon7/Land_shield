#!/usr/bin/env python3
"""
Generate offline verification test vector for frontend tests.
Outputs to frontend/tests/fixtures/offline_vector.json.
"""
import base64
import json
from pathlib import Path
import sys

# Ensure backend is in path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.services.crypto import (
    load_or_create_key,
    canonical,
    sha256_hex,
    sign_hash,
    key_id,
    public_key_hex,
)

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def main():
    key_path = ROOT / "keys" / "registrar_ed25519.hex"
    sk = load_or_create_key(key_path)
    kid = key_id(sk)
    pub_hex = public_key_hex(sk)

    # 1. Valid Deed
    sample_deed = {
        "area_sold": 15.5,
        "buyer_id": 102,
        "deed_no": "MIR-2026-000001",
        "deed_type": "KABALA",
        "plot_id": 1,
        "registered_at": "2026-10-01T10:00:00+00:00",
        "seller_id": 101,
        "sub_registry": "MIR",
    }
    canon_bytes = canonical(sample_deed)
    payload_json_str = canon_bytes.decode("utf-8")
    deed_hash = sha256_hex(canon_bytes)
    sig = sign_hash(sk, deed_hash)

    valid_obj = {
        "v": 1,
        "payload_json": payload_json_str,
        "hash": deed_hash,
        "sig": sig,
        "key_id": kid,
    }
    valid_b64 = b64url_encode(json.dumps(valid_obj, separators=(",", ":")).encode("utf-8"))

    # 2. Tampered Deed (area changed from 15.5 to 16.5 without updating hash/signature)
    tampered_deed = dict(sample_deed)
    tampered_deed["area_sold"] = 16.5
    tampered_canon_str = canonical(tampered_deed).decode("utf-8")
    tampered_obj = {
        "v": 1,
        "payload_json": tampered_canon_str,
        "hash": deed_hash,  # old hash
        "sig": sig,         # old sig
        "key_id": kid,
    }
    tampered_b64 = b64url_encode(json.dumps(tampered_obj, separators=(",", ":")).encode("utf-8"))

    # 3. Unknown Key ID
    unknown_key_obj = {
        "v": 1,
        "payload_json": payload_json_str,
        "hash": deed_hash,
        "sig": sig,
        "key_id": "deadbeef12345678",
    }
    unknown_key_b64 = b64url_encode(json.dumps(unknown_key_obj, separators=(",", ":")).encode("utf-8"))

    vector = {
        "keys": {
            kid: pub_hex
        },
        "valid": {
            "payload_b64": valid_b64,
            "raw_json": json.dumps(valid_obj),
            "expected_state": "AUTHENTIC",
            "deed_no": "MIR-2026-000001",
            "area_sold": 15.5,
        },
        "tampered": {
            "payload_b64": tampered_b64,
            "expected_state": "NOT_AUTHENTIC",
        },
        "unknown_key": {
            "payload_b64": unknown_key_b64,
            "expected_state": "KEY_UNKNOWN",
        },
    }

    out_file = ROOT / "frontend" / "tests" / "fixtures" / "offline_vector.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(vector, indent=2), encoding="utf-8")
    print(f"Generated offline test vector at {out_file}")

if __name__ == "__main__":
    main()
