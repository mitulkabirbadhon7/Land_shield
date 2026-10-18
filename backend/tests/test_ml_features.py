from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest
from sqlalchemy.orm import Session

from app.ml.features import DealRecord, features_from_history, history_from_db
from app.models.person import Person
from app.models.plot import Plot
from app.models.signing_key import SigningKey
from app.services.crypto import load_or_create_key, public_key_hex, sha256_hex
from app.services.deeds import register_deed
from ml.gen_dataset import generate_transfer_dataset


def test_pure_features_from_history():
    t0 = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(days=15)
    t2 = t1 + timedelta(days=10)

    # A -> B
    d1 = DealRecord(deed_no="D1", registered_at=t0, seller_id=1, buyer_id=2, area_sold=10.0, price_bdt=1000000.0)
    # B -> C
    d2 = DealRecord(deed_no="D2", registered_at=t1, seller_id=2, buyer_id=3, area_sold=10.0, price_bdt=1000000.0)
    # Circular: C -> A within 25 days
    d3 = DealRecord(deed_no="D3", registered_at=t2, seller_id=3, buyer_id=1, area_sold=10.0, price_bdt=200000.0)

    history = [d1, d2]
    plot_ctx = {
        "plot_id": 1,
        "area_decimal": 10.0,
        "initial_owner_id": 1,
        "flags": ["DISPUTED"],
        "area_median_price": 100000.0,  # 100k / dec -> 1M total expected
        "lineage_issues": ["GAP"],
    }

    feat = features_from_history(history, d3, plot_ctx)

    assert feat["transfers_30d"] == 2
    assert feat["days_since_last_transfer"] == 10.0
    assert feat["area_ratio"] == 1.0
    assert feat["circular_transfer"] == 1  # Buyer 1 was seller in d1 within 60d
    assert feat["price_vs_area_median"] == 0.2  # 200k / (10 dec * 100k) = 0.2 (price collapse)
    assert feat["flag_count"] == 1
    assert feat["lineage_issue_count"] == 1
    assert feat["reg_hour"] == 10


def test_history_from_db_consistency(db_session: Session):
    sk = load_or_create_key("keys/registrar_ed25519.hex")
    pk_hex = public_key_hex(sk)
    kid = sha256_hex(bytes.fromhex(pk_hex))[:16]
    db_session.add(SigningKey(key_id=kid, public_key_hex=pk_hex, status="ACTIVE"))
    db_session.commit()

    p1 = Person(display_name="Owner DB 1", is_synthetic=True)
    p2 = Person(display_name="Owner DB 2", is_synthetic=True)
    plot = Plot(dag_no="100", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=12.5, land_type="Nal", initial_owner_id=1)
    db_session.add_all([p1, p2, plot])
    db_session.commit()
    plot.initial_owner_id = p1.id
    db_session.commit()

    deed = register_deed(
        db_session,
        sk,
        plot_id=plot.id,
        seller_id=p1.id,
        buyer_id=p2.id,
        area_sold=12.5,
        deed_type="SALE",
        sub_registry="MIR",
        skip_fraud=True,
    )
    deed.price_bdt = 1250000.0
    db_session.commit()

    history, subject, ctx = history_from_db(db_session, plot, subject=deed)
    assert len(history) == 1
    assert subject is not None
    assert subject.deed_no == deed.deed_no
    assert ctx["area_decimal"] == 12.5

    feat = features_from_history(history, subject, ctx)
    assert feat["area_ratio"] == 1.0
    assert feat["seller_is_ledger_holder"] == 1


def test_dataset_generator_and_split_isolation(tmp_path: Path):
    out_csv = tmp_path / "transfers_test.csv"
    rows = generate_transfer_dataset(num_plots=30, export_paths=[str(out_csv)])

    assert out_csv.exists()
    assert len(rows) > 30

    train_plots = {r["plot_id"] for r in rows if r["split"] == "train"}
    test_plots = {r["plot_id"] for r in rows if r["split"] == "test"}

    assert len(train_plots) > 0
    assert len(test_plots) > 0
    # Clean train/test split isolation: zero overlap between plot IDs
    assert train_plots.isdisjoint(test_plots), "Data leakage: overlapping plots between train and test splits!"
