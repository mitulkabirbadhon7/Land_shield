import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    User,
    Person,
    Plot,
    Deed,
    LedgerEntry,
    Mutation,
    MutationEvent,
    Case,
    Alert,
    AuditLog,
)
from app.db import get_db

def test_create_all_models(db_session: Session):
    # 1. User
    user = User(
        name="Officer Kabir",
        username="kabir_acland",
        role="officer",
        password_hash="argon2_hash_dummy_val"
    )
    db_session.add(user)
    db_session.flush()
    assert user.id is not None
    assert user.created_at is not None

    # 2. Persons
    seller = Person(
        display_name="Rahim Uddin",
        masked_nid_hash="nid_hash_abc_123",
        is_synthetic=True
    )
    buyer = Person(
        display_name="Karim Ahmed",
        masked_nid_hash="nid_hash_xyz_789"
    )
    db_session.add_all([seller, buyer])
    db_session.flush()
    assert seller.id is not None
    assert buyer.is_synthetic is True  # default True

    # 3. Plot
    plot = Plot(
        mouza="Tejgaon",
        upazila="Dhaka Sadar",
        district="Dhaka",
        dag_no="1042",
        area_decimal=10.5,
        land_type="commercial",
        flags=["khas"],
        initial_owner_id=seller.id,
        current_owner_id=seller.id
    )
    db_session.add(plot)
    db_session.flush()
    assert plot.id is not None
    assert plot.flags == ["khas"]

    # 4. Deed
    now_iso = datetime.now(timezone.utc).isoformat()
    deed = Deed(
        deed_no="DDM-2026-000101",
        plot_id=plot.id,
        seller_id=seller.id,
        buyer_id=buyer.id,
        area_sold=5.0,
        deed_type="sale",
        sub_registry="Tejgaon Sub-Registry",
        registered_at=now_iso,
        payload_json='{"plot_id": 1, "area": 5.0}',
        deed_hash="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        signature="signature_hex_64_bytes",
        signer_key_id="reg_key_v1"
    )
    db_session.add(deed)
    db_session.flush()
    assert deed.id is not None
    assert deed.status == "ACTIVE"  # default status ACTIVE
    assert deed.tamper_backup is None

    # 5. LedgerEntry
    entry = LedgerEntry(
        plot_id=plot.id,
        seq=1,
        deed_id=deed.id,
        prev_hash="0" * 64,
        entry_hash="fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    )
    db_session.add(entry)
    db_session.flush()
    assert entry.id is not None

    # 6. Mutation & MutationEvent
    mutation = Mutation(
        deed_id=deed.id,
        plot_id=plot.id,
        state="SUBMITTED",
        applicant_id=buyer.id,
        officer_id=user.id
    )
    db_session.add(mutation)
    db_session.flush()
    assert mutation.id is not None
    assert mutation.requires_override is False

    event = MutationEvent(
        mutation_id=mutation.id,
        from_state="SUBMITTED",
        to_state="UNDER_REVIEW",
        actor_id=user.id,
        note="Initial document screening passed"
    )
    db_session.add(event)
    db_session.flush()
    assert event.id is not None

    # 7. Case
    case = Case(
        plot_id=plot.id,
        case_no="CASE-2026-442",
        status="PENDING"
    )
    db_session.add(case)
    db_session.flush()
    assert case.id is not None

    # 8. Alert
    alert = Alert(
        deed_id=deed.id,
        plot_id=plot.id,
        rule_id="R1",
        severity="CRITICAL",
        reasons=["Plot area oversold"]
    )
    db_session.add(alert)
    db_session.flush()
    assert alert.id is not None
    assert alert.status == "OPEN"

    # 9. AuditLog
    audit = AuditLog(
        actor_id=user.id,
        action="VERIFY_DEED",
        entity="deeds",
        entity_id=deed.id,
        detail="Deed verified successfully"
    )
    db_session.add(audit)
    db_session.flush()
    assert audit.id is not None

def test_deed_no_unique_constraint(db_session: Session):
    seller = Person(display_name="Seller A", is_synthetic=True)
    buyer = Person(display_name="Buyer B", is_synthetic=True)
    plot = Plot(
        mouza="Gulshan", upazila="Gulshan", district="Dhaka",
        dag_no="55", area_decimal=5.0, initial_owner_id=1
    )
    db_session.add_all([seller, buyer, plot])
    db_session.flush()

    deed1 = Deed(
        deed_no="UNIQUE-DEED-001",
        plot_id=plot.id,
        seller_id=seller.id,
        buyer_id=buyer.id,
        area_sold=2.0,
        sub_registry="Dhaka",
        registered_at="2026-10-12T00:00:00Z",
        payload_json="{}",
        deed_hash="hash1",
        signature="sig1",
        signer_key_id="k1"
    )
    db_session.add(deed1)
    db_session.flush()

    deed2 = Deed(
        deed_no="UNIQUE-DEED-001",  # duplicate deed_no
        plot_id=plot.id,
        seller_id=seller.id,
        buyer_id=buyer.id,
        area_sold=1.0,
        sub_registry="Dhaka",
        registered_at="2026-10-12T00:00:00Z",
        payload_json="{}",
        deed_hash="hash2",
        signature="sig2",
        signer_key_id="k1"
    )
    db_session.add(deed2)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_ledger_plot_seq_unique_constraint(db_session: Session):
    seller = Person(display_name="Seller X", is_synthetic=True)
    plot = Plot(
        mouza="Uttara", upazila="Uttara", district="Dhaka",
        dag_no="12", area_decimal=8.0, initial_owner_id=1
    )
    deed = Deed(
        deed_no="DEED-SEQ-001",
        plot_id=1, seller_id=1, buyer_id=1, area_sold=1.0,
        sub_registry="Uttara", registered_at="2026-10-12T00:00:00Z",
        payload_json="{}", deed_hash="h1", signature="s1", signer_key_id="k1"
    )
    db_session.add_all([seller, plot, deed])
    db_session.flush()

    entry1 = LedgerEntry(
        plot_id=plot.id,
        seq=1,
        deed_id=deed.id,
        prev_hash="0" * 64,
        entry_hash="hash_a"
    )
    db_session.add(entry1)
    db_session.flush()

    entry2 = LedgerEntry(
        plot_id=plot.id,
        seq=1,  # Duplicate seq for same plot_id!
        deed_id=deed.id,
        prev_hash="0" * 64,
        entry_hash="hash_b"
    )
    db_session.add(entry2)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

def test_get_db_rollback_on_exception():
    generator = get_db()
    db = next(generator)
    assert db.is_active

    # Verify that throwing an exception triggers rollback
    with pytest.raises(RuntimeError):
        generator.throw(RuntimeError("Simulated database failure"))
