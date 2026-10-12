import json
import pytest
import nacl.signing
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session

from app.db import Base
from app.models.person import Person
from app.models.plot import Plot
from app.models.deed import Deed
from app.models.user import User
from app.services.ledger import verify_chain
from app.services.holdings import ledger_holdings, record_holdings
from scripts.seed import seed_data


@pytest.fixture
def deterministic_key() -> nacl.signing.SigningKey:
    # Deterministic signing key for reproducible test hashes
    seed_bytes = b"deterministic_test_seed_32_bytes"
    return nacl.signing.SigningKey(seed_bytes)


def test_seed_counts_and_scenarios(db_session: Session, deterministic_key):
    res = seed_data(db_session, reset=True, signer_key=deterministic_key)

    # Validate counts
    assert len(res["users"]) == 3
    assert len(res["persons"]) == 120
    assert len(res["plots"]) == 300

    # Ensure all 8 scenarios are present
    scenario_ids = list(res["scenarios"].keys())
    for sid in ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]:
        assert sid in scenario_ids

    # Check database counts
    assert db_session.scalars(select(User)).all().__len__() == 3
    assert db_session.scalars(select(Person)).all().__len__() == 120
    assert db_session.scalars(select(Plot)).all().__len__() == 300


def test_every_ledger_chain_verifies(db_session: Session, deterministic_key):
    res = seed_data(db_session, reset=True, signer_key=deterministic_key)

    for plot in res["plots"]:
        ok, reason, broken_seq = verify_chain(db_session, plot.id)
        assert ok is True, f"Plot {plot.id} ({plot.mouza}) failed ledger verify: {reason} at {broken_seq}"
        assert broken_seq is None


def test_seed_determinism_two_runs_identical_hashes(deterministic_key):
    # Setup two fresh in-memory engines
    engine1 = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine1)
    with Session(engine1) as session1:
        seed_data(session1, reset=True, signer_key=deterministic_key)
        session1.commit()
        deeds1 = session1.scalars(select(Deed).order_by(Deed.id.asc())).all()
        hashes1 = [(d.deed_no, d.deed_hash, d.signature) for d in deeds1]

    engine2 = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine2)
    with Session(engine2) as session2:
        seed_data(session2, reset=True, signer_key=deterministic_key)
        session2.commit()
        deeds2 = session2.scalars(select(Deed).order_by(Deed.id.asc())).all()
        hashes2 = [(d.deed_no, d.deed_hash, d.signature) for d in deeds2]

    assert len(hashes1) == len(hashes2)
    assert hashes1 == hashes2


def test_scenario_s1_double_sale_condition(db_session: Session, deterministic_key):
    res = seed_data(db_session, reset=True, signer_key=deterministic_key)
    p1 = res["plots"][0]

    deeds = db_session.scalars(select(Deed).where(Deed.plot_id == p1.id).order_by(Deed.id.asc())).all()
    assert len(deeds) == 2
    d1, d2 = deeds[0], deeds[1]

    # For the second deed (d2), seller is d2.seller_id
    seller_id = d2.seller_id
    area_sold = d2.area_sold

    # Ledger holding before deed 2 (seq 2)
    lh_before_d2 = ledger_holdings(db_session, p1, before_seq=2)
    # Record holding as of deed 2 registered_at
    rh_as_of_d2 = record_holdings(db_session, p1, as_of=d2.registered_at)

    seller_ledger_area = lh_before_d2.get(seller_id, 0.0)
    seller_record_area = rh_as_of_d2.get(seller_id, 0.0)

    # TRD 6B condition: L[seller] < area_sold <= Rr[seller]
    assert seller_ledger_area < area_sold <= seller_record_area
    assert seller_ledger_area == 0.0
    assert seller_record_area == 30.0
    assert area_sold == 30.0


def test_scenarios_s7_and_s8_legitimate_conditions(db_session: Session, deterministic_key):
    res = seed_data(db_session, reset=True, signer_key=deterministic_key)

    # S7: Legit pending resale
    p7 = res["plots"][6]
    deeds_s7 = db_session.scalars(select(Deed).where(Deed.plot_id == p7.id).order_by(Deed.id.asc())).all()
    assert len(deeds_s7) == 2
    d1_s7, d2_s7 = deeds_s7[0], deeds_s7[1]

    # Buyer B in deed 1 is seller in deed 2
    lh_before_d2 = ledger_holdings(db_session, p7, before_seq=2)
    # In ledger view, B owns the land and can legitimately resell
    assert lh_before_d2.get(d2_s7.seller_id, 0.0) >= d2_s7.area_sold

    # S8: Partial sales by same owner
    p8 = res["plots"][7]
    deeds_s8 = db_session.scalars(select(Deed).where(Deed.plot_id == p8.id).order_by(Deed.id.asc())).all()
    assert len(deeds_s8) == 2
    d1_s8, d2_s8 = deeds_s8[0], deeds_s8[1]

    lh_before_d1 = ledger_holdings(db_session, p8, before_seq=1)
    assert lh_before_d1.get(d1_s8.seller_id, 0.0) >= d1_s8.area_sold

    lh_before_d2_s8 = ledger_holdings(db_session, p8, before_seq=2)
    assert lh_before_d2_s8.get(d2_s8.seller_id, 0.0) >= d2_s8.area_sold

    lh_final = ledger_holdings(db_session, p8)
    assert lh_final.get(d1_s8.seller_id, 0.0) == 10.0


def test_s7_legit_pending_resale_holdings(db_session: Session, deterministic_key):

    """S7: B resells to C while mutation for A->B is pending; valid in ledger, record still shows A."""
    res = seed_data(db_session, reset=True, signer_key=deterministic_key)
    s7_info = res["scenarios"]["S7"]
    plot_id = s7_info["plot_id"]
    plot = db_session.get(Plot, plot_id)
    assert plot is not None

    deeds = db_session.scalars(select(Deed).where(Deed.plot_id == plot_id).order_by(Deed.id.asc())).all()
    assert len(deeds) == 2
    d1, d2 = deeds[0], deeds[1]

    # For 2nd deed (B->C), ledger_holdings before deed 2 shows B owns >= area_sold
    lh_before_d2 = ledger_holdings(db_session, plot, before_seq=2)
    assert lh_before_d2.get(d2.seller_id, 0.0) >= d2.area_sold

    # Record holdings as of 2nd deed shows original owner A still owns (mutation pending)
    rh_as_of_d2 = record_holdings(db_session, plot, as_of=d2.registered_at)
    assert rh_as_of_d2.get(d1.seller_id, 0.0) >= d1.area_sold
    assert rh_as_of_d2.get(d2.seller_id, 0.0) == 0.0


def test_s8_partial_sales_holdings_conserved(db_session: Session, deterministic_key):
    """S8: Partial sales by same owner; total area conserved, no negative balance, each transfer valid."""
    res = seed_data(db_session, reset=True, signer_key=deterministic_key)
    s8_info = res["scenarios"]["S8"]
    plot_id = s8_info["plot_id"]
    plot = db_session.get(Plot, plot_id)
    assert plot is not None

    deeds = db_session.scalars(select(Deed).where(Deed.plot_id == plot_id).order_by(Deed.id.asc())).all()
    assert len(deeds) == 2

    L = ledger_holdings(db_session, plot)

    # 1. Total area conserved within 1e-6 tolerance
    assert abs(sum(L.values()) - plot.area_decimal) < 1e-6

    # 2. No negative holdings
    for pid, area in L.items():
        assert area >= 0.0

    # 3. For each deed, seller has enough holding before that deed
    for seq_idx, deed in enumerate(deeds, start=1):
        lh_before = ledger_holdings(db_session, plot, before_seq=seq_idx)
        assert lh_before.get(deed.seller_id, 0.0) >= deed.area_sold

    # Final balance check for initial owner
    initial_owner_id = deeds[0].seller_id
    assert L.get(initial_owner_id, 0.0) == 10.0


@pytest.mark.anyio
async def test_seed_on_start_in_lifespan(monkeypatch):
    """Verify that lifespan seeds empty database when SEED_ON_START is true."""
    from app.config import settings
    from app.main import lifespan
    from fastapi import FastAPI
    from sqlalchemy import select
    from app.models.plot import Plot
    from app.db import SessionLocal

    monkeypatch.setattr(settings, "SEED_ON_START", True)
    test_app = FastAPI()

    async with lifespan(test_app):
        with SessionLocal() as db:
            plots = db.scalars(select(Plot)).all()
            assert len(plots) >= 300

