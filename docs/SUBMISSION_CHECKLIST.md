# LandShield — Official Round 1 Submission Checklist
**LandTech Innovation Hackathon 2026** | Track: Digital Land Records, Verification & Digitization  
**Department of CSE & CSE-TECH, Daffodil International University (DIU)**  
**Submission Portal:** `landtech.diu.edu.bd/landtech` | **Deadline:** October 16, 2026 (Target: Oct 15)  
**Document Status:** Final Release QA & Pre-Submission Audit

---

## 1. Automated Verification Audit (100% Passing)

| Verification Dimension | Command | Expected Result | Status |
|---|---|---|:---:|
| **Backend Unit & Integration Tests** | `pytest -q` in `backend/` | 105 passed, 0 failures | ✅ **PASS** (105/105) |
| **End-to-End Smoke Test Suite** | `python scripts/smoke_test.py --base-url <url>` | 12/12 checks passed | ✅ **PASS** (12/12) |
| **Frontend Production Build** | `npm run build` in `frontend/` | 10 static routes prerendered | ✅ **PASS** (10/10) |
| **Frontend Code Quality & Lint** | `npm run lint` in `frontend/` | 0 errors, 0 warnings | ✅ **PASS** (Clean) |
| **Live Backend API & Database** | `GET /api/v1/health/deep` | HTTP 200, DB connected, 300 plots | ✅ **LIVE** (Render) |
| **Live Swagger Documentation** | `GET /docs` on live backend | Interactive API console ready | ✅ **LIVE** (Render) |

---

## 2. Regulatory & Security Compliance (Rule Book Section 8 & 9)

### 2.1 Data Privacy & Security (STRICT Compliance)
- [x] **100% Synthetic Data:** All citizen names (e.g., *রহিম উদ্দিন*, *করিম চৌধুরী*), plots, dags, and deed numbers are synthetically generated via deterministic Faker scripts.
- [x] **Zero Real NIDs or Phone Numbers:** Repository contains zero 10/13/17-digit real Bangladeshi NIDs or telephone numbers.
- [x] **Zero Government Scraping:** No automated scraping bots, queries, or network requests targeting `.gov.bd` (e-Mutation, e-Porcha, Land Service Gateway) exist in the codebase.
- [x] **Zero Live Attack Vectors:** No penetration testing tools or external attack routines are directed outside the local/hosted prototype.
- [x] **Name Masking Enforced:** Public endpoints (`/deeds/{no}/verify`, `/plots/{id}`, `/plots/{id}/chain`) mask citizen names (*র***ন খ***ন*) by default.
- [x] **No Leaked Credentials:** Verified that `.env`, `keys/`, `*.pem`, `*.db`, `landshield.db`, and `node_modules/` are strictly ignored by `.gitignore` and absent from git history.
- [x] **Production Dev Guard:** When `DEMO_MODE=false`, tampering endpoints (`/api/v1/dev/tamper`, `/api/v1/dev/restore`) strictly return `HTTP 404 Not Found`.

### 2.2 AI Usage Disclosure (Rule Book Section 9)
- [x] **Formal AI Disclosure:** `docs/AI_USAGE.md` and `README.md` document the use of Google Antigravity IDE (Gemini 3.8 Flash) and GitHub Copilot.
- [x] **Human Oversight Attested:** Dual-student code inspection, unit test validation, and oral defense competence confirmed.

---

## 3. Four Core Submission Deliverables

### Deliverable 1: Concept Note (PDF, Maximum 4 Pages)
- **Draft Source:** [`docs/concept-note/CONCEPT_NOTE.md`](file:///c:/Land%20Project/Land_shield/docs/concept-note/CONCEPT_NOTE.md) (~1,650 words).
- **Core Content Included:**
  - Executive summary and problem statement (P2 primary; P3, P4, P5 supporting).
  - Bangladesh land record challenges (CS/SA/RS/BS Khatians, deed forgery, departmental silos).
  - System architecture with ASCII component diagram and cryptographic flow.
  - Built Round 1 features vs planned Phase 2 features matrix.
  - Countrywide phased rollout plan (Phase A: Upazila -> Phase B: District -> Phase C: National Gateway).
  - Key management lifecycle (KMS/HSM) and data privacy policy.
- **Human Actions Remaining:**
  - [ ] Replace `[CITATION NEEDED]` tags with formal academic/legal citations.
  - [ ] Export `CONCEPT_NOTE.md` to `docs/concept-note/CONCEPT_NOTE.pdf`.
  - [ ] Inspect generated PDF page count — **must be 4 pages or fewer**!

### Deliverable 2: GitHub Repository & Authoritative README
- **Authoritative README:** [`README.md`](file:///c:/Land%20Project/Land_shield/README.md) formatted per `docs/README_TEMPLATE.md`.
- **Reproducibility:** Step-by-step instructions for local virtualenv, Docker Compose, and live endpoints.
- **Evaluation Scenarios:** Benchmark matrix detailing scenarios S1 through S8 with expected vs actual results.
- **Dual Authorship:** Preserved commit history with alternating contributions between Student 1 and Student 2.
- **License:** Open-source MIT License included in root [`LICENSE`](file:///c:/Land%20Project/Land_shield/LICENSE).

### Deliverable 3: Demo Video (Maximum 3 Minutes)
- **Rehearsed Script:** [`docs/DEMO_SCRIPT.md`](file:///c:/Land%20Project/Land_shield/docs/DEMO_SCRIPT.md) (0:00 to 3:00 timeline).
- **Presentation Breakdown:**
  - `0:00 - 0:35`: Student 1 — Problem hook & Citizen Pre-Purchase Check on Dag 401.
  - `0:35 - 1:15`: Student 2 — Sub-Registrar Pre-Registration Fraud Blocker (S1 Double Sale Block).
  - `1:15 - 1:50`: Student 1 — Public QR Camera Verification (S6 Clean Deed).
  - `1:50 - 2:25`: Student 2 — Admin Tamper Lab single-byte payload tampering proof.
  - `2:25 - 3:00`: Student 1 — AC Land e-Mutation Stepper with Audit Trail & wrap-up.
- **Human Actions Remaining:**
  - [ ] Record screen capture using OBS Studio following the exact script.
  - [ ] Upload video to YouTube (Unlisted) or Google Drive (Anyone with link can view).
  - [ ] Copy public link into `README.md` under `[YOUTUBE / DRIVE 3-MINUTE VIDEO URL]`.

### Deliverable 4: Live Deployment Link (Recommended)
- **Backend API:** `https://land-shield.onrender.com` (FastAPI + Managed PostgreSQL 15 on Render).
- **Backend Swagger Docs:** `https://land-shield.onrender.com/docs`.
- **Frontend Web App:** Deployed on Vercel connecting to live backend API.
- **Mobile Rehearsal:** Tested over 4G/5G mobile hotspot for live QR camera scanning.

---

## 4. Pre-Submission Placeholders Checklist (Human Tasks)

Before submitting the form on `landtech.diu.edu.bd/landtech`, verify that all brackets have been populated:

- [ ] **Live Vercel Application URL:**
  - Update `README.md`: replace `[LIVE VERCEL URL — e.g. https://land-shield.vercel.app]`.
- [ ] **Demo Video URL:**
  - Update `README.md`: replace `[YOUTUBE / DRIVE 3-MINUTE VIDEO URL]`.
- [ ] **Student Team Information:**
  - Student 1 (Team Leader): Name, DIU Student ID, DIU Email, GitHub username.
  - Student 2: Name, DIU Student ID, DIU Email, GitHub username.
  - Updated in: `README.md`, `docs/MODULE_OWNERS.md`, `docs/AI_USAGE.md`, `docs/concept-note/CONCEPT_NOTE.md`.
- [ ] **Mentors Information:**
  - Faculty Mentor: Name, Department, DIU Email.
  - Industry Mentor: Name, Organization, Professional Email.
- [ ] **Concept Note PDF Export:**
  - Verify exported PDF is exactly $\le 4$ pages.
- [ ] **Platform Submission:**
  - Submit Concept Note PDF, GitHub Repository URL, Video Link, and Live App URL.
  - Take a screenshot of the submission confirmation screen and store in team drive.

---

## 5. Git Release & Freezing Protocol

After completing S20 review:
1. Merge `chore/s20-final-qa` into `develop`.
2. Open release PR: `develop` -> `main` with title `"release: Phase 1 (Round 1 submission)"`.
3. Merge PR into `main` using **merge commit** (never squash, to preserve commit history).
4. Tag official Round 1 release:
   ```bash
   git switch main
   git pull origin main
   git tag -a v1.0-round1 -m "LandTech 2026 Round 1 Official Submission"
   git push origin v1.0-round1
   ```
5. Branch `phase2` for Phase 2 development while keeping `main` frozen during judging:
   ```bash
   git switch -c phase2
   git push -u origin phase2
   ```
