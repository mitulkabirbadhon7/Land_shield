# LandShield - Deployment & Operations Guide

This document provides a comprehensive walkthrough for deploying the **LandShield** platform both locally via containerized Docker Compose and to managed cloud infrastructure (Vercel + Render / PostgreSQL) for the **LandTech Innovation Hackathon 2026**.

---

## 1. Overview & Architecture

| Component | Recommended Host | Technology | Configuration Notes |
|---|---|---|---|
| **Frontend** | **Vercel** | Next.js 16 (App Router, TypeScript, Tailwind) | Root directory `frontend`, HTTPS default, mobile camera QR enabled |
| **Backend API** | **Render** or **Railway** / Docker | FastAPI, Python 3.11/3.13, SQLAlchemy 2, Alembic | Containerized via `backend/Dockerfile`, respects `$PORT`, entrypoint migrations |
| **Database** | **Render PostgreSQL** or **Neon / Supabase** | PostgreSQL 15+ (dev: SQLite) | Automatic connection normalization to `postgresql+psycopg://` |
| **Key Registry & Artifacts** | Persistent volume / cloud env | PyNaCl Ed25519, Joblib (<10MB) | `SIGNING_KEY_HEX` seed or persistent `/app/keys/registrar.key` |

---

## 2. Containerized Local & Staging Deployment (`docker-compose.yml`)

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

## 3. Cloud Deployment Guide (Render + Vercel)

### Backend & Managed Database (Render)

#### Step 1: Provision Managed PostgreSQL
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **PostgreSQL**.
3. Name: `landshield-db`, Database: `landshield`, User: `landshield_user`.
4. Plan: **Free**.
5. Once created, copy the **Internal Database URL** (or External Database URL).

#### Step 2: Generate the Persistent Ed25519 Signing Key
Cloud container disks are ephemeral; to ensure the Sub-Registrar key persists across all redeployments, generate a 64-character (32-byte) hex seed:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```
Save the generated 64-character hex string as `SIGNING_KEY_HEX`.

#### Step 3: Provision the FastAPI Web Service
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your **LandShield** GitHub repository.
3. Configure the build:
   * **Name:** `landshield-backend`
   * **Branch:** `main` (or active release branch)
   * **Root Directory:** `backend` (Directs Render to set build context where `requirements.txt` is located)
   * **Language / Runtime:** **Docker**
   * **Dockerfile Path:** `./Dockerfile`
   * **Plan:** **Free**
4. Under **Environment Variables**, add the variables listed in Section 4.
5. Click **Create Web Service**.

### Frontend Deployment (Vercel)
1. Log in to [Vercel](https://vercel.com) using your GitHub account.
2. Click **Add New...** -> **Project** and import **LandShield**.
3. Configure:
   * **Root Directory:** `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `.next`
4. Under **Environment Variables**, add:
   * `NEXT_PUBLIC_API_URL` = `https://<your-backend-subdomain>.onrender.com/api/v1` *(no trailing slash)*
5. Click **Deploy**.
6. Update backend `ALLOWED_ORIGINS` on Render with your Vercel URL.

---

## 4. Environment Variables Reference

### Core & Cryptographic Settings
| Variable Name | Required | Example / Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `postgres://user:pass@host:5432/landshield` | PostgreSQL connection string. The backend automatically normalizes to `postgresql+psycopg://`. |
| `SIGNING_KEY_HEX` | **Yes** (cloud) | *[64-character hex seed]* | 32-byte Ed25519 private seed. Guarantees consistent signature verification across redeployments. |
| `SIGNING_KEY_PATH` | No | `./keys/registrar.key` | Local file path fallback for on-disk private signing key. |
| `JWT_SECRET` | **Yes** | *[32+ character random string]* | Secret key for signing authentication JWT tokens. Server refuses startup on default string if `DEMO_MODE=false`. |
| `JWT_EXPIRE_MINUTES`| No | `60` | Token expiration lifetime in minutes. |
| `DEMO_MODE` | **Yes** | `true` | Enables Tamper Lab endpoints (`/dev/tamper`, `/dev/restore`) for judges. Set to `false` for hardened production. |
| `SEED_ON_START` | **Yes** | `true` | Automatically populates synthetic plots, citizens, and demo staff accounts on startup if database is empty. |
| `ALLOWED_ORIGINS` | **Yes** | `https://landshield.vercel.app,http://localhost:3000` | Comma-separated CORS origins allowed to communicate with API. |
| `FRONTEND_URL` | **Yes** | `https://landshield.vercel.app` | Base URL used when encoding verification URLs into generated QR codes. |
| `PORT` | Auto | `10000` (Render) or `8000` | Handled dynamically by Render/Railway; Dockerfile automatically binds to `${PORT:-8000}`. |
| `RATE_LIMIT` | No | `120/minute` | Rate limit threshold. |
| `MUTATION_DAYS` | No | `90` | Threshold in days for Rule R3 (unmutated deed alert). |

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

## 5. Database Migrations & First-Boot Seeding

Migrations are managed via Alembic:
```bash
# Upgrade database to head revision
alembic upgrade head

# Generate a new migration
alembic revision -m "description_of_change"
```
The Docker entrypoint automatically executes `alembic upgrade head` on every launch, ensuring seamless zero-downtime schema upgrades.

When `SEED_ON_START=true` is set:
1. Container boots and runs Alembic migrations.
2. Checks if database is unseeded; if empty, populates baseline synthetic records and Phase 2 differentiators.
3. Skips re-seeding if records already exist to guarantee idempotency.

---

## 6. Automated Verification & Smoke Testing

Run the automated end-to-end smoke test suite:
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

---

## 7. Operational Guidelines: `DEMO_MODE` & Cold-Starts

### `DEMO_MODE` Guidance
* **During Hackathon Evaluation & Demos (`DEMO_MODE=true`):**
  * The `/dev/tamper` and `/dev/restore` endpoints in the Admin Tamper Lab are active.
  * Allows judges to visually witness single-byte tampering in real-time.
* **Production Deployment (`DEMO_MODE=false`):**
  * All dev tampering endpoints immediately return `HTTP 404 Not Found`.
  * The backend refuses to start if `JWT_SECRET` is left as default.

### Cold-Start Warning (Render Free Tier)
* Render's free tier spins down web services after 15 minutes of inactivity.
* When waking up, the first request may experience a **40–50 second spin-up delay**.
* **Pre-demo Recommendation:**
  1. Ping `GET /api/v1/health` 2 minutes before demonstrating to judges.
  2. Or set up a free health monitor on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to ping `GET /api/v1/health` every 10 minutes.

---

## 8. Live Smoke-Test Checklist (Mobile Network Rehearsal)

Perform this verification on a smartphone using **cellular mobile data (4G/5G)**, completely disconnected from local Wi-Fi:

- [ ] **1. Public Availability:** Open `https://<your-app>.vercel.app` in mobile Safari or Chrome. Verify landing page renders in Bangla and English.
- [ ] **2. Citizen Check (Problem P5):**
  - Go to `/check`.
  - Search Mouza `মিরপুর`, Dag `401` (Scenario S1 - Double Sale).
  - Confirm the circular risk gauge shows `100 / HIGH` with bilingual explanation: "পূর্ববর্তী বিক্রয় দলিল বলবৎ থাকা সত্ত্বেও অপর ক্রেতার অনুকূলে বিক্রয়ের চেষ্টা (Double Selling Attempt)".
  - Verify synthetic citizen names are masked (e.g., `র***ন খ***ন`).
- [ ] **3. Camera QR Verification (Problem P2):**
  - Go to `/verify`.
  - Verify that mobile browser prompts for camera permissions (served over HTTPS).
  - Point camera at a deed QR code or enter deed number `D-DHK-2026-000001`.
  - Verify instantaneous `VALID` status with green badge.
- [ ] **4. Staff Portals:**
  - Log in with Registrar credentials (`registrar1` / `registrar123`).
  - Confirm `/registrar` portal opens with deed creation form and pre-registration fraud blocker.
  - Log in with Officer credentials (`officer1` / `officer123`).
  - Confirm `/officer` portal shows mutation queue and open alerts.
- [ ] **5. Admin Tamper Lab:**
  - Log in as Admin (`admin1` / `admin123`).
  - Open `/admin`, select deed, click "Tamper Payload".
  - Open `/verify?deed=<tampered_deed_no>`.
  - Confirm verification immediately reports `TAMPERED` with cryptographic hash mismatch!
  - Return to `/admin` and click "Restore Original Payload"; confirm verification returns to `VALID`.
