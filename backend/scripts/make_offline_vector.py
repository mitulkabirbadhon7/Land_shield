import base64
import json
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import nacl.signing
from app.services.crypto import (
    build_deed_payload,
    canonical,
    key_id,
    public_key_hex,
    sha256_hex,
    sign_hash,
)


def get_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists() or (parent / "docs").exists() or (parent / "data").exists():
            return parent
    return Path.cwd()


def generate_vectors() -> dict:
    # 1. Primary official signing key
    sk = nacl.signing.SigningKey.generate()
    k_id = key_id(sk)
    pub_hex = public_key_hex(sk)

    # 2. Canonical authentic deed payload
    deed_dict = build_deed_payload(
        deed_no="VECTOR-DEED-001",
        plot_id=101,
        seller_id=1,
        buyer_id=2,
        area_sold=20.0,
        deed_type="SALE",
        sub_registry="MIR",
        registered_at="2026-10-15T12:00:00+00:00",
    )
    raw_payload_bytes = canonical(deed_dict)
    payload_json_str = raw_payload_bytes.decode("utf-8")
    d_hash = sha256_hex(raw_payload_bytes)
    sig_hex = sign_hash(sk, d_hash)

    # Authentic payload
    authentic_obj = {
        "v": 1,
        "payload_json": payload_json_str,
        "hash": d_hash,
        "sig": sig_hex,
        "key_id": k_id,
    }
    authentic_b64 = base64.urlsafe_b64encode(
        json.dumps(authentic_obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).decode("ascii").rstrip("=")

    # 3. Tampered payload: modified payload_json without re-hashing
    tampered_dict = dict(deed_dict)
    tampered_dict["area_sold"] = 50.0  # maliciously inflated area
    tampered_payload_str = canonical(tampered_dict).decode("utf-8")
    tampered_hash_obj = {
        "v": 1,
        "payload_json": tampered_payload_str,
        "hash": d_hash,  # old hash retained!
        "sig": sig_hex,
        "key_id": k_id,
    }
    tampered_hash_b64 = base64.urlsafe_b64encode(
        json.dumps(tampered_hash_obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).decode("ascii").rstrip("=")

    # 4. Tampered signature: altered signature hex bytes
    corrupted_sig = ("00" if sig_hex[:2] != "00" else "ff") + sig_hex[2:]
    tampered_sig_obj = {
        "v": 1,
        "payload_json": payload_json_str,
        "hash": d_hash,
        "sig": corrupted_sig,
        "key_id": k_id,
    }
    tampered_sig_b64 = base64.urlsafe_b64encode(
        json.dumps(tampered_sig_obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).decode("ascii").rstrip("=")

    # 5. Unknown signing key
    sk_unknown = nacl.signing.SigningKey.generate()
    unknown_k_id = key_id(sk_unknown)
    unknown_sig_hex = sign_hash(sk_unknown, d_hash)
    unknown_key_obj = {
        "v": 1,
        "payload_json": payload_json_str,
        "hash": d_hash,
        "sig": unknown_sig_hex,
        "key_id": unknown_k_id,
    }
    unknown_key_b64 = base64.urlsafe_b64encode(
        json.dumps(unknown_key_obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).decode("ascii").rstrip("=")

    vectors = {
        "primary_key": {
            "key_id": k_id,
            "public_key_hex": pub_hex,
        },
        "authentic": {
            "payload_b64": authentic_b64,
            "expected_status": "AUTHENTIC",
            "expected_deed_no": "VECTOR-DEED-001",
            "expected_area": 20.0,
            "expected_plot_id": 101,
            "expected_seller_id": 1,
            "expected_buyer_id": 2,
        },
        "tampered_hash": {
            "payload_b64": tampered_hash_b64,
            "expected_status": "NOT_AUTHENTIC",
            "reason": "Hash mismatch between payload_json and stored hash",
        },
        "tampered_sig": {
            "payload_b64": tampered_sig_b64,
            "expected_status": "NOT_AUTHENTIC",
            "reason": "Cryptographic signature verification failed",
        },
        "unknown_key": {
            "payload_b64": unknown_key_b64,
            "expected_status": "KEY_UNKNOWN",
            "reason": "Signer key_id is not present in trusted key registry",
        },
    }
    return vectors


def main():
    repo_root = get_repo_root()
    fixtures_dir = repo_root / "frontend" / "tests" / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    out_file = fixtures_dir / "offline_vector.json"

    vectors = generate_vectors()
    out_file.write_text(json.dumps(vectors, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Exported offline test vector fixture to: {out_file}")


if __name__ == "__main__":
    main()
