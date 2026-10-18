# LandShield: Tamper-Evident Cryptographic Land Registry, Autonomous Fraud Interception & Citizen Verification Framework

> **Event:** LandTech Innovation Hackathon 2026 | **Track:** Digital Land Records, Verification & Digitization  
> **Organized by:** Department of CSE & CSE-TECH, Daffodil International University (DIU)  
> **Supported by:** Department of Law, Daffodil International University (DIU)  
> **Primary Challenges Addressed:** **P2** (Deed Verification), **P3** (Fraud & Double-Selling Prevention), **P4** (Smart e-Mutation), **P5** (Citizen Pre-Purchase Verification)  
> **Release Target:** `v1.3-final-release` (Official Final Submission)

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

## 🔗 Live Application Deliverables & Quick Links

* **Live Web Application:** [https://landshield.vercel.app](https://landshield.vercel.app)
* **Live Backend API (Render):** [https://land-shield.onrender.com](https://land-shield.onrender.com)
  * Interactive Swagger Documentation: [/docs](https://land-shield.onrender.com/docs)
  * Deep System Healthcheck: [/api/v1/health/deep](https://land-shield.onrender.com/api/v1/health/deep)
* **3-Minute Pitch & Demo Video:** `[YOUTUBE / DRIVE 3-MINUTE VIDEO URL]`
* **Official 4-Page Concept Note Proposal:** [docs/concept-note/CONCEPT_NOTE.md](docs/concept-note/CONCEPT_NOTE.md)
* **Judge Presentation & Testing Manual:** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
* **Pre-Configured Test Accounts:** [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md)

---

> [!IMPORTANT]
> ### 🛡️ Mandatory Synthetic Data Disclosure (Rule Book Section 8)
> **All data contained within this project is 100% synthetic and generated via automated deterministic scripts (300 parcels, 120 citizen personas).**  
> Zero real citizen names, real National ID (NID) numbers, real telephone numbers, real physical addresses, or genuine government land records have been collected, processed, or stored. No government portal or server (such as e-Mutation, e-Porcha, or Land Service Gateway) was scraped, queried, or security-tested. All testing and demonstrations occur strictly within an isolated local or prototype sandbox environment.

---

## 1. Problem Statement: The Bangladesh Land Crisis

In Bangladesh, over **75% of all civil court litigation (~3.2 million pending cases)** originates directly from land disputes and conflicting titles. This systemic crisis is sustained by five institutional vulnerabilities:
1. **Paper Volume Book Tampering:** Colonial-era paper registers (বালাম বই) in Sub-Registry offices are prone to page tearing, physical alteration, and backdated forged deed insertions.
2. **Double & Multi-Selling Exploits:** Selling the same parcel to multiple unsuspecting buyers before mutation updates occur.
3. **Inter-Departmental Silos:** Sub-Registry offices (Ministry of Law) execute deed registration without real-time synchronization with Upazila AC Land offices (Ministry of Land), creating a multi-month window for fraud.
4. **Cadastral Survey Lineage Breaks:** Missing generational transfers across sequential colonial surveys (CS ➔ SA ➔ RS ➔ BS) enabling proxy / stranger sellers to claim rights.
5. **Citizen Informational Asymmetry:** Prospective buyers cannot independently verify title authenticity before payment without paying unofficial intermediaries.

---

## 2. The LandShield Solution

**LandShield** is an autonomous, tamper-evident verification, fraud interception, and inter-office reconciliation infrastructure designed to operate as a secure, non-invasive middleware layer on top of existing land administration portals (`land.gov.bd`, `eporcha`, e-Mutation) without requiring constitutional or database overhauls.

Rather than proposing an expensive, legally fraught public blockchain, LandShield deploys standard battle-tested cryptographic primitives (Ed25519 digital signatures, RFC 8785 canonical JSON, SHA-256 hash chains, and daily public Merkle transparency roots) combined with an autonomous 4-layer fraud prevention engine to stop land crimes at the registrar's desk while empowering citizens with instant title due diligence.

---

## 3. Platform Capabilities & Core Innovations

LandShield provides a unified, production-ready suite of capabilities across citizen services and government operations:

### 🛡️ Autonomous Fraud Prevention & Registry Operations
* **Pre-Registration Fraud Blocker (`/registrar`):** Injects a deterministic pre-registration hook into registry workstations. If double-selling, oversold area, or a stranger seller is detected, the transaction is aborted with an instantaneous **HTTP 409 `FRAUD_BLOCKED`** before database commit.
* **Instant Digital Deed Verification (`/verify`):** Real-time cryptographic verification (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`) via deed number lookup or camera QR scan.
* **Offline Browser-Native Cryptographic Verifier (`/verify/offline`):** Enables remote citizens and field officers in disconnected rural areas to verify 2D QR deeds in the browser using TweetNaCl WebAssembly crypto with zero network dependencies.
* **Interactive Tamper Lab (`/admin`):** Live evaluator demonstration proving that altering even a single byte of a deed in the database immediately triggers cryptographic invalidation (`HASH_MISMATCH`).

### 👥 Citizen Pre-Purchase Due-Diligence
* **Public Title Risk Inspection (`/check`):** Provides prospective buyers with an animated 0–100 circular risk gauge, masked ownership timeline, and plain-language violation breakdowns.
* **Print-Ready AI Due-Diligence & Legal Advisory Report:** One-click institutional legal opinion generated strictly from verified database facts with zero hallucination, complete with print-ready CSS (`window.print()`).
* **Public Daily Merkle Transparency Log (`/transparency`):** Aggregates daily deeds into cumulative cryptographic Merkle roots published daily, making retroactive record insertion mathematically impossible, with an interactive 3-hop inclusion proof verifier.

### 🏛️ Inter-Office Governance & Lineage Analytics
* **Cross-Office Reconciliation Radar (`/officer/reconcile`):** Continuously audits Sub-Registry deeds against AC Land khatian registers, detecting ownership mismatches, stalled mutations (>90 days), and unmutated transfers.
* **Cadastral Survey Lineage Graph (CS ➔ SA ➔ RS ➔ BS):** Directed Acyclic Graph (DAG) validating 4-generation historical continuity across surveys, highlighting orphaned khatians or unexplained acreage growth.
* **Smart e-Mutation Workflow (`/officer`):** Automated 5-stage Finite State Machine (`SUBMITTED` ➔ `UNDER_REVIEW` ➔ `APPROVED` / `REJECTED`) with an immutable, append-only audit trail.
* **Security & Attack Benchmark Matrix (`/metrics`):** Audited performance across 9 adversarial threat vectors (A1–A9) showing 100% detection rate and 28ms average pipeline latency.
* **3-Phase National Rollout Roadmap (`/rollout`):** Operational deployment plan across 64 districts and 500+ Upazilas with infrastructure readiness milestones.

---

## 4. Visual System Architecture

```mermaid
flowchart TD
    subgraph Citizens["👥 Public & Citizen Touchpoints"]
        C1["/check<br/>Pre-Purchase Check & AI Report"]
        C2["/verify<br/>Deed QR Camera Scanner"]
        C3["/verify/offline<br/>Zero-Net Browser Crypto (TweetNaCl)"]
        C4["/transparency<br/>Public Daily Merkle Root Log"]
    end

    subgraph Government["🏛️ Institutional Government Portals"]
        G1["/registrar<br/>Sub-Registrar Registration Desk"]
        G2["/officer<br/>AC Land Mutation FSM Workflow"]
        G3["/officer/reconcile<br/>Cross-Office Discrepancy Radar"]
        G4["/admin<br/>Tamper Lab & Append-Only Audit"]
    end

    subgraph SecurityGateway["🔒 Security, Rate Limiting & Auth Gateway"]
        TLS["HTTPS / TLS 1.3"]
        JWT["Stateless JWT RBAC (Registrar, Officer, Admin)"]
        RateLimit["Dynamic Rate Limiting (SlowAPI)"]
        PrivacyMask["PII Masking Engine (M***d R***n)"]
    end

    subgraph Pipeline["🛡️ 4-Layer Autonomous Verification Pipeline (28ms Latency)"]
        L1["Layer 1: Cryptographic Integrity (4.2ms)<br/>RFC 8785 Canonical JSON • Ed25519 Signatures • SHA-256 Hash Chain"]
        L2["Layer 2: Domain Statutory Rules (12.5ms)<br/>R1 Double Sale Block • R2 Stranger Title • R3-R6 Statutory Flags"]
        L3["Layer 3: Inter-Office Reconciliation Radar (6.1ms)<br/>R8 Ownership Divergence • Stalled Mutation Tracking"]
        L4["Layer 4: Cadastral Survey Lineage DAG (5.4ms)<br/>R7 Multi-Generational Continuity Graph (CS ➔ SA ➔ RS ➔ BS)"]
    end

    subgraph Storage["💾 Persistence & Immutable Ledgers"]
        DB[("PostgreSQL 15 (Prod) / SQLite (Dev)<br/>Relational Records & ACID Transactions")]
        Merkle[("Daily Merkle Transparency Ledger<br/>Cryptographic Tamper-Proof Root")]
    end

    subgraph GovMiddleware["🌐 Existing National E-Governance Integration"]
        SubRegDesk["Sub-Registry Workstation Software<br/>Pre-registration HTTP 409 Interception Hook"]
        EMutationHook["mutation.land.gov.bd<br/>Authenticated Webhook for Auto-Drafting Mutations"]
        UDCHook["5,000+ Union Digital Centers<br/>Rural Offline Verification & AI Report Printing"]
    end

    Citizens --> TLS
    Government --> TLS
    TLS --> JWT --> RateLimit --> PrivacyMask --> Pipeline
    Pipeline --> DB
    Pipeline --> Merkle
    Pipeline -.->|Real-Time Hook| SubRegDesk
    Pipeline -.->|Auto-Mutation Webhook| EMutationHook
    Pipeline -.->|Citizen Access| UDCHook

    classDef citizen fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b;
    classDef govt fill:#f0f9ff,stroke:#0284c7,stroke-width:2px,color:#0c4a6e;
    classDef pipe fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#78350f;
    classDef sec fill:#f8fafc,stroke:#64748b,stroke-width:2px,color:#334155;
    classDef store fill:#fdf4ff,stroke:#c026d3,stroke-width:2px,color:#701a75;
    classDef ext fill:#ecfeff,stroke:#06b6d4,stroke-width:2px,color:#164e63;

    class C1,C2,C3,C4 citizen;
    class G1,G2,G3,G4 govt;
    class L1,L2,L3,L4 pipe;
    class TLS,JWT,RateLimit,PrivacyMask sec;
    class DB,Merkle store;
    class SubRegDesk,EMutationHook,UDCHook ext;
```

---

## 5. Platform Evolution & Verified Deliverables (Rule Book Section 7.4)

> Full continuous commit history is tracked in [`docs/CHANGELOG.md`](docs/CHANGELOG.md) and [`docs/PROGRESS.md`](docs/PROGRESS.md).

| Capability Domain | Technical Implementation & Deliverable | Institutional Impact |
|:---|:---|:---|
| **Cryptographic Expansion** | RFC 8785 canonical JSON serialization, Ed25519 digital signatures, SHA-256 genesis hash chain, and daily public Merkle transparency root log (`/transparency`) | Eliminates backdated forged deeds in public archives; mathematical certainty replaces bureaucratic trust. |
| **Cadastral Lineage Graph** | Directed Acyclic Graph (DAG) analyzing survey transitions from CS (1910) to BS (present) | Detects illegal area expansion and missing ancestral survey generations. |
| **Inter-Office Reconciliation** | Real-time discrepancy radar (`/officer/reconcile`) cross-auditing Sub-Registry deeds against AC Land khatians | Solves inter-ministerial desynchronization, flagging stalled mutations and unrecorded sales. |
| **Zero-Connectivity Verification** | Browser-native TweetNaCl WebAssembly cryptographic verifier (`/verify/offline`) | Enables instantaneous deed validation in remote villages with zero network connection. |
| **AI Due-Diligence Synthesis** | Schema-constrained AI legal opinion generator with print-ready formatting (`window.print()`) | Delivers zero-hallucination, plain-language title assessments for prospective buyers. |
| **Empirical Security Benchmark** | Automated attack test suite auditing 9 real-world threat vectors (A1–A9) with 100% defense rate | Confirms 28.2ms pipeline execution speed with 0.0% false positive rate across 187 automated tests. |
| **National Rollout Strategy** | 3-phase operational implementation plan across 64 districts and 500+ Upazilas (`/rollout`) | Actionable roadmap targeting 75% reduction in land litigation without constitutional overhaul. |
| **UI Polish & Accessibility** | Pure bilingual localization (Bangla/English), responsive typography, high-contrast dark mode | 100% WCAG-compliant readability across desktop, tablet, and mobile devices. |

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

# 4. Run automated test suite (183 backend tests)
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

# Run offline browser crypto unit tests (4 tests)
npm test

# Run ESLint validation
npm run lint

# Start Next.js development server
npm run dev
```
* Frontend Application: [http://localhost:3000](http://localhost:3000)

---

### Option B: Local Execution via Docker Compose

```powershell
# Build and run containers in background (PostgreSQL 15, FastAPI, Next.js)
docker compose up --build -d

# Check deep system health
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

Synthetic accounts pre-configured for live evaluator testing:

| Role | Username | Password | Key Portal & Capabilities |
|:---|:---|:---|:---|
| **Sub-Registrar** | `registrar` | `registrar123` | `/registrar`: Register deeds, trigger HTTP 409 fraud blocker, generate QR codes. |
| **AC Land Officer** | `officer` | `officer123` | `/officer`: Mutation review stepper, hearing notes, `/officer/reconcile` discrepancy radar. |
| **System Admin** | `admin` | `admin123` | `/admin`: Tamper Lab byte alteration, append-only system audit log. |

---

## 10. Benchmark Test Scenarios

Audited against 9 real-world land crime scenarios in `data/scenarios/scenarios.json`:

| Scenario | Name | Plot ID / Dag | Expected Result | Automated Status |
|:---|:---|:---|:---|:---:|
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
| **Runtime LLM API** | Advisory natural language synthesis of deterministic facts. | Schema-constrained JSON generation; cannot alter or lower deterministic engine risk scores; offline template fallback. |

---

## 12. Known Limitations (Stated Honestly)

1. **Key Storage:** Prototype keys are loaded via secure environment variables; production deployment requires Hardware Security Modules (Cloud KMS / HSM).
2. **Simplified Mutation Lifecycle:** The 5-stage mutation FSM models the core statutory e-Mutation stages; physical field inspections still rely on local land surveyors.
3. **Synthetic Data Constraint:** In accordance with Rule Book Section 8, all evaluations are conducted on 300 synthetic plots and 120 synthetic citizens.

---

## 13. License

This project is open-source under the [MIT License](LICENSE).
