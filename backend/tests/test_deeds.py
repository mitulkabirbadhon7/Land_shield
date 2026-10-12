from datetime import datetime, timezone
import pytest
import nacl.signing
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models.person import Person
from app.models.plot import Plot
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.services.deeds import register_deed, verify_deed, next_deed_no


@pytest.fixture
def test_key() -> nacl.signing.SigningKey:
    return nacl.signing.SigningKey.generate()


@pytest.fixture
def sample_entities(db_session: Session) -> tuple[Plot, Person, Person, Person]:
    p1 = Person(display_name="Person A", masked_nid_hash="nida")
    p2 = Person(display_name="Person B", masked_nid_hash="nidb")
    p3 = Person(display_name="Person C", masked_nid_hash="nidc")
    db_session.add_all([p1, p2, p3])
    db_session.flush()

    plot = Plot(
        mouza="Tejgaon",
        upazila="Tejgaon",
        district="Dhaka",
        dag_no="501",
        area_decimal=60.0,
        initial_owner_id=p1.id,
    )
    db_session.add(plot)
    db_session.flush()
    return plot, p1, p2, p3


def test_next_deed_no_sequential(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    d_no1 = next_deed_no(db_session, "MIR")
    assert d_no1.startswith("MIR-")
    assert d_no1.endswith("-000001")

    # Register deed with this deed_no
    register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=10.0,
        deed_type="sale",
        sub_registry="MIR",
        deed_no=d_no1,
    )
    db_session.flush()

    d_no2 = next_deed_no(db_session, "MIR")
    assert d_no2.endswith("-000002")


def test_register_then_verify_valid(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    deed = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=25.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    db_session.flush()

    result = verify_deed(db_session, deed.deed_no, configured_key=test_key)
    assert result["status"] == "VALID"
    assert result["reasons"] == []
    assert result["deed_no"] == deed.deed_no
    assert result["plot_id"] == plot.id
    assert result["chain_position"] == 1
    assert result["registered_at"] == deed.registered_at


def test_edit_payload_json_tampered_hash_mismatch(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    deed = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=25.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    db_session.flush()

    # Tamper payload text
    deed.payload_json = deed.payload_json.replace("25.0", "99.0")
    db_session.flush()

    result = verify_deed(db_session, deed.deed_no, configured_key=test_key)
    assert result["status"] == "TAMPERED"
    assert any("HASH_MISMATCH" in r for r in result["reasons"])


def test_swap_signature_bad_signature(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    deed = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=25.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    db_session.flush()

    # Tamper signature
    deed.signature = "a" * 128
    db_session.flush()

    result = verify_deed(db_session, deed.deed_no, configured_key=test_key)
    assert result["status"] == "TAMPERED"
    assert any("BAD_SIGNATURE" in r for r in result["reasons"])


def test_unknown_key_id_key_unknown(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    deed = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=25.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    db_session.flush()

    # Tamper key ID
    deed.signer_key_id = "unknown_key_id_1"
    db_session.flush()

    result = verify_deed(db_session, deed.deed_no, configured_key=test_key)
    assert result["status"] == "TAMPERED"
    assert any("KEY_UNKNOWN" in r for r in result["reasons"])


def test_second_deed_supersedes_first(db_session: Session, sample_entities, test_key):
    plot, p1, p2, p3 = sample_entities
    d1 = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=20.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    db_session.flush()

    # D1 initially VALID
    r1_before = verify_deed(db_session, d1.deed_no, configured_key=test_key)
    assert r1_before["status"] == "VALID"

    # D2 registered on same plot
    d2 = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p2.id,
        buyer_id=p3.id,
        area_sold=20.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    db_session.flush()

    # Now D1 is SUPERSEDED, D2 is VALID
    r1_after = verify_deed(db_session, d1.deed_no, configured_key=test_key)
    assert r1_after["status"] == "SUPERSEDED"
    assert any("SUPERSEDED" in r for r in r1_after["reasons"])

    r2 = verify_deed(db_session, d2.deed_no, configured_key=test_key)
    assert r2["status"] == "VALID"
    assert r2["chain_position"] == 2


def test_cancelled_deed_reports_cancelled(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    deed = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=15.0,
        deed_type="sale",
        sub_registry="Mirpur",
    )
    deed.status = "CANCELLED"
    db_session.flush()

    result = verify_deed(db_session, deed.deed_no, configured_key=test_key)
    assert result["status"] == "CANCELLED"
    assert any("CANCELLED" in r for r in result["reasons"])


def test_unknown_deed_no_reports_unknown(db_session: Session, test_key):
    result = verify_deed(db_session, "NONEXISTENT-2026-999999", configured_key=test_key)
    assert result["status"] == "UNKNOWN"
    assert any("UNKNOWN" in r for r in result["reasons"])
    assert result["plot_id"] is None
    assert result["chain_position"] is None


def test_invalid_input_raises_domain_error(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities

    # Invalid plot
    with pytest.raises(DomainError, match="Plot with id 9999"):
        register_deed(
            db_session,
            test_key,
            plot_id=9999,
            seller_id=p1.id,
            buyer_id=p2.id,
            area_sold=10.0,
            deed_type="sale",
            sub_registry="Mirpur",
        )

    # Invalid seller
    with pytest.raises(DomainError, match="Seller with id 8888"):
        register_deed(
            db_session,
            test_key,
            plot_id=plot.id,
            seller_id=8888,
            buyer_id=p2.id,
            area_sold=10.0,
            deed_type="sale",
            sub_registry="Mirpur",
        )

    # Invalid buyer
    with pytest.raises(DomainError, match="Buyer with id 7777"):
        register_deed(
            db_session,
            test_key,
            plot_id=plot.id,
            seller_id=p1.id,
            buyer_id=7777,
            area_sold=10.0,
            deed_type="sale",
            sub_registry="Mirpur",
        )

    # Zero or negative area
    with pytest.raises(DomainError, match="area_sold must be greater than 0"):
        register_deed(
            db_session,
            test_key,
            plot_id=plot.id,
            seller_id=p1.id,
            buyer_id=p2.id,
            area_sold=0.0,
            deed_type="sale",
            sub_registry="Mirpur",
        )


def test_verify_still_valid_after_db_round_trip_naive_datetimes(db_session: Session, sample_entities, test_key):
    plot, p1, p2, _ = sample_entities
    deed = register_deed(
        db_session,
        test_key,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=12.0,
        deed_type="sale",
        sub_registry="Mirpur",
        registered_at="2026-10-01T15:00:00+00:00",
    )
    # Simulate DB storing naive datetime in LedgerEntry.created_at
    entry = db_session.query(LedgerEntry).filter(LedgerEntry.deed_id == deed.id).first()
    assert entry is not None
    entry.created_at = datetime(2026, 10, 1, 15, 0, 0)
    db_session.flush()

    result = verify_deed(db_session, deed.deed_no, configured_key=test_key)
    assert result["status"] == "VALID"
    assert result["chain_position"] == 1
