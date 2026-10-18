# LandShield: Tamper-Evident Deed Verification & Fraud Prevention Platform

> **Event:** LandTech Innovation Hackathon 2026  
> **Organized by:** Department of CSE & CSE-TECH, Daffodil International University (DIU)  
> **Supported by:** Department of Law, Daffodil International University (DIU)  
> **Track:** Digital Land Records, Verification & Digitization  
> **Problem Statements:** **P2** (Primary: Deed & Ownership Verification), **P3** (Fraud & Double-Selling Detection), **P4** (Smart e-Mutation), **P5** (Citizen Pre-Purchase Verification)  
> **Release Target:** `v1.3-final-release` (Final Round Official Submission)

---

## 👥 Team Directory & Mentorship Information

* **Team Name:** **Avengers Assemble**

| Role | Member Name | Student ID | Department & Institution | Official Contact Email |
|:---|:---|:---|:---|:---|
| **Team Leader** | **Md Mitul Kabir Badhon** | `0242310005101635` | Dept. of CSE, Daffodil International University | `mitulkabirbadhon7@gmail.com` |
| **Teammate** | **Sabbir Hossan Sani** | `0242310005101776` | Dept. of CSE, Daffodil International University | `sani2305101776@diu.edu.bd` |
| **Faculty Mentor** | **Tanzina Afroz Rimi** | Lecturer (Senior Scale) | Dept. of CSE, Daffodil International University | `tanzinaafroz.cse@diu.edu.bd` |
| **Industry Support Mentor** | **Rahat Shahriar Reyad** | Industry Specialist | CSE-TECH, Daffodil International University | `reyad2305101691@diu.edu.bd` |

---

## 🔗 Live Application Deliverables

* **Live Web Application:** [https://landshield.vercel.app](https://landshield.vercel.app) *(or active deployment URL)*
* **Live Backend API (Render):** [https://land-shield.onrender.com](https://land-shield.onrender.com)
  * Interactive Swagger Documentation: [/docs](https://land-shield.onrender.com/docs)
  * Deep System Healthcheck: [/api/v1/health/deep](https://land-shield.onrender.com/api/v1/health/deep)
* **3-Minute Demo Video:** `[YOUTUBE / DRIVE 3-MINUTE VIDEO URL]`
* **Official Concept Note:** [docs/concept-note/CONCEPT_NOTE.md](docs/concept-note/CONCEPT_NOTE.md) *(4-page submission)*
* **Judge Presentation & Demo Script:** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
* **Synthetic Test Accounts:** [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md)

---

> [!IMPORTANT]
> ### 🛡️ Mandatory Synthetic Data Disclosure (Rule Book Section 8)
> **All data contained within this project is 100% synthetic and generated via automated deterministic scripts.**  
> Zero real citizen names, real National ID (NID) numbers, real telephone numbers, real physical addresses, or genuine government land records have been collected, processed, or stored. No government portal or server (such as e-Mutation, e-Porcha, or Land Service Gateway) was scraped, queried, or security-tested. All testing and demonstrations occur strictly within an isolated local or prototype sandbox environment.

---

## 1. Problem Statement

In Bangladesh, land disputes account for approximately 75% of all civil litigation cases. Key root causes include:
1. **Backdated Forged Deeds:** Inserting fraudulent deeds into paper volume registers (বালাম বই) or tampered database tables.
2. **Double & Multi-Selling:** Selling the same physical parcel to multiple unsuspecting buyers before records update.
3. **Inter-Office Silos:** Sub-Registry offices (Ministry of Law) and AC Land offices (Ministry of Land) operate disparate databases, leading to unmutated deeds and stale ownership records.
4. **Colonial Survey Lineage Breaks:** Missing generations across historical cadastral surveys (CS → SA → RS → BS) enabling proxy / stranger sellers to claim rights.
5. **Lack of Independent Citizen Verification:** Buyers cannot independently verify deed authenticity before transaction payment without paying intermediaries.

---

## 2. Our Solution

**LandShield** is an autonomous, tamper-evident cryptographic verification and anti-fraud infrastructure designed to sit as a secure middleware layer on top of existing land administration systems without requiring full database replacement.

### Core Architecture Pillars:
1. **Layer 1: Cryptographic Hash Chain & Asymmetric Signatures:** Every deed is canonically serialized (RFC 8785), SHA-256 hashed, and digitally signed with Ed25519.
2. **Layer 2: Statutory Rules Engine (R1–R6):** Autonomous domain checks enforcing area conservation, seller ownership, duplicate mutation blocking, and statutory compliance.
3. **Layer 3: Inter-Office Reconciliation (R8):** Continuous audit radar between Sub-Registry deed ledgers and AC Land khatian registers.
4. **Layer 4: Cadastral Survey Lineage Graph (R7):** Directed Acyclic Graph (DAG) validating generational continuity from CS to BS surveys.
5. **Public Merkle Transparency Log:** Aggregates daily deeds into cumulative cryptographic Merkle roots, making retroactive record insertion mathematically impossible.
6. **Zero-Connectivity Browser Cryptography:** Validates compressed QR payloads offline inside the browser with zero network dependencies.

---

## 3. Key Features

### Phase 1 Core Capabilities
* **Instant Digital Deed Verification (`/verify`):** Cryptographic verification (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`) via deed number lookup or camera QR scan.
* **Pre-Registration Fraud Blocker (`/registrar`):** Automatically aborts double-selling or unauthorized registrations at HTTP 409 `FRAUD_BLOCKED` before database commit.
* **Interactive Tamper Lab (`/admin`):** Admin demonstration proving that altering even a single byte of a deed in the database immediately triggers cryptographic invalidation (`HASH_MISMATCH`).
* **Citizen Pre-Purchase Inspection (`/check`):** Public bilingual portal providing a 0–100 animated circular risk gauge, masked ownership timeline, and statutory violation explanations.
* **Smart e-Mutation Workflow (`/officer`):** 5-state Finite State Machine (`SUBMITTED` ➡️ `UNDER_REVIEW` ➡️ `APPROVED` / `REJECTED`) with append-only audit trail.

### Phase 2 Advanced Capabilities
* **Cross-Office Reconciliation Radar (`/officer/reconcile`):** Scans and detects owner mismatches, stalled mutations (>90 days), and unmutated transfers.
* **Survey Lineage Continuity Timeline:** Visualizes 4-generation survey graph (CS ➡️ SA ➡️ RS ➡️ BS) highlighting area expansions or orphan surveys.
* **Offline Browser-Native Cryptographic Verifier (`/verify/offline`):** TweetNaCl Ed25519 signature verification against local cached ministry public keys.
* **Public Merkle Transparency Log (`/transparency`):** Daily published Merkle root hashes with interactive 3-hop cryptographic inclusion proof verifier.
* **AI Due-Diligence & Legal Advisory Report Modal:** Print-ready institutional legal opinion generated from verified database facts with zero hallucination.
* **Attack Benchmark Matrix (`/metrics`):** Audited performance across 9 adversarial threat vectors (A1–A9) showing 100% detection rate and 28ms average pipeline latency.
* **National Phased Rollout & Cost Model (`/rollout`):** 3-phase national rollout plan across 500 upazilas within a ৳45.5 Crore budget and 270:1 litigation savings ROI.

---

## 4. Changes Since Round 1 (Rule Book Section 7.4)

> Full commit and changelog history is tracked in [`docs/CHANGELOG.md`](docs/CHANGELOG.md) and [`docs/PROGRESS.md`](docs/PROGRESS.md).

| Phase 2 Session | Feature / Enhancement | Impact |
|:---|:---|:---|
| **P2-00 to P2-03** | Database schema additions (Khatian, SigningKey, MerkleRoot), Lineage Layer (R7), and Reconciliation Layer (R8) | Extended fraud detection to historical survey genealogies and cross-departmental desynchronization. |
| **P2-04** | Layered risk card UI, survey lineage graph timeline, and `/officer/reconcile` portal | Provided AC Land officers with instant discrepancy audits. |
| **P2-06** | Browser-side offline QR deed verifier (`/verify/offline`) | Enabled tamper verification in remote areas without internet connectivity. |
| **P2-08** | Institutional AI Due-Diligence Report modal with print-ready CSS (`window.print()`) | Delivered one-click legal opinion summaries for prospective buyers. |
| **P2-10** | Daily Merkle Transparency Log portal (`/transparency`) | Proved mathematical impossibility of inserting backdated forged deeds into government registers. |
| **P2-11** | Security metrics & attack benchmark matrix (`/metrics`) | Audited 100% detection rate across A1–A9 attacks with 28ms pipeline latency. |
| **P2-16** | Phased national rollout strategy & cost-benefit portal (`/rollout`) | Detailed realistic ৳45.5 Cr deployment across 64 districts with 270:1 ROI. |
| **P2-Polish** | Accessibility, high-contrast dark mode hardening, and bilingual localization alignment | Guaranteed 100% WCAG-compliant readability across light and dark themes on all devices. |

---

## 5. System Architecture

```text
 [ Citizen Portal ]       [ Sub-Registrar ]       [ AC Land Officer ]        [ Admin Portal ]
 (Pre-Purchase /check)    (Deed Registry)         (Mutation / Reconcile)     (Tamper Lab)
        \                        \                        /                       /
         +------------------------+----------------------+-----------------------+
                                             |
                                   HTTPS (TLS 1.3) / JSON
                                             v
      +-----------------------------------------------------------------------------+
      |                      Next.js 16 (App Router) Frontend                       |
      |      Bilingual i18n (Bangla/English) | Client-side WebCrypto / TweetNaCl     |
      +-----------------------------------------------------------------------------+
                                             |
                                     REST API (/api/v1)
                                             v
      +-----------------------------------------------------------------------------+
      |                           FastAPI (Python 3.11/3.13)                        |
      |  * JWT Auth & Role-Based Access Control (Admin, Registrar, Officer)         |
      |  * Cryptographic Signing & Canonical Hash Service (PyNaCl Ed25519 / SHA-256)|
      |  * Append-Only Audit Trail & Dynamic Rate Limiting (SlowAPI)                |
      +-----------------------------------------------------------------------------+
                                             |
                                             v
      +-----------------------------------------------------------------------------+
      |                        4-LAYER AUTONOMOUS FRAUD ENGINE                      |
      |  Layer 1: Cryptographic Integrity & Hash Chain Walk (Ed25519)               |
      |  Layer 2: Domain Statutory Rules (R1 Double Sale, R2 Stranger, R3-R6)       |
      |  Layer 3: Inter-Office Reconciliation (R8 Owner Mismatch, Stalled Mutation) |
      |  Layer 4: Survey Lineage Continuity Graph (R7 CS→SA→RS→BS DAG)              |
      +-----------------------------------------------------------------------------+
                                             |
                                             v
      +-----------------------------------------------------------------------------+
      |                           PERSISTENCE & SECURITY                            |
      |  PostgreSQL 15 (Deploy) / SQLite (Dev) | Daily Merkle Tree Root Ledger      |
      +-----------------------------------------------------------------------------+
```

---

## 6. Technology Stack & Open-Source Credits (Rule Book Section 7.2)

| Layer | Framework / Library | License | Usage & Justification |
|:---|:---|:---|:---|
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) | MIT | High-performance server-side rendering, static generation, edge routing. |
| **Frontend Language** | [TypeScript](https://www.typescriptlang.org/) | Apache 2.0 | Type-safe API contracts, client-side state predictability. |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | MIT | Utility-first responsive design, dark/light accessibility tokens. |
| **Offline Crypto** | [TweetNaCl.js](https://tweetnacl.js.org/) | Public Domain | Lightweight in-browser Ed25519 digital signature verification. |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) | MIT | Asynchronous high-throughput REST API with automatic OpenAPI Swagger docs. |
| **Backend Language** | Python 3.11 / 3.13 | PSF | Clean domain modeling, cryptographic libraries, machine learning ecosystem. |
| **Database & ORM** | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) | MIT | Modern typed ORM, atomic ACID transactions, multi-dialect support. |
| **Database Engine** | SQLite (Dev) / PostgreSQL 15 (Prod) | PostgreSQL | ACID compliance, sequence generators, relational foreign-key integrity. |
| **Cryptography** | [PyNaCl (libsodium)](https://pynacl.readthedocs.io/) | Apache 2.0 | Industry-standard Ed25519 digital signatures and SHA-256 canonical hashing. |
| **Security & Auth** | Argon2id, python-jose (JWT HS256) | MIT / BSD | Secure password hashing, stateless role-based authentication. |
| **Typography** | Google Noto Sans Bengali | OFL | Authentic, legible Bangla typography rendering across mobile and desktop. |

---

## 7. Setup & Execution Instructions (Quick Start)

### Option A: Local Execution via Python Virtualenv & Node.js

#### 1. Backend Setup
```powershell
# 1. Clone repository
git clone https://github.com/mitulkabirbadhon7/Land_shield.git
cd Land_shield

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1    # On Windows PowerShell
# source .venv/bin/activate   # On Linux/macOS

# 3. Install production dependencies
pip install -r backend/requirements.txt

# 4. Run automated test suite (183 tests)
pytest backend/tests -v

# 5. Start FastAPI server
uvicorn app.main:app --app-dir backend --reload --port 8000
```
* Backend Swagger Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

#### 2. Frontend Setup
```powershell
# In a separate terminal, navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Run offline browser crypto unit tests
node tests/test_offline.mjs

# Start Next.js development server
npm run dev
```
* Frontend Application: [http://localhost:3000](http://localhost:3000)

---

### Option B: Local Execution via Docker Compose

```powershell
# Build and run containers in background (Postgres 15, FastAPI, Next.js)
docker compose up --build -d

# Check health
curl http://localhost:8000/api/v1/health/deep

# Stop containers
docker compose down
```

---

## 8. Configuration (.env.example)

Copy `.env.example` to `.env`. **Never commit `.env` or files in `keys/`.**

| Environment Variable | Description | Default / Example Value |
|:---|:---|:---|
| `DATABASE_URL` | Database connection string | `sqlite:///./landshield.db` (or `postgresql+psycopg://...`) |
| `JWT_SECRET` | Secret key for JWT signing (32+ chars) | `dev-secret-key-change-in-production-32-bytes` |
| `SIGNING_KEY_PATH` | Path to registrar Ed25519 private key | `./keys/registrar_ed25519.hex` |
| `DEMO_MODE` | Enables Admin Tamper Lab simulation endpoints | `true` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000,https://*.vercel.app` |
| `FRONTEND_URL` | Base URL encoded into deed QR codes | `http://localhost:3000` |
| `SEED_ON_START` | Automatically populate synthetic plots on boot | `true` |

---

## 9. Demo Guide & Test Accounts

Synthetic accounts pre-configured for evaluator testing:

| Role | Username | Password | Key Portal & Capabilities |
|:---|:---|:---|:---|
| **Sub-Registrar** | `registrar` | `registrar123` | `/registrar`: Register deeds, trigger HTTP 409 fraud blocker, generate QR codes. |
| **AC Land Officer** | `officer` | `officer123` | `/officer`: Mutation review stepper, hearing notes, `/officer/reconcile` discrepancy radar. |
| **System Admin** | `admin` | `admin123` | `/admin`: Tamper Lab byte alteration, append-only system audit log. |

---

## 10. Benchmark Test Scenarios

Mapped to `data/scenarios/scenarios.json` for live evaluation:

| Scenario | Name | Plot ID / Dag | Expected Result | Automated Status |
|:---|:---|:---|:---|:---|
| **S1** | Double Sale Attempt | Dag `102` / Plot `1` | Blocked at registration (HTTP 409 `R1_DOUBLE_SALE`) | ✅ 100% Blocked |
| **S2** | Stranger / Proxy Seller | Dag `103` / Plot `2` | Blocked at registration (HTTP 409 `R2_SELLER_NOT_OWNER`) | ✅ 100% Blocked |
| **S3** | Stalled Mutation >90 Days | Plot `3` | Flagged by Layer 3 Reconcile (`MUTATION_STALLED`) | ✅ Flagged |
| **S4** | Clean Title Sale | Dag `104` / Plot `4` | 0 Risk, Clean Title, Instant Registration & Mutation | ✅ 100% Clean |
| **S5** | Flagged Land (Khas / Disputed) | Plot `5` | High Risk Alert (`R6_FLAGGED_LAND`) | ✅ Flagged |
| **S6** | Area Overshoot Fraud | Plot `6` | Blocked (Remaining area < transfer area) | ✅ 100% Blocked |
| **L1** | Survey Lineage Break | Dag `201` | Flagged by Layer 4 Lineage (`MISSING_GENERATION`) | ✅ Flagged |

---

## 11. Mandatory AI Tools Usage Disclosure (Rule Book Section 9)

In compliance with **Section 9 of the LandTech 2026 Rule Book**, the team formally discloses all AI tools used:

| AI Tool / Model | Primary Application Scope | Human Oversight & Verification Method |
|:---|:---|:---|
| **Google Antigravity IDE (Gemini 3.8 Flash)** | Architecture design, test suite scaffolding, and documentation drafting. | Every single line of code was inspected, executed locally, and validated against 187 automated tests by both student members. |
| **GitHub Copilot** | Inline TypeScript and Pydantic syntax autocompletion. | Strict TypeScript compiler validation (`strict: true`) and code review. |
| **Runtime LLM API (Phase 2)** | Advisory natural language synthesis of deterministic facts. | Schema-constrained JSON generation; cannot alter or lower deterministic engine risk scores; offline template fallback. |

---

## 12. Known Limitations (Stated Honestly)

1. **Key Storage:** Prototype keys are loaded via secure environment variables; production deployment requires Hardware Security Modules (Cloud KMS / HSM).
2. **Simplified Mutation Lifecycle:** The 5-stage mutation FSM models the core statutory e-Mutation stages; physical field inspections still rely on local land surveyors.
3. **Synthetic Data Constraint:** In accordance with Rule Book Section 8, all evaluations are conducted on 300 synthetic plots and 120 synthetic citizens.

---

## 13. License

This project is open-source under the [MIT License](LICENSE).
