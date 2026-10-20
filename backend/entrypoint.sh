#!/usr/bin/env bash
set -e

echo "[+] Running Alembic migrations to head..."
alembic upgrade head

if [ "$SEED_ON_START" = "true" ] || [ "$seed_on_start" = "true" ]; then
    echo "[+] Seeding Phase 1 baseline data..."
    python scripts/seed.py --reset || true
    echo "[+] Seeding Phase 2 differentiator data..."
    python scripts/seed_phase2.py || true
fi

echo "[+] Launching LandShield API Server..."
exec "$@"
