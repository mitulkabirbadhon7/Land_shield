import json
from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models.person import Person
from app.models.plot import Plot
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.services.crypto import canonical, sha256_hex, build_deed_payload
from app.services.ledger import (
    GENESIS,
    entry_ts,
    entry_hash,
    latest_entry,
    append_entry,
    verify_chain,
    is_superseded,
)


def _make_deed(
    db: Session,
    deed_no: str,
    plot_id: int,
    seller_id: int,
    buyer_id: int,
    area_sold: float,
    registered_at_str: str = "2026-10-01T12:00:00+00:00",
) -> Deed:
    payload_dict = build_deed_payload(
        deed_no=deed_no,
        plot_id=plot_id,
        seller_id=seller_id,
        buyer_id=buyer_id,
        area_sold=area_sold,
        deed_type="sale",
        sub_registry="Mirpur",
        registered_at=registered_at_str,
    )
    payload_bytes = canonical(payload_dict)
    d_hash = sha256_hex(payload_bytes)

    deed = Deed(
        deed_no=deed_no,
        plot_id=plot_id,
        seller_id=seller_id,
        buyer_id=buyer_id,
        area_sold=area_sold,
        deed_type="sale",
        sub_registry="Mirpur",
        registered_at=registered_at_str,
        payload_json=payload_bytes.decode("utf-8"),
        deed_hash=d_hash,
        signature="0" * 128,
        signer_key_id="test_key_01",
        status="ACTIVE",
    )
    db.add(deed)
    db.flush()
    return deed


def test_chain_of_three_passes(db_session: Session):
    # Setup personas & plot
    p1 = Person(display_name="Person 1", masked_nid_hash="nid1")
    p2 = Person(display_name="Person 2", masked_nid_hash="nid2")
    p3 = Person(display_name="Person 3", masked_nid_hash="nid3")
    p4 = Person(display_name="Person 4", masked_nid_hash="nid4")
    db_session.add_all([p1, p2, p3, p4])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="101",
        area_decimal=50.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    d1 = _make_deed(db_session, "D01", plot.id, p1.id, p2.id, 50.0, "2026-10-01T10:00:00+00:00")
    e1 = append_entry(db_session, plot.id, d1)
    db_session.flush()

    d2 = _make_deed(db_session, "D02", plot.id, p2.id, p3.id, 50.0, "2026-10-02T10:00:00+00:00")
    e2 = append_entry(db_session, plot.id, d2)
    db_session.flush()

    d3 = _make_deed(db_session, "D03", plot.id, p3.id, p4.id, 50.0, "2026-10-03T10:00:00+00:00")
    e3 = append_entry(db_session, plot.id, d3)
    db_session.flush()

    assert e1.seq == 1
    assert e1.prev_hash == GENESIS
    assert e2.seq == 2
    assert e2.prev_hash == e1.entry_hash
    assert e3.seq == 3
    assert e3.prev_hash == e2.entry_hash

    ok, reason, broken_seq = verify_chain(db_session, plot.id)
    assert ok is True
    assert reason == "VALID"
    assert broken_seq is None


def test_modified_deed_hash_fails_with_correct_seq(db_session: Session):
    p1 = Person(display_name="P1", masked_nid_hash="n1")
    p2 = Person(display_name="P2", masked_nid_hash="n2")
    p3 = Person(display_name="P3", masked_nid_hash="n3")
    p4 = Person(display_name="P4", masked_nid_hash="n4")
    db_session.add_all([p1, p2, p3, p4])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="102",
        area_decimal=40.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    d1 = _make_deed(db_session, "D11", plot.id, p1.id, p2.id, 40.0, "2026-10-01T10:00:00+00:00")
    append_entry(db_session, plot.id, d1)

    d2 = _make_deed(db_session, "D12", plot.id, p2.id, p3.id, 40.0, "2026-10-02T10:00:00+00:00")
    append_entry(db_session, plot.id, d2)

    d3 = _make_deed(db_session, "D13", plot.id, p3.id, p4.id, 40.0, "2026-10-03T10:00:00+00:00")
    append_entry(db_session, plot.id, d3)
    db_session.flush()

    # Tamper deed 2 hash
    d2.deed_hash = "f" * 64
    db_session.flush()

    ok, reason, broken_seq = verify_chain(db_session, plot.id)
    assert ok is False
    assert broken_seq == 2


def test_deleted_middle_entry_fails(db_session: Session):
    p1 = Person(display_name="P1", masked_nid_hash="n1")
    p2 = Person(display_name="P2", masked_nid_hash="n2")
    p3 = Person(display_name="P3", masked_nid_hash="n3")
    p4 = Person(display_name="P4", masked_nid_hash="n4")
    db_session.add_all([p1, p2, p3, p4])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="103",
        area_decimal=40.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    d1 = _make_deed(db_session, "D21", plot.id, p1.id, p2.id, 40.0, "2026-10-01T10:00:00+00:00")
    append_entry(db_session, plot.id, d1)

    d2 = _make_deed(db_session, "D22", plot.id, p2.id, p3.id, 40.0, "2026-10-02T10:00:00+00:00")
    e2 = append_entry(db_session, plot.id, d2)

    d3 = _make_deed(db_session, "D23", plot.id, p3.id, p4.id, 40.0, "2026-10-03T10:00:00+00:00")
    append_entry(db_session, plot.id, d3)
    db_session.flush()

    # Delete middle entry (seq 2)
    db_session.delete(e2)
    db_session.flush()

    ok, reason, broken_seq = verify_chain(db_session, plot.id)
    assert ok is False
    assert broken_seq == 3


def test_is_superseded(db_session: Session):
    p1 = Person(display_name="P1", masked_nid_hash="n1")
    p2 = Person(display_name="P2", masked_nid_hash="n2")
    p3 = Person(display_name="P3", masked_nid_hash="n3")
    db_session.add_all([p1, p2, p3])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="104",
        area_decimal=20.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    d1 = _make_deed(db_session, "D31", plot.id, p1.id, p2.id, 20.0, "2026-10-01T10:00:00+00:00")
    append_entry(db_session, plot.id, d1)
    db_session.flush()

    # Initially, d1 is latest so not superseded
    assert is_superseded(db_session, d1) is False

    d2 = _make_deed(db_session, "D32", plot.id, p2.id, p3.id, 20.0, "2026-10-02T10:00:00+00:00")
    append_entry(db_session, plot.id, d2)
    db_session.flush()

    # Now d1 has a subsequent entry with higher seq; d2 is latest
    assert is_superseded(db_session, d1) is True
    assert is_superseded(db_session, d2) is False

    # A deed not registered in ledger returns False
    d_unlinked = _make_deed(db_session, "D33_UNLINKED", plot.id, p3.id, p1.id, 10.0)
    assert is_superseded(db_session, d_unlinked) is False


def test_naive_vs_timezone_aware_datetime_in_db_does_not_break_verify(db_session: Session):
    p1 = Person(display_name="P1", masked_nid_hash="n1")
    p2 = Person(display_name="P2", masked_nid_hash="n2")
    db_session.add_all([p1, p2])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="105",
        area_decimal=15.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # Create deed with explicit timezone ISO string in payload
    ts_str = "2026-10-05T08:30:00+00:00"
    d = _make_deed(db_session, "D41", plot.id, p1.id, p2.id, 15.0, ts_str)
    entry = append_entry(db_session, plot.id, d)

    # Force entry created_at to naive datetime to simulate naive SQLite/DB storage
    entry.created_at = datetime(2026, 10, 5, 8, 30, 0)
    db_session.flush()

    ok, reason, broken_seq = verify_chain(db_session, plot.id)
    assert ok is True
    assert reason == "VALID"
    assert broken_seq is None
