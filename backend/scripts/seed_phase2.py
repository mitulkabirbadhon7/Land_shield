"""Deterministic synthetic seed data generator for Phase 2.

Additive & idempotent:
1. Registers system Ed25519 public key in signing_keys table.
2. Backfills Deed.price_bdt deterministically based on upazila land value tiers and area.
3. Generates multi-generational khatian chains (CS -> SA -> RS -> BS) for ~60% of existing synthetic plots.
4. Sets up canonical Phase 2 benchmark scenarios (L1, L2, L3, R1, R2, R3, C1).
5. Updates scenarios.json with phase2 benchmark definitions.
"""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import engine
from app.models.deed import Deed
from app.models.khatian import Khatian
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.models.person import Person
from app.models.plot import Plot
from app.models.signing_key import SigningKey
from app.services.crypto import key_id, load_or_create_key, public_key_hex
from app.services.deeds import register_deed

SEED_REFERENCE_DATE = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)

UPAZILA_BASE_RATES = {
    "মেঘনা": 250_000.0,
    "সুরমা": 400_000.0,
    "কর্ণফুলী": 600_000.0,
}
DEFAULT_BASE_RATE = 300_000.0


def get_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists() or (parent / "docs").exists() or (parent / "data").exists():
            return parent
    return Path.cwd()


def seed_signing_key(db: Session) -> SigningKey:
    """Register the active system Ed25519 public key if not present."""
    sk = load_or_create_key(settings.signing_key_path)
    k_id = key_id(sk)
    pub_hex = public_key_hex(sk)

    key_record = db.scalars(select(SigningKey).where(SigningKey.key_id == k_id)).first()
    if key_record is None:
        key_record = SigningKey(
            key_id=k_id,
            public_key_hex=pub_hex,
            status="ACTIVE",
            created_at=SEED_REFERENCE_DATE,
        )
        db.add(key_record)
        db.flush()
    return key_record


def backfill_deed_prices(db: Session) -> int:
    """Deterministically backfill Deed.price_bdt for all existing deeds lacking price."""
    deeds = db.scalars(select(Deed)).all()
    count = 0
    for deed in deeds:
        if deed.price_bdt is None:
            plot = db.get(Plot, deed.plot_id)
            upazila = plot.upazila if plot else ""
            base_rate = UPAZILA_BASE_RATES.get(upazila, DEFAULT_BASE_RATE)
            multiplier = 1.0 + ((deed.id * 17) % 25) * 0.01  # 1.00 to 1.24
            deed.price_bdt = round(deed.area_sold * base_rate * multiplier, 2)
            count += 1
    db.flush()
    return count


def seed_khatian_lineages(db: Session) -> int:
    """Generate multi-generational survey chains (CS -> SA -> RS -> BS) for ~60% of synthetic plots."""
    plots = db.scalars(select(Plot).order_by(Plot.id)).all()
    created_count = 0

    for plot in plots:
        # Skip scenario plots 21-27 (handled separately)
        if 21 <= plot.id <= 27:
            continue

        # ~60% of plots get historical survey chains
        if plot.id % 10 >= 6:
            continue

        existing = db.scalars(select(Khatian).where(Khatian.plot_id == plot.id)).first()
        if existing is not None:
            continue

        area = plot.area_decimal
        owner = db.get(Person, plot.initial_owner_id)
        owner_name = owner.display_name if owner else "মালিক"
        owners_json = json.dumps([{"name": owner_name, "share": 1.0}], ensure_ascii=False)

        # 1. CS (Cadastral Survey ~1920)
        cs = Khatian(
            plot_id=plot.id,
            survey_type="CS",
            khatian_no=f"CS-{plot.dag_no}",
            dag_no=plot.dag_no,
            area_decimal=round(area, 2),
            owners_json=owners_json,
            parent_id=None,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 80),
        )
        db.add(cs)
        db.flush()

        # 2. SA (State Acquisition ~1956)
        sa = Khatian(
            plot_id=plot.id,
            survey_type="SA",
            khatian_no=f"SA-{plot.dag_no}",
            dag_no=plot.dag_no,
            area_decimal=round(area, 2),
            owners_json=owners_json,
            parent_id=cs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 50),
        )
        db.add(sa)
        db.flush()

        # 3. RS (Revisional Survey ~1980)
        rs = Khatian(
            plot_id=plot.id,
            survey_type="RS",
            khatian_no=f"RS-{plot.dag_no}",
            dag_no=plot.dag_no,
            area_decimal=round(area, 2),
            owners_json=owners_json,
            parent_id=sa.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 25),
        )
        db.add(rs)
        db.flush()

        # 4. BS (Bangladesh Survey ~2010)
        bs = Khatian(
            plot_id=plot.id,
            survey_type="BS",
            khatian_no=f"BS-{plot.dag_no}",
            dag_no=plot.dag_no,
            area_decimal=round(area, 2),
            owners_json=owners_json,
            parent_id=rs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 10),
        )
        db.add(bs)
        db.flush()
        created_count += 4

    return created_count


def seed_phase2_scenarios(db: Session, signer_key) -> None:
    """Set up benchmark plots for Phase 2 test scenarios (L1, L2, L3, R1, R2, R3, C1)."""
    # -------------------------------------------------------------------------
    # L1: Plot 21 - Missing SA generation (CS -> RS -> BS)
    # -------------------------------------------------------------------------
    p21 = db.get(Plot, 21)
    if p21 and not db.scalars(select(Khatian).where(Khatian.plot_id == 21)).first():
        cs = Khatian(
            plot_id=21,
            survey_type="CS",
            khatian_no="CS-21",
            dag_no=p21.dag_no,
            area_decimal=p21.area_decimal,
            owners_json="[]",
            parent_id=None,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 70),
        )
        db.add(cs)
        db.flush()
        # Direct link from CS to RS, skipping SA
        rs = Khatian(
            plot_id=21,
            survey_type="RS",
            khatian_no="RS-21",
            dag_no=p21.dag_no,
            area_decimal=p21.area_decimal,
            owners_json="[]",
            parent_id=cs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 20),
        )
        db.add(rs)
        db.flush()
        bs = Khatian(
            plot_id=21,
            survey_type="BS",
            khatian_no="BS-21",
            dag_no=p21.dag_no,
            area_decimal=p21.area_decimal,
            owners_json="[]",
            parent_id=rs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 5),
        )
        db.add(bs)
        db.flush()

    # -------------------------------------------------------------------------
    # L2: Plot 22 - Orphan RS Survey Khatian (parent_id is None for non-earliest)
    # -------------------------------------------------------------------------
    p22 = db.get(Plot, 22)
    if p22 and not db.scalars(select(Khatian).where(Khatian.plot_id == 22)).first():
        cs = Khatian(
            plot_id=22,
            survey_type="CS",
            khatian_no="CS-22",
            dag_no=p22.dag_no,
            area_decimal=p22.area_decimal,
            owners_json="[]",
            parent_id=None,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 70),
        )
        db.add(cs)
        db.flush()
        sa = Khatian(
            plot_id=22,
            survey_type="SA",
            khatian_no="SA-22",
            dag_no=p22.dag_no,
            area_decimal=p22.area_decimal,
            owners_json="[]",
            parent_id=cs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 45),
        )
        db.add(sa)
        db.flush()
        # Orphan RS khatian with parent_id=None
        rs = Khatian(
            plot_id=22,
            survey_type="RS",
            khatian_no="RS-22",
            dag_no=p22.dag_no,
            area_decimal=p22.area_decimal,
            owners_json="[]",
            parent_id=None,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 20),
        )
        db.add(rs)
        db.flush()

    # -------------------------------------------------------------------------
    # L3: Plot 23 - Unjustified Area Expansion (Area Growth > 5%)
    # -------------------------------------------------------------------------
    p23 = db.get(Plot, 23)
    if p23 and not db.scalars(select(Khatian).where(Khatian.plot_id == 23)).first():
        cs = Khatian(
            plot_id=23,
            survey_type="CS",
            khatian_no="CS-23",
            dag_no=p23.dag_no,
            area_decimal=20.0,
            owners_json="[]",
            parent_id=None,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 70),
        )
        db.add(cs)
        db.flush()
        sa = Khatian(
            plot_id=23,
            survey_type="SA",
            khatian_no="SA-23",
            dag_no=p23.dag_no,
            area_decimal=20.0,
            owners_json="[]",
            parent_id=cs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 45),
        )
        db.add(sa)
        db.flush()
        # Area growth from 20.0 to 35.0 decimals (+75% > 5%)
        rs = Khatian(
            plot_id=23,
            survey_type="RS",
            khatian_no="RS-23",
            dag_no=p23.dag_no,
            area_decimal=35.0,
            owners_json="[]",
            parent_id=sa.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 20),
        )
        db.add(rs)
        db.flush()

    # -------------------------------------------------------------------------
    # R1: Plot 24 - Owner Mismatch (AC Land owner differs from deed mutation record)
    # -------------------------------------------------------------------------
    p24 = db.get(Plot, 24)
    if p24:
        # Deliberately set plot.current_owner_id to a different stranger ID
        current_rec_owner = p24.current_owner_id or p24.initial_owner_id
        stranger_id = (current_rec_owner % 100) + 5
        if stranger_id == current_rec_owner:
            stranger_id += 1
        p24.current_owner_id = stranger_id
        db.flush()

    # -------------------------------------------------------------------------
    # R2: Plot 25 - Stalled Mutation (stuck in UNDER_REVIEW > 90 days)
    # -------------------------------------------------------------------------
    p25 = db.get(Plot, 25)
    if p25:
        stalled_mut = db.scalars(
            select(Mutation).where(
                Mutation.plot_id == 25,
                Mutation.state.in_(["AUTO_CHECKED", "UNDER_REVIEW"]),
            )
        ).first()
        if not stalled_mut:
            d = db.scalars(select(Deed).where(Deed.plot_id == 25)).first()
            p_seller = p25.current_owner_id or p25.initial_owner_id
            p_buyer = (p_seller % 100) + 2
            if not d:
                d = register_deed(
                    db,
                    signer_key,
                    plot_id=25,
                    seller_id=p_seller,
                    buyer_id=p_buyer,
                    area_sold=p25.area_decimal,
                    deed_type="sale",
                    sub_registry="Dhaka Sadar",
                    registered_at=SEED_REFERENCE_DATE - timedelta(days=140),
                    skip_fraud=True,
                )
                d.price_bdt = 4_500_000.0
                db.flush()
            stalled_mut = Mutation(
                deed_id=d.id,
                plot_id=25,
                applicant_id=p_buyer,
                state="UNDER_REVIEW",
                created_at=SEED_REFERENCE_DATE - timedelta(days=130),
                updated_at=SEED_REFERENCE_DATE - timedelta(days=125),
            )
            db.add(stalled_mut)
            db.flush()
            evt = MutationEvent(
                mutation_id=stalled_mut.id,
                from_state="AUTO_CHECKED",
                to_state="UNDER_REVIEW",
                note="Initial officer review commenced",
                at=SEED_REFERENCE_DATE - timedelta(days=125),
            )
            db.add(evt)
            db.flush()

    # -------------------------------------------------------------------------
    # R3: Plot 26 - Area Not Conserved (Record holdings sum != plot area)
    # -------------------------------------------------------------------------
    p26 = db.get(Plot, 26)
    if p26:
        # Ensure a Khatian exists with the authentic survey area (70.0)
        k26 = db.scalars(select(Khatian).where(Khatian.plot_id == 26)).first()
        if not k26:
            k26 = Khatian(
                plot_id=26,
                survey_type="BS",
                khatian_no="BS-26",
                dag_no=p26.dag_no,
                area_decimal=70.0,
                owners_json="[]",
                parent_id=None,
                created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 10),
            )
            db.add(k26)
            db.flush()
        # Edit plot area to 85.0 to create an administrative discrepancy without deed
        p26.area_decimal = 85.0
        db.flush()

    # -------------------------------------------------------------------------
    # C1: Plot 27 - Clean Plot (Uninterrupted CS->SA->RS->BS with Area Conservation)
    # -------------------------------------------------------------------------
    p27 = db.get(Plot, 27)
    if p27 and not db.scalars(select(Khatian).where(Khatian.plot_id == 27)).first():
        area = p27.area_decimal
        cs = Khatian(
            plot_id=27,
            survey_type="CS",
            khatian_no="CS-27",
            dag_no=p27.dag_no,
            area_decimal=area,
            owners_json="[]",
            parent_id=None,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 75),
        )
        db.add(cs)
        db.flush()
        sa = Khatian(
            plot_id=27,
            survey_type="SA",
            khatian_no="SA-27",
            dag_no=p27.dag_no,
            area_decimal=area,
            owners_json="[]",
            parent_id=cs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 50),
        )
        db.add(sa)
        db.flush()
        rs = Khatian(
            plot_id=27,
            survey_type="RS",
            khatian_no="RS-27",
            dag_no=p27.dag_no,
            area_decimal=area,
            owners_json="[]",
            parent_id=sa.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 25),
        )
        db.add(rs)
        db.flush()
        bs = Khatian(
            plot_id=27,
            survey_type="BS",
            khatian_no="BS-27",
            dag_no=p27.dag_no,
            area_decimal=area,
            owners_json="[]",
            parent_id=rs.id,
            created_at=SEED_REFERENCE_DATE - timedelta(days=365 * 10),
        )
        db.add(bs)
        db.flush()


def update_scenarios_json() -> None:
    """Append phase2 benchmark scenarios to data/scenarios/scenarios.json and frontend/public/scenarios.json."""
    phase2_specs = {
        "L1": {
            "id": "L1",
            "name": "Missing SA Survey Generation",
            "plot_id": 21,
            "expected_rule": "R7_MISSING_GENERATION",
            "expected_status": "HIGH_RISK",
            "description": "Historical survey chain skips SA generation (CS -> RS -> BS)",
        },
        "L2": {
            "id": "L2",
            "name": "Orphan RS Survey Khatian",
            "plot_id": 22,
            "expected_rule": "R7_ORPHAN",
            "expected_status": "HIGH_RISK",
            "description": "RS survey khatian has no documented parent in earlier surveys",
        },
        "L3": {
            "id": "L3",
            "name": "Unjustified Area Expansion",
            "plot_id": 23,
            "expected_rule": "R7_AREA_GROWTH",
            "expected_status": "HIGH_RISK",
            "description": "Documented plot area expands from 20 to 35 decimals across surveys without lawful basis",
        },
        "R1": {
            "id": "R1",
            "name": "Record Owner Differs from Mutation History",
            "plot_id": 24,
            "expected_rule": "R8_OWNER_MISMATCH",
            "expected_status": "HIGH_RISK",
            "description": "Plot current_owner_id in AC Land registry differs from largest deed record holder",
        },
        "R2": {
            "id": "R2",
            "name": "Mutation Stalled Beyond Statutory Limit",
            "plot_id": 25,
            "expected_rule": "R8_MUTATION_STALLED",
            "expected_status": "HIGH_RISK",
            "description": "Mutation application has remained stuck in review longer than MUTATION_DAYS",
        },
        "R3": {
            "id": "R3",
            "name": "Area Holdings Not Conserved",
            "plot_id": 26,
            "expected_rule": "R8_AREA_NOT_CONSERVED",
            "expected_status": "HIGH_RISK",
            "description": "Sum of citizen deed holdings does not equal recorded plot area",
        },
        "C1": {
            "id": "C1",
            "name": "Clean Survey Lineage & Reconciliation",
            "plot_id": 27,
            "expected_rule": None,
            "expected_status": "VALID",
            "description": "Perfect chain of title across all 4 historical surveys (CS -> SA -> RS -> BS) with area conservation",
        },
    }

    repo_root = get_repo_root()
    data_path = repo_root / "data" / "scenarios" / "scenarios.json"
    public_path = repo_root / "frontend" / "public" / "scenarios.json"

    for path in [data_path, public_path]:
        if path.exists():
            try:
                content = json.loads(path.read_text(encoding="utf-8"))
                content["phase2"] = phase2_specs
                path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception:
                pass


def seed_phase2(db: Session) -> dict[str, int]:
    """Execute complete Phase 2 additive seed."""
    sk = load_or_create_key(settings.signing_key_path)
    seed_signing_key(db)
    prices_updated = backfill_deed_prices(db)
    khatians_created = seed_khatian_lineages(db)
    seed_phase2_scenarios(db, sk)
    db.commit()
    update_scenarios_json()

    return {
        "prices_updated": prices_updated,
        "khatians_created": khatians_created,
    }


def main():
    with Session(engine) as db:
        res = seed_phase2(db)
        print(f"Phase 2 Seed Completed successfully: {res}")


if __name__ == "__main__":
    main()
