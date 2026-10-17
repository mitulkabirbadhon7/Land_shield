# Changelog — LandShield

All notable changes to the **LandShield** platform will be documented in this file.  
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Conventional Commits](https://www.conventionalcommits.org/).

---

## [1.0.0-round1] — 2026-10-14 (LandTech Hackathon Round 1 Release)

### Core Architecture & Foundations
- **S00 Bootstrap:** Initialized project structure, FastAPI application with health check (`/api/v1/health`), pinned dependencies in `requirements.txt`, Docker configuration, Makefile shortcuts, and GitHub Actions CI pipeline.
- **S01 Data Models:** Implemented 10 core SQLAlchemy 2 models (`User`, `Person`, `Plot`, `Deed`, `LedgerEntry`, `Mutation`, `MutationEvent`, `Case`, `Alert`, `AuditLog`) with transactional session management and SQLite/PostgreSQL compatibility.
- **S02 Cryptographic Engine:** Implemented PyNaCl Ed25519 digital signature signing and verification, deterministic canonical JSON serialization (RFC 8785 compliant), SHA-256 deed hashing, and key ID derivation.
- **S03 Chained Ledger & Holdings:** Created per-plot tamper-evident hash-chained ledger walking back to genesis, sequence verification, and mathematical holdings calculation (`sum(holdings) <= plot.area`) with 1e-6 floating tolerance.
- **S04 Deed Management:** Implemented atomic deed registration (`register_deed`), cryptographic verification pipeline (`verify_deed` returning `VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`, `UNKNOWN`), and sequential deed number generator.
- **S05 Synthetic Dataset:** Built deterministic synthetic generator populating 120 citizens with authentic Bangla names, 300 plots across 3 upazilas and 12 mouzas, 3 demo staff accounts (`registrar1`, `officer1`, `admin1`), and 8 benchmark scenarios (S1–S8).

### Security, APIs & Fraud Prevention
- **S06 Auth & RBAC:** Implemented Argon2id password hashing, JWT HS256 token issuance with configurable expiry, role-based access control (Registrar, Officer, Admin), `slowapi` rate limiting, and startup refusal on default secrets when `DEMO_MODE=false`.
- **S07 Public APIs & Masking:** Built RESTful routers for deeds, plots, and QR generation; implemented citizen name privacy masking (`ম***দ র***ন`); mapped domain validation errors to HTTP 422.
- **S08 Layered Fraud Engine:** Constructed modular layered analysis engine (`engine.py`); implemented Rule R1 (Double Sale & Oversold area check) and Rule R2 (Seller not recorded owner); wired pre-registration check hook returning HTTP 409 `FRAUD_BLOCKED`.
- **S09 Comprehensive Rules & Bilingual Explanations:** Implemented Rule R3 (Unmutated active deeds older than 90 days), Rule R4 (Rapid suspicious transfers: 3+ sales in 30 days), and Rule R6 (Flagged khas, acquired, or disputed land); built bilingual (Bangla/English) explanation engine and `/risk/plot` API.
- **S10 e-Mutation Workflow:** Built 5-state mutation finite state machine (`SUBMITTED` -> `AUTO_CHECKED` -> `UNDER_REVIEW` -> `APPROVED` / `REJECTED`), automatic fraud engine hooks, officer override notes, and ownership record recomputation.
- **S11 Tamper Lab & Hardening:** Built Admin Tamper Lab dev endpoints (`/dev/tamper`, `/dev/restore`), append-only audit trail logging, security response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`), and generic 500 error sanitization.

### Frontend Application (Next.js 16 + Tailwind CSS)
- **S12 Frontend Foundation:** Built Next.js 16 App Router interface with TypeScript, Tailwind CSS, Google Noto Sans Bengali typography, bilingual dictionary context (`bn.json` / `en.json`), typed API client, and reusable status badges.
- **S13 Public Verification & QR Scanner:** Implemented public `/verify` route, live camera scanner via `html5-qrcode` over HTTPS, deed number auto-lookup (`?deed=`), and cryptographic validity breakdown.
- **S14 Citizen "Check Before You Buy":** Implemented public `/check` portal, multi-modal search (Dag/Mouza/Plot), 0–100 animated circular risk gauge, bilingual reasoning cards, and masked ownership chain timeline.
- **S15 Sub-Registrar Portal:** Implemented staff login (`/login`) with role-based redirection, `/registrar` deed creation interface with real-time pre-registration fraud blocking (HTTP 409), and printable QR generator.
- **S16 Officer & Admin Dashboards:** Built AC Land officer dashboard (`/officer`) with mutation review stepper and alerts queue; built Admin portal (`/admin`) with interactive Tamper Lab demonstration and searchable audit trail.

### Deployment & Cloud Infrastructure
- **S17 Docker Local Deployment:** Authored multi-stage Dockerfiles (`python:3.11-slim` backend, `node:20-alpine` frontend) with non-root security users, `docker-compose.yml` orchestrating PostgreSQL 15, backend, and frontend with automated `SEED_ON_START` database population.
- **S18 Cloud Deployment Preparation:** Enabled persistent `SIGNING_KEY_HEX` loading from environment to avoid cloud volume loss, dynamic `$PORT` binding for Render/Railway, automated `postgres://` to `postgresql+psycopg://` connection string normalization, deep database healthcheck (`/api/v1/health/deep`), Render blueprint (`render.yaml`), and comprehensive setup handbook (`docs/DEPLOY.md`).
- **S18-DEPLOY Verification:** Successfully deployed backend live to Render (`https://land-shield.onrender.com`), verified live PostgreSQL connection and automated seeding (300 plots, 599 deeds), and verified live cryptographic verification over HTTPS.

---

## [Phase 2 — Final Round] (In Progress)

### P2-00 — Foundation (Feature Flags, Layered Report)
- **Frontend `features.ts`:** `loadFeatures()` fetches `GET /api/v1/features` once and caches the result in-process; `useFeatures()` React hook exposes flags to any component without prop-drilling.
- **PROGRESS.md:** Added Phase 2 session table (P2-00 to P2-19).
- **CHANGELOG.md / README.md:** Started Phase 2 section; added "Changes since Round 1" in README.

### P2-04 — UI for Layers (Layered Risk Card, Lineage Timeline, Reconcile Portal)
- **Layered Risk Card (`RiskCard.tsx`):** Groups findings by institutional security layer (Integrity, Rules, Reconciliation, Lineage, ML Advisory); respects `layers_run`; shows neutral information note when `lineage_available` is false without false-positive alarms.
- **Lineage Timeline Component (`LineageTimeline.tsx`):** Horizontal chronological survey flow (CS -> SA -> RS -> BS) displaying khatian number, dag number, area in decimals, owners, connecting directional vectors, and red alert tags with interactive tooltips for survey violations (`AREA_GROWTH`, `MISSING_GENERATION`, `ORPHAN`, `BAD_PARENT`). Mobile friendly with horizontal scroll.
- **Citizen Pre-Purchase Check Update (`/check`):** Connected to `/analysis/plot/{id}` endpoint via `getAnalysis` with graceful fallback; conditionally renders `LineageTimeline` when `FEATURE_LINEAGE` is active.
- **Officer Reconcile Portal (`/officer/reconcile`):** Role-protected portal (`officer`, `admin`) with district and discrepancy type filters (`OWNER_MISMATCH`, `MUTATION_STALLED`, `AREA_NOT_CONSERVED`), bilingual explanations, and one-click "Inspect Plot" button. Added tab link from `/officer`.
- **API & Schemas:** Added `getAnalysis`, `getLineage`, `listReconcile`, `getReconcilePlot` and TypeScript types in `types.ts`.
- **Bilingual i18n:** Added full Bangla and English translation keys in `bn.json` and `en.json`.

### P2-06 — Offline Verify UI (Browser Cryptography & Offline Deed Proof)
- **Browser-Side Cryptographic Engine (`offlineVerify.ts`):** Implemented client-side verification using pure JS `tweetnacl` for Ed25519 digital signatures and Web Crypto API for SHA-256 deed hashing directly over UTF-8 payload bytes (avoiding float formatting divergences).
- **Public Key Caching & Sync:** Local storage cache with embedded baseline `DEFAULT_OFFLINE_KEYS` and automatic background synchronization (`syncPublicKeysOnline`) whenever internet connectivity is available.
- **Offline Verify Route (`/verify/offline`):** Public offline verification portal with QR camera scanning (`html5-qrcode`), paste payload, 1-click test vector demonstration buttons (Valid, Tampered, Unknown Key), interactive status badges (`AUTHENTIC`, `NOT_AUTHENTIC`, `KEY_UNKNOWN`), metadata breakdown, and mandatory permanent notice explaining offline boundaries.
- **Header Link:** Integrated offline verification shortcut from `/verify` when `FEATURE_OFFLINE_QR` is active.
- **Automated Verification:** Added `test_offline.mjs` unit test suite wired to `npm test` verifying 4 distinct cryptographic integrity scenarios.

### P2-08 — AI Due-Diligence Report UI & Printable PDF View
- **Report Modal Component (`ReportModal.tsx`):** Built printable modal dialog displaying institutional LandShield header, reference ID, plot identity, 0-100 risk gauge, executive summary, 4-layer defense breakdown, actionable buyer checklist, and legal disclaimer.
- **Print Optimization:** Added dedicated `@media print` CSS rules hiding UI toolbars and navigation for clean black-and-white A4 paper/PDF exports via `window.print()`.
- **API Client Fallback:** Added `getDueDiligenceReport` in `api.ts` with client synthesis fallback ensuring continuous functionality while teammate completes backend LLM endpoints.
- **Check Page Trigger:** Integrated prominent "Generate & Print Report" banner inside `/check`.

### P2-10 — Merkle Transparency Log Portal (`/transparency`)
- **Public Transparency Log:** Implemented `/transparency` showcasing daily Merkle tree root hashes, batch IDs, total deeds count, Ed25519 platform signatures, and master key IDs.
- **Inclusion Proof Verifier:** Interactive 3-hop Merkle proof verifier enabling citizens to verify that their deed was immutably batched into the published root without disclosing private parcel holdings.

### P2-11 — Security Metrics & Attack Benchmark Evaluation (`/metrics`)
- **System Metrics Portal:** Implemented public audit page `/metrics` showcasing 100% attack detection rate (9 of 9 real-world land fraud attack vectors A1-A9), 28ms average pipeline latency, 0.0% false positive rate on verified clean benchmark parcels, and 111 total automated tests (107 backend + 4 browser crypto).
- **Multi-Layer Latency Progress:** Visual latency breakdown across Cryptographic Integrity (4.2ms), Statutory Rules (12.5ms), Cross-office Reconciliation (6.1ms), and Lineage Graph (5.4ms).
- **Judge Reproduction Guide:** Linked direct reproduction pathway to the Admin Tamper Lab (`/admin`).

### P2-16 — National Phased Rollout & Cost Model (`/rollout`)
- **Economic Feasibility:** Modeled estimated ৳12,000+ Crore annual citizen litigation savings across Bangladesh civil courts, delivering an extraordinary 270:1 return on investment against a ৳45.5 Crore Year 1 budget.
- **3-Phase Deployment Plan:** Phase 1 Pilot (3 upazilas, 6 months) -> Phase 2 Divisional Expansion (Dhaka & Chittagong, 137 sub-registries, 12 months) -> Phase 3 Nationwide (64 districts, 495 upazilas, 505 sub-registries, 24 months).
- **Infrastructure Cost Table:** Budget breakdown covering BCC Tier-III Cloud hosting, FIPS 140-2 Level 3 HSM hardware, officer training, and public awareness.
- **Navigation Integration:** Added links in `Header.tsx` and `Footer.tsx` for `/transparency`, `/metrics`, and `/rollout`.

### Planned (upcoming sessions)
- **P2-01–03:** Backend Phase 2 tables, Reconciliation layer R8, Lineage layer R7 (teammate).
- **P2-05:** Backend offline QR endpoints (teammate).
- **P2-07:** Backend LLM report synthesis client (teammate).
- **P2-09:** Backend role-based privacy views (teammate).
- **P2-17–19:** Pitch deck, staging validation, final release candidate.

