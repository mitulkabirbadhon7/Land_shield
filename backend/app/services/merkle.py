import hashlib
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ledger import LedgerEntry
from app.models.merkle import MerkleRoot
from app.services.crypto import (
    load_or_create_key,
    public_key_hex,
    sha256_hex,
    sign_hash,
    verify_sig,
)


def merkle_root(hex_hashes: list[str]) -> str:
    """Compute standard binary Merkle tree root hash from a list of SHA-256 hex strings.

    Specification:
    - Empty tree (no leaves): SHA-256 of empty bytes.
    - Odd node on any layer: duplicated to pair with itself.
    - Parent node: SHA-256(left_bytes + right_bytes).
    """
    if not hex_hashes:
        return hashlib.sha256(b"").hexdigest()

    layer = [bytes.fromhex(h) for h in hex_hashes]
    while len(layer) > 1:
        if len(layer) % 2:
            layer.append(layer[-1])
        layer = [
            hashlib.sha256(layer[i] + layer[i + 1]).digest()
            for i in range(0, len(layer), 2)
        ]

    return layer[0].hex()


def _end_of_day_utc(date_str: str) -> datetime:
    """Parse YYYY-MM-DD and return the datetime representing 23:59:59.999999 UTC."""
    parts = [int(p) for p in date_str.strip().split("-")]
    return datetime(parts[0], parts[1], parts[2], 23, 59, 59, 999999, tzinfo=timezone.utc)


def build_daily_root(
    db: Session,
    date_str: str,
    signing_key_path: str | None = None,
) -> MerkleRoot:
    """Compile and sign a daily Merkle root for all ledger entries registered up to date_str.

    Idempotent: updates existing root record if already present for date_str.
    """
    end_dt = _end_of_day_utc(date_str)

    # Fetch all ledger entries created up to the specified date, ordered by ID
    entries = db.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.created_at <= end_dt)
        .order_by(LedgerEntry.id.asc())
    ).all()

    entry_count = len(entries)
    max_entry_id = entries[-1].id if entries else 0
    hashes = [e.entry_hash for e in entries]
    root = merkle_root(hashes)

    # Sign the commitment: sha256("{date}|{entry_count}|{root}")
    key_path = signing_key_path or settings.signing_key_path
    sk = load_or_create_key(key_path)

    commitment_str = f"{date_str}|{entry_count}|{root}"
    commitment_hash = sha256_hex(commitment_str.encode("utf-8"))
    sig = sign_hash(sk, commitment_hash)

    # Persist or update
    stmt = select(MerkleRoot).where(MerkleRoot.date == date_str)
    existing = db.scalars(stmt).first()

    if existing:
        existing.root = root
        existing.entry_count = entry_count
        existing.max_entry_id = max_entry_id
        existing.signature = sig
        record = existing
    else:
        record = MerkleRoot(
            date=date_str,
            root=root,
            entry_count=entry_count,
            max_entry_id=max_entry_id,
            signature=sig,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record


def verify_daily_root(
    db: Session,
    date_str: str,
    public_key_hex_val: str | None = None,
) -> dict[str, Any]:
    """Verify cryptographic integrity of published Merkle root by recomputing over historical entries.

    Returns:
        dict with status: 'MATCH' or 'MISMATCH'.
    """
    stmt = select(MerkleRoot).where(MerkleRoot.date == date_str)
    stored = db.scalars(stmt).first()
    if not stored:
        return {
            "date": date_str,
            "status": "NOT_FOUND",
            "root_match": False,
            "sig_valid": False,
            "detail": f"No Merkle root published for {date_str}",
        }

    # Recompute tree over entries with id <= stored.max_entry_id
    entries = db.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.id <= stored.max_entry_id)
        .order_by(LedgerEntry.id.asc())
    ).all()

    recomputed_hashes = [e.entry_hash for e in entries]
    recomputed_root = merkle_root(recomputed_hashes)
    root_match = (recomputed_root == stored.root)

    # Verify signature
    if not public_key_hex_val:
        sk = load_or_create_key(settings.signing_key_path)
        public_key_hex_val = public_key_hex(sk)

    commitment_str = f"{date_str}|{stored.entry_count}|{stored.root}"
    commitment_hash = sha256_hex(commitment_str.encode("utf-8"))
    sig_valid = verify_sig(public_key_hex_val, commitment_hash, stored.signature)

    status = "MATCH" if (root_match and sig_valid) else "MISMATCH"

    return {
        "date": date_str,
        "status": status,
        "root_match": root_match,
        "sig_valid": sig_valid,
        "stored_root": stored.root,
        "recomputed_root": recomputed_root,
        "entry_count": stored.entry_count,
        "max_entry_id": stored.max_entry_id,
        "signature": stored.signature,
        "created_at": stored.created_at.isoformat() if stored.created_at else None,
    }
