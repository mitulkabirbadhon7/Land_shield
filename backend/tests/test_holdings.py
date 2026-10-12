from datetime import datetime, timezone
import pytest
from sqlalchemy.orm import Session

from app.models.person import Person
from app.models.plot import Plot
from app.models.deed import Deed
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.services.crypto import canonical, sha256_hex, build_deed_payload
from app.services.ledger import append_entry
from app.services.holdings import (
    ledger_holdings,
    record_holdings,
    largest_holder,
    recompute_current_owner,
)


def _create_deed(
    db: Session,
    deed_no: str,
    plot_id: int,
    seller_id: int,
    buyer_id: int,
    area_sold: float,
    status: str = "ACTIVE",
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
        signer_key_id="key_01",
        status=status,
    )
    db.add(deed)
    db.flush()
    return deed


def _complete_mutation(
    db: Session,
    deed: Deed,
    plot_id: int,
    applicant_id: int,
    completed_at: datetime,
) -> Mutation:
    mutation = Mutation(
        deed_id=deed.id,
        plot_id=plot_id,
        state="KHATIAN_UPDATED",
        applicant_id=applicant_id,
    )
    db.add(mutation)
    db.flush()

    event = MutationEvent(
        mutation_id=mutation.id,
        from_state="APPROVED",
        to_state="KHATIAN_UPDATED",
        at=completed_at,
    )
    db.add(event)
    db.flush()
    return mutation


def test_full_sale_moves_holding(db_session: Session):
    p1 = Person(display_name="Owner A", masked_nid_hash="nid_a")
    p2 = Person(display_name="Buyer B", masked_nid_hash="nid_b")
    db_session.add_all([p1, p2])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="201",
        area_decimal=50.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # Initial holding
    lh_init = ledger_holdings(db_session, plot)
    assert lh_init[p1.id] == 50.0

    # Full sale: A sells 50.0 to B
    d = _create_deed(db_session, "D_FULL", plot.id, p1.id, p2.id, 50.0)
    append_entry(db_session, plot.id, d)
    db_session.flush()

    lh = ledger_holdings(db_session, plot)
    assert lh[p1.id] == 0.0
    assert lh[p2.id] == 50.0
    assert largest_holder(lh) == p2.id


def test_partial_sales_leave_remainder(db_session: Session):
    p1 = Person(display_name="Owner A", masked_nid_hash="nid_a")
    p2 = Person(display_name="Buyer B", masked_nid_hash="nid_b")
    p3 = Person(display_name="Buyer C", masked_nid_hash="nid_c")
    db_session.add_all([p1, p2, p3])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="202",
        area_decimal=50.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # A sells 10.0 to B
    d1 = _create_deed(db_session, "D_PART1", plot.id, p1.id, p2.id, 10.0)
    append_entry(db_session, plot.id, d1)

    # A sells 15.0 to C
    d2 = _create_deed(db_session, "D_PART2", plot.id, p1.id, p3.id, 15.0)
    append_entry(db_session, plot.id, d2)
    db_session.flush()

    lh = ledger_holdings(db_session, plot)
    assert lh[p1.id] == 25.0
    assert lh[p2.id] == 10.0
    assert lh[p3.id] == 15.0
    assert largest_holder(lh) == p1.id


def test_pending_unmutated_resale_ledger_vs_record(db_session: Session):
    p1 = Person(display_name="Owner A", masked_nid_hash="nid_a")
    p2 = Person(display_name="Buyer B", masked_nid_hash="nid_b")
    p3 = Person(display_name="Buyer C", masked_nid_hash="nid_c")
    db_session.add_all([p1, p2, p3])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="203",
        area_decimal=40.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # Deed 1: A -> B (unmutated)
    d1 = _create_deed(db_session, "D_RESALE1", plot.id, p1.id, p2.id, 40.0)
    append_entry(db_session, plot.id, d1)

    # Deed 2: B -> C (unmutated resale)
    d2 = _create_deed(db_session, "D_RESALE2", plot.id, p2.id, p3.id, 40.0)
    append_entry(db_session, plot.id, d2)
    db_session.flush()

    # In ledger view, B sold to C, so C owns 40.0, A and B own 0.0
    lh = ledger_holdings(db_session, plot)
    assert lh[p3.id] == 40.0
    assert lh[p2.id] == 0.0
    assert lh[p1.id] == 0.0

    # In official record view (mutations not completed), A is still the owner
    rh = record_holdings(db_session, plot)
    assert rh[p1.id] == 40.0
    assert rh.get(p2.id, 0.0) == 0.0
    assert rh.get(p3.id, 0.0) == 0.0
    assert largest_holder(rh) == p1.id


def test_cancelled_deed_excluded_from_holdings(db_session: Session):
    p1 = Person(display_name="Owner A", masked_nid_hash="nid_a")
    p2 = Person(display_name="Buyer B", masked_nid_hash="nid_b")
    db_session.add_all([p1, p2])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="204",
        area_decimal=30.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # Cancelled deed
    d = _create_deed(db_session, "D_CANCELLED", plot.id, p1.id, p2.id, 30.0, status="CANCELLED")
    append_entry(db_session, plot.id, d)
    db_session.flush()

    lh = ledger_holdings(db_session, plot)
    assert lh[p1.id] == 30.0
    assert lh.get(p2.id, 0.0) == 0.0


def test_before_seq_and_as_of_respected(db_session: Session):
    p1 = Person(display_name="Owner A", masked_nid_hash="nid_a")
    p2 = Person(display_name="Buyer B", masked_nid_hash="nid_b")
    p3 = Person(display_name="Buyer C", masked_nid_hash="nid_c")
    db_session.add_all([p1, p2, p3])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="205",
        area_decimal=50.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # Deed 1 at seq 1: A -> B 20.0
    d1 = _create_deed(db_session, "D_SEQ1", plot.id, p1.id, p2.id, 20.0, registered_at_str="2026-10-01T10:00:00+00:00")
    e1 = append_entry(db_session, plot.id, d1)
    _complete_mutation(db_session, d1, plot.id, p2.id, datetime(2026, 10, 2, 10, 0, 0, tzinfo=timezone.utc))

    # Deed 2 at seq 2: A -> C 15.0
    d2 = _create_deed(db_session, "D_SEQ2", plot.id, p1.id, p3.id, 15.0, registered_at_str="2026-10-10T10:00:00+00:00")
    e2 = append_entry(db_session, plot.id, d2)
    _complete_mutation(db_session, d2, plot.id, p3.id, datetime(2026, 10, 12, 10, 0, 0, tzinfo=timezone.utc))

    db_session.flush()

    # Test before_seq: before seq 2, only deed 1 took effect
    lh_before_2 = ledger_holdings(db_session, plot, before_seq=2)
    assert lh_before_2[p1.id] == 30.0
    assert lh_before_2[p2.id] == 20.0
    assert lh_before_2.get(p3.id, 0.0) == 0.0

    # All seqs
    lh_all = ledger_holdings(db_session, plot)
    assert lh_all[p1.id] == 15.0
    assert lh_all[p2.id] == 20.0
    assert lh_all[p3.id] == 15.0

    # Test as_of: as of 2026-10-05, only deed 1 mutation is complete
    rh_early = record_holdings(db_session, plot, as_of="2026-10-05T00:00:00+00:00")
    assert rh_early[p1.id] == 30.0
    assert rh_early[p2.id] == 20.0
    assert rh_early.get(p3.id, 0.0) == 0.0

    # As of 2026-10-15, both mutations are complete
    rh_late = record_holdings(db_session, plot, as_of=datetime(2026, 10, 15, 0, 0, 0, tzinfo=timezone.utc))
    assert rh_late[p1.id] == 15.0
    assert rh_late[p2.id] == 20.0
    assert rh_late[p3.id] == 15.0


def test_recompute_current_owner(db_session: Session):
    p1 = Person(display_name="Owner A", masked_nid_hash="nid_a")
    p2 = Person(display_name="Buyer B", masked_nid_hash="nid_b")
    db_session.add_all([p1, p2])
    db_session.flush()

    plot = Plot(
        mouza="Mouza 1",
        upazila="Upazila 1",
        district="Dhaka",
        dag_no="206",
        area_decimal=40.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()

    # Before any mutation, current owner is initial owner
    recompute_current_owner(db_session, plot)
    assert plot.current_owner_id == p1.id

    # Full sale to B and completed mutation
    d = _create_deed(db_session, "D_OWNER", plot.id, p1.id, p2.id, 40.0)
    append_entry(db_session, plot.id, d)
    _complete_mutation(db_session, d, plot.id, p2.id, datetime(2026, 10, 3, 10, 0, 0, tzinfo=timezone.utc))
    db_session.flush()

    # After mutation completed, largest record holder is B
    owner_id = recompute_current_owner(db_session, plot)
    assert owner_id == p2.id
    assert plot.current_owner_id == p2.id
