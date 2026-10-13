# LandShield - Product Requirements Document (PRD)

Version 1.2 | LandTech Innovation Hackathon 2026 | Track: Digital Land Records, Verification & Digitization
Problem statements: P2 (primary), P3, P4, P5 (Phase 1); P1 as a bonus in Phase 2.
Authoritative technical semantics: TRD.md sections 6A (pipeline), 6B (ownership and R1-R4), 6C (Phase 2).

## 1. Problem
Land disputes are among the most common civil cases in Bangladesh. Typical causes named in the rule book:
- forged or altered deeds
- conflicting khatians across survey generations (CS, SA, RS, BS)
- records split between the sub-registry office (registration) and the AC Land office (mutation)

Government services (Land Service Gateway, e-Mutation pilot, e-Porcha, e-Khatian) digitize records. What is still
missing for citizens and officers is an independent, tamper-evident, explainable check that:
1. proves a deed is genuine and unaltered,
2. catches double-selling and impossible sales before they complete,
3. shows where the two offices' records disagree,
4. explains risk to a citizen in plain Bangla.

## 2. Vision
LandShield is a verification and reconciliation layer on top of existing land systems. It does not replace them.
Rules and cryptographic integrity decide, machine learning advises, and language models only explain.

## 3. Users and personas
| Persona | Need | Key features |
|---|---|---|
| Citizen buyer | Know in under a minute if a plot or deed is safe | Check-before-you-buy risk report (Bangla/English), QR verify, AI-written report (Phase 2) |
| Sub-registrar | Register deeds with automatic checks | Signed deeds, QR, fraud check at registration (blocks critical findings) |
| AC Land officer | Review mutation with full context | Auto-checks, alerts, status workflow, reconciliation view, audit trail |
| Auditor / investigator | Evidence that cannot be quietly changed | Hash-chained ledger, alerts, audit log, Merkle transparency log |
| Admin | Control and demo | Roles, Tamper Lab (demo only), audit view, metrics |

## 4. Goals
- G1 Any deed copy is verifiable in under 3 seconds (QR or deed number).
- G2 Altered deeds are detected with 100% reliability on the demo and attack-suite datasets.
- G3 Double sales and impossible sales are blocked at registration; legitimate transactions (partial-area sales, resale before mutation) are NOT blocked.
- G4 Cross-office mismatches and survey-lineage breaks are surfaced (Phase 2).
- G5 A citizen gets a plain-language risk report with reasons in Bangla.
- G6 Results are measured (precision, recall, attack detection) and stated honestly as synthetic.
- G7 Everything is reproducible: one command to run, deterministic seed data.

## 5. Non-goals
- No real personal data, no real land records, no scraping or probing of government portals.
- Not a replacement for e-Mutation or the Land Service Gateway; not a legal registry.
- No public blockchain or cryptocurrency.
- No claim of real-world accuracy; the mutation workflow is a simplified model.

## 6. Scope by phase

### Phase 1 (Round 1, due Oct 16, 2026; target Oct 15) - "Working core"
| ID | Requirement |
|---|---|
| FR-1 | Synthetic registry: persons, plots (with initial owner), deeds (with status), ledger, mutations, cases, alerts, audit log |
| FR-2 | Signed (Ed25519), hash-chained (SHA-256) deeds; QR per deed; public verify returning VALID / TAMPERED / SUPERSEDED / CANCELLED / UNKNOWN with reasons |
| FR-3 | Tamper Lab: admin-only, DEMO_MODE-only; edits a deed without re-signing; idempotent with a stored backup; restore |
| FR-4 | Fraud engine in layered form: R1 (OVERSOLD, DOUBLE_SALE), R2 (NOT_OWNER), R3 (missing mutation), R4 (rapid transfers), R5 (integrity), R6 (flagged land); 0-100 score, level, Bangla/English reasons; two modes (PROPOSED at registration, PLOT for the risk page) |
| FR-5 | Registration blocked on critical findings: HTTP 409 FRAUD_BLOCKED with the report; alert and audit persisted |
| FR-6 | Mutation workflow (SUBMITTED, AUTO_CHECKED, UNDER_REVIEW, APPROVED, KHATIAN_UPDATED, REJECTED) with auto-check, officer override note, audit trail; rejection cancels the deed |
| FR-7 | Citizen check page, verify page with QR scanner, registrar page, officer and admin pages; Bangla and English |
| FR-8 | Roles (registrar, officer, admin), JWT, masking of public data, rate limits, security headers |
| FR-9 | Submission pack: concept note (max 4 pages PDF), repository with README (setup, data sources, AI disclosure), demo video (max 3 minutes), live link |

### Phase 2 (Final) - "Differentiators" (feature-flagged, additive)
| ID | Requirement | Flag |
|---|---|---|
| FR-10 | Reconciliation layer R8: OWNER_MISMATCH, MUTATION_STALLED, AREA_NOT_CONSERVED; officer list | FEATURE_RECONCILE |
| FR-11 | Survey lineage layer R7 (CS-SA-RS-BS): MISSING_GENERATION, ORPHAN, BAD_PARENT, AREA_GROWTH; timeline UI | FEATURE_LINEAGE |
| FR-12 | Offline-verifiable QR: signed payload checked in the browser without the server; public key list; cached keys | FEATURE_OFFLINE_QR |
| FR-13 | AI due-diligence report: deterministic facts, one LLM call for wording, schema-validated, engine overrides risk level, template fallback | FEATURE_AGENT |
| FR-14 | Role-based privacy views and data policy | always on |
| FR-15 | Merkle transparency log (daily signed root, public verify) | FEATURE_TRANSPARENCY |
| FR-16 | Attack-simulation suite and evaluation metrics page (own prototype only) | always on |
| FR-17 | ML advisory layer (LightGBM + SHAP) with model card; never blocks or lowers risk | FEATURE_ML |
| FR-18 | Scan-to-ingest of dummy khatian/deed with mandatory human review (bonus) | FEATURE_OCR |
| FR-19 | Rollout and cost page; pitch deck (max 10 slides); updated README with "Changes since Round 1" | always on |

### Phase 3 (roadmap only, not built)
Official gateway API integration, KMS/HSM and multi-signature approval, SMS/USSD verification, mobile app, upazila pilot under a separate agreement, inclusion proofs for the Merkle log.

## 7. Detailed functional requirements and acceptance criteria
| ID | Acceptance criteria |
|---|---|
| FR-2 | Untouched deed returns VALID. Any change to a signed field returns TAMPERED with HASH_MISMATCH. A newer deed on the plot makes the older one SUPERSEDED. Cancelled deed returns CANCELLED. Chain verification survives database round-trips (ledger timestamp is the payload string) |
| FR-3 | Tamper then verify shows TAMPERED; second tamper returns 409; restore returns the deed to VALID; all dev routes return 404 when DEMO_MODE is false |
| FR-4 | Seeded scenarios fire the expected rule only: double sale gives R1 DOUBLE_SALE (not R2); stranger seller gives R2; unmutated old deed gives R3; four quick legitimate transfers give R4 only; flagged plot gives R6; clean plot gives no findings; resale by new buyer before mutation and several partial sales give NO R1/R2 |
| FR-5 | POST /deeds for a critical case returns 409 with code FRAUD_BLOCKED and findings; an OPEN alert exists afterwards; no deed or ledger entry was created |
| FR-6 | Illegal transitions return 409 with allowed states; officer note required for rejection and for passing a blocked auto-check; approval recomputes record holdings; rejection excludes the deed from holdings |
| FR-10 | Edited record owner, stalled mutation and edited plot area are each detected; clean and legitimate plots produce no R8 finding; R8 never duplicates R3 |
| FR-12 | Phone with no network verifies a valid offline QR as AUTHENTIC; edited payload gives NOT_AUTHENTIC; unknown key gives KEY_UNKNOWN; the page states that offline cannot detect supersession |
| FR-13 | With a mocked model: engine risk level always wins; invalid output, timeout or missing key returns the template report; injected text inside data does not change the report |
| FR-15 | Daily root verifies MATCH; any change to older ledger history gives MISMATCH |
| FR-16 | Attacks A1-A6 are detected 100% on the test set; false positives are listed with the responsible rule |
| FR-17 | ML never changes blocked/has_critical, never lowers the level, can raise Low/Medium by one step at probability >= 0.85; missing model means the layer is skipped |

## 8. Non-functional requirements
- Performance: verify p95 under 300 ms on demo data; risk report under 1 s; seed of 300 plots under 10 s.
- Availability: demo reachable during judging; local Docker copy and recorded video as backups.
- Usability: Bangla-first, mobile-friendly, large tap targets, clear status colours.
- Security and privacy: see SECURITY.md.
- Explainability: every score lists the findings and their layer; AI text is labelled.
- Maintainability: layered pipeline, feature flags, migrations (Phase 2), tests for every module, CI on every push.
- Reproducibility: deterministic seed (fixed reference date), one-command start.

## 9. Success metrics
- Round 1: all FR-1 to FR-9 working live; core services at least 80% test coverage; demo under 3 minutes.
- Final: reported precision/recall/false-positive rate and per-attack detection rates (synthetic); both students explain any module; stable live demo.
- Quality bar: every claim in the pitch is demonstrable or in the repo.

## 10. Traceability to the rule book
| Rule-book item | Where satisfied |
|---|---|
| P2 Deed and ownership verification | FR-2, FR-3, FR-12, FR-15 |
| P3 Fraud and double-selling detection | FR-4, FR-5, FR-10, FR-11, FR-17 |
| P4 Smart e-mutation and registry workflow | FR-6, FR-10 |
| P5 Citizen pre-purchase verification | FR-7, FR-13 |
| P1 Historical record digitization (bonus) | FR-11 (lineage), FR-18 |
| Concept note, repo + README, video, live link | FR-9 |
| Final: updated repo, pitch deck (max 10 slides), live demo | FR-19 |
| Data, privacy and security rules | SECURITY.md |
| AI tool disclosure | README, AI_USAGE.md |

## 11. Assumptions, dependencies and open questions
- Registration deadline (Oct 6) has passed: late registration must be confirmed in writing with the organizers.
- The Judging Rubric is a separate document: request it and align the concept note and demo.
- Final date is TBA; confirmation fee due within 3 days of the announcement.
- Mentors guide only; students build and present.
- Government platform status is taken from public information only, never by scraping.

## 12. Risks
| Risk | Mitigation |
|---|---|
| Time (6 days to Round 1) | Session-based plan, cut list, parallel work |
| Rule logic flags legitimate sales | Ownership model in TRD 6B; regression scenarios S7 (pending resale) and S8 (partial sales) |
| Live demo failure | Local Docker copy, staging, recorded backup video |
| Over-claiming (blockchain, AI accuracy) | Precise wording; metrics labelled synthetic; model card |
| LLM unavailable | Template fallback is a first-class path |
| Both students must explain code | Review gate and module-swap sessions; AI use disclosed |

## 13. Revision history
| Version | Change |
|---|---|
| 1.0 | Initial PRD |
| 1.1 | Hybrid layered pipeline, ML/OCR added |
| 1.2 | Review fixes: ownership model (R1/R2), deed status, FraudBlocked 409 contract, PLOT/PROPOSED modes, Tamper Lab backup; Phase 2 semantics (R7, R8, offline QR, Merkle, report, ML); feature flags |
