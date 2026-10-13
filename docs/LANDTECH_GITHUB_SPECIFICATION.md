# LandTech 2026 — Official GitHub Repository Specification & Submission Guide
**Event:** LandTech Innovation Hackathon 2026  
**Theme:** Land Tech Software for Smart E-Governance in Bangladesh  
**Track:** Digital Land Records, Verification & Digitization  
**Organized by:** Department of CSE & CSE-TECH, Daffodil International University (DIU)  
**Supported by:** Department of Law, Daffodil International University (DIU)  
**Document Status:** Authoritative Repository & Submission Specification  

---

## 1. Executive Summary & Regulatory Compliance

This document extracts and consolidates all mandatory requirements set forth in the official **LandTech 2026 Rule Book** regarding code development, data privacy, AI tool usage, repository architecture, and final deliverables.

### Key Deadlines & Deliverables
* **Round 1 Submission Deadline:** October 16, 2026 (via `landtech.diu.edu.bd/landtech`)
* **Round 1 Submission Pack:**
  1. **Concept Note:** PDF format, maximum 4 pages.
  2. **GitHub/GitLab Repository:** Public or shared with organizers, containing an authoritative `README.md`.
  3. **Demo Video:** Maximum 3 minutes.
  4. **Live Deployment Link:** Recommended (hosted on Vercel/Render/Railway).
* **Final Round Submission Pack (for selected teams):**
  1. Updated repository link with a summarized changelog in `README.md`.
  2. Pitch Deck PDF (maximum 10 slides).
  3. Live demonstration (5-minute pitch & demo, 3-minute Q&A). Both student members must present.

---

## 2. Mandatory Rules from the Official Rule Book

### 2.1 Repository & Commit History (Rule Book Section 7)
* **Authorship Verification:** The repository **must preserve its commit history**. Organizers and judges will inspect commit logs to verify authentic development and proportional contribution between both students.
* **Open-Source Attribution:** Open-source frameworks, libraries, APIs, and datasets are permitted, provided their licenses are respected and sources are explicitly credited in `README.md`.
* **Plagiarism:** Copying code, designs, or ideas without explicit attribution will result in immediate disqualification.
* **Changelog Requirement:** Any modifications made between Round 1 and the Final Round must be summarized in `README.md`.

### 2.2 Data, Privacy & Security Rules (Rule Book Section 8 — STRICT)
> [!CAUTION]
> Violation of any item in Section 8 leads to **immediate disqualification** and potential referral to authorities.

1. **Synthetic Data Only:** Teams must use self-generated synthetic (dummy) data or open public datasets.
2. **Zero Real Personal Data:** Real names, real National ID (NID) numbers, real telephone numbers, real addresses, or actual physical land records must **never** be collected, stored, or displayed.
3. **No Scraping:** Automated scraping, querying, or bulk downloading from any government portal (e.g., e-Mutation, Land Service Gateway, e-Khatian) is strictly prohibited.
4. **No Penetration Testing:** Penetration testing, vulnerability scanning, or unauthorized requests against live government or third-party servers are illegal and banned. All security features must be demonstrated solely on the team's local/hosted prototype.
5. **Demonstration Documents:** Any real deed used as visual reference must be 100% anonymized/redacted and pre-approved by the organizers.

### 2.3 AI Tools Usage Policy (Rule Book Section 9)
* AI coding assistants (e.g., Antigravity, GitHub Copilot) and Large Language Models (LLMs) are explicitly allowed.
* **Mandatory Disclosure:** All AI tools utilized must be formally listed in `README.md` with a concise explanation of their application.
* **Oral Competence:** Both student members must be capable of explaining all submitted code, design architecture, and cryptographic logic to the judges.

### 2.4 Licensing & Intellectual Property (Rule Book Section 12)
* The team retains 100% intellectual property ownership of the software.
* Releasing the repository under an open-source license (such as **MIT License**) is strongly encouraged.

---

## 3. Authoritative GitHub Repository Structure

The following directory layout meets and exceeds all criteria established by the hackathon organizers:

```text
landshield/                                # Root project directory
├── .github/
│   └── workflows/
│       └── ci.yml                         # Automated CI pipeline (pytest, lint, build)
├── backend/                               # Python / FastAPI Backend Service
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py                # JWT authentication & role-based access control
│   │   │       ├── deeds.py               # Deed registration, verification & QR endpoints
│   │   │       ├── plots.py               # Plot search, metadata & ledger chain history
│   │   │       ├── risk.py                # 0-100 fraud risk score calculation & reasoning
│   │   │       ├── mutations.py           # e-Mutation workflow transitions & officer approvals
│   │   │       └── dev.py                 # Tamper Lab simulation endpoints (gated by DEMO_MODE)
│   │   ├── models/                        # SQLAlchemy database models (Person, Plot, Deed, Ledger)
│   │   ├── schemas/                       # Pydantic v2 validation models
│   │   ├── services/                      # Core business logic
│   │   │   ├── crypto.py                  # SHA-256 canonical hashing & Ed25519 signing/verification
│   │   │   ├── ledger.py                  # Per-plot hash-chained tamper-evident ledger
│   │   │   ├── deed_service.py            # Deed state management & lookup
│   │   │   ├── mutation_fsm.py            # Mutation state machine (FSM)
│   │   │   └── fraud/
│   │   │       ├── engine.py              # Layered fraud rule engine
│   │   │       ├── r1_double_sale.py      # R1: Oversold area & double-selling check
│   │   │       ├── r2_seller_owner.py     # R2: Seller not recorded owner check
│   │   │       ├── r3_mutation.py         # R3: Unmutated active deeds older than 90 days
│   │   │       ├── r4_rapid.py            # R4: Rapid suspicious transfers (3+ in 30 days)
│   │   │       ├── r5_integrity.py        # R5: Cryptographic signature & hash failure
│   │   │       └── r6_flagged.py          # R6: Khas, acquired, or disputed land check
│   │   ├── utils/
│   │   │   ├── masking.py                 # Masking personal names on public endpoints
│   │   │   └── security.py                # Argon2 password hashing & token generation
│   │   ├── config.py                      # Environment configuration loading
│   │   ├── db.py                          # Database session manager
│   │   └── main.py                        # FastAPI entry point, middleware & route registration
│   ├── scripts/
│   │   ├── seed.py                        # Synthetic seed generator (Faker, 300 plots, scenarios S1-S6)
│   │   └── keygen.py                      # Ed25519 keypair generation utility
│   ├── tests/
│   │   ├── conftest.py                    # Test client & SQLite test database fixtures
│   │   ├── test_crypto.py                 # Cryptographic verification & tampering tests
│   │   ├── test_ledger.py                 # Hash-chain integrity & tampering detection tests
│   │   ├── test_fraud_rules.py            # Unit tests for rules R1 through R6
│   │   ├── test_mutation_fsm.py           # Valid & invalid mutation transition tests
│   │   └── test_api_scenarios.py          # Integration tests for pre-seeded test scenarios
│   ├── requirements.txt                   # Production Python dependencies
│   └── Dockerfile                         # Container definition for backend
├── frontend/                              # Next.js App Router (TypeScript + Tailwind CSS)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                 # Root layout with navigation & bilingual toggle
│   │   │   ├── page.tsx                   # Landing page with mission overview & quick verify
│   │   │   ├── check/
│   │   │   │   └── page.tsx               # Citizen Pre-Purchase Check tool (Problem P5)
│   │   │   ├── verify/
│   │   │   │   └── page.tsx               # Instant QR code scanner & deed verifier (Problem P2)
│   │   │   ├── registrar/
│   │   │   │   └── page.tsx               # Sub-Registrar registration portal with fraud blocker
│   │   │   ├── officer/
│   │   │   │   └── page.tsx               # AC Land officer mutation management dashboard
│   │   │   ├── admin/
│   │   │   │   └── page.tsx               # Interactive Tamper Lab & system audit logs
│   │   │   └── login/
│   │   │       └── page.tsx               # Role-based authentication interface
│   │   ├── components/                    # UI elements (QRScanner, RiskBadge, LanguageToggle)
│   │   ├── lib/
│   │   │   └── api.ts                     # Type-safe API client communicating with backend
│   │   └── locales/
│   │       ├── bn.json                    # Complete Bangla translation dictionary
│   │       └── en.json                    # English translation dictionary
│   ├── package.json                       # Frontend dependencies & scripts
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── tailwind.config.js                 # Tailwind CSS styles & theme
│   └── Dockerfile                         # Container definition for frontend
├── data/
│   └── scenarios/
│       └── scenarios.json                 # Pre-configured test scenarios (Clean, Double Sale, Tampered)
├── docs/                                  # Documentation & Judge Evaluation Resources
│   ├── concept-note/
│   │   └── CONCEPT_NOTE.pdf               # Official Round 1 Concept Note (max 4 pages)
│   ├── PRD.md                             # Product Requirements Document
│   ├── TRD.md                             # Technical Requirements Document
│   ├── SECURITY.md                        # Threat model, security controls & synthetic data policy
│   ├── AI_USAGE.md                        # Mandatory AI disclosure documentation
│   ├── DEMO_ACCOUNTS.md                   # Synthetic test accounts for judges (Registrar, Officer, Admin)
│   ├── DEMO_SCRIPT.md                     # Rehearsed 3-minute video & pitch script
│   ├── PROGRESS.md                        # Ongoing session tracking log
│   └── CHANGELOG.md                       # Release notes and updates
├── .env.example                           # Safe template for environment variables
├── .gitignore                             # Ignores keys/, .env, *.db, node_modules/, .venv/
├── docker-compose.yml                     # Multi-service local runner (Postgres/SQLite, API, Web)
├── Makefile                               # Developer shortcut commands (setup, seed, test, run)
├── README.md                              # Authoritative repository presentation
└── LICENSE                                # MIT Open Source License
```

---

## 4. Required Contents of `README.md`

According to the Rule Book, the `README.md` file in the root of the repository must contain the following specific sections:

### 1. Header & Project Summary
* **Title:** LandShield: Tamper-Evident Deed Verification & Fraud Prevention Layer
* **Hackathon:** LandTech Innovation Hackathon 2026 | DIU
* **Problem Statements Addressed:**
  - Primary: P2 (Deed & Ownership Verification)
  - Secondary: P3 (Fraud & Double-Selling Detection), P4 (Smart e-Mutation), P5 (Citizen Pre-Purchase Verification)
* **Direct Links:**
  - `[Live Application URL]`
  - `[3-Minute Demo Video]`
  - `[Concept Note PDF]`

### 2. Mandatory Synthetic Data Disclosure (Rule Book Section 8)
* Explicitly state:
  > *"All data contained in this project is purely synthetic and generated via automated scripts. No real personal identities, real NIDs, phone numbers, or genuine government land records have been collected or processed. No government servers were scraped or accessed."*

### 3. Key Feature Overview
* **Cryptographic Verification (Ed25519 & SHA-256):** Instant validity verification (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`).
* **Tamper Lab Demonstration:** Interactive proof showing that modifying even a single byte triggers immediate cryptographic invalidation.
* **Pre-Registration Fraud Blocker:** Blocks double-selling and unauthorized sales at HTTP 409 before records are committed.
* **Citizen "Check Before You Buy" Portal:** Bilingual (Bangla/English) explanation of ownership risks.

### 4. Setup & Execution Instructions (Quick Start)
* Provide both **Docker** and **Manual** execution commands:
  ```bash
  # Docker execution
  git clone <repository-url> && cd landshield
  cp .env.example .env
  docker compose up --build -d
  docker compose exec backend python -m scripts.seed --reset
  ```
  - Frontend accessible at: `http://localhost:3000`
  - Backend Swagger docs accessible at: `http://localhost:8000/docs`

### 5. Mandatory AI Tools Disclosure Table (Rule Book Section 9)
| Tool / Model | Scope of Usage | Context & Human Oversight |
| :--- | :--- | :--- |
| **Antigravity (with Claude / Gemini)** | Architecture scaffolding, test boilerplate, and documentation drafting. | Every line of generated code was manually inspected, debugged, and validated by both student team members. |
| **Google Gemini API** (Optional) | Runtime generation of plain-language citizen risk summaries. | Constrained by schema validation and deterministic rule engine fallbacks. |

### 6. Credits & Open Source Libraries (Rule Book Section 7.2)
* List all major dependencies: FastAPI, Next.js, PyNaCl (libsodium), SQLAlchemy, Tailwind CSS, html5-qrcode.

### 7. Changes Since Round 1 (Mandatory for Final Round)
* Chronological summary of improvements made between Round 1 and the Knowledge Tower Final presentation.

---

## 5. Strict Git & Authorship Protocols

1. **Dual Student Authorship:**
   * Run `git shortlog -sn` before submitting.
   * Both student members must have verifiable commits under their registered GitHub usernames.
   * Work should be alternated across feature branches (`feat/crypto`, `feat/fraud-engine`, `feat/ui`, etc.).
2. **Branch Management:**
   * Protect `main`. Direct pushes to `main` should be restricted.
   * Features must be merged through Pull Requests after local verification.
3. **Official Round 1 Tag:**
   * Before submitting the repository link on the platform, create and push an immutable Git tag:
     ```bash
     git tag -a v1.0-round1 -m "LandTech 2026 Round 1 Official Submission"
     git push origin v1.0-round1
     ```

---

## 6. Prohibited Files & Disqualification Traps

The following items must **never appear in the Git history**:
* ❌ Real `.env` files containing actual passwords or secret keys.
* ❌ Private keys directory (`keys/registrar_ed25519.hex` must be in `.gitignore`).
* ❌ SQLite database binaries (`*.db`, `*.sqlite`, `*.sqlite3`).
* ❌ Genuine personally identifiable information (PII) or real citizen records.
* ❌ Automated scraping bots or load-testing scripts directed against external domains.
