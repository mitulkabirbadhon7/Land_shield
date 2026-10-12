import json
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger import LedgerEntry
from app.models.deed import Deed
from app.services.crypto import sha256_hex

GENESIS = "0" * 64


def entry_ts(deed: Deed) -> str:
    """Extract the exact registered_at string from the signed deed payload."""
    payload = json.loads(deed.payload_json)
    return str(payload["registered_at"])


def entry_hash(prev: str, deed_hash: str, seq: int, ts: str) -> str:
    """Compute the entry hash for a ledger entry: sha256(prev|deed_hash|seq|ts)."""
    data = f"{prev}|{deed_hash}|{seq}|{ts}".encode("utf-8")
    return sha256_hex(data)


def latest_entry(db: Session, plot_id: int) -> LedgerEntry | None:
    """Retrieve the latest LedgerEntry for a given plot by sequence number."""
    stmt = (
        select(LedgerEntry)
        .where(LedgerEntry.plot_id == plot_id)
        .order_by(LedgerEntry.seq.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()


def append_entry(db: Session, plot_id: int, deed: Deed) -> LedgerEntry:
    """Append a new LedgerEntry to the plot's hash chain. Caller commits."""
    last = latest_entry(db, plot_id)
    if last is not None:
        seq = last.seq + 1
        prev = last.entry_hash
    else:
        seq = 1
        prev = GENESIS

    ts = entry_ts(deed)
    eh = entry_hash(prev, deed.deed_hash, seq, ts)

    entry = LedgerEntry(
        plot_id=plot_id,
        seq=seq,
        deed_id=deed.id,
        prev_hash=prev,
        entry_hash=eh,
    )
    db.add(entry)
    return entry


def verify_chain(db: Session, plot_id: int) -> tuple[bool, str, int | None]:
    """Verify integrity of the plot's hash chain.

    Returns:
        (ok: bool, reason: str, broken_seq: int | None)
    """
    stmt = (
        select(LedgerEntry)
        .where(LedgerEntry.plot_id == plot_id)
        .order_by(LedgerEntry.seq.asc())
    )
    entries = list(db.scalars(stmt).all())
    if not entries:
        return (True, "VALID", None)

    expected_seq = 1
    expected_prev = GENESIS

    for entry in entries:
        if entry.seq != expected_seq:
            return (False, f"Sequence gap: expected {expected_seq}, got {entry.seq}", entry.seq)

        if entry.prev_hash != expected_prev:
            return (False, f"Previous hash mismatch at seq {entry.seq}", entry.seq)

        deed = db.get(Deed, entry.deed_id)
        if deed is None:
            return (False, f"Deed not found for seq {entry.seq}", entry.seq)

        ts = entry_ts(deed)
        recomputed = entry_hash(entry.prev_hash, deed.deed_hash, entry.seq, ts)
        if entry.entry_hash != recomputed:
            return (False, f"Entry hash mismatch at seq {entry.seq}", entry.seq)

        expected_seq += 1
        expected_prev = entry.entry_hash

    return (True, "VALID", None)


def is_superseded(db: Session, deed: Deed) -> bool:
    """Check if a deed has been superseded by a subsequent ledger entry on the same plot."""
    stmt = select(LedgerEntry).where(LedgerEntry.deed_id == deed.id)
    entry = db.scalars(stmt).first()
    if entry is None:
        return False

    higher_stmt = (
        select(LedgerEntry)
        .where(LedgerEntry.plot_id == entry.plot_id, LedgerEntry.seq > entry.seq)
        .limit(1)
    )
    return db.scalars(higher_stmt).first() is not None
