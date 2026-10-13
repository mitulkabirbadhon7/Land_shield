# LandShield: Tamper-Evident Deed Verification & Fraud Prevention Platform

> **LandTech Innovation Hackathon 2026**  
> **Track:** Digital Land Records, Verification & Digitization  
> **Problem Statements:** **P2** (Primary: Deed & Ownership Verification), **P3** (Fraud & Double-Selling Detection), **P4** (Smart e-Mutation), **P5** (Citizen Pre-Purchase Verification)  
> **Release Target:** `v1.0-round1` (Round 1 Official Submission)

---

## 🔗 Submission Deliverables & Live Links
* **Live Web Application:** `[LIVE VERCEL URL — e.g. https://land-shield.vercel.app]`
* **Live Backend API (Render):** [https://land-shield.onrender.com](https://land-shield.onrender.com) (Swagger Docs: [/docs](https://land-shield.onrender.com/docs) | Deep Health: [/api/v1/health/deep](https://land-shield.onrender.com/api/v1/health/deep))
* **3-Minute Demo Video:** `[YOUTUBE / DRIVE 3-MINUTE VIDEO URL]`
* **Official Concept Note:** [docs/concept-note/CONCEPT_NOTE.md](docs/concept-note/CONCEPT_NOTE.md) *(Target: 4 PDF pages)*
* **Demo Script & Walkthrough:** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
* **Synthetic Demo Accounts:** [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md)

---

> [!IMPORTANT]
> ### 🛡️ Mandatory Synthetic Data Disclosure (Rule Book Section 8)
> **All data contained within this project is 100% synthetic and generated via automated scripts.**  
> Zero real citizen names, real National ID (NID) numbers, real telephone numbers, real physical addresses, or genuine government land records have been collected, processed, or stored. No government portal or server (such as e-Mutation, e-Porcha, or Land Service Gateway) was scraped, queried, or security-tested.

---

## 1. Problem Statement
In Bangladesh, land disputes account for an estimated 75% of civil court cases [CITATION NEEDED]. Key root causes include forged paper deeds, unauthorized double-selling of identical land plots, conflicting survey generation records (CS, SA, RS, BS), and institutional desynchronization between the Sub-Registry office (Ministry of Law, handling deed registration) and the AC Land office (Ministry of Land, handling mutation). Prospective buyers lack independent, transparent tools to verify ownership legitimacy before completing transactions.

## 2. Our Solution
**LandShield** is an independent, zero-trust verification and reconciliation layer designed to operate on top of existing land governance infrastructure without replacing legal registries.

### Operating Principles
1. **Cryptographic Integrity & Rules Decide:** Asymmetric digital signatures (Ed25519) and mathematical area conservation rules hold absolute authority and block fraud at HTTP 409 before persistence.
2. **Machine Learning Advises:** Statistical ML models provide advisory anomaly detection without the power to lower risk scores or bypass rules.
3. **Language Models Explain:** Generative AI is strictly restricted to plain-language bilingual summarization; it never determines risk scores.

---

## 3. Key Features

### Round 1 Core Capabilities (Built & Verified)
* **Cryptographic Deed Integrity:** Every deed is canonically serialized (RFC 8785), SHA-256 hashed, and digitally signed with Ed25519; status is verified instantaneously (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`).
* **Per-Plot Hash-Chained Ledger:** Per-plot immutable hash chains walking back to genesis verify ledger continuity and detect sequence tampering.
* **Pre-Registration Fraud Blocker:** Intercepts attempted double-selling and unauthorized sales at HTTP 409 `FRAUD_BLOCKED` before database commit.
* **Interactive Tamper Lab:** Admin demonstration proving that altering even a single byte of a deed in the database triggers immediate cryptographic invalidation (`HASH_MISMATCH`).
* **Citizen "Check Before You Buy" Portal:** Public bilingual portal providing a 0–100 animated circular risk gauge, masked ownership timeline, and plain-Bangla explanations.
* **Smart e-Mutation Workflow:** 5-state Finite State Machine (`SUBMITTED` -> `AUTO_CHECKED` -> `UNDER_REVIEW` -> `APPROVED` / `REJECTED`) with officer hearing notes and append-only audit trail.
* **Browser-Native Camera QR Scanner:** Decodes deed QR tokens directly through device camera over HTTPS on mobile phones.

### Phase 2 Roadmap Additions (Feature-Flagged)
* Cross-office reconciliation layer (Rule R8: `OWNER_MISMATCH`, `MUTATION_STALLED`, `AREA_NOT_CONSERVED`).
* Survey lineage directed acyclic graph (Rule R7: CS -> SA -> RS -> BS continuity).
* Offline browser QR verification using Web Crypto API.
* Merkle tree daily transparency logs with published cryptographic roots.
* Advisory ML risk scoring (LightGBM + SHAP) and dummy document OCR ingest.

---

## 4. System Architecture

```text
 [ Citizen Web ]        [ Sub-Registrar ]        [ AC Land Officer ]        [ Admin ]
 (Pre-Purchase)          (Deed Registry)          (Mutation Stepper)       (Tamper Lab)
        \                       \                        /                     /
         +-----------------------+----------------------+---------------------+
                                            |
                                  HTTPS (TLS 1.3) / JSON
                                            v
     +-----------------------------------------------------------------------------+
     |                       Next.js 16 (App Router) Frontend                      |
     |         Bilingual i18n (Bangla/English) | html5-qrcode Camera Scanner       |
     +-----------------------------------------------------------------------------+
                                            |
                                    REST API (/api/v1)
                                            v
     +-----------------------------------------------------------------------------+
     |                           FastAPI (Python 3.11)                             |
     |  * JWT Auth & RBAC (Registrar, Officer, Admin) | slowapi Rate Limiting      |
     |  * Deed Service | Mutation FSM | Masking Engine | Append-Only Audit Trail   |
     +-----------------------------------------------------------------------------+
                                            |
                                            v
     +-----------------------------------------------------------------------------+
     |                         HYBRID LAYERED FRAUD ENGINE                         |
     |  Layer 1: Cryptographic Integrity (Ed25519 Signatures, Hash Chain Walk)     |
     |  Layer 2: Domain Rules (R1 Double Sale, R2 Stranger, R3 Delay, R4 Rapid)   |
     |  Layer 3: Bilingual Explanation & 0-100 Risk Score Engine                   |
     +-----------------------------------------------------------------------------+
                                            |
                                            v
     +-----------------------------------------------------------------------------+
     |                         PERSISTENCE & SECURITY                              |
     |  PostgreSQL 15 (Deploy) / SQLite (Dev) | PyNaCl Ed25519 Signing Keys        |
     +-----------------------------------------------------------------------------+
```
*Comprehensive architecture details:* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | [docs/TRD.md](docs/TRD.md)

---

## 5. Technology Stack
| Layer | Technology | Justification |
|---|---|---|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS | Fast SSR/prerendering, responsive mobile-first UI, type safety |
| **Typography** | Google Noto Sans Bengali, Outfit, Inter | Authentic, legible Bangla script rendering across all devices |
| **Backend** | Python 3.11, FastAPI, Pydantic v2 | High-performance asynchronous REST API, strict schema validation |
| **ORM & DB** | SQLAlchemy 2, PostgreSQL 15 (dev: SQLite) | Parameterized queries, atomic transactions, multi-dialect support |
| **Cryptography** | PyNaCl (libsodium Ed25519), hashlib SHA-256 | High-speed asymmetric digital signatures, RFC 8785 canonical JSON |
| **Camera & QR** | html5-qrcode, qrcode (PIL) | Instant in-browser camera scanning over HTTPS, PNG QR generation |
| **Security** | Argon2id, python-jose (JWT HS256), slowapi | Modern password hashing, stateless role tokens, rate limiting |
| **DevOps** | Docker, Docker Compose, Render, Vercel | Production containerization, managed backend, edge CDN frontend |

---

## 6. Quick Start & Execution Instructions

### Option A: Local Execution via Virtualenv (Fastest for Testing)

#### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/mitulkabirbadhon7/Land_shield.git
cd Land_shield

# Create and activate Python 3.11 virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1    # On Windows PowerShell
# source .venv/bin/activate   # On Linux/macOS

# Install dependencies
pip install -r backend/requirements.txt

# Run full test suite (105 tests)
pytest backend/tests -v

# Run the backend server
uvicorn app.main:app --app-dir backend --reload --port 8000
```
Swagger API documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

#### 2. Frontend Setup
```bash
# In a separate terminal, navigate to frontend
cd frontend

# Copy environment file
cp .env.example .env.local

# Install Node dependencies and start development server
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Local Execution via Docker Compose

```bash
# Start all containers in the background (PostgreSQL 15, FastAPI, Next.js)
docker compose up --build -d

# View real-time container logs
docker compose logs -f

# Check health
curl http://localhost:8000/api/v1/health/deep

# Stop containers
docker compose down
```

*Makefile shortcuts:* `make up`, `make down`, `make logs`, `make reset`, `make test`.

---

## 7. Configuration (.env.example)

Copy `.env.example` to `.env`. **Never commit `.env` or files in `keys/`.**

| Environment Variable | Description | Default / Example Value |
|---|---|---|
| `DATABASE_URL` | Database connection string (auto-normalized) | `sqlite:///./landshield.db` (or `postgresql+psycopg://...`) |
| `JWT_SECRET` | Secret key for JWT signing (32+ chars) | `dev-secret-key-change-in-production-32-bytes` |
| `SIGNING_KEY_PATH` | Path to registrar Ed25519 private key seed | `./keys/registrar_ed25519.hex` |
| `SIGNING_KEY_HEX` | Optional hex private key seed for cloud deploys | `[64-character hex seed]` |
| `DEMO_MODE` | Enables Admin Tamper Lab simulation | `true` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000,https://*.vercel.app` |
| `FRONTEND_URL` | Base URL encoded into deed QR codes | `http://localhost:3000` |
| `SEED_ON_START` | Automatically populate 300 plots on first boot | `true` |

---

## 8. Demo Guide & Test Accounts

Synthetic accounts are configured for hackathon demonstration:

| Role | Username | Password | Key Portal & Capabilities |
|---|---|---|---|
| **Sub-Registrar** | `registrar1` | `RegistrarPass123!` | `/registrar`: Create deeds, trigger fraud blocker, download QR |
| **AC Land Officer** | `officer1` | `OfficerPass123!` | `/officer`: Mutation review stepper, auto-checks, alert resolution |
| **System Admin** | `admin1` | `AdminPass123!` | `/admin`: Interactive Tamper Lab, single-byte tampering, audit trail |

*Detailed step-by-step video script:* [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)  
*Cloud deployment handbook:* [docs/DEPLOY.md](docs/DEPLOY.md)

---

## 9. Benchmark Test Scenarios

The synthetic dataset generates 8 canonical evaluation scenarios mapped to `data/scenarios/scenarios.json`:

| Scenario | Name | Plot ID | Expected Result | Status |
|---|---|---|---|---|
| **S1** | Double Sale Attempt | Plot 1 | Blocked at registration (HTTP 409 `R1_DOUBLE_SALE`) | ✅ Verified |
| **S2** | Stranger Seller | Plot 2 | Blocked at registration (HTTP 409 `R2_SELLER_NOT_OWNER`) | ✅ Verified |
| **S3** | Missing Mutation >90 Days | Plot 3 | Medium Risk alert (`R3_MISSING_MUTATION`) | ✅ Verified |
| **S4** | Rapid Transfers (4 in 20 days) | Plot 4 | High Risk alert (`R4_RAPID_TRANSFERS`) | ✅ Verified |
| **S5** | Flagged Land (Khas / Disputed) | Plot 5 | High Risk alert (`R6_FLAGGED_LAND`) | ✅ Verified |
| **S6** | Clean Land Deal | Plot 6 | 0 Risk, Valid Deed (`VALID`) | ✅ Verified |
| **S7** | Legit Pending Resale | Plot 7 | Valid in ledger, unmutated resale allowed | ✅ Verified |
| **S8** | Partial Sales Conserved | Plot 8 | Valid, partial area conserved (`sum <= total`) | ✅ Verified |

---

## 10. AI Tools Usage Disclosure (Rule Book Section 9)

In compliance with **Section 9 of the LandTech 2026 Rule Book**, the authors formally disclose all AI tools used during development:

| AI Tool / Model | Primary Application | Human Verification & Quality Assurance Method |
|---|---|---|
| **Google Antigravity IDE (Gemini 3.8 Flash)** | Session-by-session code scaffolding, test case generation, and documentation drafting | All code reviewed line-by-line before commit; all 105 tests run locally; all UI flows tested in browser |
| **GitHub Copilot** | In-line TypeScript and Pydantic syntax autocompletion | Human inspection; TypeScript strict compiler type checking |
| **Runtime LLM API (Phase 2)** | Plain-Bangla translation of deterministic findings | Strict schema validation; deterministic engine overrides risk level; offline template fallback |

*Full disclosure documentation:* [docs/AI_USAGE.md](docs/AI_USAGE.md)

---

## 11. Known Limitations (Stated Honestly)
1. **Prototype Signing Key Management:** Private keys are loaded from disk/env; a production rollout requires Hardware Security Modules (Cloud KMS / HSM).
2. **Simplified Mutation Workflow:** The 5-stage mutation FSM is a simplified model of the full statutory e-Mutation process.
3. **Synthetic Metrics:** All accuracy, precision, and fraud detection metrics are measured on our deterministic synthetic dataset.
4. **Offline QR Scope:** Offline QR verification mathematically proves authenticity and integrity, but cannot detect whether a newer deed has superseded it online.

---

## 12. Team Directory & Module Ownership

| Role | Name | Institution | Contact |
|---|---|---|---|
| **Student 1 (Team Leader)** | `[STUDENT 1 NAME - TEAM LEADER]` | Daffodil International University (DIU) | `[STUDENT 1 EMAIL]` |
| **Student 2 (Team Member)** | `[STUDENT 2 NAME - TEAM MEMBER]` | Daffodil International University (DIU) | `[STUDENT 2 EMAIL]` |
| **Faculty Mentor** | `[FACULTY MENTOR NAME]` | Daffodil International University (DIU) | `[FACULTY MENTOR EMAIL]` |
| **Industry Mentor** | `[INDUSTRY MENTOR NAME]` | `[ORGANIZATION / COMPANY]` | `[INDUSTRY MENTOR EMAIL]` |

*Module responsibility matrix:* [docs/MODULE_OWNERS.md](docs/MODULE_OWNERS.md)

---

## 13. License
This project is open-source under the [MIT License](LICENSE).
