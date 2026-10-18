import base64
import io
import json
from typing import Any
import qrcode

from app.errors import DomainError
from app.models.deed import Deed
from app.services.crypto import sha256_hex, verify_sig


def build_offline_payload(deed: Deed) -> str:
    """Construct a compact, self-verifying offline QR payload encoded in URL-safe Base64.

    Format per TRD 6C:
    {"v": 1, "payload_json": "<EXACT stored canonical payload>", "hash": "<hex>", "sig": "<hex>", "key_id": "<id>"}
    Raises DomainError if stored payload_json does not match deed_hash.
    """
    if not deed.payload_json or not deed.deed_hash:
        raise DomainError("Deed is missing payload or hash")

    # Cryptographic consistency check: re-hash stored verbatim payload
    computed_hash = sha256_hex(deed.payload_json.encode("utf-8"))
    if computed_hash != deed.deed_hash:
        raise DomainError(
            f"Deed integrity failure: recomputed hash {computed_hash} does not match recorded deed_hash {deed.deed_hash}"
        )

    compact_obj = {
        "v": 1,
        "payload_json": deed.payload_json,
        "hash": deed.deed_hash,
        "sig": deed.signature,
        "key_id": deed.signer_key_id,
    }

    raw_json = json.dumps(compact_obj, separators=(",", ":"), ensure_ascii=False)
    encoded = base64.urlsafe_b64encode(raw_json.encode("utf-8")).decode("ascii").rstrip("=")
    return encoded


def decode_offline_payload(payload_b64: str) -> dict[str, Any]:
    """Decode a Base64URL offline payload into its dictionary representation."""
    rem = len(payload_b64) % 4
    padded = payload_b64 + ("=" * (4 - rem) if rem else "")
    raw_bytes = base64.urlsafe_b64decode(padded.encode("ascii"))
    return json.loads(raw_bytes.decode("utf-8"))


def verify_offline_payload(
    payload_b64: str,
    public_keys: dict[str, str],
) -> tuple[str, dict[str, Any] | None]:
    """Verify an offline QR payload using cached public keys.

    Returns:
    - ("AUTHENTIC", data) on successful verification
    - ("NOT_AUTHENTIC", data_or_none) on hash mismatch or invalid signature
    - ("KEY_UNKNOWN", data) if signer key_id is not in public_keys
    """
    try:
        data = decode_offline_payload(payload_b64)
    except Exception:
        return "NOT_AUTHENTIC", None

    payload_json = data.get("payload_json", "")
    recorded_hash = data.get("hash", "")
    sig = data.get("sig", "")
    key_id = data.get("key_id", "")

    # 1. Verify hash of payload_json bytes AS RECEIVED
    computed_hash = sha256_hex(payload_json.encode("utf-8"))
    if computed_hash != recorded_hash:
        return "NOT_AUTHENTIC", data

    # 2. Check public key presence
    if key_id not in public_keys:
        return "KEY_UNKNOWN", data

    # 3. Verify signature over hash bytes
    pub_hex = public_keys[key_id]
    if not verify_sig(pub_hex, recorded_hash, sig):
        return "NOT_AUTHENTIC", data

    return "AUTHENTIC", data


def qr_offline_png(payload: str) -> bytes:
    """Generate PNG bytes containing a QR code for the offline payload with Error Correction L."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=6,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
