# LandShield - PHASE 2 GUIDE (Final Round "Differentiators")

Version 1.2 | Companion to ANTIGRAVITY_PHASE2_PROMPTS.md (agent sessions). This guide is for the humans: what to do, how to
manage GitHub, how to merge with Phase 1, and how to prepare for the Final.
Authoritative semantics: TRD.md sections 6B and 6C. If anything here differs, follow TRD.md and the Phase 2 prompt pack.

Phase 2 starts after the Round 1 upload and tag `v1.0-round1`. Only selected teams (about 25) go to the Final (Knowledge Tower, DIU,
date TBA). Pay the 100 BDT confirmation fee within 3 days of the announcement. Phase 2 is an IMPROVEMENT of the Round 1 project, not a new
project, and the README must summarize the changes.

---------------------------------------------------------------------
## 0. Definition of done
1. Reconciliation R8 and lineage R7 working, with UI.
2. Offline-verifiable QR working on a phone with no network.
3. AI due-diligence report with a tested template fallback (the demo never depends on the LLM).
4. Role-based privacy views and Merkle transparency log.
5. Attack suite and metrics page with honest, synthetic numbers.
6. Optional: ML advisory layer with model card; scan-to-ingest.
7. Rollout/cost page, 10-slide pitch deck PDF, updated README, repo link submitted before the Final.
8. Round 1 behaviour and tests unchanged and green.

---------------------------------------------------------------------
## 1. GitHub: keep Phase 1 safe, work on `phase2`

### 1.1 Freeze Round 1
Judges may open the repo during Round 1 evaluation. Keep `main` equal to `v1.0-round1` until results are announced. Never move or delete that tag.
Only tiny `fix/*` PRs (typos, deployment breakage) may touch main.

### 1.2 Branches
```
main                      frozen at v1.0-round1 until selection
phase2                    long-lived integration branch (created by /phase1-tag)
phase2/<module>           one per session, e.g. phase2/p2-02-reconcile
chore/*, docs/*           small non-feature tasks (PR base phase2)
```
```bash
git switch main && git pull && git switch -c phase2 && git push -u origin phase2   # done by /phase1-tag
git switch phase2 && git pull && git switch -c phase2/p2-02-reconcile
```
Protect `phase2` like main: PR required, CI required, no force pushes. Merge style: merge commit or rebase-and-merge (no squash).
Both students commit under their own identity (alternate sessions). Never commit `.env`, `keys/`, `*.db`, model files over a few MB (use Git LFS or `make train`).

### 1.3 Workflows (slash commands from ANTIGRAVITY_PHASE2_PROMPTS.md)
| Command | When |
|---|---|
| `/git-ship base=phase2` | After you reviewed a session: tests, push branch, open PR into phase2 |
| `/p2-milestone-tag v1.1-recon-lineage` | After P2-04 merged |
| `/p2-milestone-tag v1.2-offline-agent` | After P2-08 merged |
| `/p2-milestone-tag v1.3-final-rc` | After P2-19 merged (release candidate) |
| `/phase2-release` | When selected and the Final build is ready; opens PR phase2 -> main; you merge it |
| `/phase2-tag` | After the merge: tags `v2.0-final` |

### 1.4 Bringing Round 1 fixes into phase2
```bash
git switch phase2 && git pull && git merge main     # resolve conflicts, run tests, push through a PR
```

### 1.5 Repo hygiene
Update `docs/CHANGELOG.md` after each merged module; copy it into the README section "Changes since Round 1". Keep `docs/AI_USAGE.md`
current (runtime LLM use and the ML model count as AI tools). Check `git shortlog -sn` weekly so both students keep committing.
GitHub Release notes for `v1.0-round1` and `v2.0-final` come from the CHANGELOG, never invented.

---------------------------------------------------------------------
## 2. Merging Phase 2 with Phase 1 (technical rules)
1. **Additive only:** new tables, endpoints, services, layers. Do not rename or delete Phase 1 fields/endpoints/tests.
2. **Alembic from P2-00:** the baseline is stamped on existing databases (`alembic stamp head`); new changes via `alembic revision --autogenerate`, reviewed by hand. SQLite uses batch mode. Tests still use create_all plus one migration-equivalence test.
3. **Feature flags** (settings, exposed at runtime by `GET /api/v1/features`; the frontend reads them without rebuilding):
   FEATURE_RECONCILE, FEATURE_LINEAGE, FEATURE_OFFLINE_QR, FEATURE_AGENT, FEATURE_TRANSPARENCY, FEATURE_ML, FEATURE_OCR.
4. **Layered pipeline already exists** (Phase 1 S08). Phase 2 adds layers (reconcile, lineage, ml) to the registry; the report gains `layers`, `layers_run`, `lineage_available`. `/risk/plot` keeps its Round 1 shape; `/analysis/plot` carries the extended body.
5. **Do not change R1-R6 semantics** (TRD 6B). New layers must not duplicate them (R8 never repeats R3).
6. **Seeds:** `seed_phase2.py` is additive and idempotent (khatians, prices, Phase 2 scenarios) and never wipes Phase 1 data.
7. **Staging first:** deploy `phase2` to a separate staging service; the main demo URL points to a release tag only.
8. Every PR must keep all Round 1 tests green.

---------------------------------------------------------------------
## 3. Module guide (prompt id -> what and how)

### P2-00 Foundation (0.5 day)
Alembic baseline, feature flags + `/features`, layered report fields, PROGRESS.md Phase 2 table, CHANGELOG start. No new features.

### P2-01 Tables + seed_phase2 (0.5 day)
Models: Khatian, SigningKey, MerkleRoot, IngestDraft, `Deed.price_bdt`. One migration. Seed: lineages for about 60% of plots,
synthetic prices, and Phase 2 scenarios (L1 missing SA, L2 orphan RS, L3 area growth, R1 edited record owner, R2 stalled mutation, R3 edited area, C1 clean).

### P2-02 Reconciliation R8 (0.5 day)
Sub-codes: OWNER_MISMATCH (plot.current_owner_id differs from the largest record holder), MUTATION_STALLED (stuck in AUTO_CHECKED/UNDER_REVIEW longer than MUTATION_DAYS), AREA_NOT_CONSERVED (sum of record holdings differs from plot area). R3 still owns "no completed mutation".
```python
def reconcile_plot(db, plot, now=None):
    issues = []
    rec = record_holdings(db, plot)                       # TRD 6B
    top = largest_holder(rec)
    if top is not None and plot.current_owner_id != top:
        issues.append(("OWNER_MISMATCH", "Record owner differs from mutation-derived owner"))
    for m in stalled_mutations(db, plot, settings.MUTATION_DAYS, now):
        issues.append(("MUTATION_STALLED", f"Mutation {m.id} stuck in {m.state}"))
    if abs(sum(rec.values()) - plot.area_decimal) > 1e-6:
        issues.append(("AREA_NOT_CONSERVED", "Record holdings do not add up to plot area"))
    return issues
```
Officer endpoints: `/reconcile/{plot_id}` and `/reconcile?district=&type=`.

### P2-03 Lineage R7 (1 day, your most unique feature)
Order CS < SA < RS < BS. Sub-codes: MISSING_GENERATION (present types not contiguous), ORPHAN (not the earliest present type but no parent), BAD_PARENT (parent not an earlier type), AREA_GROWTH (child area > parent area x 1.05; decreases are allowed because plots get partitioned). A plot with no khatians gets no finding and `lineage_available=false`.
```python
ORDER = ["CS", "SA", "RS", "BS"]
def check_lineage(khatians, tol=0.05):
    issues = []
    by_id = {k.id: k for k in khatians}
    idx = {k.id: ORDER.index(k.survey_type) for k in khatians}
    present = sorted({idx[k.id] for k in khatians})
    if present and present != list(range(present[0], present[-1] + 1)):
        issues.append(("MISSING_GENERATION", "A survey generation is missing in the chain"))
    for k in khatians:
        if k.parent_id is None:
            if idx[k.id] != present[0]:
                issues.append(("ORPHAN", f"{k.survey_type} khatian {k.khatian_no} has no parent"))
            continue
        p = by_id.get(k.parent_id)
        if p is None or idx[p.id] >= idx[k.id]:
            issues.append(("BAD_PARENT", f"{k.survey_type} khatian {k.khatian_no} has an invalid parent"))
        elif k.area_decimal > p.area_decimal * (1 + tol):
            issues.append(("AREA_GROWTH", f"Area grows from {p.survey_type} to {k.survey_type}"))
    return issues
```

### P2-04 UI for layers (0.5 day)
`/check` uses `/analysis/plot`; RiskCard groups findings by layer; lineage timeline; `/officer/reconcile`. Tag `v1.1-recon-lineage`.

### P2-05 and P2-06 Offline QR (1 day total)
Payload = base64url of compact JSON `{v:1, payload_json:"<exact signed string>", hash, sig, key_id}`. The browser hashes the UTF-8 bytes of `payload_json` AS RECEIVED, compares with `hash`, then verifies the Ed25519 signature over the hash bytes with the key for `key_id` from `/keys` (cached). **Never re-canonicalize in the browser:** JS and Python print numbers like 30.0 differently.
```ts
import nacl from "tweetnacl";
async function verifyOffline(p: {payload_json: string; hash: string; sig: string; key_id: string}, keys: Record<string,string>) {
  const bytes = new TextEncoder().encode(p.payload_json);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  if (toHex(digest) !== p.hash) return "NOT_AUTHENTIC";
  const pub = keys[p.key_id]; if (!pub) return "KEY_UNKNOWN";
  const ok = nacl.sign.detached.verify(fromHex(p.hash), fromHex(p.sig), fromHex(pub));
  return ok ? "AUTHENTIC" : "NOT_AUTHENTIC";
}
```
A backend-generated test vector (`offline_vector.json`) is verified by a frontend unit test so both languages agree. Keep the payload small and use error correction L; test scanning on a real phone. Offline cannot tell whether a newer sale exists; the UI says so.

### P2-07 and P2-08 AI due-diligence report (1.5 days)
Design: deterministic code gathers read-only facts (plot summary, combined analysis, reconcile, lineage, flags; names masked), then ONE LLM call writes the wording. Output is validated against a schema; `risk_level` and finding codes are overwritten from the engine; any failure (no key, timeout, invalid JSON) returns the template report (`source: "template"`). Treat all database text as untrusted (prompt injection): pass data as JSON, instruct the model to ignore instructions in data. Rate limit 5/min, cache 10 minutes, 20-second timeout, never log keys or prompts. UI shows "Written by AI from verified facts" or "Generated from rules", plus print-to-PDF. Tag `v1.2-offline-agent`.
(An optional tool-calling loop can sit behind a flag; skip it unless everything else is done.)

### P2-09 Privacy views (0.25 day)
One `person_view(person, viewer)` helper; citizens see masked names, officers see full synthetic names; no extra identifiers in public responses; test every public endpoint for leaks; `docs/DATA_POLICY.md`.

### P2-10 Merkle transparency log (0.25-0.5 day)
```python
import hashlib
def merkle_root(hex_hashes):
    if not hex_hashes: return hashlib.sha256(b"").hexdigest()
    layer = [bytes.fromhex(h) for h in hex_hashes]
    while len(layer) > 1:
        if len(layer) % 2: layer.append(layer[-1])
        layer = [hashlib.sha256(layer[i] + layer[i+1]).digest() for i in range(0, len(layer), 2)]
    return layer[0].hex()
```
Leaves = ledger entry hashes with id <= stored `max_entry_id`, ordered by id. Store (date, root, entry_count, max_entry_id, signature over sha256("date|count|root")). Verify recomputes over ids <= max_entry_id; a mismatch means older history changed. Public page `/transparency`.

### P2-11 Attack suite + metrics (1 day, high impact)
Runs ONLY against a fresh in-memory database and refuses a non-local DATABASE_URL. Attacks: A1 edit deed field, A2 swap signatures, A3 delete middle ledger entry, A4 double sale, A5 seller not owner, A6 replay after newer sale (SUPERSEDED), A7 edit record owner (OWNER_MISMATCH), A8 break lineage, A9 forged key id. Evaluation unit = plot; flagged = level >= MEDIUM (also report HIGH+); report precision, recall, false-positive rate and list false positives with the responsible rule. Outputs `data/metrics/metrics.json`, `docs/EVALUATION.md`, `/metrics` page. Be honest: synthetic data, no tuning to hide false positives.

### P2-12 to P2-14 ML advisory layer (about 2.5 days, cut-able)
- One pure feature function `features_from_history(history, subject, plot_context)` used for BOTH training and serving; a DB adapter builds the history at serve time.
- Dataset: synthetic in-memory database built with the real services; about 600 plots / 2000 deeds; about 10% injected anomalies the rules do NOT cover (price far below median, circular transfers, one buyer from many new sellers, odd registration hours) plus near-miss clean cases (family transfers, legitimate fast resale). Labels come from the injection, never from the rule engine. Split by plot.
- Train IsolationForest baseline and LightGBM; compare rules-only vs ML-only vs combined on test plots; SHAP top-3 reasons; `MODEL_CARD.md`.
- Serve as an advisory layer: probability >= 0.85 may raise Low/Medium by one step; never blocks, never lowers; missing model means skipped.
- Train offline (`make train`); never at container start; keep the model file small or use Git LFS.

### P2-15 Scan-to-ingest (0.5-1 day, bonus)
Dummy watermarked khatian images (Pillow + Noto Sans Bengali) -> LLM vision extraction with per-field confidence -> mandatory human review -> creates a Khatian (feeds lineage) or prefills the deed form (never auto-registers). Limits: png/jpg, magic-byte check, 3 MB, stored outside web root. Skip if behind schedule.

### P2-16 Rollout and cost page (0.5 day)
Pilot upazila -> district -> national; integration through official APIs (no claims about current availability); KMS/HSM and multi-signature; training; SMS/USSD; cost model with explicit assumptions and ranges, marked "estimates to be validated"; mentors review. Never invent official figures.

### P2-17 Pitch pack, P2-18 Staging, P2-19 Final QA
See section 5 and the prompt pack. Tag `v1.3-final-rc` after P2-19.

---------------------------------------------------------------------
## 4. Schedule (adjust to the Final date)
| Block | Work | Tag |
|---|---|---|
| 1 | P2-00 to P2-04 | `v1.1-recon-lineage` |
| 2 | P2-05 to P2-08 | `v1.2-offline-agent` |
| 3 | P2-09, P2-10, P2-11, then P2-12 to P2-14 (ML), P2-15 (OCR) only if time | |
| 4 | P2-16 to P2-19, rehearsals | `v1.3-final-rc`, then `v2.0-final` |
Cut order: OCR, ML, Merkle, privacy polish. Never cut P2-00 to P2-08, P2-11, the pitch pack and final QA. A stable demo with fewer layers beats a half-working version of all.

---------------------------------------------------------------------
## 5. Final submission and pitch

### 5.1 Before the Final (platform upload; late submissions are not accepted)
- [ ] Updated repository link; README has "Changes since Round 1"; AI disclosure updated (runtime LLM, ML model, coding tools)
- [ ] Pitch deck PDF, maximum 10 slides
- [ ] Live deployment from `v1.3-final-rc` or `v2.0-final`
- [ ] Both students confirmed to attend in person (mentors encouraged, but do not present or answer for you)

### 5.2 Pitch deck (max 10 slides)
1 Title + problem statements | 2 Problem in Bangladesh | 3 Idea: verification and reconciliation layer | 4 Architecture (layered pipeline)
5 Demo overview | 6 Unique features (Tamper Lab, reconciliation, lineage, offline QR, explainable Bangla report) | 7 Numbers: precision/recall, attack detection (synthetic)
8 Security, privacy, honest limitations | 9 Rollout and cost | 10 Roadmap + team.

### 5.3 5-minute script (3 minutes Q&A follows; presentation order is by lottery)
| Time | Content |
|---|---|
| 0:00-0:30 | Problem and one-line solution |
| 0:30-1:15 | Citizen check and AI report (Bangla) |
| 1:15-2:00 | Register deed, offline QR on a phone with Wi-Fi off |
| 2:00-2:30 | Tamper Lab -> TAMPERED; double sale blocked |
| 2:30-3:30 | Lineage break and reconciliation mismatch |
| 3:30-4:15 | Metrics slide and rollout |
| 4:15-5:00 | Limits, roadmap, close |
Both students speak. Presentations may be in Bangla or English.

### 5.4 Demo safety plan
Staging and production tested the night before; wake free-tier servers 10 minutes early; local Docker copy running; recorded backup video on the laptop; feature flags known (switch off a faulty layer); phone hotspot ready; cheat sheet with accounts and plot ids printed.

### 5.5 Q&A drill (both students answer all)
Why not blockchain? What if the database owner rewrites history? How does it integrate with existing systems? Is the score AI? How accurate, on what data? How are keys protected? What data did you use? Which AI tools and where? What if the LLM is down? Can offline QR detect a newer sale? How would it scale nationally? What are the limits? (Answers in docs/pitch/QA.md, written in P2-17.)

---------------------------------------------------------------------
## 6. Final checklist
- [ ] `v1.0-round1` untouched; all Phase 2 PRs reviewed by the other student and merged into `phase2`
- [ ] Round 1 tests unchanged and green; CI green
- [ ] Migrations apply on a fresh database; seed + seed_phase2 work
- [ ] Feature-flag matrix tested (each flag off, missing model file, empty LLM key)
- [ ] SECURITY.md Final checklist complete (no real data, no secrets, no scraping, outbound HTTP only to the LLM provider)
- [ ] CHANGELOG, README "Changes since Round 1", MODEL_CARD, EVALUATION, DATA_POLICY, ROLLOUT, AI_USAGE complete
- [ ] `phase2` merged to main via `/phase2-release`, `v2.0-final` tagged, GitHub Release written
- [ ] Deck uploaded, repo link updated, two timed rehearsals done, backups ready
