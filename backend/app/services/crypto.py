import hashlib
import json
import os
from pathlib import Path
from typing import Any
import nacl.signing
import nacl.exceptions

REQUIRED_DEED_FIELDS = (
    "area_sold",
    "buyer_id",
    "deed_no",
    "deed_type",
    "plot_id",
    "registered_at",
    "seller_id",
    "sub_registry",
)

def canonical(payload: dict[str, Any]) -> bytes:
    """Canonicalize a dictionary to deterministic UTF-8 bytes: sorted keys, compact separators, no whitespace."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def sha256_hex(data: bytes) -> str:
    """Compute SHA-256 hexadecimal digest of bytes."""
    return hashlib.sha256(data).hexdigest()

def load_or_create_key(path: str | Path, signing_key_hex: str | None = None) -> nacl.signing.SigningKey:
    """Load existing Ed25519 signing key or generate a new one at path. Never log key contents.

    Order of precedence:
    1. Existing key file at `path`
    2. Explicitly passed `signing_key_hex` parameter
    3. `SIGNING_KEY_HEX` environment variable or settings configuration
    4. Auto-generate key and persist to `path` if possible
    """
    key_path = Path(path)
    if key_path.exists():
        seed_hex = key_path.read_text(encoding="utf-8").strip()
        seed_bytes = bytes.fromhex(seed_hex)
        return nacl.signing.SigningKey(seed_bytes)

    # If no file exists, check provided parameter, env var, or settings
    hex_candidate = signing_key_hex or os.getenv("SIGNING_KEY_HEX")
    if not hex_candidate:
        try:
            from app.config import settings
            hex_candidate = settings.effective_signing_key_hex
        except Exception:
            pass

    if hex_candidate and hex_candidate.strip():
        clean_hex = hex_candidate.strip()
        seed_bytes = bytes.fromhex(clean_hex)
        if len(seed_bytes) != 32:
            raise ValueError(f"SIGNING_KEY_HEX must be 32 bytes (64 hex characters), got {len(seed_bytes)} bytes")
        return nacl.signing.SigningKey(seed_bytes)

    try:
        key_path.parent.mkdir(parents=True, exist_ok=True)
        sk = nacl.signing.SigningKey.generate()
        seed_hex = bytes(sk).hex()
        key_path.write_text(seed_hex, encoding="utf-8")
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass
        return sk
    except OSError:
        return nacl.signing.SigningKey.generate()

def key_id(sk: nacl.signing.SigningKey | nacl.signing.VerifyKey) -> str:
    """Derive key ID as first 16 hex characters of sha256(public_key_bytes)."""
    vk_bytes = bytes(sk.verify_key) if isinstance(sk, nacl.signing.SigningKey) else bytes(sk)
    return sha256_hex(vk_bytes)[:16]

def public_key_hex(sk: nacl.signing.SigningKey | nacl.signing.VerifyKey) -> str:
    """Return public key as a 64-character (32-byte) hex string."""
    vk_bytes = bytes(sk.verify_key) if isinstance(sk, nacl.signing.SigningKey) else bytes(sk)
    return vk_bytes.hex()

def sign_hash(sk: nacl.signing.SigningKey, hash_hex: str) -> str:
    """Sign a 32-byte sha256 hash hex string with Ed25519; return 128-char detached signature hex."""
    message = bytes.fromhex(hash_hex)
    signed = sk.sign(message)
    return signed.signature.hex()

def verify_sig(public_key_hex_val: str, hash_hex: str, sig_hex: str) -> bool:
    """Verify an Ed25519 signature over a hash hex. Never raises; returns False on invalid input/signature."""
    try:
        vk_bytes = bytes.fromhex(public_key_hex_val)
        hash_bytes = bytes.fromhex(hash_hex)
        sig_bytes = bytes.fromhex(sig_hex)
        if len(vk_bytes) != 32 or len(sig_bytes) != 64:
            return False
        vk = nacl.signing.VerifyKey(vk_bytes)
        vk.verify(hash_bytes, sig_bytes)
        return True
    except (nacl.exceptions.BadSignatureError, ValueError, TypeError):
        return False

def build_deed_payload(**fields: Any) -> dict[str, Any]:
    """Build canonical deed payload with fixed, documented field set. Rejects unknown/missing fields."""
    provided_keys = set(fields.keys())
    required_keys = set(REQUIRED_DEED_FIELDS)

    missing = required_keys - provided_keys
    if missing:
        raise ValueError(f"Missing required deed fields: {sorted(missing)}")

    extra = provided_keys - required_keys
    if extra:
        raise ValueError(f"Unexpected deed fields: {sorted(extra)}")

    return {
        "area_sold": float(fields["area_sold"]),
        "buyer_id": int(fields["buyer_id"]),
        "deed_no": str(fields["deed_no"]),
        "deed_type": str(fields["deed_type"]),
        "plot_id": int(fields["plot_id"]),
        "registered_at": str(fields["registered_at"]),
        "seller_id": int(fields["seller_id"]),
        "sub_registry": str(fields["sub_registry"]),
    }
