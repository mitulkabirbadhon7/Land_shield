from __future__ import annotations
import os
import sys
import time
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db import Base
from app.errors import FraudBlocked
from app.models.deed import Deed
from app.models.khatian import Khatian
from app.models.ledger import LedgerEntry
from app.models.person import Person
from app.models.plot import Plot
from app.models.signing_key import SigningKey
from app.services.crypto import load_or_create_key, public_key_hex, sign_hash, sha256_hex
from app.services.deeds import register_deed, verify_deed
from app.services.lineage import check_lineage
from app.services.reconcile import reconcile_plot


def verify_safety_in_memory_only(url: str | None = None) -> None:
    """Hard safety invariant: abort immediately if database is not ephemeral in-memory SQLite."""
    target_url = (url or os.getenv("DATABASE_URL") or "sqlite:///:memory:").lower().strip()
    if not (
        target_url.startswith("sqlite:///:memory:")
        or ":memory:" in target_url
        or target_url == "sqlite://"
        or "mode=memory" in target_url
    ):
        raise RuntimeError(
            f"SAFETY ABORT: Attack suite can ONLY run against an ephemeral in-memory SQLite database! "
            f"Refused execution on target: {target_url}"
        )


def make_fresh_memory_db() -> Session:
    """Create fresh, isolated in-memory SQLite database session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    # Pre-register test signing key
    sk = load_or_create_key(settings.signing_key_path)
    pk_hex = public_key_hex(sk)
    kid = sha256_hex(bytes.fromhex(pk_hex))[:16]
    session.add(SigningKey(key_id=kid, public_key_hex=pk_hex, status="ACTIVE"))
    session.commit()

    return session


_SK = load_or_create_key(settings.signing_key_path)


def _reg(
    db: Session,
    plot_id: int,
    seller_id: int,
    buyer_id: int,
    area_sold: float,
    skip_fraud: bool = True,
) -> Deed:
    deed = register_deed(
        db,
        _SK,
        plot_id=plot_id,
        seller_id=seller_id,
        buyer_id=buyer_id,
        area_sold=area_sold,
        deed_type="SALE",
        sub_registry="MIR",
        skip_fraud=skip_fraud,
    )
    db.commit()
    db.refresh(deed)
    return deed


# --- Attack Vectors A1 to A9 ---

def run_attack_a1(db: Session, i: int) -> bool:
    """A1: Direct modification of deed payload text in DB -> Detected by HASH_MISMATCH."""
    p = Person(display_name=f"Seller A1_{i}", is_synthetic=True)
    b = Person(display_name=f"Buyer A1_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A1_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p, b, plot])
    db.commit()
    plot.initial_owner_id = p.id
    db.commit()

    deed = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b.id, area_sold=5.0, skip_fraud=True)

    # Attacker tampers directly with raw payload_json in SQLite
    import json
    data = json.loads(deed.payload_json)
    data["area_sold"] = float(data["area_sold"]) + 10.0
    deed.payload_json = json.dumps(data)
    db.commit()

    res = verify_deed(db, deed.deed_no)
    return res["status"] == "TAMPERED" and any("HASH_MISMATCH" in r for r in res.get("reasons", []))


def run_attack_a2(db: Session, i: int) -> bool:
    """A2: Signature swapping between two valid deeds -> Detected by BAD_SIGNATURE."""
    p = Person(display_name=f"Seller A2_{i}", is_synthetic=True)
    b1 = Person(display_name=f"Buyer A2_1_{i}", is_synthetic=True)
    b2 = Person(display_name=f"Buyer A2_2_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A2_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=20.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p, b1, b2, plot])
    db.commit()
    plot.initial_owner_id = p.id
    db.commit()

    d1 = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b1.id, area_sold=5.0, skip_fraud=True)
    d2 = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b2.id, area_sold=5.0, skip_fraud=True)

    # Swap signature of d1 onto d2
    d2.signature = d1.signature
    db.commit()

    res = verify_deed(db, d2.deed_no)
    return res["status"] == "TAMPERED" and any("BAD_SIGNATURE" in r for r in res.get("reasons", []))


def run_attack_a3(db: Session, i: int) -> bool:
    """A3: Deletion of an intermediate ledger chain entry -> Detected by CHAIN_BROKEN."""
    p = Person(display_name=f"Owner A3_{i}", is_synthetic=True)
    b1 = Person(display_name=f"Buyer A3_1_{i}", is_synthetic=True)
    b2 = Person(display_name=f"Buyer A3_2_{i}", is_synthetic=True)
    b3 = Person(display_name=f"Buyer A3_3_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A3_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=30.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p, b1, b2, b3, plot])
    db.commit()
    plot.initial_owner_id = p.id
    db.commit()

    d1 = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b1.id, area_sold=5.0, skip_fraud=True)
    d2 = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b2.id, area_sold=5.0, skip_fraud=True)
    d3 = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b3.id, area_sold=5.0, skip_fraud=True)

    # Delete intermediate ledger entry 2
    entries = db.scalars(select(LedgerEntry).where(LedgerEntry.plot_id == plot.id).order_by(LedgerEntry.seq.asc())).all()
    if len(entries) >= 2:
        db.delete(entries[1])
        db.commit()

    res = verify_deed(db, d3.deed_no)
    return res["status"] == "TAMPERED" or "CHAIN_BROKEN" in res["reasons"]


def run_attack_a4(db: Session, i: int) -> bool:
    """A4: Double-sale registration attempt -> Detected and blocked by Rule R1 (FRAUD_BLOCKED)."""
    p = Person(display_name=f"Seller A4_{i}", is_synthetic=True)
    b1 = Person(display_name=f"Buyer A4_1_{i}", is_synthetic=True)
    b2 = Person(display_name=f"Buyer A4_2_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A4_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p, b1, b2, plot])
    db.commit()
    plot.initial_owner_id = p.id
    plot.current_owner_id = p.id
    db.commit()

    # Legitimate sale of all 10 decimals
    _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b1.id, area_sold=10.0, skip_fraud=False)

    # Attempt second sale of 10 decimals while unmutated
    try:
        _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b2.id, area_sold=10.0, skip_fraud=False)
        return False  # Failed to block
    except FraudBlocked:
        return True


def run_attack_a5(db: Session, i: int) -> bool:
    """A5: Unauthorized seller transfer attempt -> Detected and blocked by Rule R2."""
    p_owner = Person(display_name=f"Real Owner A5_{i}", is_synthetic=True)
    p_stranger = Person(display_name=f"Stranger A5_{i}", is_synthetic=True)
    b = Person(display_name=f"Victim Buyer A5_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A5_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p_owner, p_stranger, b, plot])
    db.commit()
    plot.initial_owner_id = p_owner.id
    plot.current_owner_id = p_owner.id
    db.commit()

    try:
        _reg(db, plot_id=plot.id, seller_id=p_stranger.id, buyer_id=b.id, area_sold=5.0, skip_fraud=False)
        return False
    except FraudBlocked:
        return True


def run_attack_a6(db: Session, i: int) -> bool:
    """A6: Replay of an invalidated deed after subsequent sale -> Detected as SUPERSEDED."""
    p = Person(display_name=f"Original Owner A6_{i}", is_synthetic=True)
    b1 = Person(display_name=f"Middle Owner A6_{i}", is_synthetic=True)
    b2 = Person(display_name=f"End Owner A6_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A6_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p, b1, b2, plot])
    db.commit()
    plot.initial_owner_id = p.id
    plot.current_owner_id = p.id
    db.commit()

    # First sale to B1 (10 decimals)
    d1 = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b1.id, area_sold=10.0, skip_fraud=True)
    # Resale from B1 to B2 (10 decimals)
    _reg(db, plot_id=plot.id, seller_id=b1.id, buyer_id=b2.id, area_sold=10.0, skip_fraud=True)

    # Replay verification of d1
    res = verify_deed(db, d1.deed_no)
    return res["status"] == "SUPERSEDED"


def run_attack_a7(db: Session, i: int) -> bool:
    """A7: Direct tampering with plot ownership records -> Detected by Rule R8 OWNER_MISMATCH."""
    p_legit = Person(display_name=f"Legit Owner A7_{i}", is_synthetic=True)
    p_spoofed = Person(display_name=f"Spoofed Owner A7_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A7_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p_legit, p_spoofed, plot])
    db.commit()
    plot.initial_owner_id = p_legit.id
    plot.current_owner_id = p_legit.id
    db.commit()

    # Valid deed to p_legit
    _reg(db, plot_id=plot.id, seller_id=p_legit.id, buyer_id=p_legit.id, area_sold=10.0, skip_fraud=True)

    # Tamper with AC Land recorded owner directly
    plot.current_owner_id = p_spoofed.id
    db.commit()

    issues = reconcile_plot(db, plot)
    return any(iss[0] == "OWNER_MISMATCH" for iss in issues)


def run_attack_a8(db: Session, i: int) -> bool:
    """A8: Khatian survey area inflation -> Detected by Rule R7 AREA_GROWTH."""
    plot = Plot(dag_no=f"A8_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add(plot)
    db.commit()

    k_cs = Khatian(plot_id=plot.id, survey_type="CS", khatian_no=f"CS_{i}", dag_no=f"A8_{i}", area_decimal=10.0, parent_id=None)
    db.add(k_cs)
    db.commit()

    # Inflated SA khatian (15.0 dec vs 10.0 dec parent = 50% growth)
    k_sa = Khatian(plot_id=plot.id, survey_type="SA", khatian_no=f"SA_{i}", dag_no=f"A8_{i}", area_decimal=15.0, parent_id=k_cs.id)
    db.add(k_sa)
    db.commit()

    issues = check_lineage([k_cs, k_sa], tolerance=0.05)
    return any(code == "AREA_GROWTH" for code, _, _ in issues)


def run_attack_a9(db: Session, i: int) -> bool:
    """A9: Forged key ID insertion -> Detected by SIGNER_UNKNOWN or TAMPERED."""
    p = Person(display_name=f"Seller A9_{i}", is_synthetic=True)
    b = Person(display_name=f"Buyer A9_{i}", is_synthetic=True)
    plot = Plot(dag_no=f"A9_{i}", mouza="Mirpur", upazila="Mirpur", district="Dhaka", area_decimal=10.0, land_type="Nal", initial_owner_id=1)
    db.add_all([p, b, plot])
    db.commit()
    plot.initial_owner_id = p.id
    plot.current_owner_id = p.id
    db.commit()

    deed = _reg(db, plot_id=plot.id, seller_id=p.id, buyer_id=b.id, area_sold=5.0, skip_fraud=True)

    # Corrupt signer_key_id to unknown rogue key ID
    deed.signer_key_id = "00000000deadbeef"
    db.commit()

    res = verify_deed(db, deed.deed_no)
    return res["status"] in ("TAMPERED", "UNKNOWN") or "SIGNER_UNKNOWN" in res["reasons"]


ATTACK_VECTORS = [
    ("A1", "Direct payload text modification", run_attack_a1),
    ("A2", "Signature swapping between valid deeds", run_attack_a2),
    ("A3", "Intermediate ledger entry deletion", run_attack_a3),
    ("A4", "Double-sale registration attempt", run_attack_a4),
    ("A5", "Unauthorized seller transfer attempt", run_attack_a5),
    ("A6", "Invalidated deed replay after resale", run_attack_a6),
    ("A7", "AC Land plot owner spoofing", run_attack_a7),
    ("A8", "Khatian survey area inflation (>5%)", run_attack_a8),
    ("A9", "Forged key ID insertion", run_attack_a9),
]


def run_attack_suite(iterations_per_vector: int = 20) -> dict[str, Any]:
    verify_safety_in_memory_only()
    print("=" * 70)
    print("LANDSHIELD OFFENSIVE ATTACK SIMULATION SUITE")
    print(f"Safety Mode: Ephemeral In-Memory SQLite | Iterations: {iterations_per_vector}/vector")
    print("=" * 70)

    start_time = time.time()
    results: dict[str, Any] = {}
    total_runs = 0
    total_detected = 0

    for code, name, attack_fn in ATTACK_VECTORS:
        detected = 0
        for i in range(iterations_per_vector):
            db = make_fresh_memory_db()
            try:
                if attack_fn(db, i):
                    detected += 1
            finally:
                db.close()

        rate = (detected / iterations_per_vector) * 100.0
        results[code] = {
            "name": name,
            "iterations": iterations_per_vector,
            "detected": detected,
            "detection_rate_pct": round(rate, 2),
        }
        total_runs += iterations_per_vector
        total_detected += detected
        print(f"[{code}] {name:<42} | Detected: {detected:2d}/{iterations_per_vector:2d} ({rate:5.1f}%)")

    elapsed = time.time() - start_time
    overall_rate = (total_detected / total_runs) * 100.0 if total_runs else 0.0

    print("-" * 70)
    print(f"Total Vectors: {len(ATTACK_VECTORS)} | Executed: {total_runs} | Detected: {total_detected}")
    print(f"Overall Tamper Detection Rate: {overall_rate:.2f}% | Elapsed Time: {elapsed:.2f}s")
    print("=" * 70)

    return {
        "overall_detection_rate_pct": round(overall_rate, 2),
        "total_attacks": total_runs,
        "total_detected": total_detected,
        "elapsed_seconds": round(elapsed, 2),
        "vectors": results,
    }


if __name__ == "__main__":
    summary = run_attack_suite(iterations_per_vector=20)
    if summary["overall_detection_rate_pct"] < 100.0:
        sys.exit(1)
    sys.exit(0)
