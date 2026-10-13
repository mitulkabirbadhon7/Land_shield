# LandShield - Progress Tracking Log

## Phase 1 Progress (Round 1)

| Session | Feature | Status | Notes |
|---|---|---|---|
| **S00** | Repo bootstrap, CI, health route | Done | Scaffold, Makefile, CI, docker-compose, initial tests ready |
| **S01** | Database and models | Done | All 10 SQLAlchemy 2 models, DB session, config, and unit tests passing |
| **S02** | Crypto service (PyNaCl Ed25519) | Done | Ed25519 signing/verify, canonical JSON, SHA-256 deed hashing |
| **S03** | Ledger, holdings and chain verification | Done | Per-plot hash chain, verify_chain, is_superseded, ledger_holdings, record_holdings (TRD 6B), recompute_current_owner |
| **S04** | Deed service (register + verify) | Done | register_deed, verify_deed, next_deed_no, DomainError, pre_register_check hook |
| **S05** | Seed script and scenarios | Done (40 tests) | Deterministic seed: 120 persons, 300 plots, 8 scenarios (S1-S8), argon2 demo accounts. S05-FIX: removed duplicate scripts/seed.py, added S7/S8 regression tests |
| **S06** | Auth + RBAC | Done (47 tests) | Argon2id, JWT HS256 tokens, RBAC deps (admin bypass, registrar, officer), slowapi rate limiting, insecure secret startup refusal |
| **S07** | Deed, QR and plot API | Done (56 tests) | POST /deeds (registrar), GET /deeds/{no}/verify (public), GET /deeds/{no}/qr (registrar), GET /plots/{id}, GET /plots/{id}/chain, GET /plots/search, name masking, DomainError 422 handler |
| **S08** | Fraud engine core + R1, R2, R5 + 409 handler | Done (68 tests) | Layered pipeline (engine, base, registry), IntegrityLayer (R5), RulesLayer (R1 oversold, R1 double sale, R2 seller not owner), pre_register_check hook, HTTP 409 FraudBlocked handler |
| **S09** | Rules R3, R4, R6 + explanations + risk API | Done (78 tests) | Rules R3, R4, R6, bilingual explanations (explain.py), public /risk/plot API, officer alerts management |
| **S10** | Mutation workflow | Done (85 tests) | Mutation FSM workflow, auto-check risk hooks, officer override, deed cancellation on rejection, holdings recomputation |
| **S11** | Tamper Lab, audit, masking, hardening | Done (91 tests) | Tamper Lab dev endpoints (/dev/tamper, /dev/restore), unified audit logging, security headers, rate limiting |
| **S12** | Frontend foundation | Done (build ok) | Next.js 16 (App Router, TS, Tailwind v4), Noto Sans Bengali font, custom i18n (BN/EN), typed API wrapper, StatusBadge, Card, Spinner, ErrorBox, landing page, CI frontend job |
| **S13** | Verify page + QR scanner | Done (build ok) | Public /verify route, URL query (?deed=) autoload, html5-qrcode live camera scanner, StatusBadge, deed & plot details, audit reasons, bilingual bn/en |
| **S14** | Citizen check page | Done (build ok) | Public /check route, multi-modal search (Dag/Mouza/Plot/Deed), RiskCard with circular gauge (0-100), bilingual findings from /risk/plot, ChainTimeline with masked buyers, badges for flags, mutation summary, benchmark scenarios helper |
| **S15** | Registrar page | Done (97 tests, build ok) | Backend GET /meta and GET /persons/search with RBAC; /login route with role redirect; /registrar deed creation portal with pre-registration fraud blocking (HTTP 409), QR generator & downloader, and mutation starter |
| **S16** | Officer + admin pages | Done (97 tests, build ok) | AC Land officer portal (/officer) with mutation review stepper & alerts management; Admin portal (/admin) with Tamper Lab demo and append-only audit trail |
| **S17** | Docker (local deploy) | Done (compose config validated statically; runtime proof skipped — Docker Desktop unavailable on authors' machine) | Multi-stage Dockerfiles, compose stack (db, backend, frontend), healthchecks, SEED_ON_START automated seeding, Makefile targets, LAN/mobile QR guide |
| **S18** | Cloud deploy preparation | Done (104 tests, build ok) | SIGNING_KEY_HEX loading, PORT dynamic binding, postgres:// normalization, /health/deep, render.yaml blueprint, docs/DEPLOY.md guide |
| **S19** | Docs, README, concept note draft | Pending | |
| **S20** | Final QA, security sweep, tag | Pending | |

### Session S03 Log
- **What was done:**
  - Implemented `backend/app/services/ledger.py`: `GENESIS`, `entry_ts`, `entry_hash`, `latest_entry`, `append_entry`, `verify_chain`, and `is_superseded`.
  - Implemented `backend/app/services/holdings.py`: `ledger_holdings`, `record_holdings`, `largest_holder`, and `recompute_current_owner` with 1e-6 floating tolerance.
  - Added unit test suites `backend/tests/test_ledger.py` and `backend/tests/test_holdings.py` covering hash chain verification, tampering detection, sequence gap detection, naive vs timezone-aware datetimes, unmutated resales, cancelled deeds, and `before_seq` / `as_of` filters.
- **Decisions:**
  - `entry_ts` strictly extracts the exact `registered_at` ISO string from `deed.payload_json` ensuring DB datetime serialization differences never invalidate cryptographic chain hashes.
  - Datetimes in `record_holdings` are normalized to UTC-aware datetimes for safe comparisons across naive SQLite and aware datetimes.
  - Tolerances of 1e-6 round near-zero balances cleanly to 0.0.
- **Known gaps:**
  - Deed registration, fraud check hooks, and verify endpoints will be integrated in S04 and S08.
- **Next session:** `S04` (`s04-deed-service`)

### Session S04 Log
- **What was done:**
  - Implemented `backend/app/errors.py`: defined `DomainError` for domain rule validation failures (to map to HTTP 422).
  - Implemented `backend/app/services/pipeline/hooks.py`: stub hook `pre_register_check` for S08 fraud integration.
  - Implemented `backend/app/services/deeds.py`: `next_deed_no` (sequential `CODE-YYYY-000001` format), `register_deed` (validations, payload canonicalization, SHA-256 hashing, Ed25519 signing, ledger entry creation), and `verify_deed` (ordered verification: unknown -> payload hash vs deed_hash -> key resolution -> Ed25519 signature -> ledger chain -> CANCELLED -> SUPERSEDED -> VALID).
  - Implemented unit tests in `backend/tests/test_deeds.py` (10 tests covering valid flow, payload tampering, signature mismatch, unknown key ID, superseded deeds, cancelled deeds, unknown deed numbers, domain validations, and DB datetime roundtrips).
- **Decisions:**
  - In `verify_deed`, cryptographic integrity (payload hash, signature, key ID, chain) is evaluated before checking `CANCELLED` status so tampered cancelled deeds still correctly report `TAMPERED`.
  - `register_deed` flushes entities within caller transaction and does not update `Plot.current_owner_id` (ownership is updated through mutation completion in holdings).
- **Known gaps:**
  - Public HTTP endpoints (`/deeds`, `/deeds/{deed_no}/verify`, QR generator) will be wired in S07; fraud engine rules will be added in S08.
- **Next session:** `S05` (`s05-seed`)

### Session S05 Log
- **What was done:**
  - Built deterministic synthetic dataset generator in `backend/scripts/seed.py` and top-level wrapper `scripts/seed.py`.
  - Created 3 demo users (`registrar1`, `officer1`, `admin1`) with Argon2 password hashes, documented in `docs/DEMO_ACCOUNTS.md`.
  - Created 120 synthetic personas with Bangla script names, 300 plots across 3 upazilas and 12 mouzas with unique dag numbers.
  - Implemented 8 canonical benchmark test scenarios (S1 double sale, S2 stranger seller, S3 unmutated deed > 90d, S4 rapid transfers, S5 khas/disputed with open case, S6 clean deal, S7 legit pending resale, S8 partial sales) in `data/scenarios/scenarios.json`.
  - Implemented unit tests in `backend/tests/test_seed.py` verifying counts, 100% ledger chain integrity across all 300 plots, cross-run determinism, and TRD 6B holding conditions for S1/S7/S8.
  - S05-FIX: removed duplicate root `scripts/seed.py`, standardized `data/scenarios/scenarios.json` to a dictionary mapping `{"S1": {...}, ..., "S8": {...}}`, and added explicit `test_s7_legit_pending_resale_holdings` and `test_s8_partial_sales_holdings_conserved` (40 passing tests).
- **Decisions:**
  - Seed reference date is fixed to `2026-10-01T10:00:00+00:00` with relative timestamp offsets, guaranteeing byte-identical hashes across runs.
  - CLI supports `--reset` to wipe and reseed; refuses without `--reset` if records exist.
- **Known gaps:**
  - Auth token issuance and login routes will be implemented in S06.
- **Next session:** `S06` (`s06-auth`)

### Session S06 Log
- **What was done:**
  - Implemented `backend/app/security.py`: Argon2id password hashing and verification via `argon2-cffi`, JWT access token issuance and decoding via `python-jose` HS256 with expiration from `settings.jwt_expire_minutes`.
  - Implemented `backend/app/deps.py`: `get_current_user` dependency extracting and validating Bearer tokens with DB lookup (and supporting optional tokens for endpoints with dual public/authenticated behavior), and `require_role(*roles)` enforcing role-based access control (RBAC) with HTTP 401 Unauthorized / HTTP 403 Forbidden.
  - Implemented `backend/app/api/v1/auth.py`: `POST /api/v1/auth/login` endpoint accepting `{username, password}` and returning `{access_token, token_type, role, name}`, rate-limited via `slowapi` (10 per minute), returning generic error messages to thwart user enumeration.
  - Wired auth router and `slowapi` rate limiter exception handler into `backend/app/main.py`.
  - Added startup safety check in `lifespan`: refuses startup with `RuntimeError` if `settings.jwt_secret == "change-me"` when `settings.demo_mode == False`.
  - Added test suite `backend/tests/test_auth.py` covering successful login, invalid credentials rejection, protected dummy route RBAC (401 without token, 403 wrong role, 200 correct role), expired token rejection, and startup refusal on default JWT secret in production mode.
  - S06-FIX: Added admin bypass to `require_role` in `app/deps.py` allowing admin to pass all role checks, added dynamic rate-limit configuration on `POST /api/v1/auth/login`, and added automated tests `test_admin_bypasses_role_checks` and `test_login_rate_limit` (47 total tests passing).
- **Decisions:**
  - `argon2.PasswordHasher` configured with standard recommended parameters.
  - Login failures return a generic `"Invalid username or password"` to prevent username enumeration attacks.
  - `get_current_user` gracefully returns `None` when no authorization header is provided so that future public endpoints can optionally identify the user without blocking unauthenticated requests.
  - `admin` users bypass all role constraints in `require_role`.
- **Known gaps:**
  - Deed registration, verification, and QR code public APIs will be connected to the router and protected endpoints in S07.
- **Next session:** `S07` (`s07-deed-api`)

### Session S07 Log
- **What was done:**
  - Implemented `backend/app/utils/masking.py`: `mask_name` for Bangla and Latin privacy masking keeping first and last characters of each word separated by `***`.
  - Implemented `backend/app/services/qr.py`: `qr_png` using `qrcode` library generating PNG bytes, and `build_qr_url` targeting `{frontend_url}/verify?deed={deed_no}&h={hash_prefix}`.
  - Implemented schemas in `backend/app/schemas/`: `DeedCreate`, `DeedOut`, `VerifyOut`, `DeedRegistrationResponse`, `PlotOut`, `ChainItem`.
  - Implemented `backend/app/api/v1/deeds.py`: `POST /deeds` (registrar-only, registers deed via service, commits, returns deed + verify status), `GET /deeds/{deed_no}/verify` (public verification), and `GET /deeds/{deed_no}/qr` (registrar-only PNG QR image).
  - Implemented `backend/app/api/v1/plots.py`: `GET /plots/{id}` (public masked summary), `GET /plots/{id}/chain` (public masked chronological ledger chain with verify statuses), and `GET /plots/search?mouza=&dag_no=` (public masked search).
  - Registered `DomainError` exception handler in `backend/app/main.py` mapping domain validation failures to HTTP 422 `{"code": "INVALID", "detail": ...}`.
  - Wired deed and plot routers into `backend/app/main.py` under `/api/v1`.
  - Added unit and API tests in `backend/tests/test_masking.py` and `backend/tests/test_api_deeds.py` (total 56 tests passing).
- **Decisions:**
  - Public deed and plot endpoints mask synthetic citizen names to protect privacy.
  - `POST /deeds` commits the transaction upon successful registration and refreshes the deed before returning.
  - `GET /deeds/{deed_no}/qr` requires registrar/admin credentials and delivers clean binary PNG image bytes.
- **Known gaps:**
  - Pre-registration fraud detection blocking (HTTP 409 `FRAUD_BLOCKED`) will be implemented in S08.
- **Next session:** `S08` (`s08-fraud-core`)

### Session S08 Log
- **What was done:**
  - Implemented `backend/app/services/pipeline/base.py`: defined `Finding`, `DealSubject`, `AnalysisContext` (with `mode`: `PROPOSED` vs `PLOT`), and abstract `Layer` class with `is_enabled` flag check.
  - Implemented `backend/app/services/pipeline/engine.py`: `assess` function implementing TRD 6A score capping (0-100), categorical levels (LOW, MEDIUM, HIGH, CRITICAL), decisive floor elevation, safe exception trapping per layer, and mode output properties (`blocked` in PROPOSED mode; `has_critical` in PLOT mode).
  - Implemented `backend/app/services/fraud/integrity.py`: `IntegrityLayer` enforcing R5 checks on ledger chain continuity, SHA-256 payload hash integrity, and Ed25519 signature validity.
  - Implemented `backend/app/services/fraud/rules.py`: `RulesLayer` building deal subjects and evaluating TRD 6B exact ownership conditions:
    * `R1_OVERSOLD`: sold area > plot area
    * `R1_DOUBLE_SALE`: `L[seller] < area_sold <= Rr[seller]`
    * `R2_SELLER_NOT_OWNER`: `L[seller] < area_sold` and `Rr[seller] < area_sold` (skipped when R1 fires)
  - Implemented `backend/app/services/pipeline/registry.py`: `LAYERS` list and `get_layers()`.
  - Implemented `backend/app/services/pipeline/hooks.py`: `pre_register_check` running pre-registration fraud assessment, persisting `Alert` and `AuditLog` rows upon critical violation, committing to DB, and raising `FraudBlocked`.
  - Implemented `backend/app/errors.py`: defined `FraudBlocked` exception carrying the detailed report.
  - Registered `FraudBlocked` exception handler in `backend/app/main.py` mapping to HTTP 409 Conflict `{"code": "FRAUD_BLOCKED", "report": ...}`.
  - Added test suite `backend/tests/test_fraud_engine.py` (12 tests) verifying engine capping, floor, layer failure tolerance, seeded scenarios S1, S2, S6, S7, S8, R5 hash tampering, and API POST /deeds 409 fraud blocking with alert persistence (68 tests passing total).
- **Decisions:**
  - Pre-registration check persists `Alert` and `AuditLog` records before raising `FraudBlocked` so that attempted fraud attempts are permanently tracked even though the deed is rejected.
  - `pre_register_check` receives `signer_key` from `register_deed` to ensure cryptographic integrity checks on existing deeds and context remain verified across test and production keys.
  - In `RulesLayer`, R2 is strictly suppressed when R1 fires for the same deal subject to prevent confusing double-alerting.
### Session S09 Log
- **What was done:**
  - Implemented remaining plot-level fraud detection rules in `backend/app/services/fraud/rules.py`:
    * `R3_MISSING_MUTATION`: Active deed older than `settings.mutation_days` (90 days) without completed mutation (`KHATIAN_UPDATED`) -> MEDIUM, weight 25, decisive.
    * `R4_RAPID_TRANSFERS`: Sliding window detecting $\ge 3$ active deed transfers within 30 days -> HIGH, weight 35, decisive.
    * `R6_FLAGGED_LAND`: Plot has governmental flags (`khas`, `acquisition`, `disputed`) or active court cases -> HIGH, weight 40, decisive.
  - Implemented natural bilingual explanations in `backend/app/services/fraud/explain.py`:
    * Native sentence templates in Bangla (`bn`) and English (`en`) for `OVERSOLD`, `DOUBLE_SALE`, `NOT_OWNER`, `MISSING_MUTATION`, `RAPID_TRANSFERS`, `FLAGGED_LAND`, and `INTEGRITY`.
    * Cleanly formats deed numbers when present (e.g. `দলিল DHAKA-2026-000002:` / `Deed DHAKA-2026-000002:`).
  - Implemented schemas in `backend/app/schemas/risk.py`:
    * `RiskFindingOut`, `MutationSummary`, `RiskReportOut` (with `has_critical`, score, level, findings, chain_ok, flags, mutation_summary, and no `blocked` field in PLOT mode).
    * `AlertOut`, `AlertUpdate`.
  - Implemented public risk assessment API in `backend/app/api/v1/risk.py`:
    * `GET /api/v1/risk/plot/{plot_id}?lang=bn|en` (public, masked risk report).
    * `GET /api/v1/analysis/plot/{plot_id}` (alias returning exact same body).
    * Mounted at both `/api/v1` and root prefixes.
  - Implemented alerts management API in `backend/app/api/v1/alerts.py`:
    * `GET /api/v1/alerts` (officer/admin only, filter by status and severity).
    * `PATCH /api/v1/alerts/{id}` (officer/admin only, updates status to `ACK`, `RESOLVED`, `DISMISSED`).
  - Added comprehensive integration tests in `backend/tests/test_risk_api.py` covering scenarios S1 through S8, bilingual text, public masking, and alerts RBAC (total 78 tests passing).
- **Decisions:**
  - `GET /risk/plot/{plot_id}` runs in PLOT mode and omits the `blocked` field while providing `has_critical` and granular bilingual findings.
  - Public risk assessment is fully open to citizens without authentication, exposing masked deed references and risk breakdowns while protecting personal PII.
  - Alert endpoints are strictly RBAC restricted to `officer` and `admin` roles.
### Session S10 Log
- **What was done:**
  - Implemented `backend/app/services/mutation_fsm.py`:
    * State machine `TRANSITIONS`: `SUBMITTED -> {AUTO_CHECKED, REJECTED}`, `AUTO_CHECKED -> {UNDER_REVIEW, REJECTED}`, `UNDER_REVIEW -> {APPROVED, REJECTED}`, `APPROVED -> {KHATIAN_UPDATED}`.
    * `transition`: Validates transitions, writes chronological `MutationEvent` records, creates structured `AuditLog` rows, enforces mandatory explanation notes for rejection, and enforces mandatory officer override notes when auto-check flags critical risk.
    * On `REJECTED`: Automatically marks the associated deed status as `CANCELLED` and writes an audit entry, excluding it from future holdings calculations.
    * On `KHATIAN_UPDATED`: Flushes the session and triggers `recompute_current_owner(db, plot)` to update official ownership using exact partial-sale conservation.
    * `start_mutation`: Ensures deed exists, is `ACTIVE`, has no existing open mutation, and creates the record in `SUBMITTED`.
    * `auto_check`: Evaluates plot risk via `assess` in `PLOT` mode, stores the analysis report in `auto_check_json`, flags `requires_override = True` if critical findings exist, and transitions state to `AUTO_CHECKED`.
  - Implemented `IllegalTransition` exception in `backend/app/errors.py` and registered handler in `backend/app/main.py` returning HTTP 409 Conflict with `{"code": "ILLEGAL_TRANSITION", "allowed": [...]}`.
  - Implemented schemas in `backend/app/schemas/mutations.py`: `MutationCreate`, `MutationTransition`, `MutationEventOut`, `MutationOut`.
  - Implemented mutation endpoints in `backend/app/api/v1/mutations.py`:
    * `POST /api/v1/mutations`: Registrar only, creates mutation and runs auto-check.
    * `POST /api/v1/mutations/{id}/transition`: Officer only, transitions state with note validation.
    * `GET /api/v1/mutations`: Officer/Admin only, lists mutations with optional `state` filter.
    * `GET /api/v1/mutations/{id}`: Public masked view with full chronological event steps (applicant name masked, `auto_check_json` hidden for public and visible for officers).
  - Wired `mutations.router` into `backend/app/main.py` under both `/api/v1` and root prefixes.
  - Added test suite `backend/tests/test_mutations.py` (7 tests) covering full sale happy path, partial sale owner preservation, 409 illegal transitions, override note requirements, rejection deed cancellation, duplicate open mutation refusal, and RBAC (total 85 tests passing).
- **Decisions:**
  - `POST /mutations` defaults `auto_check=True`, automatically advancing from `SUBMITTED` to `AUTO_CHECKED` upon creation while retaining full event history.
  - Rejection mandatorily cancels the underlying deed and creates an audit entry so disputed land rights are cleanly deactivated.
  - Public `GET /mutations/{id}` suppresses `auto_check_json` and masks applicant names to maintain citizen privacy.
### Session S11 Log
- **What was done:**
  - Implemented Tamper Lab demo endpoints in `backend/app/api/v1/dev.py`:
    * `GET /api/v1/dev/status`: Admin only, returns `{"demo_mode": bool}` (returns false when disabled so frontend hides panel).
    * `POST /api/v1/dev/tamper/{deed_no}`: Admin + `settings.demo_mode=True` only, modifies `payload_json` area by +1 without touching hash, signature, or ledger, stores original in `tamper_backup`, returns 409 `ALREADY_TAMPERED` if already tampered, logs `demo tamper`.
    * `POST /api/v1/dev/restore/{deed_no}`: Admin + `settings.demo_mode=True` only, restores original `payload_json` from `tamper_backup`, sets `tamper_backup=None`, returns 409 `NOT_TAMPERED` if not tampered, logs `demo restore`.
    * Strict refusal with HTTP 404 on tamper/restore when `DEMO_MODE=false`.
  - Implemented unified audit logging service in `backend/app/services/audit.py` with `log(db, actor, action, entity, entity_id, detail)`:
    * Wired into deed registration (`DEED_REGISTERED`), mutation state machine (`MUTATION_*`, `DEED_CANCELLED`), login authentication (`LOGIN_SUCCESS`, `LOGIN_FAILURE`), alert status triage (`ALERT_STATUS_UPDATE`), and dev tamper lab (`DEMO_TAMPER`, `DEMO_RESTORE`).
  - Implemented paginated audit log retrieval API in `backend/app/api/v1/audit.py`:
    * `GET /api/v1/audit` (Admin only) with pagination parameters (`limit`, `offset`, `page`, `size`).
  - Implemented security headers middleware in `backend/app/main.py`:
    * `X-Content-Type-Options: nosniff`
    * `X-Frame-Options: DENY`
    * `Referrer-Policy: strict-origin-when-cross-origin`
    * `X-Data-Policy: synthetic-demo`
  - Hardened error handling in `backend/app/main.py`:
    * Implemented generic 500 exception handler returning `{"code": "SERVER_ERROR"}` with no stack trace leakage.
    * Ensured typed exceptions (`FraudBlocked` 409, `DomainError` 422, `IllegalTransition` 409, and `HTTPException`) are strictly preserved.
  - Hardened rate limiting:
    * Applied slowapi rate limiting on public deed verification (`GET /deeds/{deed_no}/verify`) and staff login using dynamic `settings.RATE_LIMIT`.
  - Added comprehensive test suite `backend/tests/test_hardening.py` (6 tests) covering tamper/restore lifecycles, 404 on disabled demo mode, security headers, generic 500 preservation, audit logs, and rate limiting (total 91 tests passing).
- **Decisions:**
  - `GET /dev/status` returns `{"demo_mode": false}` rather than 404 when demo mode is disabled so the client UI can hide the dev panel cleanly.
  - Generic exception handler intercepts untyped exceptions while explicitly checking and passing through typed domain errors and HTTP exceptions.
- **Known gaps:**
  - Frontend foundation implemented in S12.
- **Next session:** `S12` (`s12-frontend-foundation`)

### Session S12 Log
- **What was done:**
  - Bootstrapped Next.js (TypeScript, Tailwind CSS v4, App Router, `src/` directory) in `frontend/`.
  - Configured Google Fonts: `Noto_Sans_Bengali` and `Inter` via `next/font/google` with responsive typography.
  - Implemented bilingual dictionary catalogs in `frontend/src/locales/bn.json` and `frontend/src/locales/en.json`.
  - Implemented lightweight custom i18n subsystem in `frontend/src/lib/i18n.tsx`: `LanguageProvider`, `useLanguage`, and nested key translation helper `t(key, fallback)` persisted in `localStorage`.
  - Implemented typed backend API client in `frontend/src/lib/api.ts` with error handling (`ApiError`), bearer token management (`localStorage`), and typed methods (`login`, `verifyDeed`, `getPlot`, `getChain`, `getRisk`, `searchPlots`). Types centralized in `frontend/src/lib/types.ts`.
  - Implemented reusable design system components in `frontend/src/components/`:
    * `StatusBadge.tsx`: distinct color-coded pill indicators for `VALID` (green), `TAMPERED` (red with pulse), `SUPERSEDED` (amber), `CANCELLED` (strike-through grey), and `UNKNOWN` (neutral grey).
    * `Card.tsx`: glassmorphic content cards with hover transitions, header actions, and footer slots.
    * `Spinner.tsx`: accessible animated circular SVG spinner with configurable sizes and labels.
    * `ErrorBox.tsx`: accessible alert banner with code badges and retry callback.
    * `Header.tsx`: sticky navigation bar with LandShield logo, links, role status, and interactive language toggle (BN/EN).
    * `Footer.tsx`: responsive footer with required `"Prototype - synthetic data"` notice.
  - Implemented comprehensive landing page in `frontend/src/app/page.tsx` featuring the 3 core CTAs ("Check a Plot", "Verify a Deed", "Officer Portal"), proof metrics, and security pillars.
  - Added route placeholders with responsive UI for `/verify`, `/check`, and `/login`.
  - Created `frontend/.env.example` and `frontend/.env.local`.
  - Updated root and frontend `README.md` with setup instructions.
  - Added `frontend-build` job to GitHub Actions CI (`.github/workflows/ci.yml`) running `npm ci`, `npm run lint`, and `npm run build`.
  - Verified static generation and production compilation via `npm run build` (all 7 routes prerendered with 0 errors).
- **Decisions:**
  - Custom React Context i18n (`src/lib/i18n.tsx`) was chosen over heavy external i18n packages to ensure zero-dependency client bundling and eliminate hydration mismatches.
  - Bangla (`bn`) is configured as the default locale on first visit to prioritize citizen access for Bangladesh land records.
  - Font pairing combines `Noto_Sans_Bengali` for Bengali script and `Inter` for Latin script.
- **Known gaps:**
  - Citizen check page (/check) with Mouza/Dag search and risk breakdown starts in S14.
- **Next session:** `S13` (`s13-verify-page`)

### Session S13 Log
- **What was done:**
  - Implemented the full public `/verify` page in `frontend/src/app/verify/page.tsx`:
    * Wrapped in React `<Suspense>` boundary for clean App Router static prerendering and hydration.
    * Automatically parses `?deed=` from URL search parameters (supporting direct QR scan redirection).
    * Provides an interactive deed number search input with quick sample deed pills (`MIR-2026-000001`, `MIR-2026-000002`, `MIR-2026-000003`).
    * Displays a prominent status banner using `StatusBadge` (with `VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`, `UNKNOWN`).
    * Shows plain-language bilingual explanation lines for each deed status.
    * Displays deed metadata and ledger chain position (`Seq #`).
    * Integrates plot summary (`Plot #`, Dag number, Mouza, Upazila, District, Area in decimals, Land type).
    * Lists audit observations and cryptographic failure details when tampered/invalid.
    * Provides quick action buttons to copy the verification link and navigate directly to the plot's risk analysis page (`/check?plot=...`).
  - Implemented live camera QR scanning modal in `frontend/src/components/QRScanner.tsx`:
    * Dynamic client-side import of `html5-qrcode`.
    * Built robust deed URL/parameter parser (`parseDeedFromQR`) handling full verification URLs (`?deed=...`), JSON payloads, and direct deed numbers.
    * User-friendly camera permission error handling and device absence messaging.
  - Added bilingual translation keys for all verification components and scanner prompts to `frontend/src/locales/bn.json` and `frontend/src/locales/en.json`.
  - Updated `VerifyOut` schema in `frontend/src/lib/types.ts` to support `chain_position` and optional fields.
  - Verified TypeScript compilation (`npx tsc --noEmit`) and production static build (`npm run build` succeeds in ~2.5s with all 7 routes).
  - Verified backend pytest suite (`91 passed in 72.52s`).
- **Decisions:**
  - Dynamic `html5-qrcode` import prevents SSR window/navigator reference errors during Next.js build.
  - If a deed verification returns a `plot_id`, the page asynchronously retrieves plot details without blocking the primary deed validity result.
  - Camera scanner automatically stops video capture and unmounts upon a successful QR decode.
- **Known gaps:**
  - Registrar deed registration page and staff login flow starts in S15.
- **Next session:** `S14` (`s14-citizen-page`)

### Session S14 Log
- **What was done:**
  - Implemented the full public pre-purchase citizen check page in `frontend/src/app/check/page.tsx`:
    * Wrapped in React `<Suspense>` boundary for static prerendering and error-free client hydration.
    * Multi-modal search supporting pure Plot ID (e.g. `1`), Mouza / Dag number queries, and Deed numbers (automatically looks up plot via `verifyDeed`).
    * Displays search result cards when multiple plots match, allowing one-click selection.
    * Directly loads plot details if visited with `?plot=...` URL parameter (e.g. from `/verify` cross-links).
  - Implemented interactive benchmark scenario helper:
    * Copied `data/scenarios/scenarios.json` to `frontend/public/scenarios.json`.
    * Rendered benchmark scenario buttons (`S1` Double Sale, `S2` Stranger Seller, `S3` Missing Mutation, `S4` Rapid Transfers, `S5` Khas/Disputed, `S6` Clean Deal, `S7` Legit Pending Resale, `S8` Partial Sales) with color-coded risk expectation pills.
  - Implemented `RiskCard.tsx` (`frontend/src/components/RiskCard.tsx`):
    * SVG circular progress ring visualizing the 0-100 risk score with dynamic stroke color (emerald, amber, orange, rose).
    * Large numeric score display and localized risk level banner (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
    * Plain-language citizen risk explanation in Bangla and English.
    * Government restrictions flags strip (`Khas land`, `Under acquisition`, `Active court cases` count, or `Clean`).
    * Structured findings list displaying rule ID badges, severity tags, weight contributions, deed references, and bilingual explanation text retrieved from `/risk/plot/{plot_id}?lang={bn|en}`.
    * Mutation summary progress breakdown (Total, Completed, Pending, Rejected).
  - Implemented `ChainTimeline.tsx` (`frontend/src/components/ChainTimeline.tsx`):
    * Chronological vertical ownership ledger line displaying each deed transfer on the plot.
    * Shows sequence number, timestamp, masked citizen buyer name, chain hash preview, and `StatusBadge`.
    * Provides direct clickable links to `/verify?deed={deed_no}` for instant cryptographic inspection of any link in the chain.
  - Added complete bilingual translation keys in `frontend/src/locales/bn.json` and `frontend/src/locales/en.json`.
  - Added prototype disclaimer notice banner on the page.
  - Verified static generation and production compilation via `npm run build` (all 7 routes prerendered with 0 errors).
  - Verified backend pytest suite (`91 passed in 136s`).
- **Decisions:**
  - Automatic language synchronization re-fetches risk findings from `/risk/plot` when the user toggles between Bangla and English so all findings match the active UI language.
  - Search query router automatically tries Plot ID, Deed Number, and Mouza/Dag consecutively, providing a frictionless experience for non-technical citizens.
- **Known gaps:**
  - Protected Sub-Registrar deed creation and staff login portal will be implemented in S15 (`/login`, `/registrar`).
- **Next session:** `S15` (`s15-registrar-page`)

### Session S15 Log
- **What was done:**
  - Backend metadata & directory endpoints:
    * Implemented `GET /api/v1/meta` returning allowed `deed_types` and `sub_registries` with RBAC for staff roles (`registrar`, `officer`, `admin`).
    * Implemented `GET /api/v1/persons/search` supporting name substring and numeric ID searches on the synthetic `Person` table with RBAC (`registrar`, `admin`).
    * Added schemas `MetaOut`, `SubRegistryOut`, and `PersonOut`.
    * Created unit & integration test suite in `backend/tests/test_api_meta.py` verifying 401 unauthenticated, 403 forbidden role constraints, and query filtering.
    * Full backend test suite passing: `97 passed in 69.80s`.
  - Frontend authentication & route guards:
    * Implemented `AuthProvider`, `useAuth()` hook, and `ProtectedRoute` component in `frontend/src/lib/auth.tsx`.
    * Implemented `/login` route (`frontend/src/app/login/page.tsx`) with username/password form, 1-click test pills for demo accounts (`registrar1`, `officer1`, `admin1`), Next.js `<Suspense>` query param (`?next=`) handling, and automatic role-based redirect (`/registrar`, `/officer`, `/admin`).
    * Updated `Header.tsx` to dynamically show staff link (`/registrar`) and user role badge with seamless logout.
  - Sub-Registrar deed registration portal (`frontend/src/app/registrar/page.tsx`):
    * Role-protected to `registrar` and `admin`.
    * Interactive benchmark fast test buttons (`S6` Clean Sale, `S1` Double Sale Block, `S2` Stranger Seller Block).
    * Searchable plot selector with live summary, Dag/Mouza, total area, and current owner identification.
    * Searchable seller and buyer select dropdowns from `/persons/search`.
    * Area sold input with decimals validation; dynamic deed type and sub-registry selects from `/meta`.
    * Pre-registration fraud blocking: catches `HTTP 409` code `FRAUD_BLOCKED` and displays prominent red alert container with critical findings, rule IDs, and specific reasons without issuing a deed.
    * On successful registration: renders `VALID` `StatusBadge`, registered deed number, metadata grid, cryptographic QR code preview from `GET /deeds/{no}/qr` with direct PNG download, link to public `/verify`, and in-place "Start Mutation (Namjari)" button calling `POST /api/v1/mutations`.
  - Added bilingual translations in `frontend/src/locales/bn.json` and `frontend/src/locales/en.json`.
  - Verified Next.js static production build (`npm run build` succeeds in ~5.9s, all 8 routes prerendered).
- **Decisions:**
  - `ProtectedRoute` verifies token presence and role authorization, displaying an unauthorized warning with "Switch Account" if role does not match.
  - QR Code binary fetched directly via `fetch` with `Bearer` token and rendered safely via `URL.createObjectURL(blob)`.
- **Known gaps:**
  - AC Land officer mutation review workflow and Admin tamper lab/audit control panel to be implemented in S16 (`/officer`, `/admin`).
- **Next session:** `S16` (`s16-officer-admin-pages`)

### Session S16 Log
- **What was done:**
  - Implemented the Assistant Commissioner (Land) Officer Portal (`frontend/src/app/officer/page.tsx`):
    * Role-protected to `officer` and `admin` via `ProtectedRoute`.
    * **Mutations Tab:** Mutation applications table with state filter (`ALL`, `SUBMITTED`, `AUTO_CHECKED`, `UNDER_REVIEW`, `APPROVED`, `KHATIAN_UPDATED`, `REJECTED`), deed/plot cross-links, applicant identifiers, and `⚠️ OVERRIDE` alert badges.
    * **Mutation Review Drawer / Modal:** Features 5-stage `StatusStepper` (`SUBMITTED` -> `AUTO_CHECKED` -> `UNDER_REVIEW` -> `APPROVED` -> `KHATIAN_UPDATED`, or `REJECTED` in prominent red), auto-check fraud findings breakdown with severity badges, chronological history events timeline, dynamic legal transition buttons, and an official order/justification note input (strictly enforced for rejections or overriding critical warnings).
    * **Fraud Alerts Tab:** Real-time alert list with status (`ALL`, `OPEN`, `ACK`, `RESOLVED`, `DISMISSED`) and severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) filters, with instant `ACK` and `RESOLVED` status update actions calling `PATCH /api/v1/alerts/{id}`.
  - Implemented the System Administration Portal (`frontend/src/app/admin/page.tsx`):
    * Role-protected strictly to `admin` via `ProtectedRoute`.
    * **Tamper Lab Panel:** Verifies `GET /api/v1/dev/status` to ensure demo mode is active. Includes target deed input with 1-click sample deed pills (`MIR-2026-000001`, `000002`, `000003`). Tamper simulation button (+1.0 decimal area sold without updating Ed25519 signature) and Restore button with confirmation modals. Inline real-time cryptographic verification demonstrates immediate status flip between `VALID` and `TAMPERED` (`HASH_MISMATCH`).
    * **Audit Log Trail:** Connects to `GET /api/v1/audit` with server-side pagination, displaying chronological, immutable logs (Action, Entity, Actor, Timestamp, Details).
  - Updated `Header.tsx` to conditionally expose `/officer` and `/admin` navigation links based on user role (`officer`, `admin`).
  - Added complete bilingual translations for both portals in `frontend/src/locales/bn.json` and `frontend/src/locales/en.json`.
  - Verified Next.js static production build (`npm run build` succeeds in ~5.5s, all 10 routes prerendered).
  - Verified backend test suite: all 97 pytest tests pass.
- **Decisions:**
  - Tamper Lab is cleanly hidden when `demo_mode` is false, safeguarding against accidental invocation in production environments.
  - Confirmation modals prevent accidental execution of destructive demo actions.
  - Officer note validation is enforced client-side before calling transition APIs to provide instant feedback.
- **Known gaps:**
  - Docker packaging and local deploy configurations will be implemented in S17.
- **Next session:** `S17` (`s17-docker`)

### Session S17 Log
- **What was done:**
  - Implemented `backend/Dockerfile`:
    * Multi-stage-ready python environment using `python:3.11-slim` with system dependencies (`build-essential`, `libpq-dev`, `curl`).
    * Configured non-root user (`appuser` UID 1000) for container security.
    * Installed `requirements.txt` with psycopg binary support.
    * Exposed port 8000 running uvicorn on `0.0.0.0:8000`.
  - Implemented `backend/.dockerignore` filtering out pycache, venv, databases, git, and ruff caches.
  - Implemented `frontend/Dockerfile`:
    * Multi-stage build (`deps` -> `builder` -> `runner`) using `node:20-alpine`.
    * Build-time argument `ARG NEXT_PUBLIC_API_URL=http://localhost:8000` baked into static Next.js artifacts.
    * Configured non-root user (`nextjs` UID 1001 / `nodejs` GID 1001).
    * Exposed port 3000 running `npm run start` on `0.0.0.0`.
  - Implemented `frontend/.dockerignore` filtering out node_modules, .next, and git files.
  - Configured `docker-compose.yml`:
    * `db`: `postgres:15-alpine` with persistent volume `postgres_data`, credentials, port 5432, and healthcheck (`pg_isready`).
    * `backend`: built from `./backend`, `env_file: .env`, overridden with PostgreSQL `DATABASE_URL` and `SEED_ON_START=true`, persistent volumes for `./keys` and `./data`, depends on `db` (`service_healthy`), and HTTP healthcheck on `/api/v1/health`.
    * `frontend`: built from `./frontend` with `ARG NEXT_PUBLIC_API_URL=http://localhost:8000`, port 3000, depends on `backend` (`service_healthy`), and HTTP healthcheck.
  - Implemented `SEED_ON_START` automated seeding:
    * Added `seed_on_start: bool = False`, `SEED_ON_START: bool | None = None`, and `should_seed_on_start` property to `backend/app/config.py`.
    * Added idempotent startup check in `backend/app/main.py` lifespan: if `should_seed_on_start` is true and database contains 0 plots, automatically runs `seed_data(check_db)` creating 300 plots, 120 persons, 3 demo staff users, and benchmark scenarios S1–S8.
    * Added `test_seed_on_start_in_lifespan` in `backend/tests/test_seed.py` (98 tests passing).
  - Updated `Makefile` with Docker workflow targets: `up`, `down`, `logs`, `reset`, and `seed`.
  - Updated `README.md` with complete "Run with Docker" documentation, port mapping table, and LAN/mobile phone live QR scanning instructions.
- **Decisions:**
  - Non-root users (`appuser` for Python, `nextjs` for Node) used across all containers for container security.
  - In `docker-compose.yml`, environment variables explicitly override `DATABASE_URL` with postgresql connection while respecting `.env` for local SQLite development.
  - Build arg `NEXT_PUBLIC_API_URL` ensures client-side bundle inlining while allowing override for local Wi-Fi / LAN testing.
- **Known gaps:**
  - Cloud deployment preparation (Vercel, Render/Railway, production secrets, health pingers) to be implemented in S18.
- **Next session:** `S18` (`s18-cloud-deploy-prep`)

### Session S17-FIX Log
- **What was done:**
  - Diagnosed API base path mismatch between frontend client calls (`/auth/login`, `/deeds`, `/plots`) and backend router registrations (mounted strictly under `/api/v1`).
  - Aligned `NEXT_PUBLIC_API_URL` to `http://localhost:8000/api/v1` across `frontend/src/lib/api.ts` (fallback default), `frontend/Dockerfile` (`ARG NEXT_PUBLIC_API_URL`), `docker-compose.yml` (build arg and runtime environment), `.env.example`, and `README.md`.
  - Added build-time assertion in `frontend/src/lib/api.ts` throwing an error if `NEXT_PUBLIC_API_URL` is empty in production builds.
  - Audited Dockerfile paths: confirmed `WORKDIR /app`, `USER appuser` (backend) / `USER nextjs` (frontend), `EXPOSE 8000` / `3000`, `CMD uvicorn ... --host 0.0.0.0 --port 8000`. Resolved `SIGNING_KEY_PATH` inside container to `/app/keys/registrar_ed25519.hex` matching volume mount `./keys:/app/keys`.
  - Docker execution check: attempted `docker info`; failed with:
    `docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program.`
    `docker compose config` and `docker compose up` could NOT be executed natively in this environment because Docker Desktop is not installed on the author's machine.
  - Confirmed test accounting: 98 tests passing in `backend/tests/` (70.51s); verified `test_seed_on_start_in_lifespan` in `backend/tests/test_seed.py` was the test added in S17.
- **Decisions:**
  - Base URL contract strictly incorporates `/api/v1` because backend core routers (`auth`, `deeds`, `plots`) and `/health` route are mounted strictly at `/api/v1`.
  - Client-side build assertion in `api.ts` protects against silent runtime network errors when static bundles are inlined.
- **Known gaps:**
  - Docker runtime proof skipped due to missing Docker Desktop.
- **Next session:** `S18` (`s18-cloud-deploy-prep`)

### Session S17-FIX-2 Log
- **What was corrected:**
  - S17 status and S17-FIX documentation updated to provide honest disclosure regarding Docker verification.
  - Clarified that URL alignment and Dockerfile path audit were completed and verified, but runtime execution (`docker compose up --build`, container startup, healthcheck polling, seed idempotency at runtime, and end-to-end register->verify inside Docker) could NOT be run due to Docker Desktop being unavailable on the author's Windows machine (`docker info` fails with CommandNotFoundException).
  - Added warning banner in `README.md` "Run with Docker" section stating that local Docker verification was not possible on the author's machine and that the live deployment link is the primary deliverable.
  - Added operational security note in `docs/SECURITY.md` section 7.
  - Created `docs/SUBMISSION_CHECKLIST.md` tracking the carryover runtime proof item to be verified on a Docker-enabled machine prior to final submission.
- **Why:**
  - Strict compliance with hackathon honesty requirements and transparency: never claim runtime verification that could not be executed on the development machine.
- **What remains unverified:**
  - Native `docker compose config` CLI exit code in standard author environment.
  - Live container startup, healthchecks, and networking.
  - Runtime automated `SEED_ON_START` idempotency across restart in PostgreSQL container.
  - End-to-end register and verify deed transaction executed through the Docker container stack.
- **Next session:** `S18` (`s18-cloud-deploy-prep`)

### Session S17-FIX-3 Log
- **What was done:**
  - Fixed top-level directory case mismatch from `Docs/` to `docs/` using two-step `git mv` (`Docs -> Docs__tmp_rename -> docs`).
  - Windows is case-insensitive so the mismatch was invisible locally, but Linux environments (CI, Vercel, Render) treat them as distinct directories and would break.
  - Updated hardcoded `Docs/` path references in `README.md`, `GEMINI.md`, and `tools/split_prompts.py` to `docs/`.
- **Next session:** `S18` (`s18-cloud-deploy-prep`)

### Session S18 Log
- **What was done:**
  - Enabled persistent signing key loading via `SIGNING_KEY_HEX` environment variable / parameter in `backend/app/services/crypto.py` and `backend/app/config.py` when no key file exists on ephemeral cloud storage, with strict 32-byte (64 hex characters) validation and zero key logging.
  - Implemented automatic PostgreSQL connection normalization in `backend/app/config.py` and `backend/app/db.py`, transforming cloud-provided `postgres://` and `postgresql://` connection strings to `postgresql+psycopg://` required by SQLAlchemy 2.
  - Updated `backend/Dockerfile` to dynamically respect cloud-assigned `${PORT:-8000}` through shell execution, and added port resolution to `backend/app/config.py`.
  - Added deep healthcheck endpoint `GET /api/v1/health/deep` (and `/health/deep`) in `backend/app/main.py` testing live database query connectivity and seed presence (`plots_count`, `deeds_count`, `seeded: bool`) without exposing credentials, secrets, or internal paths.
  - Created optional Render Blueprint specification `render.yaml` configuring 1-click cloud provisioning for the Dockerized backend service and managed PostgreSQL database with automated seeding on first start (`SEED_ON_START=true`).
  - Authored comprehensive cloud deployment guide in `docs/DEPLOY.md` covering Render/Railway backend setup, managed Postgres provisioning, environment variables table, persistent key generation, Vercel frontend deployment with `NEXT_PUBLIC_API_URL`, CORS linkage, `DEMO_MODE` guidance, free-tier cold start mitigation, and mobile data smoke-test checklist.
  - Added unit and API tests in `backend/tests/test_crypto.py` and `backend/tests/test_health.py` (all 104 tests passing in backend, frontend production build 10 routes prerendered).
- **Decisions:**
  - Kept key file precedence over env var so local development using `./keys/registrar_ed25519.hex` continues without disruption, while cloud containers without persistent volume mounts safely load `SIGNING_KEY_HEX`.
  - Deep health check returns HTTP 503 with generic error message if the database connection fails, ensuring cloud orchestrators do not route user traffic to degraded instances while concealing database stack traces.
- **Known gaps:**
  - Dashboard execution (Render/Railway/Vercel project creation) is performed manually by authors using their personal accounts as documented in `docs/DEPLOY.md`.
- **Next session:** `S19` (`s19-docs`)









