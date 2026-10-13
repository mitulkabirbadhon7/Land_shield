# LandShield - Production & Cloud Deployment Guide

This document provides a comprehensive, step-by-step walkthrough for deploying the **LandShield** platform to managed cloud infrastructure for the **LandTech Innovation Hackathon 2026** live evaluation.

---

## 1. Architecture Overview

| Component | Recommended Host | Technology | Configuration Notes |
|---|---|---|---|
| **Frontend** | **Vercel** | Next.js 16 (App Router) | Root directory `frontend`, HTTPS default, camera QR enabled |
| **Backend** | **Render** or **Railway** | FastAPI, Python 3.11 | Containerized via `backend/Dockerfile`, respects `$PORT` |
| **Database** | **Render PostgreSQL** or **Neon / Supabase** | PostgreSQL 15+ | Connection normalized automatically by backend |

---

## 2. Backend & Managed Database Setup

You can deploy the backend manually via the dashboard or using the provided optional [`render.yaml`](../render.yaml) Blueprint.

### Option A: Render Dashboard (Recommended)

#### Step 1: Provision Managed PostgreSQL
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **PostgreSQL**.
3. Name: `landshield-db`.
4. Database: `landshield`.
5. User: `landshield_user`.
6. Region: Pick the region closest to you (e.g., `Singapore` or `Oregon`).
7. Plan: **Free**.
8. Click **Create Database**.
9. Once created, copy the **Internal Database URL** (if deploying backend on Render) or **External Database URL**.

#### Step 2: Generate the Persistent Ed25519 Signing Key
Cloud container disks are ephemeral; if a container restarts or deploys a new version, an on-disk key file is wiped. To ensure the Sub-Registrar key persists across all deploys, generate a 64-character (32-byte) hex seed on your local machine:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Save the generated 64-character hex string. You will set this as `SIGNING_KEY_HEX`.

#### Step 3: Provision the FastAPI Web Service
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your **LandShield** GitHub repository.
3. Configure the build:
   * **Name:** `landshield-backend`
   * **Branch:** Select `chore/s18-cloud-deploy` (or your latest merged branch: `develop` / `main`).
   * **Root Directory:** `backend`  
     > [!IMPORTANT]  
     > **You MUST set `Root Directory` to `backend`.**  
     > Because this repository contains both `backend` and `frontend`, setting `Root Directory` to `backend` directs Render to set the Docker build context inside `backend/` where `requirements.txt` is located. If left blank, Docker looks in the root folder and fails with `requirements.txt not found`.
   * **Language / Runtime:** **Docker**
   * **Dockerfile Path:** `./Dockerfile` (or `Dockerfile`)
   * **Plan:** **Free**
4. Under **Environment Variables**, add the variables listed in the table below.
5. Click **Create Web Service**.

---

## 3. Production Environment Variables Reference

| Variable Name | Required | Example / Recommended Value | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `postgres://user:pass@host:5432/landshield` | PostgreSQL connection string. The backend automatically normalizes `postgres://` and `postgresql://` to `postgresql+psycopg://`. |
| `SIGNING_KEY_HEX` | **Yes** | *[64-character hex from Step 2]* | 32-byte Ed25519 private seed. Guarantees consistent signature verification across redeployments and container restarts. |
| `JWT_SECRET` | **Yes** | *[32+ character random string]* | Secret key for signing authentication JWT tokens. Server refuses startup on default string if `DEMO_MODE=false`. |
| `JWT_EXPIRE_MINUTES`| No | `60` | Token expiration lifetime in minutes. |
| `DEMO_MODE` | **Yes** | `true` | Enables Tamper Lab endpoints (`/dev/tamper`, `/dev/restore`) for judges. Set to `false` for hardened production. |
| `SEED_ON_START` | **Yes** | `true` | **Crucial for first boot.** Automatically populates 300 plots, 120 citizens, 3 demo staff accounts, and benchmark scenarios (S1–S8) if the database is empty. |
| `ALLOWED_ORIGINS` | **Yes** | `https://landshield.vercel.app,http://localhost:3000` | Comma-separated CORS origins allowed to communicate with the API. |
| `FRONTEND_URL` | **Yes** | `https://landshield.vercel.app` | Base URL used when encoding verification URLs into generated QR codes. |
| `PORT` | Auto | `10000` (Render default) or `8000` | Handled dynamically by Render/Railway; the backend Dockerfile automatically binds to `${PORT:-8000}`. |
| `RATE_LIMIT` | No | `120/minute` | Rate limit threshold. |
| `MUTATION_DAYS` | No | `90` | Threshold in days for Rule R3 (unmutated deed alert). |

---

## 4. First-Boot Automated Seeding (`SEED_ON_START`)

On first deployment, your cloud PostgreSQL database will be completely empty.

Because `SEED_ON_START=true` is set:
1. When the backend container boots, FastAPI's `lifespan` handler creates all tables (`Base.metadata.create_all`).
2. It queries `Plot` count:
   * If `Plot` count is **0**, it executes `seed_data()` automatically in under 5 seconds.
   * It creates 120 synthetic citizens with Bangla names, 300 plots across 3 upazilas, 3 staff accounts (`registrar1`, `officer1`, `admin1`), and benchmark scenarios (S1 through S8).
   * If data already exists, it skips seeding to guarantee idempotency and avoid duplicate rows.

---

## 5. Verifying Backend Health

Once the web service is deployed, test the health check endpoints using your browser or `curl`:

### Basic Health Check:
```bash
curl https://<your-backend-subdomain>.onrender.com/api/v1/health
# Response: {"status":"ok"}
```

### Deep Health Check:
```bash
curl https://<your-backend-subdomain>.onrender.com/api/v1/health/deep
# Response:
# {
#   "status": "ok",
#   "database": "connected",
#   "seeded": true,
#   "plots_count": 300,
#   "deeds_count": 150
# }
```

> [!NOTE]
> `/api/v1/health/deep` verifies live PostgreSQL connectivity and verifies that the initial seed data is present, without leaking any credentials, tokens, or system paths.

---

## 6. Frontend Deployment on Vercel

Vercel is the optimal platform for Next.js App Router applications, providing global edge CDN caching and automatic HTTPS (which is mandatory for mobile camera QR scanning).

### Step-by-Step Vercel Setup:
1. Log in to [Vercel](https://vercel.com) using your GitHub account.
2. Click **Add New...** -> **Project**.
3. Select your **LandShield** repository and click **Import**.
4. In the configuration screen:
   * **Framework Preset:** `Next.js`
   * **Root Directory:** Click **Edit** and select `frontend`.
   * **Build Command:** `npm run build` (default)
   * **Output Directory:** `.next` (default)
   * **Install Command:** `npm install` (default)
5. Under **Environment Variables**, add:
   * **Name:** `NEXT_PUBLIC_API_URL`
   * **Value:** `https://<your-backend-subdomain>.onrender.com/api/v1` *(Ensure no trailing slash)*
6. Click **Deploy**.
7. In ~60 seconds, Vercel will assign a production URL (e.g. `https://landshield-diu.vercel.app`).

### Step 7: Update CORS on Backend
Return to your Render/Railway backend environment variables and ensure `ALLOWED_ORIGINS` includes your live Vercel domain:
```env
ALLOWED_ORIGINS=https://landshield-diu.vercel.app,http://localhost:3000
FRONTEND_URL=https://landshield-diu.vercel.app
```
Trigger a redeployment of the backend web service so CORS rules take effect.

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
  1. Ping the backend URL (`https://<backend>/api/v1/health`) 2 minutes before demonstrating to judges.
  2. Alternatively, set up a free health monitor on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to ping `GET /api/v1/health` every 10 minutes during the judging window.

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
  - Verify that mobile browser prompts for camera permissions (guaranteed because Vercel serves over HTTPS).
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
