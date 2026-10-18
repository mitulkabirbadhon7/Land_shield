import json
from pathlib import Path
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.khatian import Khatian
from app.models.signing_key import SigningKey
from app.models.merkle import MerkleRoot
from app.models.ingest_draft import IngestDraft
from app.models.deed import Deed
from app.models.plot import Plot
from scripts.seed_phase2 import seed_phase2, get_repo_root


def test_phase2_models_schema(db_session: Session):
    """Verify all Phase 2 models can be persisted and queried."""
    # 1. SigningKey
    key = SigningKey(key_id="test_key_01", public_key_hex="a" * 64, status="ACTIVE")
    db_session.add(key)
    db_session.flush()
    assert db_session.get(SigningKey, key.id).key_id == "test_key_01"

    # 2. MerkleRoot
    root = MerkleRoot(
        date="2026-10-15",
        root="b" * 64,
        entry_count=10,
        max_entry_id=10,
        signature="c" * 128,
    )
    db_session.add(root)
    db_session.flush()
    assert db_session.get(MerkleRoot, root.id).entry_count == 10

    # 3. IngestDraft
    draft = IngestDraft(
        document_type="khatian",
        image_ref="/tmp/doc.png",
        extracted_json="{}",
        confidence_json="{}",
        status="DRAFT",
    )
    db_session.add(draft)
    db_session.flush()
    assert db_session.get(IngestDraft, draft.id).status == "DRAFT"

    # 4. Khatian & Deed.price_bdt
    plot = Plot(
        dag_no="555",
        mouza="Tejgaon",
        upazila="Dhaka",
        district="Dhaka",
        area_decimal=15.0,
        land_type="NAL",
        initial_owner_id=1,
        current_owner_id=1,
    )
    db_session.add(plot)
    db_session.flush()

    khatian = Khatian(
        plot_id=plot.id,
        survey_type="CS",
        khatian_no="CS-555",
        dag_no="555",
        area_decimal=15.0,
        owners_json="[]",
        parent_id=None,
    )
    db_session.add(khatian)
    db_session.flush()
    assert db_session.get(Khatian, khatian.id).survey_type == "CS"


def test_seed_phase2_idempotency(db_session: Session):
    """seed_phase2 runs cleanly and is completely idempotent on repeated runs."""
    # Ensure at least one plot and deed exist for backfilling
    plot = Plot(
        dag_no="777",
        mouza="মেঘনা",
        upazila="মেঘনা",
        district="Dhaka",
        area_decimal=20.0,
        land_type="residential",
        initial_owner_id=1,
        current_owner_id=1,
    )
    db_session.add(plot)
    db_session.flush()

    deed = Deed(
        deed_no="TEST-2026-000099",
        plot_id=plot.id,
        seller_id=1,
        buyer_id=2,
        area_sold=20.0,
        deed_type="sale",
        sub_registry="Dhaka",
        registered_at="2026-10-01T10:00:00+00:00",
        payload_json="{}",
        deed_hash="hash",
        signature="sig",
        signer_key_id="key1",
        status="ACTIVE",
    )
    db_session.add(deed)
    db_session.commit()

    # First run
    res1 = seed_phase2(db_session)
    assert res1["prices_updated"] >= 1
    khatian_count_1 = len(db_session.scalars(select(Khatian)).all())
    assert khatian_count_1 >= 1

    # Second run should be idempotent
    res2 = seed_phase2(db_session)
    assert res2["prices_updated"] == 0
    khatian_count_2 = len(db_session.scalars(select(Khatian)).all())
    assert khatian_count_2 == khatian_count_1


def test_phase2_scenarios_in_json():
    """Verify scenarios.json has phase2 benchmarks (L1, L2, L3, R1, R2, R3, C1)."""
    repo_root = get_repo_root()
    path = repo_root / "data" / "scenarios" / "scenarios.json"
    assert path.exists()

    content = json.loads(path.read_text(encoding="utf-8"))
    assert "phase2" in content
    phase2 = content["phase2"]
    for sid in ["L1", "L2", "L3", "R1", "R2", "R3", "C1"]:
        assert sid in phase2
        assert "expected_status" in phase2[sid]
        assert "plot_id" in phase2[sid]
