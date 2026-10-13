# LandShield - Technical Requirements Document (TRD)

## 1. Architecture
```
[ Citizen Web ]  [ Registrar UI ]  [ AC Land UI ]  [ Admin ]
        \              |               |            /
              Next.js frontend (Bangla/English)
                          |  HTTPS / JSON
                 FastAPI backend (/api/v1)
   +---------+-----------+------------+-------------+-----------+
   | Auth/RBAC | Ledger+Crypto | Fraud engine | Mutation FSM | Reports/Agent |
   +---------+-----------+------------+-------------+-----------+
                          |
                  PostgreSQL (SQLite for quick start)
```
Phase 2 adds: reconciliation service, lineage graph service, transparency log job, AI agent module,
OCR ingest module, ML risk module. All analysis modules plug into one layered pipeline (section 6A).

## 2. Tech stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (React), TypeScript, Tailwind CSS, next-intl or i18next, html5-qrcode |
| Backend | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| DB | PostgreSQL 15 (dev: SQLite) |
| Crypto | PyNaCl or cryptography (SHA-256, Ed25519), canonical JSON |
| QR | qrcode (Pillow) |
| Graph | NetworkX |
| ML (Phase 2, advisory) | scikit-learn, LightGBM, SHAP, joblib (IsolationForest baseline + LightGBM classifier) |
| AI | LLM API (explanations, report writing, vision OCR) with JSON-schema outputs |
| Auth | JWT (short expiry) + role-based access, password hashing with argon2 |
| Tests | pytest, httpx, Playwright (optional) |
| DevOps | Docker, docker compose, GitHub Actions, Render/Railway/Vercel |

## 3. Data model (core tables)
- users(id, name, role, password_hash, created_at)
- persons(id, display_name, masked_nid_hash, is_synthetic=true)
- plots(id, mouza, upazila, district, dag_no, area_decimal, land_type, flags JSON[khas, acquisition, disputed], initial_owner_id, current_owner_id [informational: largest record holder])
- deeds(id, deed_no, plot_id, seller_id, buyer_id, area_sold, deed_type, registered_at, sub_registry, price_bdt (synthetic, Phase 2 ML), payload_json, deed_hash, signature, signer_key_id, status [ACTIVE|CANCELLED, NOT part of hashed payload], tamper_backup [Tamper Lab only, nullable])
- ledger_entries(id, plot_id, seq, deed_id, prev_hash, entry_hash, created_at)
- mutations(id, deed_id, plot_id, state, applicant_id, officer_id, created_at, updated_at)
- mutation_events(id, mutation_id, from_state, to_state, actor_id, note, at)
- cases(id, plot_id, case_no, status, filed_at)
- alerts(id, deed_id, plot_id, rule_id, severity, reasons JSON, created_at, status)
- khatians(id, plot_id, survey_type [CS|SA|RS|BS], khatian_no, dag_no, owners JSON) -- Phase 2 lineage
- audit_log(id, actor_id, action, entity, entity_id, at, ip)
- signing_keys(id, public_key, status, created_at)
- merkle_roots(date, root, entry_count, signature) -- Phase 2
- ingest_drafts(id, image_ref, extracted_json, confidence_json, status, reviewer_id) -- Phase 2 bonus

## 4. Cryptographic design
1. Canonicalize deed payload: JSON, sorted keys, UTF-8, no whitespace, fixed field set.
2. deed_hash = SHA-256(canonical_payload).
3. signature = Ed25519.sign(registrar_private_key, deed_hash).
4. ledger entry per plot: entry_hash = SHA-256(prev_hash || deed_hash || seq || timestamp).
5. Verify: recompute hash from stored payload, check signature with public key, walk chain back to genesis.
6. QR payload (Phase 1): short URL with deed_no and hash prefix. QR payload (Phase 2): base64url of
   {deed_no, deed_hash, signature, key_id} for offline verification with the published public key.
7. Phase 2 transparency log: daily Merkle root of all entry hashes, published on a public page.
8. Keys: prototype keys in env/file; production would use KMS/HSM and rotate keys (signing_keys table
   keeps old public keys so old deeds still verify).

## 5. API (v1)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | /auth/login | Get JWT | public |
| GET | /plots/{id} | Plot summary | public (masked) |
| GET | /plots/{id}/chain | Ownership chain with validity | public (masked) |
| POST | /deeds | Register deed (runs fraud checks, signs, appends ledger) | registrar |
| GET | /deeds/{deed_no}/verify | VALID / TAMPERED / SUPERSEDED / CANCELLED / UNKNOWN with detail | public |
| GET | /deeds/{deed_no}/qr | QR image | registrar |
| POST | /mutations | Start mutation from deed | registrar |
| POST | /mutations/{id}/transition | Move state with note | officer |
| GET | /mutations/{id} | Status and history | public (masked) / officer |
| GET | /risk/plot/{id} | Risk score and reasons | public |
| GET | /alerts | Alert list | officer/admin |
| POST | /dev/tamper/{deed_no} | Tamper Lab (demo only, disabled when DEMO_MODE=false) | admin |
| POST | /reports/due-diligence | AI report (Phase 2) | public |
| GET | /reconcile/{plot_id} | Registry vs mutation comparison (Phase 2) | officer |
| GET | /lineage/{plot_id} | Survey lineage graph (Phase 2) | public |
| GET | /analysis/plot/{id} | Combined layered assessment (all enabled layers, grouped findings) | public (masked) |
| GET | /keys | Public signing keys for offline verification (Phase 2) | public |
| GET | /transparency | Daily Merkle roots (Phase 2) | public |
| POST | /ingest/scan | OCR draft extraction with confidence (Phase 2 bonus) | registrar |
| GET | /metrics | Evaluation results and attack-suite summary (Phase 2) | public |

## 6. Fraud engine
Rule interface: `evaluate(plot, deed, context) -> Finding | None` with rule_id, severity, weight, reasons.
| Rule | Name | Logic | Severity |
|---|---|---|---|
| R1 | Oversold / double sale | See section 6B (OVERSOLD, DOUBLE_SALE) | Critical |
| R2 | Seller not owner | See section 6B (seller lacks holding in both ledger and record views) | Critical |
| R3 | Missing mutation | ACTIVE deed older than N days with no completed (KHATIAN_UPDATED) mutation | Medium |
| R4 | Rapid transfers | Any 30-day window containing 3+ ACTIVE deeds (sliding window; includes the proposed deed) | High |
| R5 | Integrity failure | Hash or signature mismatch, broken chain | Critical |
| R6 | Flagged land | Plot is khas, under acquisition or has a pending case | High |
| R7 (P2) | Lineage break | Khatian lineage inconsistent across survey generations | High |
| R8 (P2) | Office mismatch | Registry owner differs from mutation record owner | High |
Score: sum of weights capped at 100. Levels: 0-24 Low, 25-59 Medium, 60-84 High, 85+ Critical.
Advisory ML score (Phase 2) is shown separately and never overrides rules; see section 6A.
LLMs are used only to explain findings, never to decide.

## 6B. Ownership model and rule semantics (authoritative for R1-R4)
Why: ownership must support partial-area sales and sales that are registered but not yet mutated, otherwise legitimate
transactions are falsely flagged. Two views of ownership are computed per plot (area in decimals, tolerance 1e-6).

- `Plot.initial_owner_id` = record owner at genesis, holding `Plot.area_decimal`.
- `Deed.status`: ACTIVE or CANCELLED. Status is NOT part of the signed payload. A deed becomes CANCELLED when its
  mutation is REJECTED (or an admin cancels it). Cancelled deeds stay in the ledger (chain stays intact) but are excluded
  from holdings and from rules.
- `ledger_holdings(plot, before_seq=None)`: start `{initial_owner: area}`; for each ACTIVE deed in seq order:
  `holdings[seller] -= area_sold; holdings[buyer] += area_sold`.
- `record_holdings(plot, as_of=None)`: same, but only deeds whose Mutation reached KHATIAN_UPDATED (time = that
  MutationEvent's `at`; with `as_of`, only events at or before it). This is what the official record shows.
- `Plot.current_owner_id` is informational: the largest record holder, refreshed by `recompute_current_owner`.

DealSubject = (seller_id, buyer_id, area_sold, at, seq or None, deed_no or None). For a subject, `L = ledger_holdings(before it)`,
`Rr = record_holdings(as_of subject.at)`:
| Finding | Condition | Meaning |
|---|---|---|
| R1 OVERSOLD | `area_sold > plot.area_decimal` | Impossible area |
| R1 DOUBLE_SALE | `L[seller] < area_sold <= Rr[seller]` | Official record still shows the seller as owner, but the ledger shows that area is already committed to another deed |
| R2 NOT_OWNER | `L[seller] < area_sold` and `Rr[seller] < area_sold`, and R1 did not fire for this subject | Seller has no ownership basis in either view |
Legitimate cases that must NOT fire: resale by a new buyer before mutation (`L[buyer] >= area_sold`); several partial sales by one owner.

Evaluation modes:
- **PROPOSED** (registration): `ctx.proposed` is set; subjects = [proposed deal]; R3/R6/R5 are plot-level, R4 includes the proposed deed.
  Result has `blocked` = any CRITICAL decisive finding.
- **PLOT** (risk page, `ctx.proposed is None`): subjects = every ACTIVE deed in seq order, each evaluated with the
  views as of that deed (history replay). Findings carry the `deed_no`. Result has `has_critical` (no `blocked`).
R3 is relative to now. R4 uses a sliding window over history (not relative to now), so seeded data stays deterministic.

Ledger timestamp rule: `entry_hash` uses the exact `registered_at` STRING from the signed payload (not a re-formatted
datetime), so naive/aware datetime handling in the database can never break chain verification.

Error contract: `FraudBlocked` is converted by a global exception handler to HTTP 409
`{"code":"FRAUD_BLOCKED","report":{...}}`; the Alert and AuditLog are committed before the exception is raised so they
persist. Domain validation errors return 422.

## 6A. Layered analysis pipeline (hybrid design)
All analysis paths are merged into one pipeline. Each layer implements the same interface and returns findings.

```python
# app/services/pipeline/base.py
from dataclasses import dataclass, field
@dataclass
class Finding:
    layer: str          # "integrity" | "rule" | "lineage" | "reconcile" | "ml"
    rule_id: str        # e.g. R1, R5, R7, ML1
    severity: str       # INFO | LOW | MEDIUM | HIGH | CRITICAL
    weight: int
    decisive: bool      # True = may block/raise floor; False = advisory
    reasons: list = field(default_factory=list)

class Layer:
    name = ""
    enabled_flag = ""   # env flag, e.g. FEATURE_ML
    def analyze(self, ctx) -> list[Finding]: ...
```
| # | Layer | Phase | Path | Decisive? | Flag |
|---|---|---|---|---|---|
| 1 | Ingest (OCR/vision, human review) | 2 bonus | P1 | No | FEATURE_OCR |
| 2 | Integrity (hash, signature, chain, replay) | 1 | P2 | Yes | always on |
| 3 | Rules R1-R6 | 1 | P3 | Yes | always on |
| 4 | Reconciliation R8 | 2 | P3/P4 | Yes | FEATURE_RECONCILE |
| 5 | Lineage R7 | 2 | P1/P3 | Yes | FEATURE_LINEAGE |
| 6 | ML risk (advisory) | 2 bonus | P3 | No | FEATURE_ML |
| 7 | Mutation workflow auto-check | 1 | P4 | Enforces | always on |
| 8 | Citizen report (templates; LLM in Phase 2) | 1 / 2 | P5 | Explains only | FEATURE_AGENT |

### Score combination (explainable)
1. Run every enabled layer; collect findings. A layer that errors is logged and skipped (never crashes the request).
2. `floor`: highest severity among decisive findings (integrity + rules + lineage + reconcile). Any CRITICAL decisive finding gives Critical and blocks registration.
3. `rule_score = min(100, sum(weights of decisive findings))`.
4. Advisory layers (ML) never lower the level and never block. They can add a warning and, at most, raise the level by one step when ML probability >= 0.85 and level is Low/Medium.
5. Output: `{score, level, blocked, findings grouped by layer, ml: {probability, top_reasons} | null}`.
6. LLM (Phase 2) only rewrites the findings into Bangla/English text. Its `risk_level` is overwritten by the engine's.

```python
def assess(ctx, layers):
    findings = []
    for layer in layers:
        if not layer.is_enabled(): continue
        try: findings += layer.analyze(ctx)
        except Exception as e: log.warning("layer %s failed: %s", layer.name, e)
    decisive = [f for f in findings if f.decisive]
    score = min(100, sum(f.weight for f in decisive))
    level = level_from_score(score)
    if any(f.severity == "CRITICAL" for f in decisive): level, blocked = "CRITICAL", True
    else: blocked = False
    level = apply_ml_bump(level, [f for f in findings if f.layer == "ml"])
    return build_report(score, level, blocked, findings)
```
Adding a layer = add a class + register it in `LAYERS` + add a feature flag + add tests. No other code changes.

### ML layer (Phase 2, advisory)
- Data: `ml/gen_ml_data.py` creates ~5,000 synthetic transfers (about 90% clean, 10% fraud, 5-6 fraud types) including patterns NOT covered by rules (price far below area median, circular transfers, repeated buyer-new seller, odd registration hours) and near-miss clean cases (legitimate fast resale, family transfer).
- Features: transfers_30d, days_since_last_transfer, area_ratio, seller_is_owner, price_vs_area_median, mutation_lag_days, buyer_seller_repeat, distinct_buyers, reg_hour, flag_count, lineage_issue_count.
- Models: IsolationForest baseline; LightGBM classifier (class_weight=balanced). Split by plot (GroupShuffleSplit) to avoid leakage.
- Evaluation: report rules-only vs ML-only vs rules+ML (precision, recall, PR-AUC) in `docs/EVALUATION.md` and `docs/MODEL_CARD.md`. State clearly that data is synthetic.
- Explainability: SHAP top-3 reasons per prediction.
- Serving: `joblib` model loaded once at startup from `app/ml/model.joblib`; missing file means the layer is skipped.
- Train offline (`make train`), not at container start.

### OCR/ingest layer (Phase 2 bonus)
Image upload -> vision model or Tesseract (Bangla) -> structured JSON with per-field confidence -> mandatory human review screen -> saved as DRAFT -> passes through the same integrity and rules pipeline. Dummy documents only; type and size limits.

## 6C. Phase 2 semantics (authoritative for Phase 2 prompts)

### R8 Reconciliation (layer `reconcile`, decisive, HIGH, weight 35 per sub-code)
R3 owns "no completed mutation"; R8 never repeats it. Sub-codes:
- OWNER_MISMATCH: `plot.current_owner_id` differs from the largest holder in `record_holdings(now)` (ties: skip). Detects the record side being edited.
- MUTATION_STALLED: a Mutation in AUTO_CHECKED or UNDER_REVIEW whose `updated_at` is older than `MUTATION_DAYS`.
- AREA_NOT_CONSERVED: `abs(sum(record_holdings) - plot.area_decimal) > 1e-6`.

### R7 Lineage (layer `lineage`, decisive, HIGH, weight 35)
Table `khatians(id, plot_id, survey_type CS|SA|RS|BS, khatian_no, dag_no, area_decimal, owners_json, parent_id)`. Order CS < SA < RS < BS.
Sub-codes: MISSING_GENERATION (present survey types are not contiguous between the earliest and latest present),
ORPHAN (a khatian that is not of the earliest present type has no parent), BAD_PARENT (parent is not of an earlier type),
AREA_GROWTH (child area > parent area * 1.05; area decreasing is allowed because plots get partitioned).
A plot with no khatian rows gets no finding and `lineage_available=false` (missing data is not penalized).

### Offline QR
Payload = base64url(compact JSON `{"v":1,"payload_json":"<EXACT signed canonical string>","hash":"<hex>","sig":"<hex>","key_id":"<id>"}`).
The browser hashes the UTF-8 bytes of `payload_json` AS RECEIVED and compares with `hash`, then verifies the Ed25519 `sig`
over the hash bytes using the public key for `key_id` (from `GET /keys`, cached). It NEVER re-canonicalizes in the browser
(JS and Python print numbers such as 30.0 differently). Fields shown to the user are parsed from `payload_json`.
Offline results: AUTHENTIC, NOT_AUTHENTIC, KEY_UNKNOWN. Offline can NOT tell whether the deed was superseded or cancelled.
Cross-language test vector: generated by the backend, verified by a frontend unit test.

### Merkle transparency log
Leaves = `bytes.fromhex(entry_hash)` of LedgerEntry rows with `id <= max_entry_id`, ordered by id. Parent = sha256(left||right);
odd node duplicated; no leaves = sha256(b""). Table `merkle_roots(date unique, root, entry_count, max_entry_id, signature, created_at)`;
signature = sign(sha256(f"{date}|{entry_count}|{root}")). Verification recomputes over ids <= stored max_entry_id and
compares the root: a mismatch means older history was rewritten.

### Due-diligence report (LLM)
The LLM never decides. Deterministic code gathers read-only facts (plot summary, combined analysis, reconcile, lineage, flags;
names masked). One LLM call writes the wording. Output is validated against a schema; `risk_level` and findings are
overwritten from the engine; on any failure (no key, timeout, invalid JSON) a template report is returned
(`source: "template"`). All DB text is treated as untrusted data (prompt injection).

### ML advisory layer
A pure function `features_from_history(history, subject)` is used both for training and serving. Training data comes from a
synthetic in-memory database built with the real services, with injected anomalies the rules do not cover (price far below
area median, circular transfers, repeated buyer with many new sellers, odd registration hours) and near-miss clean cases.
Split by plot. Advisory only (see 6A).

### Evaluation definitions
Unit = plot. Label = an anomaly was injected. Flagged = engine level >= MEDIUM (also report HIGH+). Report precision, recall,
false-positive rate for rules-only, ML-only and rules+ML, and detection rate per attack type. Always labelled synthetic.

## 7. Mutation state machine
SUBMITTED -> AUTO_CHECKED -> UNDER_REVIEW -> APPROVED -> KHATIAN_UPDATED
Any state before APPROVED can go to REJECTED (with reason). Real e-Mutation has more steps (notice, hearing,
approvals); this prototype simplifies them and says so.

## 8. Phase 2 modules
All modules below are layers or services plugged into the pipeline in section 6A, each behind a feature flag.
- Reconciliation: join deeds and mutations by plot; list unmatched, delayed, owner-mismatch records.
- Lineage: directed graph of khatian/dag links by survey type; detect missing links, area growth, orphan nodes.
- AI agent: tool-calling loop over internal read-only endpoints (chain, risk, reconcile, lineage, flags)
  producing a structured JSON report, then rendered to Bangla text/PDF. Agent has no write access.
- OCR ingest: image -> vision model -> JSON fields -> human confirmation screen -> save. Dummy documents only.
- Attack suite: scripted scenarios (forge, replay, double-sale, owner spoof) run against own prototype; report detection rate.

## 9. Testing
- Unit: crypto (hash/sign/verify), each fraud rule, state machine transitions.
- Integration: register -> verify -> tamper -> verify fail; double-sale blocked.
- Seeded scenario tests mapping to demo script.
- Pipeline tests: a failing layer is skipped; decisive findings set the floor; ML cannot lower or block; feature flags on/off.
- ML tests: model loads; prediction shape; fallback when model file missing; no data leakage between train/test plots.
- Agent tests: mocked LLM valid/invalid JSON; template fallback.
- CI: lint (ruff, eslint), tests, build on every push.

## 10. Deployment
- docker-compose: db, backend, frontend. `.env.example` documents variables.
- Live demo: managed hosting; seed script runs on first boot; DEMO_MODE=true for Tamper Lab.
- Backup: recorded demo video and local run instructions.

## 11. Performance targets
verify p95 under 300 ms; plot risk report under 1 s; seed of 300 plots under 10 s.
