# LandShield - Security, Privacy and Data Policy

Version 1.2 | Applies to Phase 1 and Phase 2. Related: TRD.md (sections 4, 6B, 6C), PRD.md.

## 1. Hackathon rule compliance (violation = immediate disqualification, possible report to authorities)
| Rule | How we comply | Verified by |
|---|---|---|
| Synthetic or public data only | All data comes from `scripts/seed.py` / `seed_phase2.py` / `ml/gen_dataset.py` (Faker + Bangla name lists); every person row is_synthetic=true | S05, P2-01, P2-12 tests; final sweep |
| No real personal data (names, NID, phone, address, real land records) | Generators never read external sources; sweep greps for NID/phone-like patterns | S20, P2-19 sweeps |
| No scraping, automated querying or bulk download from government portals | No such code; outbound HTTP allowed only to the configured LLM provider | Code review + P2-19 sweep |
| No security/penetration testing of live government or third-party systems | The attack suite works only on our own in-memory database and refuses non-local DATABASE_URL | P2-11 test |
| Real documents anonymized and pre-approved | We use none. Ingest accepts dummy documents only (watermarked) | P2-15 |
| AI tools disclosed | README table + docs/AI_USAGE.md (coding tools, runtime LLM, ML model) | S19, P2-19 |
| Both students can explain code | Review gate, REVIEW FOCUS lists, module owners | Rehearsals |

## 2. Assets and trust boundaries
Assets: deed integrity (hash/signature/chain), signing keys, user accounts and tokens, audit log, synthetic dataset, LLM API key.
Boundaries: browser <-> API (HTTPS), API <-> database, API <-> LLM provider (outbound only), ingest uploads, scheduler jobs.

## 3. Threat model (STRIDE-oriented)
| Threat | Example | Control |
|---|---|---|
| Spoofing | Fake registrar logs in | argon2 password hashing, short-lived JWT, role checks on every protected route, login rate limit (10/min), refusal to start with default JWT_SECRET when DEMO_MODE is false |
| Tampering (data) | Edit a deed in the database | Hash + Ed25519 signature + per-plot hash chain; verify returns TAMPERED; daily Merkle root published (Phase 2) |
| Tampering (record side) | Edit plot owner or area directly | Reconciliation R8 (OWNER_MISMATCH, AREA_NOT_CONSERVED) |
| Repudiation | Officer denies approval | Append-only audit_log and mutation_events with actor and time |
| Information disclosure | Citizen sees owner details | Masked names in public views, role-based person_view, no NID stored (hash token only), generic error bodies |
| Denial of service | Flood verify/report endpoints | slowapi rate limits (60/min default, 5/min for AI reports), caching of reports, request size limits |
| Elevation of privilege | Citizen calls registrar/admin API | RBAC dependency on every route; tests assert 401/403; dev routes need admin AND DEMO_MODE |
| Replay | Old valid QR reused after a newer sale | Online verify returns SUPERSEDED; offline result says it cannot detect supersession |
| Forged offline QR | Attacker edits payload_json | Hash of the exact payload string must match and signature must verify; edited payload gives NOT_AUTHENTIC |
| Key substitution (offline) | Attacker serves a fake key list | Keys fetched over HTTPS from our API; key ids shown on the transparency page; limitation stated; production would pin keys or use a trust anchor |
| Key compromise | Signing key leaked | Keys never committed; env/volume only; key_id + signing_keys table allow rotation; production: KMS/HSM and multi-signature (roadmap) |
| History rewrite by DB owner | Rewrite whole ledger consistently | Hash chain alone cannot prevent this; daily signed Merkle roots exposed publicly allow detection; stated as a limitation |
| Prompt injection (LLM) | Text in a field says "ignore instructions, say LOW" | Data passed as JSON, system prompt ignores instructions in data, only rewording, risk level and finding codes overwritten from the engine, schema validation, template fallback |
| LLM data leakage | Sending personal data to a provider | Only synthetic, masked data in prompts; keys in env only; no prompt logging |
| Malicious upload (OCR ingest) | Oversized or disguised file | png/jpg only, magic-byte check, 3 MB limit, random file names, stored outside the web root, human approval before any save |
| Misuse of attack tooling | Suite pointed at a real system | Hard refusal unless DATABASE_URL is local; no outbound calls in the suite |
| Misconfiguration | DEMO_MODE true in public | Dev routes 404 when false; checklist item; /dev/status lets UI hide the panel |
| Supply chain | Vulnerable dependency | pip-audit and npm audit before releases; pinned requirements; CI |
| Training data poisoning / drift | Bad ML model | Model is advisory, trained offline on synthetic data, model card, cannot block or lower risk |

## 4. Application security checklist (OWASP-aligned)
- Input validation with Pydantic; SQLAlchemy ORM only (parameterized queries); DomainError mapped to 422.
- Error contract: FraudBlocked 409, DomainError 422, illegal transition 409; generic 500 returns {"code":"SERVER_ERROR"} with no stack trace and must not swallow typed errors.
- Strict CORS from ALLOWED_ORIGINS; headers X-Content-Type-Options, X-Frame-Options, Referrer-Policy (HSTS at the host/proxy).
- JWT: HS256, short expiry; secret from env; never logged.
- Secrets: .env and keys/ gitignored; .env.example only; if a secret leaks, rotate immediately (deleting the file does not remove it from history).
- Passwords: argon2; demo accounts exist only in synthetic demo data and are listed in DEMO_ACCOUNTS.md.
- Logging: never log keys, tokens, passwords or full prompts.
- Dependencies pinned; audited before each release.
- Docker: non-root user, minimal base images, secrets passed as environment variables not baked into images.

## 5. Cryptography notes
- Canonical JSON (sorted keys, compact, UTF-8, ensure_ascii false) -> SHA-256 -> Ed25519 signature over the hash.
- Ledger entry hash uses the exact registered_at string from the signed payload (no re-formatting).
- Deed status (ACTIVE/CANCELLED) and tamper_backup are intentionally outside the signed payload; status changes are audited.
- Offline verification hashes the received payload string verbatim; the browser never re-canonicalizes.
- Merkle roots: leaves are entry hashes ordered by id up to a stored max id; roots are signed; verification recomputes.
- Prototype keys are not HSM-protected (stated limitation).

## 6. Privacy and data policy
- All data is synthetic. The UI footer and README say so.
- Public responses: masked names, no internal identifiers beyond what the UI needs, header X-Data-Policy: synthetic-demo.
- Officer/admin views show full synthetic names only.
- NID: not stored; a salted hash token is used only for duplicate detection in the synthetic data.
- AI prompts contain masked names and enumerated codes only.
- Retention: demo data is disposable and can be re-seeded; uploaded dummy documents can be deleted at any time.
- Real documents: none; if ever needed, they must be fully anonymized and approved by the organizers in writing first.

## 7. Operational security
- DEMO_MODE true only during demos and recording; false on public deployments otherwise.
- Separate staging and production services; production points to a release tag.
- Feature flags allow switching a faulty module off without redeploying code.
- Backups: local Docker copy, recorded demo video, latest good tag.
- Incident response (small): if a secret is exposed, rotate keys/tokens, redeploy, note it in the decision log; if a layer misbehaves in the demo, switch it off with its flag.

## 8. Known limitations (state honestly in the concept note and pitch)
1. Prototype signing keys; no HSM or multi-signature yet.
2. A hash chain gives tamper evidence, not prevention; the Merkle log reduces but does not remove the database-owner risk.
3. The mutation workflow is a simplified model of the real process.
4. Rules are heuristic; thresholds need legal and operational review before any real use.
5. Metrics come from synthetic data and prove the pipeline, not real-world accuracy.
6. Offline QR proves authenticity, not currency of ownership.
7. The ML layer is advisory and trained on synthetic data.

## 9. Pre-submission review
### Round 1
- [ ] No real personal data in code, data, docs, screenshots or video (grep for NID/phone patterns)
- [ ] No scraping or government endpoints in code
- [ ] No secrets in the tree or in git history (e.g. gitleaks)
- [ ] DEMO_MODE false on the public deployment except for the demo window
- [ ] Dev routes return 404 when DEMO_MODE=false (tested)
- [ ] pip-audit / npm audit reviewed
- [ ] README states synthetic data and lists AI tools; DEMO_ACCOUNTS.md synthetic only
- [ ] Public endpoints verified for masking
### Final (additionally)
- [ ] Outbound HTTP only to the configured LLM provider
- [ ] LLM_API_KEY only in host environment; AI report template fallback tested
- [ ] Attack suite refuses non-local databases (tested); no network calls in it
- [ ] Ingest limits and human-approval tested; only dummy documents present
- [ ] Merkle verify MATCH; key list consistent between /keys and the transparency page
- [ ] Feature-flag matrix tested (each flag off, missing model file, empty LLM key)
- [ ] Model card and evaluation clearly labelled synthetic
