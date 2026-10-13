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

## [Phase 2 - Planned Roadmap (Final Round)]
- **Feature Flags:** Runtime toggleable features via `GET /api/v1/features` (`FEATURE_RECONCILE`, `FEATURE_LINEAGE`, `FEATURE_OFFLINE_QR`, `FEATURE_AGENT`, `FEATURE_TRANSPARENCY`, `FEATURE_ML`, `FEATURE_OCR`).
- **Reconciliation Layer (R8):** Cross-office discrepancy detection (`OWNER_MISMATCH`, `MUTATION_STALLED`, `AREA_NOT_CONSERVED`).
- **Survey Lineage Graph (R7):** Directed acyclic graph across survey generations (CS -> SA -> RS -> BS).
- **Offline Browser QR Verification:** Client-side Web Crypto API Ed25519 verification without server connectivity.
- **AI Due-Diligence Agent:** Deterministic fact extraction with schema-validated Bangla summary generation.
- **Merkle Transparency Log:** Daily cryptographic root of all ledger transactions published publicly.
- **Advisory Machine Learning:** LightGBM + SHAP anomaly detection model trained on synthetic records.
