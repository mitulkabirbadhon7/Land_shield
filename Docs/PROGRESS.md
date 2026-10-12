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
| **S09** | Rules R3, R4, R6 + explanations + risk API | Pending | |
| **S10** | Mutation workflow | Pending | |
| **S11** | Tamper Lab, audit, masking, hardening | Pending | |
| **S12** | Frontend foundation | Pending | |
| **S13** | Verify page + QR scanner | Pending | |
| **S14** | Citizen check page | Pending | |
| **S15** | Registrar page | Pending | |
| **S16** | Officer + admin pages | Pending | |
| **S17** | Docker (local deploy) | Pending | |
| **S18** | Cloud deploy preparation | Pending | |
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
  - Frontend Next.js app foundation, layout, and bilingual i18n setup starts in S12.
- **Next session:** `S12` (`s12-frontend-foundation`)






