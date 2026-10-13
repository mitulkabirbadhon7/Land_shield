# LandShield — System Architecture & Design

**Event:** LandTech Innovation Hackathon 2026  
**Document Status:** System Architecture Specification (Round 1 & Phase 2 Alignment)

---

## 1. High-Level System Architecture

LandShield is structured as a modular, layered verification platform designed to bridge the trust gap between deed registration (Sub-Registry office) and land mutation (AC Land office) in Bangladesh.

```text
========================================================================================
                          LANDSHIELD SYSTEM ARCHITECTURE
========================================================================================

 [ Citizen Buyer ]      [ Sub-Registrar ]      [ AC Land Officer ]      [ System Admin ]
  (Pre-Purchase)          (Deed Registry)      (Mutation Stepper)        (Tamper Lab)
        |                       |                       |                      |
        +-----------------------+-----------------------+----------------------+
                                            |
                                 HTTPS (TLS 1.3) / JSON
                                            v
+--------------------------------------------------------------------------------------+
|                               PRESENTATION TIER                                      |
|  Next.js 16 (App Router) + TypeScript + Tailwind CSS                                 |
|  * Bilingual Localization (Bangla `bn.json` / English `en.json`)                     |
|  * Live Camera QR Scanner (`html5-qrcode` over HTTPS)                                |
|  * 0–100 Circular Risk Gauge & Masked Ownership Chain Timeline                       |
+--------------------------------------------------------------------------------------+
                                            |
                                    REST API (/api/v1)
                                            v
+--------------------------------------------------------------------------------------+
|                               APPLICATION TIER                                       |
|  FastAPI (Python 3.11) + Uvicorn ASGI Server                                         |
|                                                                                      |
|  [ Security & Middleware ]                                                           |
|  * JWT HS256 Token Auth & RBAC (Registrar, Officer, Admin)                           |
|  * `slowapi` IP Rate Limiting (60/min general, 10/min login)                         |
|  * OWASP Security Headers (nosniff, DENY, X-Data-Policy: synthetic-demo)             |
|                                                                                      |
|  [ Core Services & Workflows ]                                                       |
|  * Deed Lifecycle Service (`app/services/deeds.py`)                                  |
|  * e-Mutation Finite State Machine (`app/services/mutation_fsm.py`)                  |
|  * Masking Utility (`app/utils/masking.py` — masks Bangla & Latin names)             |
|  * Append-Only Audit Logging (`app/models/audit_log.py`)                             |
+--------------------------------------------------------------------------------------+
                                            |
                                            v
+--------------------------------------------------------------------------------------+
|                           HYBRID LAYERED FRAUD ENGINE                                |
|  Deterministic engine evaluating transactions and plots before database persistence |
|                                                                                      |
|  +--------------------------------------------------------------------------------+  |
|  | Layer 1: Cryptographic Integrity (`IntegrityLayer`)                            |  |
|  | * Ed25519 digital signature verification over canonical payload                |  |
|  | * Per-plot SHA-256 hash-chain continuity check walking back to genesis        |  |
|  | * Superseded deed and cancelled deed status detection                          |  |
|  +--------------------------------------------------------------------------------+  |
|  | Layer 2: Domain Rules (`RulesLayer`)                                           |  |
|  | * R1: Double Sale & Oversold Area Check (`sum(holdings) <= plot.area`)          |  |
|  | * R2: Seller Not Recorded Owner Verification                                   |  |
|  | * R3: Unmutated Active Deeds Older than 90 Days Alert                           |  |
|  | * R4: Rapid Suspicious Transfers (3+ transfers within 30 days)                 |  |
|  | * R6: Flagged Land (Khas, acquired, or disputed plots with open court cases)   |  |
|  +--------------------------------------------------------------------------------+  |
|  | Layer 3: Bilingual Explanation & Risk Scoring Engine                           |  |
|  | * 0–100 Weighted Score calculation (LOW, MEDIUM, HIGH, CRITICAL)               |  |
|  | * Bilingual explanations mapping rule findings to plain Bangla & English       |  |
|  +--------------------------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------+
                                            |
                                            v
+--------------------------------------------------------------------------------------+
|                            CRYPTOGRAPHY & PERSISTENCE                                |
|                                                                                      |
|  [ Cryptographic Primitives ]                                                        |
|  * PyNaCl (libsodium Ed25519 asymmetric cryptography)                                |
|  * RFC 8785 Canonical JSON Serialization (sorted keys, compact delimiters)           |
|  * Persistent `SIGNING_KEY_HEX` loading with zero volume-loss risk                   |
|                                                                                      |
|  [ Database Tier ]                                                                   |
|  * PostgreSQL 15+ (Production / Cloud) | SQLite (Development)                        |
|  * SQLAlchemy 2 Object-Relational Mapper (ORM) with parameterized queries            |
+--------------------------------------------------------------------------------------+
```

---

## 2. Core Execution Flows

### Flow A: Deed Registration & Pre-Registration Fraud Blocking
1. Sub-Registrar submits proposed deed parameters via `POST /api/v1/deeds`.
2. Backend triggers `pre_register_check`:
   - Runs `RulesLayer` in `PROPOSED` mode.
   - Evaluates whether seller holds uncommitted decimals on the plot.
   - If findings include critical violations (e.g. `R1_DOUBLE_SALE` or `R2_NOT_OWNER`), the engine raises `FraudBlocked`.
   - Returns **HTTP 409 Conflict** with detailed findings and automatically logs an open `Alert`. No deed is saved.
3. If clean:
   - Payload is normalized into canonical UTF-8 bytes.
   - Deed hash is calculated: `SHA-256(canonical_payload)`.
   - Registrar's private Ed25519 key signs the hash: `Ed25519.sign(sk, deed_hash)`.
   - New `LedgerEntry` is appended to the plot's hash chain: `entry_hash = SHA-256(prev_hash || deed_hash || seq || registered_at)`.
   - Transaction commits atomically; QR code is generated.

### Flow B: Public Deed Verification
1. Citizen, surveyor, or bank scans deed QR code or queries `GET /api/v1/deeds/{deed_no}/verify`.
2. Backend loads deed by `deed_no`.
3. Verifies canonical payload hash matches stored `deed_hash`.
4. Derives registrar public key and verifies Ed25519 digital signature.
5. Walks the plot's ledger entries from genesis to current sequence checking every intermediate hash link.
6. Evaluates deed status (`CANCELLED`, `SUPERSEDED`, or `VALID`).
7. Returns verified response in under 50 milliseconds.
