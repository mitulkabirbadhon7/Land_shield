# LandShield - Master Project Plan and Workflow
LandTech Innovation Hackathon 2026 | Track: Digital Land Records, Verification & Digitization
Organizer: Dept. of CSE & CSE-TECH, Daffodil International University (DIU)
Document owner: Team Leader | Status: living document (update after every phase)

This is the single source of truth. Detailed specs live in the companion files listed in section 24.

---------------------------------------------------------------------
## 1. Snapshot

| Item | Value |
|---|---|
| Project | LandShield: tamper-evident deed verification, fraud detection, mutation tracking and citizen pre-purchase check |
| Main problem statement | P2 Deed & Ownership Verification (primary). Supporting: P3 Fraud/Double-selling, P4 e-Mutation workflow, P5 Citizen pre-purchase verification. Bonus: P1 digitization (Phase 2) |
| Rounds | Round 1 online (concept note + repo + video + link). Final on-site at Knowledge Tower, DIU |
| Team | 2 students (1 leader) + 1 faculty mentor + 1 industry mentor. DIU students/alumni only |
| Key dates | Registration closed Oct 6 (CONFIRM LATE ENTRY). Round 1 submission Oct 16 (target Oct 15). Final date TBA |
| Fees | 200 BDT Round 1; 100 BDT confirmation within 3 days if selected; bKash/Rocket; non-refundable |
| Prizes | Champion 20,000 BDT, 1st runner-up 10,000, 2nd runner-up 5,000 + certificates |
| Platform | landtech.diu.edu.bd/landtech |
| Contact | csetech@diu.edu.bd, +880 1756-808027 |
| Today | Saturday Oct 10, 2026 |

### 1.1 Open items to resolve first (blockers)
1. **Registration deadline (Oct 6) has passed.** Email/call organizers today; ask for late registration and written confirmation.
2. **Team composition:** confirm the faculty mentor and industry mentor and collect names/emails for the concept note.
3. **Judging rubric:** the rule book says a separate Judging Rubric exists (Round 1 criteria). Ask the organizers for it and align the concept note and demo to it.
4. **Payment:** pay 200 BDT and keep proof.
5. **Final date:** unknown. Watch the platform. Confirmation fee is due within 3 days of the announcement.

---------------------------------------------------------------------
## 2. Problem and context

Land disputes are among the most common civil cases in Bangladesh. Root causes named in the rule book:
- forged deeds
- conflicting khatians across survey generations (CS, SA, RS, BS)
- records split between the sub-registry office (registration) and the AC Land office (mutation)

Existing digital services (Land Service Gateway, e-Mutation pilot, e-Porcha, e-Khatian) digitize records. There is still no simple, independent layer that lets anyone check a deed's integrity, flags double-selling before it completes, reconciles the two offices, and explains risk to a citizen in Bangla.

### 2.1 Target users
| User | Pain | LandShield gives |
|---|---|---|
| Citizen buyer | Can't tell if a plot or deed is safe | "Check before you buy" risk report in Bangla |
| Sub-registrar | Manual duplicate checks | Automatic checks at registration, signed deeds, QR |
| AC Land officer | Reviews mutation without full context | Auto-checks, alerts, status workflow, audit trail |
| Auditor/investigator | No tamper-proof trail | Hash-chained ledger, alerts, audit log |
| Admin | Needs control | Roles, keys, demo controls |

### 2.2 Non-goals
Not a replacement for government systems; not a legal registry; no real personal data; no public blockchain/crypto; no scraping or testing of government portals.

---------------------------------------------------------------------
## 3. Solution overview (hybrid layered pipeline)

Every deed/plot flows through merged analysis layers. Each layer returns findings; one engine combines them.

```
 [Scan/OCR draft]  -> [Integrity: hash+signature+chain] -> [Rules R1-R6]
        P1                      P2                              P3
                                   -> [Lineage R7] [Reconciliation R8] [ML advisory]
                                              Phase 2
 -> [Mutation workflow P4] -> [Citizen report + AI explanation P5]
```
| Layer | Phase | Path | Decisive | Flag |
|---|---|---|---|---|
| Integrity (R5, replay/supersede) | 1 | P2 | Yes | always |
| Rules R1 double sale/oversold, R2 seller not owner, R3 missing mutation, R4 rapid transfers, R6 flagged land | 1 | P3 | Yes | always |
| Mutation workflow auto-check | 1 | P4 | Enforces | always |
| Citizen report (templates) | 1 | P5 | Explains | always |
| Lineage R7 | 2 | P1/P3 | Yes | FEATURE_LINEAGE |
| Reconciliation R8 | 2 | P3/P4 | Yes | FEATURE_RECONCILE |
| LLM due-diligence report | 2 | P5 | Explains | FEATURE_AGENT |
| ML risk (LightGBM, advisory) | 2 bonus | P3 | No | FEATURE_ML |
| OCR/vision ingest | 2 bonus | P1 | No | FEATURE_OCR |

Principles: rules and integrity decide; ML advises; LLM explains; every score lists reasons; every layer can be switched off; a failing layer never crashes a request.

### 3.1 Unique selling points
1. Tamper Lab live demo (edit one field, instantly TAMPERED).
2. Cross-office reconciliation (registry vs mutation) - the "three offices" gap.
3. Survey lineage graph CS->SA->RS->BS with break detection.
4. Offline-verifiable QR (signature inside the QR).
5. Explainable Bangla risk report; AI only explains, with safe fallback.
6. Measured results: precision/recall and attack-suite detection rate (on synthetic data, stated honestly).
7. Privacy by design: masked names, no NIDs.

Honest uniqueness rating: base idea about 5/10, with the differentiators about 7 to 7.5/10, overall realistic target 8 to 8.5/10 with strong execution. A ranking cannot be guaranteed.

---------------------------------------------------------------------
## 4. Scope by phase

### Phase 1 (Round 1): "Working core" - must all work live
1. Synthetic registry (plots, persons, deeds, ledger, mutations, cases, alerts, audit).
2. Signed, hash-chained deeds; QR; public verify (VALID / TAMPERED / SUPERSEDED / CANCELLED / UNKNOWN).
3. Tamper Lab (admin, DEMO_MODE only).
4. Fraud engine: R1, R2, R3, R4, R5, R6 with 0-100 score, level, reasons (Bangla/English).
5. Mutation state machine with auto-check and audit trail.
6. Citizen check page (Bangla/English), verify page with QR scanner, registrar page, officer/admin pages.
7. Auth + roles (registrar, officer, admin), masking, rate limits, security headers.
8. Docker, live deployment, README, concept note (<= 4 pages PDF), demo video (<= 3 min).

### Phase 2 (Final): "Differentiators"
Reconciliation (R8), lineage graph (R7), offline QR, AI due-diligence report (with fallback), privacy views, attack-simulation suite with metrics, Merkle transparency log, rollout/cost page, pitch deck (<= 10 slides). Bonus: ML advisory layer, OCR ingest.

### Phase 3 (roadmap only, do not build)
Official gateway API integration, KMS/HSM and multi-signature, SMS/USSD verification, mobile app, upazila pilot under a separate agreement.

---------------------------------------------------------------------
## 5. Architecture summary
```
 Next.js (BN/EN) --HTTPS/JSON--> FastAPI /api/v1 --> PostgreSQL (SQLite dev)
   pages: / /check /verify /login /registrar /officer /admin
 FastAPI modules: auth/RBAC | crypto+ledger | pipeline(layers) | mutation FSM | reports/agent | metrics
```
Tech: Python 3.11, FastAPI, SQLAlchemy 2, Pydantic v2, PyNaCl (Ed25519), qrcode, argon2, python-jose, slowapi, pytest; Next.js App Router, TypeScript, Tailwind, html5-qrcode; Docker; GitHub Actions; Render/Railway + Vercel. Phase 2 adds Alembic, NetworkX, tweetnacl, LLM API, scikit-learn/LightGBM/SHAP.

### 5.1 Data model (Phase 1)
User, Person (synthetic), Plot (mouza, upazila, district, dag_no, area_decimal, land_type, flags, initial_owner_id, current_owner_id), Deed (deed_no, plot, seller, buyer, area_sold, type, sub_registry, registered_at, payload_json, deed_hash, signature, signer_key_id, status, tamper_backup), LedgerEntry (plot, seq, deed, prev_hash, entry_hash), Mutation (+MutationEvent), Case, Alert, AuditLog. Phase 2: khatians, merkle_roots, ingest_drafts, price_bdt on deeds.

### 5.2 Cryptography
1. canonical JSON (sorted keys, compact, UTF-8) -> SHA-256 = deed_hash.
2. Ed25519 signature over deed_hash by the registrar key.
3. Per-plot chain: entry_hash = SHA-256(prev | deed_hash | seq | timestamp), genesis = 64 zeros.
4. Verify order: unknown -> hash recompute -> signature -> chain -> superseded -> VALID.
5. Ledger timestamp = the registered_at string inside the signed payload. Keys never committed; Phase 1 prototype keys in gitignored file or env hex; production would use KMS/HSM + rotation.

### 5.3 Fraud rules and scoring
| Rule | Logic | Severity | Weight |
|---|---|---|---|
| R1 | OVERSOLD (area > plot) or DOUBLE_SALE (record still shows seller as owner but ledger shows area already sold) - TRD 6B | CRITICAL | 60 |
| R2 | Seller holds less than area sold in both ledger and record views (partial and pending-mutation sales are legitimate) - TRD 6B | CRITICAL | 60 |
| R3 | ACTIVE deed older than 90 days with no completed mutation | MEDIUM | 25 |
| R4 | Any 30-day window with 3+ ACTIVE deeds | HIGH | 35 |
| R5 | Hash/signature/chain failure | CRITICAL | 100 |
| R6 | Khas/acquisition/disputed flag or open case | HIGH | 40 |
| R7 (P2) | Lineage break | HIGH | 35 |
| R8 (P2) | Registry vs mutation owner mismatch | HIGH | 35 |
Score = min(100, sum of decisive weights). Levels: 0-24 LOW, 25-59 MEDIUM, 60-84 HIGH, 85+ CRITICAL. Any CRITICAL decisive finding => blocked. ML (Phase 2) can raise Low/Medium by one step if probability >= 0.85, never lowers or blocks.

### 5.4 Mutation workflow (simplified, state this honestly)
SUBMITTED -> AUTO_CHECKED -> UNDER_REVIEW -> APPROVED -> KHATIAN_UPDATED; REJECTED allowed before APPROVED. Real e-Mutation includes notices/hearings/approvals not modeled here.

### 5.5 API summary (v1)
Public: GET /health, GET /deeds/{no}/verify, GET /plots/search, GET /plots/{id}, GET /plots/{id}/chain, GET /risk/plot/{id}, GET /analysis/plot/{id}, GET /mutations/{id} (masked). Auth: POST /auth/login. Registrar: POST /deeds, GET /deeds/{no}/qr, POST /mutations. Officer: POST /mutations/{id}/transition, GET /mutations, GET/PATCH /alerts. Admin: /dev/tamper, /dev/restore, /dev/status, GET /audit. Phase 2 adds /reconcile, /lineage, /reports/due-diligence, /keys, /transparency, /ingest/scan, /metrics.

---------------------------------------------------------------------
## 6. Roles and responsibilities (RACI)

| Area | Student A | Student B | Leader | Mentors |
|---|---|---|---|---|
| Registration, fee, platform uploads | | | R/A | I |
| Crypto, ledger, deed service, deed API | R | C (review) | A | |
| Fraud engine, mutation, seed, auth | C (review) | R | A | |
| Frontend: verify, citizen | R | C | A | |
| Frontend: registrar, officer, admin | C | R | A | |
| Docker, deploy | | | R | industry mentor C |
| Domain correctness (land workflow, terms) | | | A | faculty/industry mentors C |
| Concept note, README, deck | R | R | A | mentors review |
| Demo script, rehearsal | R | R | A | |
R = does the work, A = accountable, C = consulted, I = informed. Mentors guide only: they may not build or present or answer judges' questions at the Final.
Leader is one of the two students. Both students must be able to explain all code (judges may question either).

### 6.1 Working agreements
- Daily 15-minute sync (what done, what next, blockers). Evening 10-minute "explain your module" swap between students.
- Every PR reviewed by the other student. No direct commits to main.
- Decisions recorded in section 22 (decision log).

---------------------------------------------------------------------
## 7. Workflow overview (end to end)

```
Plan (this doc) -> Setup (repo, tools, accounts) -> Session loop x21 (Antigravity)
   -> PR review -> merge to develop -> demo check -> Phase 1 release (tag v1.0-round1)
   -> Submit Round 1 -> wait for selection -> Phase 2 on branch phase2 -> Final prep -> v2.0-final
```

### 7.1 The session loop (repeat for each feature)
1. `git switch develop && git pull`; create the branch named in the session prompt.
2. New Antigravity conversation. Run the slash command (e.g. /s03-ledger) or paste the prompt from ANTIGRAVITY_PHASE1_PROMPTS.md.
3. Agent works (Planning mode for PLAN sessions, Fast for FAST). Don't interrupt unless it drifts.
4. Agent finishes with tests, PROGRESS.md update, local commit, and prints HUMAN ACTIONS, REVIEW FOCUS, NEXT SESSION.
5. You: run tests yourself, do the HUMAN ACTIONS, read the diff, push the branch.
6. Open a PR into develop. The other student reviews against the REVIEW FOCUS list, CI must be green, merge (merge commit or rebase, not squash).
7. Tick the session in docs/PROGRESS.md. Start the next session in a fresh conversation.

### 7.2 Definition of Done (per session)
Tests added and green; scope respected; no secrets/real data; PROGRESS.md updated; PR reviewed; both students can explain the change.

### 7.3 Token and quota management
One feature per conversation; short always-on GEMINI.md; named-file reads only; stop at drift; planning mode only where needed; commit small. Details in ANTIGRAVITY_PHASE1_PROMPTS.md Part A.

---------------------------------------------------------------------
## 8. Git and GitHub workflow

| Branch | Purpose | Rules |
|---|---|---|
| main | Always deployable; Round 1 submission source | PR only, CI green, no force-push; tags mark releases |
| develop | Integration of Phase 1 work | PR from feature branches |
| feat/sNN-*, chore/*, docs/* | One per session/task | Short-lived, deleted after merge |
| phase2 | Long-lived Phase 2 integration | Starts from tag v1.0-round1; main stays frozen until selection |
| phase2/* | Phase 2 module branches | PR into phase2 |

- Commits: conventional (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), small, frequent. Both students commit under their own GitHub identity (alternate sessions).
- Merge style: merge commit or rebase-and-merge; avoid squash to preserve authorship history.
- Branch protection on main/develop/phase2: PR required, CI required, no force pushes.
- Secrets: .env, keys/, *.pem never committed. If one leaks, rotate immediately.
- Tags: `v1.0-round1` (frozen Round 1), `v1.1-recon-lineage`, `v1.2-offline-agent`, `v1.3-final-rc`, `v2.0-final`.
- Releases: create GitHub Releases for v1.0-round1 and v2.0-final with notes.
- Round 1 judging window: keep main equal to v1.0-round1; only small `fix/*` patches allowed.
- Keep `docs/CHANGELOG.md` and the README "Changes since Round 1" section current.
- Issues: one per session; label phase-1/phase-2; close via PR ("closes #n").

---------------------------------------------------------------------
## 9. Phase 1 schedule (Oct 10-15, Round 1 due Oct 16)

Standard plan (6 days). Sessions refer to ANTIGRAVITY_PHASE1_PROMPTS.md.
| Date | Focus | Sessions | Exit criteria |
|---|---|---|---|
| Sat Oct 10 | Blockers + setup + foundation | Registration email, accounts, tools, repo, S00 bootstrap, S01 models, S02 crypto, S03 ledger | Repo on GitHub, CI green, crypto+ledger tests pass |
| Sun Oct 11 | Deeds and data | S04 deed service, S05 seed, S06 auth, S07 deed/QR/plot API | Swagger shows register -> verify flow with seeded data |
| Mon Oct 12 | Intelligence | S08 fraud core (R1, R2, R5), S09 rules R3/R4/R6 + risk API, S10 mutation, S11 Tamper Lab/hardening | All seeded scenarios detected; Tamper Lab works in API |
| Tue Oct 13 | Frontend | S12 foundation, S13 verify, S14 citizen, S15 registrar, S16 officer/admin | Whole demo flow works in browser locally |
| Wed Oct 14 | Ship | S17 Docker, S18 cloud deploy, S19 docs/concept note/video | Live URL works on mobile data; docs drafted; video recorded |
| Thu Oct 15 | QA and submit | S20 final QA, fresh-clone test, tag v1.0-round1, upload | Submitted with confirmation screenshot |
| Fri Oct 16 | Buffer / deadline day | Emergency fixes only | |

Compressed 4-day plan (if you start late): Day 1 = S00-S05; Day 2 = S06-S11; Day 3 = S12-S17 (use parallel work, A and B on separate branches); Day 4 = S18-S20 + submit. Use the cut list in 9.1.

### 9.1 Cut list if behind (in order)
1. Detail of R4, 2. officer dashboard polish, 3. Bangla on admin pages, 4. Postgres on deploy (SQLite), 5. Docker-only local run if cloud deploy fails (record video from local and give repo; live link is "recommended, not mandatory").
Never cut: crypto verify, Tamper Lab, double-sale block, citizen page, tests, README, video, concept note.

### 9.2 Round 1 submission pack (platform upload)
- Concept note PDF, max 4 pages: problem chosen, Bangladesh context, solution, architecture + stack, key features, countrywide implementation plan, team and mentors.
- Repository link (GitHub/GitLab, public or shared with organizers) with README: setup, data sources, AI tool disclosure.
- Demo video, max 3 minutes.
- Live deployment link (recommended).

---------------------------------------------------------------------
## 10. Phase 2 schedule (Final, date TBA)

Start immediately after Round 1 upload (light prep), full build once selected and the date is known. Follow PHASE2_GUIDE.md. Typical order:
| Block | Work | Tag |
|---|---|---|
| 1 | Alembic baseline, feature flags, pipeline wiring, seed_phase2, reconciliation, lineage | v1.1-recon-lineage |
| 2 | Offline QR, AI report agent (with fallback) | v1.2-offline-agent |
| 3 | Privacy views, attack suite + metrics, Merkle log, then ML layer | |
| 3b | OCR ingest (only if time) | |
| 4 | Rollout/cost page, UI polish, staging deploy, release candidate | v1.3-final-rc |
| 5 | Pitch deck (<= 10 slides), rehearsals, final README, submit | v2.0-final |
Final-round requirements: both students present in person; 5 min pitch + live demo, 3 min Q&A; Bangla or English; presentation order by lottery; mentors may not present or answer for the team; updated repo + pitch deck PDF submitted before the Final (late submissions not accepted); README summarizes changes since Round 1.

---------------------------------------------------------------------
## 11. Environments and configuration

| Variable | Purpose |
|---|---|
| DATABASE_URL | sqlite (dev) / postgresql+psycopg (docker, cloud) |
| JWT_SECRET, JWT_EXPIRE_MINUTES | auth |
| SIGNING_KEY_PATH / SIGNING_KEY_HEX | Ed25519 key (file locally, env on cloud) |
| DEMO_MODE | enables Tamper Lab; false on public deployments except demo time |
| ALLOWED_ORIGINS, FRONTEND_URL | CORS and QR links |
| SEED_ON_START | seed empty DB at first boot |
| RATE_LIMIT, MUTATION_DAYS | limits and R3 threshold |
| FEATURE_* (Phase 2) | RECONCILE, LINEAGE, OFFLINE_QR, AGENT, OCR, ML |
| NEXT_PUBLIC_API_URL | frontend to backend |
Environments: local (venv/Docker), staging (Phase 2), production demo (Render/Railway + Vercel). Free tiers sleep: wake before judging/recording. Keep a local Docker copy as backup.

---------------------------------------------------------------------
## 12. Testing strategy
- Unit: crypto, ledger, each fraud rule, state machine, masking.
- Integration (API): register -> verify -> tamper -> verify fail; double-sale blocked; RBAC 401/403; mutation happy and illegal paths; rate limit.
- Scenario tests tied to seeded scenarios S1-S6 (these double as the demo script).
- Frontend: build + lint in CI; manual checks on phone.
- Phase 2: pipeline (failing layer skipped, flags), lineage, reconcile, agent with mocked LLM and fallback, ML load/fallback, attack suite.
- Targets: core services >= 80% coverage; verify p95 < 300 ms on demo data; demo completes < 3 minutes.
- CI on every push/PR; main must always be green.

---------------------------------------------------------------------
## 13. Security, privacy and rule compliance
Violations of data/security rules mean immediate disqualification and possible reporting to authorities.
- Synthetic data only (own, organizer-provided or clearly public). No real names, NIDs, phones, addresses or real land records.
- No scraping, automated querying or bulk download from government portals. No penetration testing or access attempts against live government/third-party systems. Security features are demonstrated only on our own prototype (attack suite targets only our app).
- Any real document used must be fully anonymized and pre-approved in writing. We use none.
- Controls: argon2 passwords, short JWT, RBAC on every protected route, masked public output, rate limiting, security headers, strict CORS, no stack traces, secrets in env only, audit log, Tamper Lab behind admin + DEMO_MODE, LLM agent read-only with schema-validated output.
- Honest limitations (state in concept note/pitch): prototype keys not HSM-protected; hash chain gives tamper evidence not prevention (Merkle roots and multi-signature mitigate); simplified mutation flow; heuristic rules; synthetic data only.
- Full list: SECURITY.md. Pre-submission sweep is Session S20.

### 13.1 AI tool use rules (from the rule book)
AI coding assistants and LLMs are allowed. Disclose every AI tool and how it was used in the README. Both students must be able to explain the submitted code and design; inability to explain affects scoring. Keep docs/AI_USAGE.md current.

### 13.2 IP and licensing
Team keeps ownership. Organizers get a non-exclusive, royalty-free right to publish team name, description, screenshots, videos. Open-source release encouraged (MIT planned). Credit all libraries in the README. Any pilot/incubation is a separate agreement. Keep full commit history; plagiarism or uncredited copying is disqualification.

---------------------------------------------------------------------
## 14. Deployment plan
1. Local: `docker compose up --build` (db, backend, frontend), seed on first start.
2. Cloud: backend + Postgres on Render/Railway (Dockerfile), frontend on Vercel (root `frontend`), env vars per DEPLOY.md, seed once, test from phone on mobile data.
3. Backup: local Docker copy, recorded full-run video, screenshots.
4. Phase 2: staging service first; production demo URL points to a release tag only.
5. Keys: persist the signing key (volume or env hex) or old deeds will show as tampered.

---------------------------------------------------------------------
## 15. Demo plan

### 15.1 Round 1 video (<= 3:00)
0:00 problem (20s) | 0:20 citizen risk report (30s) | 0:50 register deed + QR + VALID (40s) | 1:30 Tamper Lab -> TAMPERED (30s) | 2:00 double-sale blocked (30s) | 2:30 mutation steps (20s) | 2:50 close/rollout (10s).

### 15.2 Final pitch (5 min + 3 min Q&A)
0:00-0:30 problem + solution | 0:30-1:15 citizen check + AI report | 1:15-2:00 register + offline QR (turn off Wi-Fi) | 2:00-2:30 Tamper Lab + double-sale | 2:30-3:30 lineage break + reconciliation | 3:30-4:15 metrics + rollout | 4:15-5:00 limits, roadmap, close.

### 15.3 Demo-day runbook
- Night before: staging/prod URLs tested, accounts and scenario ids on a printed cheat sheet, laptop charged, hotspot ready, local Docker copy running, backup video on desktop.
- 10 minutes before: wake cloud servers, log in to each role in separate browser profiles, set DEMO_MODE=true, restore any tampered deeds.
- If live demo fails: switch to local copy, then to the backup video; keep talking about design and limits.

### 15.4 Q&A preparation (both students answer all)
Why not blockchain? What if the DB owner rewrites history? How does it integrate with existing systems? Is the score AI? How accurate and on what data? How are keys protected? What data did you use? Which AI tools did you use and where? What happens if the LLM is down? How would it scale nationally? What are the limits? (Answers are in PHASE2_GUIDE.md section 5.5 and the Master Plan sections 3, 13.)

---------------------------------------------------------------------
## 16. Evaluation and metrics plan
- Phase 1: scenario pass table (S1-S6 expected rule fires), test counts and coverage.
- Phase 2: labeled synthetic set (e.g., 200 deeds: 140 clean, 60 attacked); report precision, recall, false positive rate; attack suite detection rate; if ML built, compare rules-only vs ML-only vs rules+ML (PR-AUC) with a MODEL_CARD.md. Always state data is synthetic.
- Impact framing (qualitative, no invented statistics): time to verify a deed, fewer double-sale chances, cross-office visibility. Mark any figure that needs a source with [CITATION NEEDED].

---------------------------------------------------------------------
## 17. Risk register

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Late registration refused | Medium | Critical | Contact organizers now; ask in writing | Leader |
| Not enough time (4-6 days) | High | High | Session plan, cut list, parallel A/B work | Both |
| Agent produces code nobody understands | Medium | High | Review gate, REVIEW FOCUS, module-swap explanations | Both |
| Agent drift/token burn | Medium | Medium | One feature per session, scope lines, git restore | Both |
| Live demo fails | Medium | High | Local Docker + backup video | Leader |
| Data rule violation | Low | Critical | Synthetic only, S20 sweep, SECURITY.md | Both |
| Key loss makes deeds "tampered" | Low | High | Persist key, env hex backup, reseed procedure | A |
| Free tier sleeps/slow | High | Medium | Wake before demo, local fallback | Leader |
| Mentors unavailable | Medium | Medium | Confirm names early; ask domain questions in writing | Leader |
| Domain inaccuracy | Medium | Medium | Mentor review; state simplifications | Leader |
| Overclaiming (blockchain/AI/accuracy) | Medium | High | Use precise wording from this plan | Both |
| Missed Final fee/deadline | Low | Critical | Calendar reminders (3 days after announcement) | Leader |

---------------------------------------------------------------------
## 18. Master checklists

### 18.1 Before coding
- [ ] Late registration confirmed in writing; fee paid
- [ ] Mentors confirmed; judging rubric requested
- [ ] Repo + branch protection + collaborator; both git identities set
- [ ] Python 3.11+, Node 20+, Git, Docker, Antigravity installed; GEMINI.md and rules added
- [ ] Docs copied into docs/; workflows generated from the prompt pack

### 18.2 Before submitting Round 1
- [ ] All S00-S20 merged; CI green on main; no failing tests
- [ ] Fresh-clone run works (Docker and manual)
- [ ] Live link works on mobile data; QR scan tested on a real phone
- [ ] No secrets or real personal data in repo/history; synthetic statement in README
- [ ] README complete: setup, data sources, AI disclosure, demo accounts pointer
- [ ] Concept note PDF <= 4 pages; video <= 3 minutes
- [ ] `git shortlog -sn` shows both students with meaningful commits
- [ ] Tag v1.0-round1 pushed; uploaded on the platform; confirmation saved

### 18.3 Before the Final
- [ ] Confirmation fee paid within 3 days; both students confirmed to attend in person
- [ ] Phase 2 modules merged; tests green; flags tested on/off
- [ ] README "Changes since Round 1", AI_USAGE, MODEL_CARD/EVALUATION updated
- [ ] Pitch deck PDF (<= 10 slides) + repo link uploaded before the deadline
- [ ] Two timed rehearsals; Q&A drill; backup video and local copy ready

---------------------------------------------------------------------
## 19. Communication and tracking
- GitHub Issues + Projects board (To do / Doing / Review / Done) for sessions and tasks.
- docs/PROGRESS.md updated by the agent after every session.
- Shared chat group for the 4 members; send mentors weekly short status and specific questions (domain checks).
- Record decisions in section 22; record blockers in the issue tracker.

---------------------------------------------------------------------
## 20. Domain glossary (Bangladesh land administration)
| Term | Meaning |
|---|---|
| Khatian | Record of rights listing owners/possessors for land parcels |
| Porcha | Certified copy (extract) of the khatian |
| Dag / Plot number | Identifier of a land parcel within a mouza |
| Mouza | Revenue village/unit used to organize land records |
| CS / SA / RS / BS | Cadastral, State Acquisition, Revised, Bangladesh surveys (survey generations) |
| Deed (dolil) | Document recording a transfer/sale |
| Sub-registry office | Registers deeds |
| AC Land | Assistant Commissioner (Land) office handling mutation |
| Mutation (namjari) | Updating the khatian/record after a transfer |
| Khas land | Government-owned land |
| Acquisition | Land taken by the state for public purposes |
| Land Service Gateway | Government platform bringing land services online |
Have the faculty and industry mentors confirm these terms and the workflow wording before submission.

---------------------------------------------------------------------
## 21. Success criteria
- Round 1: selected for the Final (top ~25 expected).
- Final: working live demo, convincing metrics, clear rollout, confident Q&A from both students, and a stable system.
- Quality bar: every claim in the pitch can be shown in the demo or the repo.

---------------------------------------------------------------------
## 22. Decision log (append as you go)
| Date | Decision | Why |
|---|---|---|
| 2026-10-09 | Primary problem statement P2, supported by P3/P4/P5 | Strongest coherent story, demo-friendly |
| 2026-10-10 | Hybrid layered pipeline instead of a single path | Merge paths; each layer pluggable and switchable |
| 2026-10-10 | Hash-chained signed ledger, no public blockchain | Registrar stays authority; simpler and cheaper |
| 2026-10-10 | Rules decide, ML advisory, LLM explains | Auditability and honesty |
| 2026-10-10 | One feature per Antigravity session | Token/quota management and review quality |
| 2026-10-10 | main frozen at Round 1 tag until selection | Judges may open the repo during Round 1 |

---------------------------------------------------------------------
## 23. Assumptions to verify
- The Final date and detailed schedule (announced on the platform).
- Judging Rubric criteria and weights (separate document).
- Whether late registration and mentors' roles are acceptable to organizers.
- That synthetic Bangla names/places are acceptable (they are, as synthetic data is required).
- Current status of government platforms (check only through public information, never by scraping).

---------------------------------------------------------------------
## 24. Document index

| File | Purpose |
|---|---|
| MASTER_PLAN_AND_WORKFLOW.md (this file) | Full plan, roles, schedule, workflow, risks, checklists |
| PRD.md | Product requirements, personas, FR-IDs, metrics |
| TRD.md | Architecture, data model, crypto, API, layered pipeline, ML/OCR specs |
| SECURITY.md | Rule compliance, threat model, controls, pre-submission review |
| PHASE1_GUIDE.md | Manual step-by-step Phase 1 guide with code |
| PHASE2_GUIDE.md | Phase 2 modules, merging with Phase 1, GitHub for Phase 2, pitch |
| ANTIGRAVITY_PHASE1_PROMPTS.md | 21 session prompts, GEMINI.md, rules, workflow generation, git workflows |
| ANTIGRAVITY_PHASE2_PROMPTS.md | 20 Phase 2 session prompts, Phase 2 rules, git release workflows |
| README_TEMPLATE.md | README skeleton |
| LandShield_Master_Roadmap.pdf | Printable roadmap, folder structure and requirements |
| tools/split_prompts.py | Generates slash-command workflows from the prompt pack |
Generated during the build: PROGRESS.md, DEMO_ACCOUNTS.md, DEMO_SCRIPT.md, DEPLOY.md, AI_USAGE.md, MODULE_OWNERS.md, CHANGELOG.md, ARCHITECTURE.md, SUBMISSION_CHECKLIST.md, concept-note/CONCEPT_NOTE.md; Phase 2: EVALUATION.md, MODEL_CARD.md.

---------------------------------------------------------------------
## 25. Next 24 hours (start here)
1. Email/call organizers about late registration; request the Judging Rubric and confirm the Final date process.
2. Confirm both mentors; pay the fee; save proofs.
3. Create the GitHub repo, protect branches, invite the second student.
4. Install tools; set git identities; add GEMINI.md and rules; generate slash workflows.
5. Run S00, then S01, S02, S03 (alternating students). Push and review each PR.
6. At the end of the day update PROGRESS.md and the risk register.
