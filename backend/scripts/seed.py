"""Deterministic synthetic seed data generator for LandShield.

Generates 300 plots, 120 persons, 3 demo users, and 8 benchmark scenarios.

Scenario JSON Schema (data/scenarios/scenarios.json):
{
    "description": str,
    "reference_date": str,
    "scenarios": {
        "S1": {
            "id": "S1",
            "name": str,
            "plot_id": int,
            "deed_numbers": list[str],
            "target_deed_no": str | None,
            "expected_rule": str | None,
            "expected_status": str,
            "description": str
        },
        ...
        "S8": { ... }
    }
}
"""

import argparse

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import random
from typing import Any

from argon2 import PasswordHasher
from faker import Faker
import nacl.signing
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, engine
from app.models.case import Case
from app.models.deed import Deed
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.services.crypto import load_or_create_key, sha256_hex
from app.services.deeds import register_deed
from app.services.holdings import recompute_current_owner

SEED_REFERENCE_DATE = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)

BANGLA_FIRST_NAMES = [
    "মোহাম্মদ", "আব্দুল", "ফারুক", "রফিক", "কামাল", "তারিক", "তানভীর", "আরিফ",
    "মাহমুদ", "সাকিব", "হাসান", "হুসাইন", "নাসির", "জাফর", "শফিক", "আনিস",
    "মিজানুর", "জাহিদুল", "মুস্তাফিজ", "রাশেদ", "ইকবাল", "ফরহাদ", "সাইফুল", "মনির",
    "শামসুল", "আসাদ", "বেলায়েত", "কবির", "লতিফ", "মতিন", "নাজমুল", "ওমর",
    "পলাশ", "কায়সার", "রেজাউল", "শাহিন", "তোফায়েল", "উজ্জ্বল", "ওয়াহিদুল", "জিয়া",
    "ফাতেমা", "রোকেয়া", "নুসরাত", "সালমা", "শারমিন", "ফারহানা", "নাজনীন", "আয়েশা",
    "খাদিজা", "জাহানারা", "তানিয়া", "সুলতানা", "সাবরিনা", "রুবিনা", "লায়লা", "শিরিন",
    "পারভীন", "নাসরিন", "তাসলিমা", "মমতাজ"
]

BANGLA_SURNAMES = [
    "রহমান", "আহমেদ", "খান", "চৌধুরী", "হোসেন", "শিকদার", "ভূঁইয়া", "হক",
    "ইসলাম", "মিয়া", "আলী", "তালুকদার", "শেখ", "মোল্লা", "সরকার", "হালদার",
    "মজুমদার", "পাটোয়ারী", "খন্দকার", "মুন্সী", "দেওয়ান", "গাজী", "বেপারী", "মন্ডল",
    "প্রামাণিক", "বিশ্বাস", "দাস", "বড়ুয়া", "বন্যা", "মির্জা", "মিধা", "সৈয়দ",
    "জমাদ্দার", "হাওলাদার", "কাজী", "লস্কর", "বখশী", "মীর", "মালিক", "নুর"
]

UPAZILAS_AND_MOUZAS = [
    ("মেঘনা", ["রূপনগর", "শান্তিনগর", "আনন্দপুর", "সবুজবাগ"]),
    ("সুরমা", ["পদ্মাপাড়া", "নদীয়া", "ধানমন্ডিপুর", "সোনারগাঁওপুর"]),
    ("কর্ণফুলী", ["বনানীপাড়া", "উত্তরাচক", "মধুবন", "হৈমন্তী"]),
]

LAND_TYPES = ["residential", "agricultural", "commercial", "pond"]

DEMO_USERS_SPEC = [
    {"username": "registrar1", "name": "Demo Sub-Registrar 1", "role": "registrar", "password": "RegistrarPass123!"},
    {"username": "officer1", "name": "Demo Land Officer 1", "role": "officer", "password": "OfficerPass123!"},
    {"username": "admin1", "name": "Demo System Admin 1", "role": "admin", "password": "AdminPass123!"},
]


def get_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists() or (parent / "Docs").exists() or (parent / "data").exists():
            return parent
    return Path.cwd()


def _add_mutation_chain(
    db: Session,
    deed: Deed,
    applicant_id: int,
    deed_dt: datetime,
) -> Mutation:
    mutation = Mutation(
        deed_id=deed.id,
        plot_id=deed.plot_id,
        state="KHATIAN_UPDATED",
        applicant_id=applicant_id,
    )
    db.add(mutation)
    db.flush()

    steps = [
        ("SUBMITTED", "AUTO_CHECKED", deed_dt + timedelta(days=1)),
        ("AUTO_CHECKED", "UNDER_REVIEW", deed_dt + timedelta(days=2)),
        ("UNDER_REVIEW", "APPROVED", deed_dt + timedelta(days=3)),
        ("APPROVED", "KHATIAN_UPDATED", deed_dt + timedelta(days=4)),
    ]
    for from_st, to_st, event_time in steps:
        event = MutationEvent(
            mutation_id=mutation.id,
            from_state=from_st,
            to_state=to_st,
            at=event_time,
        )
        db.add(event)
    db.flush()
    return mutation


def seed_data(
    db: Session,
    reset: bool = False,
    signer_key: nacl.signing.SigningKey | None = None,
) -> dict[str, Any]:
    """Deterministically seed synthetic data into database. Caller commits."""
    random.seed(42)
    Faker.seed(42)
    fake = Faker()

    if signer_key is None:
        signer_key = load_or_create_key(settings.signing_key_path)

    # 1. Create Demo Users
    ph = PasswordHasher()
    created_users = []
    for spec in DEMO_USERS_SPEC:
        pwd_hash = ph.hash(spec["password"])
        user = User(
            name=spec["name"],
            username=spec["username"],
            role=spec["role"],
            password_hash=pwd_hash,
            created_at=SEED_REFERENCE_DATE - timedelta(days=180),
        )
        db.add(user)
        created_users.append(user)
    db.flush()

    # 2. Create 120 synthetic persons
    created_persons = []
    for i in range(120):
        first = BANGLA_FIRST_NAMES[i % len(BANGLA_FIRST_NAMES)]
        surname = BANGLA_SURNAMES[(i * 7) % len(BANGLA_SURNAMES)]
        name = f"{first} {surname}"
        nid_hash = sha256_hex(f"NID-SYNTHETIC-{i:04d}".encode("utf-8"))[:16]
        person = Person(
            display_name=name,
            masked_nid_hash=nid_hash,
            is_synthetic=True,
        )
        db.add(person)
        created_persons.append(person)
    db.flush()

    # 3. Create 300 plots across 3 upazilas and 12 mouzas
    all_mouzas = []
    for upazila_name, mouza_list in UPAZILAS_AND_MOUZAS:
        for m in mouza_list:
            all_mouzas.append((upazila_name, m))

    created_plots = []
    for i in range(300):
        upazila, mouza = all_mouzas[i % len(all_mouzas)]
        dag_no = str(100 + (i // len(all_mouzas)) + 1)
        area = round(5.0 + ((i * 17) % 75), 2)
        land_type = LAND_TYPES[i % len(LAND_TYPES)]
        initial_owner = created_persons[i % len(created_persons)]

        plot = Plot(
            mouza=mouza,
            upazila=upazila,
            district="ঢাকা",
            dag_no=dag_no,
            area_decimal=area,
            land_type=land_type,
            flags=[],
            initial_owner_id=initial_owner.id,
            current_owner_id=initial_owner.id,
        )
        db.add(plot)
        created_plots.append(plot)
    db.flush()

    # 4. Seeded Scenarios (S1 to S8) on Plots 1-8 (indices 0-7)
    scenarios_metadata: dict[str, Any] = {}

    # S1: Double sale (Plot 1, index 0)
    p1 = created_plots[0]
    p1.area_decimal = 30.0
    owner_a = created_persons[0]
    buyer_x = created_persons[1]
    buyer_y = created_persons[2]
    p1.initial_owner_id = owner_a.id

    t_s1_d1 = SEED_REFERENCE_DATE - timedelta(days=30)
    d1_s1 = register_deed(
        db, signer_key,
        plot_id=p1.id, seller_id=owner_a.id, buyer_id=buyer_x.id,
        area_sold=30.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s1_d1.isoformat(), skip_fraud=True,
    )
    # Mutation for d1_s1 remains uncompleted (pending)

    t_s1_d2 = SEED_REFERENCE_DATE - timedelta(days=5)
    d2_s1 = register_deed(
        db, signer_key,
        plot_id=p1.id, seller_id=owner_a.id, buyer_id=buyer_y.id,
        area_sold=30.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s1_d2.isoformat(), skip_fraud=True,
    )
    scenarios_metadata["S1"] = {
        "id": "S1",
        "name": "Double Sale Attempt",
        "plot_id": p1.id,
        "deed_numbers": [d1_s1.deed_no, d2_s1.deed_no],
        "target_deed_no": d2_s1.deed_no,
        "expected_rule": "R1_DOUBLE_SALE",
        "expected_status": "BLOCKED",
        "description": "Seller A sells 30 decimals to X (unmutated), then sells the same 30 decimals to Y",
    }

    # S2: Not owner (Plot 2, index 1)
    p2 = created_plots[1]
    p2.area_decimal = 40.0
    owner_a2 = created_persons[3]
    stranger_z = created_persons[4]
    buyer_w = created_persons[5]
    p2.initial_owner_id = owner_a2.id

    t_s2_d1 = SEED_REFERENCE_DATE - timedelta(days=10)
    d1_s2 = register_deed(
        db, signer_key,
        plot_id=p2.id, seller_id=stranger_z.id, buyer_id=buyer_w.id,
        area_sold=40.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s2_d1.isoformat(), skip_fraud=True,
    )
    scenarios_metadata["S2"] = {
        "id": "S2",
        "name": "Seller Not Recorded Owner",
        "plot_id": p2.id,
        "deed_numbers": [d1_s2.deed_no],
        "target_deed_no": d1_s2.deed_no,
        "expected_rule": "R2_SELLER_NOT_OWNER",
        "expected_status": "BLOCKED",
        "description": "Stranger Z attempts to sell land on Plot 2 without prior holding",
    }

    # S3: Missing mutation over 90 days (Plot 3, index 2)
    p3 = created_plots[2]
    p3.area_decimal = 25.0
    owner_a3 = created_persons[6]
    buyer_b3 = created_persons[7]
    p3.initial_owner_id = owner_a3.id

    t_s3_d1 = SEED_REFERENCE_DATE - timedelta(days=120)
    d1_s3 = register_deed(
        db, signer_key,
        plot_id=p3.id, seller_id=owner_a3.id, buyer_id=buyer_b3.id,
        area_sold=25.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s3_d1.isoformat(), skip_fraud=True,
    )
    scenarios_metadata["S3"] = {
        "id": "S3",
        "name": "Missing Mutation Over 90 Days",
        "plot_id": p3.id,
        "deed_numbers": [d1_s3.deed_no],
        "target_deed_no": d1_s3.deed_no,
        "expected_rule": "R3_MISSING_MUTATION",
        "expected_status": "MEDIUM_RISK",
        "description": "Active deed registered 120 days ago with no completed mutation",
    }

    # S4: Rapid transfers (Plot 4, index 3)
    p4 = created_plots[3]
    p4.area_decimal = 50.0
    per_a4 = created_persons[8]
    per_b4 = created_persons[9]
    per_c4 = created_persons[10]
    per_d4 = created_persons[11]
    per_e4 = created_persons[12]
    p4.initial_owner_id = per_a4.id

    t_s4_d1 = SEED_REFERENCE_DATE - timedelta(days=18)
    d1_s4 = register_deed(
        db, signer_key,
        plot_id=p4.id, seller_id=per_a4.id, buyer_id=per_b4.id,
        area_sold=50.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s4_d1.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d1_s4, per_b4.id, t_s4_d1)

    t_s4_d2 = SEED_REFERENCE_DATE - timedelta(days=12)
    d2_s4 = register_deed(
        db, signer_key,
        plot_id=p4.id, seller_id=per_b4.id, buyer_id=per_c4.id,
        area_sold=50.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s4_d2.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d2_s4, per_c4.id, t_s4_d2)

    t_s4_d3 = SEED_REFERENCE_DATE - timedelta(days=6)
    d3_s4 = register_deed(
        db, signer_key,
        plot_id=p4.id, seller_id=per_c4.id, buyer_id=per_d4.id,
        area_sold=50.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s4_d3.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d3_s4, per_d4.id, t_s4_d3)

    t_s4_d4 = SEED_REFERENCE_DATE - timedelta(days=1)
    d4_s4 = register_deed(
        db, signer_key,
        plot_id=p4.id, seller_id=per_d4.id, buyer_id=per_e4.id,
        area_sold=50.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s4_d4.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d4_s4, per_e4.id, t_s4_d4)

    scenarios_metadata["S4"] = {
        "id": "S4",
        "name": "Rapid Transfers (4 deeds within 20 days)",
        "plot_id": p4.id,
        "deed_numbers": [d1_s4.deed_no, d2_s4.deed_no, d3_s4.deed_no, d4_s4.deed_no],
        "target_deed_no": d4_s4.deed_no,
        "expected_rule": "R4_RAPID_TRANSFERS",
        "expected_status": "HIGH_RISK",
        "description": "4 legitimate sequential transfers on Plot 4 within a 20-day span",
    }

    # S5: Flagged Land (Plot 5, index 4)
    p5 = created_plots[4]
    p5.flags = ["khas", "disputed"]
    case_s5 = Case(
        plot_id=p5.id,
        case_no="CS-2026-0001",
        status="PENDING",
        filed_at=SEED_REFERENCE_DATE - timedelta(days=45),
    )
    db.add(case_s5)
    db.flush()
    scenarios_metadata["S5"] = {
        "id": "S5",
        "name": "Flagged Land (Khas / Disputed with Open Case)",
        "plot_id": p5.id,
        "deed_numbers": [],
        "target_deed_no": None,
        "expected_rule": "R6_FLAGGED_LAND",
        "expected_status": "HIGH_RISK",
        "description": "Plot 5 is designated as khas and disputed land with an open court case",
    }

    # S6: Clean land deal (Plot 6, index 5)
    p6 = created_plots[5]
    p6.area_decimal = 35.0
    owner_a6 = created_persons[13]
    buyer_b6 = created_persons[14]
    buyer_c6 = created_persons[15]
    p6.initial_owner_id = owner_a6.id

    t_s6_d1 = SEED_REFERENCE_DATE - timedelta(days=60)
    d1_s6 = register_deed(
        db, signer_key,
        plot_id=p6.id, seller_id=owner_a6.id, buyer_id=buyer_b6.id,
        area_sold=35.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s6_d1.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d1_s6, buyer_b6.id, t_s6_d1)

    t_s6_d2 = SEED_REFERENCE_DATE - timedelta(days=30)
    d2_s6 = register_deed(
        db, signer_key,
        plot_id=p6.id, seller_id=buyer_b6.id, buyer_id=buyer_c6.id,
        area_sold=35.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s6_d2.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d2_s6, buyer_c6.id, t_s6_d2)

    scenarios_metadata["S6"] = {
        "id": "S6",
        "name": "Clean Land Deal",
        "plot_id": p6.id,
        "deed_numbers": [d1_s6.deed_no, d2_s6.deed_no],
        "target_deed_no": d2_s6.deed_no,
        "expected_rule": None,
        "expected_status": "VALID",
        "description": "Happy path: 2 sequential, fully mutated land transfers on Plot 6",
    }

    # S7: Legit pending resale (Plot 7, index 6)
    p7 = created_plots[6]
    p7.area_decimal = 45.0
    owner_a7 = created_persons[16]
    buyer_b7 = created_persons[17]
    buyer_c7 = created_persons[18]
    p7.initial_owner_id = owner_a7.id

    t_s7_d1 = SEED_REFERENCE_DATE - timedelta(days=20)
    d1_s7 = register_deed(
        db, signer_key,
        plot_id=p7.id, seller_id=owner_a7.id, buyer_id=buyer_b7.id,
        area_sold=45.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s7_d1.isoformat(), skip_fraud=True,
    )
    # Mutation for D1 is pending (not completed)

    t_s7_d2 = SEED_REFERENCE_DATE - timedelta(days=5)
    d2_s7 = register_deed(
        db, signer_key,
        plot_id=p7.id, seller_id=buyer_b7.id, buyer_id=buyer_c7.id,
        area_sold=45.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s7_d2.isoformat(), skip_fraud=True,
    )
    scenarios_metadata["S7"] = {
        "id": "S7",
        "name": "Legitimate Pending Resale",
        "plot_id": p7.id,
        "deed_numbers": [d1_s7.deed_no, d2_s7.deed_no],
        "target_deed_no": d2_s7.deed_no,
        "expected_rule": None,
        "expected_status": "VALID_LEDGER",
        "description": "Buyer B resells land to C before mutation of A->B completes; valid in ledger",
    }

    # S8: Partial sales (Plot 8, index 7)
    p8 = created_plots[7]
    p8.area_decimal = 30.0
    owner_a8 = created_persons[19]
    buyer_b8 = created_persons[20]
    buyer_c8 = created_persons[21]
    p8.initial_owner_id = owner_a8.id

    t_s8_d1 = SEED_REFERENCE_DATE - timedelta(days=20)
    d1_s8 = register_deed(
        db, signer_key,
        plot_id=p8.id, seller_id=owner_a8.id, buyer_id=buyer_b8.id,
        area_sold=10.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s8_d1.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d1_s8, buyer_b8.id, t_s8_d1)

    t_s8_d2 = SEED_REFERENCE_DATE - timedelta(days=10)
    d2_s8 = register_deed(
        db, signer_key,
        plot_id=p8.id, seller_id=owner_a8.id, buyer_id=buyer_c8.id,
        area_sold=10.0, deed_type="sale", sub_registry="DHAKA",
        registered_at=t_s8_d2.isoformat(), skip_fraud=True,
    )
    _add_mutation_chain(db, d2_s8, buyer_c8.id, t_s8_d2)

    scenarios_metadata["S8"] = {
        "id": "S8",
        "name": "Partial Sales by Same Owner",
        "plot_id": p8.id,
        "deed_numbers": [d1_s8.deed_no, d2_s8.deed_no],
        "target_deed_no": d2_s8.deed_no,
        "expected_rule": None,
        "expected_status": "VALID",
        "description": "Owner A sells 10 decimals to B and 10 decimals to C out of 30, keeping 10",
    }


    # 5. Populate transfers for remaining plots (Plots 9-300, indices 8-299)
    for idx in range(8, 300):
        plot = created_plots[idx]
        num_transfers = (idx % 3) + 1  # 1 to 3 transfers
        current_holder_id = plot.initial_owner_id
        current_holding_area = plot.area_decimal

        is_partial = (idx % 10 == 0)

        for tr_idx in range(num_transfers):
            # Select buyer deterministically
            b_idx = (idx * 7 + tr_idx * 13 + 5) % len(created_persons)
            buyer = created_persons[b_idx]
            if buyer.id == current_holder_id:
                buyer = created_persons[(b_idx + 1) % len(created_persons)]

            if is_partial and tr_idx == 0:
                area_sold = round(current_holding_area * 0.4, 2)
            else:
                area_sold = current_holding_area

            tr_date = SEED_REFERENCE_DATE - timedelta(days=90 - (tr_idx * 25))
            deed = register_deed(
                db, signer_key,
                plot_id=plot.id,
                seller_id=current_holder_id,
                buyer_id=buyer.id,
                area_sold=area_sold,
                deed_type="sale",
                sub_registry="DHAKA",
                registered_at=tr_date.isoformat(),
                skip_fraud=True,
            )
            # Add completed mutation
            _add_mutation_chain(db, deed, buyer.id, tr_date)

            if not is_partial:
                current_holder_id = buyer.id

    db.flush()

    # 6. Recompute current_owner_id for all plots
    for plot in created_plots:
        recompute_current_owner(db, plot)
    db.flush()

    # 7. Write scenarios.json & DEMO_ACCOUNTS.md
    repo_root = get_repo_root()
    scenarios_file = repo_root / "data" / "scenarios" / "scenarios.json"
    scenarios_file.parent.mkdir(parents=True, exist_ok=True)
    scenarios_content = {
        "description": "Pre-configured synthetic test scenarios for LandShield evaluation",
        "reference_date": SEED_REFERENCE_DATE.isoformat(),
        "scenarios": scenarios_metadata,
    }
    scenarios_file.write_text(json.dumps(scenarios_content, indent=2, ensure_ascii=False), encoding="utf-8")

    demo_acc_content = "# LandShield - Synthetic Demo Accounts\n\n"
    demo_acc_content += "> **IMPORTANT:** All credentials listed below are purely synthetic for hackathon evaluation and demonstration.\n\n"
    demo_acc_content += "| Role | Username | Password | Purpose |\n"
    demo_acc_content += "|---|---|---|---|\n"
    for spec in DEMO_USERS_SPEC:
        demo_acc_content += f"| {spec['role'].capitalize()} | `{spec['username']}` | `{spec['password']}` | {spec['name']} |\n"

    for doc_dir in [repo_root / "docs", repo_root / "Docs"]:
        if doc_dir.exists():
            (doc_dir / "DEMO_ACCOUNTS.md").write_text(demo_acc_content, encoding="utf-8")

    return {
        "users": created_users,
        "persons": created_persons,
        "plots": created_plots,
        "scenarios": scenarios_metadata,
    }


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic data for LandShield")
    parser.add_argument("--reset", action="store_true", help="Wipe and recreate database tables")
    args = parser.parse_args()

    if args.reset:
        print("Resetting database schema...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    else:
        Base.metadata.create_all(bind=engine)
        with Session(engine) as check_db:
            existing = check_db.scalars(select(Plot)).first()
            if existing is not None:
                print("Database already contains records. Run with '--reset' to wipe and recreate.")
                return

    print("Seeding synthetic data...")
    with Session(engine) as db:
        res = seed_data(db, reset=args.reset)
        db.commit()

    print(f"Successfully seeded:")
    print(f"  - {len(res['users'])} demo users")
    print(f"  - {len(res['persons'])} synthetic persons")
    print(f"  - {len(res['plots'])} land plots")
    print(f"  - {len(res['scenarios'])} benchmark test scenarios (S1-S8)")
    print("Demo accounts written to docs/DEMO_ACCOUNTS.md")
    print("Scenarios metadata written to data/scenarios/scenarios.json")


if __name__ == "__main__":
    main()

