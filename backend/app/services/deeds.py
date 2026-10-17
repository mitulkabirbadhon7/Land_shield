from datetime import datetime, timezone
from typing import Any
import nacl.signing
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import DomainError
from app.models.person import Person
from app.models.plot import Plot
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.services.crypto import (
    build_deed_payload,
    canonical,
    sha256_hex,
    sign_hash,
    key_id,
    public_key_hex,
    verify_sig,
    load_or_create_key,
)
from app.services.ledger import append_entry, verify_chain, is_superseded
from app.services.pipeline.hooks import pre_register_check


def next_deed_no(db: Session, sub_registry_code: str) -> str:
    """Generate a sequential deed number in 'CODE-YYYY-000001' style."""
    code = sub_registry_code.strip().upper()
    year = datetime.now(timezone.utc).year
    prefix = f"{code}-{year}-"

    stmt = select(Deed.deed_no).where(Deed.deed_no.like(f"{prefix}%"))
    existing_nos = db.scalars(stmt).all()

    max_seq = 0
    for d_no in existing_nos:
        suffix = d_no[len(prefix):]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))

    return f"{prefix}{max_seq + 1:06d}"


def register_deed(
    db: Session,
    signer_key: nacl.signing.SigningKey,
    *,
    plot_id: int,
    seller_id: int,
    buyer_id: int,
    area_sold: float,
    deed_type: str,
    sub_registry: str,
    deed_no: str | None = None,
    registered_at: str | datetime | None = None,
    skip_fraud: bool = False,
) -> Deed:
    """Validate, canonically format, sign, and register a land deed to the ledger. Caller commits."""
    plot = db.get(Plot, plot_id)
    if plot is None:
        raise DomainError(f"Plot with id {plot_id} does not exist")

    seller = db.get(Person, seller_id)
    if seller is None:
        raise DomainError(f"Seller with id {seller_id} does not exist")

    buyer = db.get(Person, buyer_id)
    if buyer is None:
        raise DomainError(f"Buyer with id {buyer_id} does not exist")

    if seller_id == buyer_id:
        raise DomainError("Seller and buyer cannot be the same person")

    if area_sold <= 0:
        raise DomainError(f"area_sold must be greater than 0, got {area_sold}")

    if not skip_fraud:
        proposed = {
            "plot_id": plot_id,
            "seller_id": seller_id,
            "buyer_id": buyer_id,
            "area_sold": area_sold,
            "deed_type": deed_type,
            "sub_registry": sub_registry,
            "signer_key": signer_key,
        }
        pre_register_check(db, proposed)

    if registered_at is None:
        registered_at_str = datetime.now(timezone.utc).isoformat()
    elif isinstance(registered_at, datetime):
        if registered_at.tzinfo is None:
            registered_at_str = registered_at.replace(tzinfo=timezone.utc).isoformat()
        else:
            registered_at_str = registered_at.astimezone(timezone.utc).isoformat()
    else:
        registered_at_str = str(registered_at)

    if deed_no is None:
        deed_no = next_deed_no(db, sub_registry)

    payload_dict = build_deed_payload(
        area_sold=area_sold,
        buyer_id=buyer_id,
        deed_no=deed_no,
        deed_type=deed_type,
        plot_id=plot_id,
        registered_at=registered_at_str,
        seller_id=seller_id,
        sub_registry=sub_registry,
    )
    payload_bytes = canonical(payload_dict)
    payload_str = payload_bytes.decode("utf-8")

    d_hash = sha256_hex(payload_bytes)
    sig = sign_hash(signer_key, d_hash)
    sk_id = key_id(signer_key)

    deed = Deed(
        deed_no=deed_no,
        plot_id=plot_id,
        seller_id=seller_id,
        buyer_id=buyer_id,
        area_sold=float(area_sold),
        deed_type=deed_type,
        sub_registry=sub_registry,
        registered_at=registered_at_str,
        payload_json=payload_str,
        deed_hash=d_hash,
        signature=sig,
        signer_key_id=sk_id,
        status="ACTIVE",
    )
    db.add(deed)
    db.flush()

    append_entry(db, plot_id, deed)
    db.flush()

    from app.services.audit import log
    log(
        db,
        actor=None,
        action="DEED_REGISTERED",
        entity="deed",
        entity_id=deed.id,
        detail=f"Deed {deed.deed_no} registered on plot {plot_id}",
    )

    return deed



def verify_deed(
    db: Session,
    deed_no: str,
    configured_key: nacl.signing.SigningKey | None = None,
) -> dict[str, Any]:
    """Verify cryptographic authenticity, signature, and chain integrity of a deed.

    Order:
      1. UNKNOWN (if deed row not found)
      2. HASH_MISMATCH (payload_json recomputed hash vs stored deed_hash)
      3. KEY_UNKNOWN (signer_key_id matches configured key)
      4. BAD_SIGNATURE (Ed25519 signature verification)
      5. CHAIN_BROKEN (plot ledger hash chain verification)
      6. CANCELLED (deed.status == CANCELLED with integrity valid)
      7. SUPERSEDED (newer ledger entry exists on plot)
      8. VALID
    """
    clean_deed_no = deed_no.strip() if isinstance(deed_no, str) else str(deed_no)
    stmt = select(Deed).where(Deed.deed_no == clean_deed_no)
    deed = db.scalars(stmt).first()
    if deed is None:
        stmt_upper = select(Deed).where(Deed.deed_no == clean_deed_no.upper())
        deed = db.scalars(stmt_upper).first()
    if deed is None and clean_deed_no.isdigit():
        deed = db.get(Deed, int(clean_deed_no))
    if deed is None:
        return {
            "status": "UNKNOWN",
            "reasons": ["UNKNOWN: Deed not found"],
            "deed_no": clean_deed_no,
            "plot_id": None,
            "chain_position": None,
            "registered_at": None,
        }

    # Fetch position in plot chain
    entry_stmt = select(LedgerEntry).where(LedgerEntry.deed_id == deed.id)
    entry = db.scalars(entry_stmt).first()
    chain_pos = entry.seq if entry is not None else None

    # Step 1: Recompute hash from canonical payload text
    computed_hash = sha256_hex(deed.payload_json.encode("utf-8"))
    if computed_hash != deed.deed_hash:
        return {
            "status": "TAMPERED",
            "reasons": ["HASH_MISMATCH: Computed payload hash does not match deed_hash"],
            "deed_no": deed.deed_no,
            "plot_id": deed.plot_id,
            "chain_position": chain_pos,
            "registered_at": deed.registered_at,
        }

    # Step 2: Resolve public key by signer_key_id
    if configured_key is None:
        configured_key = load_or_create_key(settings.signing_key_path)

    expected_key_id = key_id(configured_key)
    if deed.signer_key_id != expected_key_id:
        return {
            "status": "TAMPERED",
            "reasons": ["KEY_UNKNOWN: Unrecognized signer key ID"],
            "deed_no": deed.deed_no,
            "plot_id": deed.plot_id,
            "chain_position": chain_pos,
            "registered_at": deed.registered_at,
        }

    # Step 3: Signature verification
    pub_hex = public_key_hex(configured_key)
    if not verify_sig(pub_hex, deed.deed_hash, deed.signature):
        return {
            "status": "TAMPERED",
            "reasons": ["BAD_SIGNATURE: Digital signature verification failed"],
            "deed_no": deed.deed_no,
            "plot_id": deed.plot_id,
            "chain_position": chain_pos,
            "registered_at": deed.registered_at,
        }

    # Step 4: Verify hash chain integrity
    chain_ok, chain_reason, broken_seq = verify_chain(db, deed.plot_id)
    if not chain_ok:
        return {
            "status": "TAMPERED",
            "reasons": [f"CHAIN_BROKEN: Chain broken at seq {broken_seq} ({chain_reason})"],
            "deed_no": deed.deed_no,
            "plot_id": deed.plot_id,
            "chain_position": chain_pos,
            "registered_at": deed.registered_at,
        }

    # Step 5: Cancelled deed check (integrity verified first)
    if deed.status == "CANCELLED":
        return {
            "status": "CANCELLED",
            "reasons": ["CANCELLED: Deed has been marked CANCELLED"],
            "deed_no": deed.deed_no,
            "plot_id": deed.plot_id,
            "chain_position": chain_pos,
            "registered_at": deed.registered_at,
        }

    # Step 6: Superseded check
    if is_superseded(db, deed):
        return {
            "status": "SUPERSEDED",
            "reasons": ["SUPERSEDED: Deed has been superseded by a newer transaction on this plot"],
            "deed_no": deed.deed_no,
            "plot_id": deed.plot_id,
            "chain_position": chain_pos,
            "registered_at": deed.registered_at,
        }

    # Step 7: VALID
    return {
        "status": "VALID",
        "reasons": [],
        "deed_no": deed.deed_no,
        "plot_id": deed.plot_id,
        "chain_position": chain_pos,
        "registered_at": deed.registered_at,
    }
