from __future__ import annotations
import csv
import random
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db import Base
from app.models.deed import Deed
from app.models.person import Person
from app.models.plot import Plot
from app.models.signing_key import SigningKey
from app.ml.features import DealRecord, features_from_history
from app.services.crypto import load_or_create_key, public_key_hex, sha256_hex
from app.services.deeds import register_deed

_SK = load_or_create_key(settings.signing_key_path)


def generate_transfer_dataset(
    num_plots: int = 600,
    export_paths: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Generate ~600 synthetic plots and ~2,000 transactions with subtle anomaly injections outside static rules.

    Injected anomalies:
    - Circular sales (A -> B -> C -> A within 60 days)
    - Midnight / anomalous registration hours (2-4 AM)
    - Severe price collapse below upazila median (< 30% of median)
    - Suspicious rapid transfer chains
    """
    if export_paths is None:
        export_paths = [
            "ml/data/transfers.csv",
            "backend/ml/data/transfers.csv",
        ]

    random.seed(42)
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    db = session_factory()

    try:
        # Pre-register key
        pk_hex = public_key_hex(_SK)
        kid = sha256_hex(bytes.fromhex(pk_hex))[:16]
        db.add(SigningKey(key_id=kid, public_key_hex=pk_hex, status="ACTIVE"))
        db.commit()

        # Generate pool of 300 synthetic persons
        persons = [Person(display_name=f"Trader_{i}", is_synthetic=True) for i in range(1, 301)]
        db.add_all(persons)
        db.commit()

        rows: list[dict[str, Any]] = []
        base_time = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

        for p_idx in range(1, num_plots + 1):
            plot_area = round(random.uniform(8.0, 35.0), 2)
            init_owner = persons[p_idx % len(persons)]
            plot = Plot(
                dag_no=f"DAG_{p_idx}",
                mouza="Mirpur",
                upazila="Mirpur",
                district="Dhaka",
                area_decimal=plot_area,
                land_type="Nal",
                initial_owner_id=init_owner.id,
                current_owner_id=init_owner.id,
                flags=[],
            )
            db.add(plot)
            db.commit()

            # Train/test partition strictly by plot_id (80% train, 20% test)
            split = "test" if (p_idx % 5 == 0) else "train"

            # Determine anomaly type for ~12% of plots (coprime to split modulo 5 to avoid split bias)
            is_anom_plot = (p_idx % 8 == 0)
            anom_type = (p_idx % 3) if is_anom_plot else -1  # 0: circular, 1: odd_hours, 2: price_collapse

            # Transaction count on this plot (between 2 and 6 deals)
            num_deals = random.randint(3, 5) if is_anom_plot else random.randint(2, 4)

            history: list[DealRecord] = []
            curr_seller = init_owner
            curr_time = base_time + timedelta(days=(p_idx * 2) % 180)
            median_price = 100000.0  # 100k BDT/dec

            for d_idx in range(num_deals):
                is_last_deal = (d_idx == num_deals - 1)
                is_anomalous_deal = is_anom_plot and is_last_deal

                # Select buyer
                if is_anomalous_deal and anom_type == 0 and len(history) >= 2:
                    # Circular transfer: buy back to the original initial owner
                    buyer = init_owner
                else:
                    buyer = persons[(p_idx + d_idx + 1) % len(persons)]
                    if buyer.id == curr_seller.id:
                        buyer = persons[(p_idx + d_idx + 2) % len(persons)]

                # Area sold
                area_sold = plot_area if d_idx == 0 else round(plot_area * random.uniform(0.5, 1.0), 2)

                # Registration timestamp and hour
                if is_anomalous_deal and anom_type == 1:
                    # Anomalous midnight / off-hour registration (e.g. 2:30 AM)
                    curr_time = curr_time.replace(hour=2, minute=30)
                else:
                    normal_hour = random.choice([10, 11, 12, 14, 15, 16])
                    curr_time = curr_time.replace(hour=normal_hour, minute=random.randint(0, 59))

                # Pricing
                if is_anomalous_deal and anom_type == 2:
                    # Price collapse (< 25% of median)
                    price_bdt = round(area_sold * median_price * 0.18, 2)
                elif not is_anom_plot and random.random() < 0.2:
                    # Legitimate intra-family / concession transfer (near-miss: ~70% median)
                    price_bdt = round(area_sold * median_price * 0.70, 2)
                else:
                    # Normal market pricing (90% - 125% of median)
                    price_bdt = round(area_sold * median_price * random.uniform(0.92, 1.25), 2)

                deal = register_deed(
                    db,
                    _SK,
                    plot_id=plot.id,
                    seller_id=curr_seller.id,
                    buyer_id=buyer.id,
                    area_sold=area_sold,
                    deed_type="SALE",
                    sub_registry="MIR",
                    registered_at=curr_time,
                    skip_fraud=True,
                )
                deal.price_bdt = price_bdt
                db.commit()

                rec = DealRecord(
                    deed_no=deal.deed_no,
                    registered_at=curr_time,
                    seller_id=curr_seller.id,
                    buyer_id=buyer.id,
                    area_sold=area_sold,
                    price_bdt=price_bdt,
                )

                # Extract features for this deal with history up to this point
                plot_ctx = {
                    "plot_id": plot.id,
                    "area_decimal": plot_area,
                    "initial_owner_id": init_owner.id,
                    "flags": [],
                    "area_median_price": median_price,
                    "mutation_lag_days": 10.0 if not is_anom_plot else (110.0 if anom_type == 0 else 15.0),
                }

                feat = features_from_history(history, rec, plot_ctx)
                label = 1 if is_anomalous_deal else 0

                row_dict = {
                    "plot_id": plot.id,
                    "deed_no": deal.deed_no,
                    "split": split,
                    "label": label,
                    **feat,
                }
                rows.append(row_dict)

                # Advance history and state
                history.append(rec)
                curr_seller = buyer
                # Advance date
                time_step = timedelta(days=random.randint(5, 18)) if is_anom_plot else timedelta(days=random.randint(35, 90))
                curr_time += time_step

        print(f"[+] Successfully generated {len(rows)} transfer records across {num_plots} plots.")
        anom_count = sum(1 for r in rows if r["label"] == 1)
        train_count = sum(1 for r in rows if r["split"] == "train")
        test_count = sum(1 for r in rows if r["split"] == "test")
        print(f"[+] Total Anomalies: {anom_count} ({(anom_count / len(rows)) * 100:.1f}%) | Train: {train_count} | Test: {test_count}")

        # Export to CSV
        fieldnames = list(rows[0].keys())
        for path_str in export_paths:
            out_p = Path(path_str)
            out_p.parent.mkdir(parents=True, exist_ok=True)
            with open(out_p, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            print(f"[+] Exported dataset to: {out_p.resolve()}")

        return rows

    finally:
        db.close()


if __name__ == "__main__":
    generate_transfer_dataset()
