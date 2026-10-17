# LandShield Deployment & Operations Guide

## 1. Overview & Architecture
LandShield uses containerized multi-tier deployment:
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Backend API:** FastAPI (Python 3.11/3.13, SQLAlchemy 2, Alembic, PyNaCl, scikit-learn, LightGBM)
- **Database:** PostgreSQL 15 (dev/test: SQLite in-memory or file)
- **Key Registry & Artifacts:** Persistent `/app/keys`, `/app/data`, and `/app/data/uploads`

---

## 2. Containerized Deployment (`docker-compose.yml`)
To launch the full LandShield stack with persistent volumes and healthchecks:
```bash
docker compose up --build -d
```

### Services
1. **db**: PostgreSQL 15 on port `5432` with healthcheck.
2. **backend**: FastAPI on port `8000`. Runs entrypoint script:
   - Automatically executes `alembic upgrade head` before starting Uvicorn.
   - If `SEED_ON_START=true`, seeds synthetic baseline and Phase 2 differentiator datasets.
   - Serves API on `http://localhost:8000/api/v1`.
3. **frontend**: Next.js on port `3000` with client-side offline QR verification.

---

## 3. Environment Variables Reference

### Core & Cryptographic Settings
| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://...` | Database connection string |
| `JWT_SECRET` | `dev-secret-...` | Secret for HMAC-SHA256 JWT tokens (change in production) |
| `JWT_EXPIRE_MINUTES` | `60` | Token validity duration |
| `SIGNING_KEY_PATH` | `./keys/registrar.key` | File path to persistent Ed25519 private signing key |
| `SIGNING_KEY_HEX` | `None` | Optional raw hex private key (for headless cloud providers) |
| `DEMO_MODE` | `true` | Allows Tamper Lab endpoints when true; strict security when false |
| `RATE_LIMIT` | `60/minute` | Rate limit for public endpoints |
| `SEED_ON_START` | `false` | When true, runs synthetic database seed scripts on launch |

### Phase 2 Feature Flags
| Feature Flag | Default | Description |
|---|---|---|
| `FEATURE_RECONCILE` | `true` | Layer R8: Cross-office Sub-Registry vs. AC Land mutation reconciliation |
| `FEATURE_LINEAGE` | `true` | Layer R7: Multi-generational survey khatian graph lineage validation |
| `FEATURE_OFFLINE_QR` | `true` | Compact Ed25519 cryptographic QR certificate & public keys API |
| `FEATURE_AGENT` | `true` | LLM-assisted citizen due-diligence report generator with deterministic fallback |
| `FEATURE_TRANSPARENCY` | `true` | Daily Merkle log verification endpoints and audit commit checks |
| `FEATURE_ML` | `false` | Advisory LightGBM anomaly classifier (requires `model.joblib`) |
| `FEATURE_OCR` | `false` | Document scan-to-ingest and Vision LLM metadata review portal |

### AI & Vision LLM Settings
| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `openai` | Vision & report provider (`openai` or `anthropic`) |
| `LLM_MODEL` | `gpt-4o-mini` | Model identifier |
| `LLM_API_KEY` | `""` | API key. If empty, system automatically falls back to deterministic templates |
| `AGENT_TIMEOUT_SECONDS` | `20` | Strict client timeout to prevent hung requests |

---

## 4. Database Migrations
Migrations are managed via Alembic:
```bash
# Upgrade database to head revision
alembic upgrade head

# Generate a new migration
alembic revision -m "description_of_change"
```
The Docker entrypoint executes `alembic upgrade head` on every launch, ensuring seamless zero-downtime schema upgrades.

---

## 5. Automated Verification & Smoke Testing
Run the automated end-to-end smoke test suite against a running container or local instance:
```bash
# Via Makefile
make smoke

# Or directly
python scripts/smoke_test.py
```
This script exercises:
- Phase 2 runtime feature flags (`GET /api/v1/features`)
- Public signing key registry (`GET /keys`)
- Layered assessment pipeline (`GET /analysis/plot/{id}`)
- Bilingual citizen due-diligence report generation (`POST /reports/due-diligence`)
- Daily Merkle root transparency endpoints (`GET /transparency`)
