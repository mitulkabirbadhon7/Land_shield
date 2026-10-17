from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.audit import AuditLog
from app.models.deed import Deed
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token, hash_password
from app.services.crypto import load_or_create_key
from app.services.holdings import ledger_holdings, record_holdings
from app.services.mutation_fsm import auto_check, start_mutation, transition
from scripts.seed import seed_data


@pytest.fixture
def seeded_db(db_session: Session):
    key = load_or_create_key(settings.signing_key_path)
    seed_data(db_session, reset=True, signer_key=key)
    return db_session


@pytest.fixture
def test_users(seeded_db: Session):
    officer = seeded_db.scalars(select(User).where(User.role == "officer")).first()
    registrar = seeded_db.scalars(select(User).where(User.role == "registrar")).first()
    admin = seeded_db.scalars(select(User).where(User.role == "admin")).first()

    return {
        "officer": officer,
        "registrar": registrar,
        "admin": admin,
        "officer_token": create_access_token(officer.username, "officer"),
        "registrar_token": create_access_token(registrar.username, "registrar"),
        "admin_token": create_access_token(admin.username, "admin"),
    }


# -----------------------------------------------------------------------------
# 1. Happy Path & Holdings Recomputation
# -----------------------------------------------------------------------------

def test_mutation_happy_path_full_sale_updates_khatian_and_current_owner(seeded_db: Session, test_users: dict):
    # Create fresh plot, seller, buyer, and active deed
    seller = Person(display_name="বিক্রেতা মোজাম্মেল", is_synthetic=True)
    buyer = Person(display_name="ক্রেতা ফারুক হোসেন", is_synthetic=True)
    seeded_db.add_all([seller, buyer])
    seeded_db.flush()

    plot = Plot(
        mouza="বাড্ডা",
        upazila="গুলশান",
        district="ঢাকা",
        dag_no="777",
        area_decimal=25.0,
        land_type="residential",
        initial_owner_id=seller.id,
        current_owner_id=seller.id,
    )
    seeded_db.add(plot)
    seeded_db.flush()

    key = load_or_create_key(settings.signing_key_path)
    from app.services.deeds import register_deed
    deed = register_deed(
        seeded_db,
        signer_key=key,
        plot_id=plot.id,
        seller_id=seller.id,
        buyer_id=buyer.id,
        area_sold=25.0,
        deed_type="SALE",
        sub_registry="GUL",
        skip_fraud=True,
    )
    seeded_db.flush()


    # 1. Start mutation
    mutation = start_mutation(seeded_db, deed_id=deed.id, applicant_id=buyer.id)
    assert mutation.state == "SUBMITTED"
    assert mutation.applicant_id == buyer.id

    # 2. Automated risk check
    mutation = auto_check(seeded_db, mutation)
    assert mutation.state == "AUTO_CHECKED"
    assert mutation.auto_check_json is not None
    assert mutation.requires_override is False

    # 3. Under review
    mutation = transition(seeded_db, mutation, "UNDER_REVIEW", actor=test_users["officer"], note="Documents verified")
    assert mutation.state == "UNDER_REVIEW"

    # 4. Approved
    mutation = transition(seeded_db, mutation, "APPROVED", actor=test_users["officer"], note="Mutation approved")
    assert mutation.state == "APPROVED"

    # 5. Khatian updated
    mutation = transition(seeded_db, mutation, "KHATIAN_UPDATED", actor=test_users["officer"], note="e-Porcha issued")
    assert mutation.state == "KHATIAN_UPDATED"

    # Verify official record holdings updated
    rec = record_holdings(seeded_db, plot)
    assert rec.get(seller.id, 0.0) == 0.0
    assert rec.get(buyer.id, 0.0) == 25.0
    assert plot.current_owner_id == buyer.id

    # Verify event order
    events = seeded_db.scalars(
        select(MutationEvent).where(MutationEvent.mutation_id == mutation.id).order_by(MutationEvent.id.asc())
    ).all()
    states = [e.to_state for e in events]
    assert states == ["SUBMITTED", "AUTO_CHECKED", "UNDER_REVIEW", "APPROVED", "KHATIAN_UPDATED"]


def test_mutation_happy_path_partial_sale_preserves_owner(seeded_db: Session, test_users: dict):
    # Plot area 30, seller sells 10 to buyer, keeping 20
    seller = Person(display_name="আনোয়ার হোসেন", is_synthetic=True)
    buyer = Person(display_name="বেলাল আহমেদ", is_synthetic=True)
    seeded_db.add_all([seller, buyer])
    seeded_db.flush()

    plot = Plot(
        mouza="উত্তরা",
        upazila="উত্তরা",
        district="ঢাকা",
        dag_no="888",
        area_decimal=30.0,
        land_type="residential",
        initial_owner_id=seller.id,
        current_owner_id=seller.id,
    )
    seeded_db.add(plot)
    seeded_db.flush()

    key = load_or_create_key(settings.signing_key_path)
    from app.services.deeds import register_deed
    deed = register_deed(
        seeded_db,
        signer_key=key,
        plot_id=plot.id,
        seller_id=seller.id,
        buyer_id=buyer.id,
        area_sold=10.0,
        deed_type="SALE",
        sub_registry="UTT",
        skip_fraud=True,
    )
    seeded_db.flush()


    mutation = start_mutation(seeded_db, deed_id=deed.id, applicant_id=buyer.id)
    mutation = auto_check(seeded_db, mutation)
    mutation = transition(seeded_db, mutation, "UNDER_REVIEW", actor=test_users["officer"], note="Verified")
    mutation = transition(seeded_db, mutation, "APPROVED", actor=test_users["officer"], note="Approved")
    mutation = transition(seeded_db, mutation, "KHATIAN_UPDATED", actor=test_users["officer"], note="Khatian updated")

    rec = record_holdings(seeded_db, plot)
    assert rec.get(seller.id, 0.0) == 20.0
    assert rec.get(buyer.id, 0.0) == 10.0
    # Seller still holds 20 > 10, so seller remains the largest holder
    assert plot.current_owner_id == seller.id


# -----------------------------------------------------------------------------
# 2. Illegal Transitions & Constraint Tests
# -----------------------------------------------------------------------------

def test_illegal_transition_returns_409(client: TestClient, seeded_db: Session, test_users: dict):
    # Plot 1 deed 1
    deed = seeded_db.scalars(select(Deed).where(Deed.plot_id == 1, Deed.status == "ACTIVE")).first()
    mutation = start_mutation(seeded_db, deed_id=deed.id)
    seeded_db.commit()

    # In SUBMITTED, attempt skipping straight to APPROVED
    res = client.post(
        f"/api/v1/mutations/{mutation.id}/transition",
        json={"to_state": "APPROVED", "note": "Skip steps"},
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res.status_code == 409
    body = res.json()
    assert body["code"] == "ILLEGAL_TRANSITION"
    assert "AUTO_CHECKED" in body["allowed"]
    assert "REJECTED" in body["allowed"]


def test_override_note_required_on_critical_auto_check(seeded_db: Session, test_users: dict):
    # Plot 1 has S1 double sale -> assess in PLOT mode finds critical risk
    plot = seeded_db.get(Plot, 1)
    deed = seeded_db.scalars(select(Deed).where(Deed.plot_id == plot.id, Deed.status == "ACTIVE")).first()

    # Clear any previous mutations
    for m in seeded_db.scalars(select(Mutation).where(Mutation.deed_id == deed.id)).all():
        m.state = "REJECTED"
    seeded_db.flush()

    mutation = start_mutation(seeded_db, deed_id=deed.id)
    mutation = auto_check(seeded_db, mutation)
    assert mutation.requires_override is True

    # Transitioning to UNDER_REVIEW without note must fail
    with pytest.raises(Exception) as exc_info:
        transition(seeded_db, mutation, "UNDER_REVIEW", actor=test_users["officer"], note="")
    assert "override note is mandatory" in str(exc_info.value).lower()

    # Transitioning with note succeeds
    mutation = transition(
        seeded_db, mutation, "UNDER_REVIEW", actor=test_users["officer"], note="Officer manual verification override"
    )
    assert mutation.state == "UNDER_REVIEW"


def test_rejection_cancels_deed_and_excludes_from_holdings(seeded_db: Session, test_users: dict):
    seller = Person(display_name="বিক্রেতা কালাম", is_synthetic=True)
    buyer = Person(display_name="ক্রেতা জামাল", is_synthetic=True)
    seeded_db.add_all([seller, buyer])
    seeded_db.flush()

    plot = Plot(
        mouza="মিরপুর",
        upazila="মিরপুর",
        district="ঢাকা",
        dag_no="999",
        area_decimal=15.0,
        land_type="residential",
        initial_owner_id=seller.id,
        current_owner_id=seller.id,
    )
    seeded_db.add(plot)
    seeded_db.flush()

    key = load_or_create_key(settings.signing_key_path)
    from app.services.deeds import register_deed
    deed = register_deed(
        seeded_db,
        signer_key=key,
        plot_id=plot.id,
        seller_id=seller.id,
        buyer_id=buyer.id,
        area_sold=15.0,
        deed_type="SALE",
        sub_registry="MIR",
        skip_fraud=True,
    )
    seeded_db.flush()


    mutation = start_mutation(seeded_db, deed_id=deed.id)

    # Rejection without note fails
    with pytest.raises(Exception):
        transition(seeded_db, mutation, "REJECTED", actor=test_users["officer"], note="")

    # Rejection with note succeeds
    mutation = transition(
        seeded_db, mutation, "REJECTED", actor=test_users["officer"], note="Forged identification detected"
    )
    assert mutation.state == "REJECTED"
    assert deed.status == "CANCELLED"

    # Cancelled deed is excluded from ledger holdings
    lh = ledger_holdings(seeded_db, plot)
    assert lh.get(buyer.id, 0.0) == 0.0

    # AuditLog entry created
    deed_audits = seeded_db.scalars(
        select(AuditLog).where(AuditLog.entity == "deed", AuditLog.action == "DEED_CANCELLED")
    ).all()
    assert any(a.entity_id == deed.id for a in deed_audits)


def test_second_open_mutation_on_same_deed_refused(seeded_db: Session):
    deed = seeded_db.scalars(select(Deed).where(Deed.plot_id == 6, Deed.status == "ACTIVE")).first()

    # Clear prior mutations on this deed
    for m in seeded_db.scalars(select(Mutation).where(Mutation.deed_id == deed.id)).all():
        m.state = "KHATIAN_UPDATED"
    seeded_db.flush()

    # Start first open mutation
    start_mutation(seeded_db, deed_id=deed.id)

    # Attempt second open mutation
    with pytest.raises(Exception) as exc_info:
        start_mutation(seeded_db, deed_id=deed.id)
    assert "already exists" in str(exc_info.value).lower()


# -----------------------------------------------------------------------------
# 3. API RBAC and Masked Public View
# -----------------------------------------------------------------------------

def test_mutation_api_rbac_and_public_view(client: TestClient, seeded_db: Session, test_users: dict):
    deed = seeded_db.scalars(select(Deed).where(Deed.plot_id == 6, Deed.status == "ACTIVE")).first()
    # Mark old mutations finished
    for m in seeded_db.scalars(select(Mutation).where(Mutation.deed_id == deed.id)).all():
        m.state = "KHATIAN_UPDATED"
    seeded_db.commit()

    # 1. Unauthenticated POST /api/v1/mutations -> 401
    res_unauth = client.post("/api/v1/mutations", json={"deed_id": deed.id})
    assert res_unauth.status_code == 401

    # 2. Officer POST /api/v1/mutations -> 403 (registrar only)
    res_officer_create = client.post(
        "/api/v1/mutations",
        json={"deed_id": deed.id},
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res_officer_create.status_code == 403

    # 3. Registrar POST /api/v1/mutations -> 201 Created
    res_reg_create = client.post(
        "/api/v1/mutations",
        json={"deed_id": deed.id, "auto_check": True},
        headers={"Authorization": f"Bearer {test_users['registrar_token']}"},
    )
    assert res_reg_create.status_code == 201
    mut_data = res_reg_create.json()
    mutation_id = mut_data["id"]
    assert mut_data["state"] == "AUTO_CHECKED"

    # 4. Registrar POST transition -> 403 (officer only)
    res_reg_trans = client.post(
        f"/api/v1/mutations/{mutation_id}/transition",
        json={"to_state": "UNDER_REVIEW", "note": "Officer check"},
        headers={"Authorization": f"Bearer {test_users['registrar_token']}"},
    )
    assert res_reg_trans.status_code == 403

    # 5. Officer POST transition -> 200 OK
    res_off_trans = client.post(
        f"/api/v1/mutations/{mutation_id}/transition",
        json={"to_state": "UNDER_REVIEW", "note": "Documents verified by officer"},
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res_off_trans.status_code == 200
    assert res_off_trans.json()["state"] == "UNDER_REVIEW"

    # 6. Officer GET /api/v1/mutations?state=UNDER_REVIEW -> 200 OK
    res_list = client.get(
        "/api/v1/mutations?state=UNDER_REVIEW",
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res_list.status_code == 200
    assert any(m["id"] == mutation_id for m in res_list.json())

    # 7. Public GET /api/v1/mutations/{id} -> masked view, auto_check_json omitted
    res_public = client.get(f"/api/v1/mutations/{mutation_id}")
    assert res_public.status_code == 200
    pub_data = res_public.json()
    assert "***" in pub_data["applicant_name"]
    assert pub_data["auto_check_json"] is None
    assert len(pub_data["events"]) >= 2

    # 8. Officer GET /api/v1/mutations/{id} -> auto_check_json visible
    res_officer_view = client.get(
        f"/api/v1/mutations/{mutation_id}",
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res_officer_view.status_code == 200
    off_data = res_officer_view.json()
    assert off_data["auto_check_json"] is not None


def test_scenario_s6_clean_sale_mutation_application_recommendation_approves(
    client: TestClient,
    seeded_db: Session,
    test_users: dict,
):
    """Submitting an application for S6 clean deal returns clean auto-check recommendation (APPROVE/not blocked)."""
    p6 = seeded_db.get(Plot, 6)
    assert p6 is not None
    assert p6.current_owner_id is not None

    buyer = seeded_db.scalars(
        select(Person).where(Person.id != p6.current_owner_id)
    ).first()
    assert buyer is not None

    # 1. Registrar registers new clean transfer on S6
    res_deed = client.post(
        "/api/v1/deeds",
        json={
            "plot_id": p6.id,
            "seller_id": p6.current_owner_id,
            "buyer_id": buyer.id,
            "area_sold": 10.0,
            "deed_type": "SALE",
            "sub_registry": "DHAKA",
        },
        headers={"Authorization": f"Bearer {test_users['registrar_token']}"},
    )
    assert res_deed.status_code == 201
    deed_data = res_deed.json()
    assert deed_data["verify"]["status"] == "VALID"
    new_deed_id = deed_data["deed"]["id"]

    # 2. Registrar submits mutation application with auto_check
    res_mut = client.post(
        "/api/v1/mutations",
        json={"deed_id": new_deed_id, "auto_check": True},
        headers={"Authorization": f"Bearer {test_users['registrar_token']}"},
    )
    assert res_mut.status_code == 201
    mut_data = res_mut.json()
    assert mut_data["state"] == "AUTO_CHECKED"
    assert mut_data["requires_override"] is False
    assert mut_data["auto_check_json"]["has_critical"] is False
    assert mut_data["auto_check_json"]["score"] == 0

    # 3. Officer can transition directly to UNDER_REVIEW and APPROVED without override note
    mut_id = mut_data["id"]
    res_review = client.post(
        f"/api/v1/mutations/{mut_id}/transition",
        json={"to_state": "UNDER_REVIEW", "note": "Clean deal verified"},
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res_review.status_code == 200

    res_approve = client.post(
        f"/api/v1/mutations/{mut_id}/transition",
        json={"to_state": "APPROVED", "note": "Recommended and approved"},
        headers={"Authorization": f"Bearer {test_users['officer_token']}"},
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["state"] == "APPROVED"

