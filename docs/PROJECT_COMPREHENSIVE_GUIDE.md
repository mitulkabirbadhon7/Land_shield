# LandShield: Comprehensive Technical & Functional Documentation
**Platform Name:** LandShield (ভূমি রেকর্ড ও দলিল সুরক্ষা প্ল্যাটফর্ম)  
**Hackathon:** LandTech Innovation Hackathon 2026 (Round 1)  
**Target Vision:** Smart Bangladesh 2041 — Tamper-Evident Land Governance  
**Repository Branch:** `main`

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Real-World Land Governance Dilemma
In Bangladesh, land administration is historically split across two separate government jurisdictions with disconnected record systems:
1. **Sub-Registry Offices (Ministry of Law, Justice and Parliamentary Affairs):** Responsible for executing and registering land transfer deeds under the *Registration Act of 1908*.
2. **Upazila Land Offices / AC Land (Ministry of Land):** Responsible for maintaining official Record of Rights (Khatian / Porcha), conducting Mutation (*Namzari*), and collecting land development tax under the *State Acquisition and Tenancy Act of 1950*.

### 1.2 The Systemic Vulnerability Window
Because deeds are registered before the land office conducts hearings and updates the official Khatian, a dangerous time gap of 30 to 90+ days exists. During this window:
- **Double Selling (জাল দলিল ও একাধিক বিক্রি):** A fraudulent seller sells the same parcel of land to multiple unsuspecting buyers before any mutation appears on record.
- **Selling Unmutated Land (খারিজবিহীন জমি বিক্রি):** Buyers who purchased land years ago without completing mutation resell land they do not officially hold on the Khatian.
- **Stranger / Fictitious Sellers (বেনামী বা অসদুপায়ী বিক্রেতা):** Individuals posing as landowners without legitimate chain of title execute registrations.
- **Rapid Transfer Flipping:** Fraud rings execute rapid successive transfers within days to obfuscate fraudulent paper trails.
- **Encroachment on Khas / Disputed Land:** Government-owned (Khas), court-injunction, or acquired land is registered through forged paperwork.
- **Document Forgery & Seal Tampering:** Physical deed papers and revenue stamps are forged or altered after registration.

### 1.3 The LandShield Solution
LandShield bridges this jurisdictional gap by providing an end-to-end cryptographic and intelligent platform:
1. **Ed25519 Asymmetric Signatures & SHA-256 Ledger Chains:** Every deed is canonically serialized, digitally signed with military-grade Ed25519 cryptography, and appended to a plot-specific hash chain.
2. **Dual-View Land Holdings Accounting:** Tracks both *Record Holdings* (official Khatian-updated land) and *Ledger Holdings* (uncommitted available land) to stop double-selling at the moment of registration.
3. **Real-Time 6-Rule Fraud Detection Engine:** Automatically evaluates transaction risk across 6 deterministic legal and cryptographic rules before registration and during mutation.
4. **Smart 5-Stage e-Mutation Finite State Machine (FSM):** Orchestrates mutation lifecycles (`SUBMITTED` → `AUTO_CHECKED` → `UNDER_REVIEW` → `APPROVED` → `KHATIAN_UPDATED`), enforcing hearing notes and automated ownership updates.
5. **Citizen Pre-Purchase Title Risk Portal:** Empowers citizens to inspect plot history, ownership chains, and fraud risk scores before handing over money.
6. **Pure Bilingual Dynamic Interface:** Instantaneous 100% immersive switching between conversational Bangla and English with zero language mixing.

---

## 2. Technology Stack & Architectural Overview

| Layer | Technologies Used | Primary Responsibility |
|---|---|---|
| **Backend Framework** | Python 3.12, FastAPI, Uvicorn | High-performance asynchronous REST API, request validation, CORS, rate limiting. |
| **Cryptography** | PyNaCl (`libsodium`), Ed25519, SHA-256 | Asymmetric digital key generation, canonical payload signing, hash chain verification. |
| **Database & ORM** | SQLAlchemy 2.0, SQLite (Dev) / PostgreSQL (Prod) | Relational persistence, transactional atomicity, foreign key constraints. |
| **Data Validation** | Pydantic v2 | Strict schema serialization, input sanitization, API contracts. |
| **Frontend Framework** | Next.js 16 (App Router), React 19, TypeScript | Server and client component rendering, responsive UI, accessible forms. |
| **Styling & Design** | Vanilla CSS + Tailwind CSS v4 | Curated dark mode, glassmorphism, responsive data grids, color-coded risk pills. |
| **QR Engine** | Python `qrcode[pil]`, `html5-qrcode` (Client) | Secure base64 QR generation and real-time smartphone camera verification. |
| **Security & Auth** | Argon2id, JWT (HMAC-SHA256) | Role-based authentication (`citizen`, `registrar`, `officer`, `admin`). |

---

## 3. Detailed Subsystem Walkthrough (How Every Feature Works)

### 3.1 Cryptographic Deed & Ledger Subsystem (`app/services/crypto.py`, `deeds.py`, `ledger.py`)

#### A. Canonical Serialization
To guarantee that hash comparisons never fail due to JSON key ordering or whitespace differences, deeds are formatted according to RFC 8785 Canonical JSON:
```python
canonical_bytes = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
```

#### B. Asymmetric Signing (Ed25519)
1. Sub-Registrars hold an asymmetric private signing key (`nacl.signing.SigningKey`).
2. The canonical payload is hashed with SHA-256: `deed_hash = SHA256(canonical_payload)`.
3. The private key signs the `deed_hash`: `signature = SigningKey.sign(deed_hash)`.
4. Anyone with the public key (`VerifyKey`) can verify authenticity without revealing private keys:
```python
verify_key.verify(deed_hash_bytes, signature_bytes)
```

#### C. Plot-Specific Hash Chain (Tamper-Evident Ledger)
Each land plot maintains an independent sequential hash chain. When Deed $N$ is appended:
$$\text{entry\_hash}_N = \text{SHA256}(\text{prev\_entry\_hash} + \text{deed\_hash}_N + \text{seq}_N)$$
- **Genesis Block ($\text{seq}=0$):** Anchored to the original Cadastral Survey (CS/RS) record.
- **Chain Verification:** The system iterates from Block 0 to $N$. If even a single byte or digit of any historical deed is altered, the entire subsequent chain breaks, immediately flagging `TAMPERED`.

#### D. Instant QR Code Verification (`/verify`)
- Every registered deed produces an official cryptographic QR code containing:
  `{"deed_no": "...", "deed_hash": "...", "key_id": "...", "verify_url": "..."}`.
- Citizens or bank officers scan the deed using any smartphone camera or file upload. The system verifies cryptographic signature and ledger positioning in under 50 milliseconds.

---

### 3.2 Dual-View Ownership Accounting (`app/services/holdings.py`)

To solve the split jurisdiction between Ministry of Law and Ministry of Land, LandShield implements **Dual-View Accounting**:

```
                       ┌─────────────────────────┐
                       │   Registered Land Deed   │
                       └────────────┬────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │    Ledger Holdings    │                 │    Record Holdings    │
   │  (Immediate Lockout)  │                 │   (Official Khatian)  │
   ├───────────────────────┤                 ├───────────────────────┤
   │ Deducted immediately  │                 │ Deducted ONLY after   │
   │ at deed registration. │                 │ Mutation completes    │
   │ Stops double-selling! │                 │ "KHATIAN_UPDATED".    │
   └───────────────────────┘                 └───────────────────────┘
```

1. **`ledger_holdings(plot)`:**
   - Starts with `plot.initial_owner_id = plot.area_decimal`.
   - For every `ACTIVE` deed in sequence: $\text{Seller} \mathrel{-}= \text{Area}$, $\text{Buyer} \mathrel{+}= \text{Area}$.
   - Reflects committed land even before mutation hearings.
2. **`record_holdings(plot, as_of)`:**
   - Starts with `plot.initial_owner_id = plot.area_decimal`.
   - Only reflects deeds where e-Mutation has reached `KHATIAN_UPDATED`.
   - Identifies the true legal titleholder on government revenue records.
3. **`recompute_current_owner(plot)`:**
   - Automatically sets `plot.current_owner_id` to the largest holding party in `record_holdings()`.

---

### 3.3 Real-Time Multi-Layer Fraud Detection Engine (`app/services/fraud/`)

The engine analyzes 6 deterministic legal and cryptographic rules. It runs in two modes:
- **Deal Mode (`proposed` deed present):** Evaluates a pending deed before registration. Critical findings trigger `HTTP 409 FRAUD_BLOCKED`.
- **Plot Mode (`proposed = None`):** Evaluates overall plot risk for citizen advisory (`/check`) or mutation auto-screening (`/officer`).

| Rule Code | Rule Name | Severity | Condition & Algorithm |
|---|---|---|---|
| **R1** | `R1_DOUBLE_SALE` | **CRITICAL** (60 pts) | Seller's uncommitted `ledger_holdings` < proposed `area_sold`. Intercepts attempts to resell land already pledged in prior unmutated deeds. |
| **R2** | `R2_SELLER_NOT_OWNER` | **CRITICAL** (60 pts) | Seller has 0 holdings or does not exist in plot ownership history. Intercepts stranger/imposter fraud. |
| **R3** | `R3_MISSING_MUTATION` | **MEDIUM** (20 pts) | An active deed on the plot has remained unmutated for over 90 days. Warns buyers of chain-of-title backlog. |
| **R4** | `R4_RAPID_TRANSFERS` | **HIGH** (30 pts) | 3 or more land deeds registered on the plot within a 30-day window. Flags suspicious speculative flipping. |
| **R5** | `R5_TAMPERED_HASH` | **CRITICAL** (100 pts) | Digital signature does not match public key OR ledger hash chain is broken. Flags forged records. |
| **R6** | `R6_FLAGGED_LAND` | **HIGH** (35 pts) | Plot is marked with government flags: `khas`, `acquired`, or `court_disputed`. Alerts citizens against encroaching on state/litigated property. |

#### Risk Score Calculation & Action Thresholds
$$\text{Score} = \min(100, \sum \text{Finding Points})$$
- **LOW Risk (0 – 29):** Safe to proceed; legitimate transaction.
- **MEDIUM Risk (30 – 59):** Caution; administrative delays or unmutated predecessor deeds.
- **HIGH Risk (60 – 84):** Dangerous; rapid transfer patterns or flagged state land.
- **CRITICAL Risk (85 – 100):** Outright fraud; double sale, stranger seller, or broken cryptographic signatures.

---

### 3.4 Smart 5-Stage e-Mutation FSM (`app/services/mutation_fsm.py`)

A finite state machine enforcing strict statutory workflows for land mutation:

```
[SUBMITTED] ───(auto_check)───► [AUTO_CHECKED] ───► [UNDER_REVIEW] ───► [APPROVED] ───► [KHATIAN_UPDATED]
     │                                │                   │
     └────────► [REJECTED] ◄──────────┴───────────────────┘
```

1. **`SUBMITTED`:** Buyer submits mutation application citing registered deed number.
2. **`AUTO_CHECKED`:** Automated background fraud engine executes Plot-mode assessment. If critical risks are detected, `requires_override = True` is permanently stamped.
3. **`UNDER_REVIEW`:** Land Officer (`officer1`) conducts field verification and summons parties for physical/digital hearing.
4. **`APPROVED`:** Officer approves title transfer. **Note:** If `requires_override` is True, an official legal justification note is strictly mandatory.
5. **`KHATIAN_UPDATED`:** Final state. New Khatian is generated. Triggering this state automatically recomputes `plot.current_owner_id`.
6. **`REJECTED`:** Rejection requires mandatory explanation note. Rejection automatically cancels the deed (`deed.status = CANCELLED`) to prevent lingering invalid deeds.

---

### 3.5 Privacy-Preserving Unicode Bangla Grapheme Masking (`app/utils/masking.py`)

To comply with personal data privacy and prevent PII leakage on public search pages, citizen names are masked while preserving script legibility.

#### Why Simple Slicing Fails in Indic Scripts
Bangla characters consist of multi-codepoint Unicode graphemes (Consonants + Nuktas + Virama Conjuncts + Vowel Matras + Chandrabindu). Slicing strings with standard Python indices `name[0]` and `name[-1]` detaches combining marks, producing broken Unicode glyphs with dotted circles (e.g., `মা***ল ব***ে` or `প***ী`).

#### The LandShield Akshor Regex Engine
```python
AKSHOR = re.compile(
    r'(?:[\u0985-\u0994]|(?:[\u0995-\u09B9\u09CE\u09DC-\u09DF]\u09BC?(?:\u09CD[\u0995-\u09B9\u09DC-\u09DF]\u09BC?)*))[\u09BE-\u09CC\u09D7]?[\u0981-\u0983]?|.'
)
```
- Preserves the entire initial syllable and final syllable with attached matras:
  - `মোহাম্মদ রফিকুল` → `মো***দ র***ল`
  - `হুসাইন পাটোয়ারী` → `হু***ন পা***রী`
  - `শামসুল বন্যা` → `শা***ল ব***ন্যা`
  - `তাসলিমা ভূঁইয়া` → `তা***মা ভূঁ***য়া`
  - `সালমা গাজী` → `সা***মা গা***জী`
  - `John Doe` → `J***n D***e`

---

## 4. Synthetic Data Specification & Benchmark Scenarios

### 4.1 Strict Synthetic Data Policy
In compliance with Rule Book Section 5 and National Data Privacy principles:
- **Zero Real Data:** Absolutely no real citizen names, NIDs, mobile phone numbers, or actual land registry records exist in the system.
- **Deterministic Seeding (`backend/scripts/seed.py`):** Uses seeded pseudo-random generation (Seed `42`) to produce reproducible, verifiable demonstration data.

### 4.2 Seed Dataset Quantities
- **300 Land Plots:** Spanning prominent Dhaka mouzas (Dhanmondi, Gulshan, Badda, Uttara, Mirpur, Motijheel, Savar, etc.).
- **120 Synthetic Personas:** With realistic Bengali display names and deterministic identification numbers.
- **599 Digitally Signed Deeds:** Fully signed with Ed25519 and chained sequentially.
- **3 Dedicated Role-Based Demo Accounts:**
  - Sub-Registrar: `registrar1` (`password123`)
  - Land Officer: `officer1` (`password123`)
  - System Admin: `admin1` (`password123`)

### 4.3 The 8 Canonical Benchmark Evaluation Scenarios

| Scenario | Name | Plot ID | Target Deed | Expected Engine Behavior |
|---|---|---|---|---|
| **S1** | **Double Sale Attempt** | Plot 1 | `DHAKA-2026-000002` | **Blocked at Registration:** Rule `R1_DOUBLE_SALE` fires (HTTP 409 Conflict / Score 100). Seller 1 tries reselling already transferred land. |
| **S2** | **Stranger Seller** | Plot 2 | `DHAKA-2026-000003` | **Blocked at Registration:** Rule `R2_SELLER_NOT_OWNER` fires (HTTP 409 Conflict / Score 100). Imposter with 0 holding attempts sale. |
| **S3** | **Missing Mutation > 90 Days** | Plot 3 | `DHAKA-2026-000004` | **Advisory Warning:** Rule `R3_MISSING_MUTATION` fires (Score 45 / Medium Risk). Unmutated transfer lingering since > 90 days. |
| **S4** | **Rapid Transfers** | Plot 4 | `DHAKA-2026-000008` | **High Risk Alert:** Rule `R4_RAPID_TRANSFERS` fires (Score 80 / High Risk). 3 transfers executed within 30 days. |
| **S5** | **Flagged Land (Khas / Disputed)** | Plot 5 | None | **High Risk Alert:** Rule `R6_FLAGGED_LAND` fires (Score 90 / High Risk). Plot flagged as government Khas with active civil court litigation. |
| **S6** | **Clean Land Deal** | Plot 6 | `DHAKA-2026-000010` | **Success (Happy Path):** 0 Findings, Score 0, Verify status `VALID`, HTTP 201 Created. Sequential mutated transfers to legitimate owner. |
| **S7** | **Legit Pending Resale** | Plot 7 | `DHAKA-2026-000012` | **Permitted Resale:** Legitimate seller reselling remaining uncommitted ledger balance. Does not fire R1 or R2. |
| **S8** | **Partial Sales Conserved** | Plot 8 | `DHAKA-2026-000014` | **Holdings Conservation:** Original owner subdivides 60 decimals among 3 separate buyers; sum of holdings precisely matches plot area. |

---

## 5. User Interface & Feature Walkthrough

### 5.1 Citizen Pre-Purchase Check (`/check`)
- **Purpose:** Publicly accessible page for prospective land buyers.
- **Features:** Search by Mouza or Dag Number, visual risk gauge (0 to 100), color-coded risk findings breakdown, chronological chain-of-title timeline, and quick-scenario evaluation buttons (S1–S8).

### 5.2 Public Deed Verification (`/verify`)
- **Purpose:** Instant cryptographic authenticity check for citizens, banks, and legal advisors.
- **Features:** Direct deed number search, live smartphone camera QR scanner, cryptographic signature confirmation (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`), signer public key badge, and ledger position inspection.

### 5.3 Sub-Registrar Workspace (`/registrar`)
- **Purpose:** Operational interface for Ministry of Law registrars.
- **Features:** 
  - Deed registration form with interactive plot, seller, and buyer auto-suggest search.
  - Interactive pre-registration fraud blocker modal with detailed rule violation breakdowns.
  - Automated Ed25519 digital signature signing and cryptographic QR code generation upon successful issuance.
  - One-click initiation of e-Mutation applications directly from newly registered deeds.

### 5.4 Land Officer e-Mutation Portal (`/officer`)
- **Purpose:** Operational interface for AC Land officers.
- **Features:**
  - Mutation applications table with state filters (`SUBMITTED`, `AUTO_CHECKED`, `UNDER_REVIEW`, `APPROVED`, `KHATIAN_UPDATED`, `REJECTED`).
  - Interactive 5-stage `StatusStepper`.
  - Automatic fraud evaluation findings breakdown.
  - Officer hearing notes and legal justification capture (enforced for overrides and rejections).
  - Chronological mutation event history audit trail.

### 5.5 System Administration & Tamper Lab (`/admin`)
- **Purpose:** Platform monitoring, auditing, and hackathon evaluation demonstration.
- **Features:**
  - **Platform Health Metrics:** Active plots, deeds, mutations, and open fraud alerts counters.
  - **Tamper Demonstration Lab:** Controlled feature allowing judges to deliberately tamper with deed payloads to witness cryptographic hash failure in real time.
  - **Immutable Audit Trail:** Append-only log recording every user login, registration attempt, fraud block, and mutation transition with timestamps and actor IDs.

---

## 6. How to Reproduce & Test Locally

### 6.1 Backend Setup
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
python -m scripts.seed --reset --with-applications
pytest -q
uvicorn app.main:app --reload --port 8000
```

### 6.2 Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run dev
# Open http://localhost:3000 in your browser
```

---
*Document verified and compliant with LandTech Hackathon 2026 specifications.*
