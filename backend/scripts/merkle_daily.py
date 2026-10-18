import argparse
from datetime import datetime, timezone
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.db import engine
from app.services.merkle import build_daily_root, verify_daily_root


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile and publish daily signed Merkle root for LandShield deed ledger.")
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Date string in YYYY-MM-DD format (defaults to UTC current date)",
    )
    args = parser.parse_args()

    target_date = args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"[*] Processing Merkle transparency log for date: {target_date}")

    with Session(engine) as db:
        record = build_daily_root(db, target_date)
        print(f"[+] Root compiled: {record.root}")
        print(f"[+] Entry count: {record.entry_count} (max_id: {record.max_entry_id})")
        print(f"[+] Signature: {record.signature[:32]}...")

        verification = verify_daily_root(db, target_date)
        status = verification.get("status")
        print(f"[*] Verification check: {status}")

        if status != "MATCH":
            print(f"[!] ERROR: Verification failed with status {status}", file=sys.stderr)
            return 1

    print("[+] Successfully published and verified daily Merkle root.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
