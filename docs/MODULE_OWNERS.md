# LandShield — Module Ownership & Team Responsibilities

**Event:** LandTech Innovation Hackathon 2026  
**Document Purpose:** Clear delineation of engineering responsibilities, commit ownership, and oral defense accountability between team members.

---

## 1. Team Directory

| Role | Full Name | Institution / Affiliation | Contact Email | GitHub Profile |
|---|---|---|---|---|
| **Student 1 (Team Leader)** | `[STUDENT 1 NAME - TEAM LEADER]` | Daffodil International University (DIU) | `[STUDENT 1 EMAIL]` | `[STUDENT 1 GITHUB]` |
| **Student 2 (Team Member)** | `[STUDENT 2 NAME - TEAM MEMBER]` | Daffodil International University (DIU) | `[STUDENT 2 EMAIL]` | `[STUDENT 2 GITHUB]` |
| **Faculty Mentor** | `[FACULTY MENTOR NAME]` | Daffodil International University (DIU) | `[FACULTY MENTOR EMAIL]` | — |
| **Industry Mentor** | `[INDUSTRY MENTOR NAME]` | `[ORGANIZATION / COMPANY]` | `[INDUSTRY MENTOR EMAIL]` | — |

---

## 2. Module Engineering Ownership Matrix

| Subsystem / Module | Primary Owner | Secondary Reviewer | Key Code Files & Artifacts | Oral Defense Focus |
|---|---|---|---|---|
| **Cryptographic Engine** | Student 1 | Student 2 | `backend/app/services/crypto.py`<br>`backend/tests/test_crypto.py` | PyNaCl Ed25519 signing/verification, SHA-256 canonical deed payload hashing, persistent `SIGNING_KEY_HEX` loading. |
| **Ledger & Holdings Chain** | Student 1 | Student 2 | `backend/app/services/ledger.py`<br>`backend/app/services/holdings.py`<br>`backend/tests/test_ledger.py` | Per-plot hash-chained ledger, sequence verification, holdings conservation (`sum <= plot.area`), unmutated resale handling. |
| **Public Citizen Portal** | Student 1 | Student 2 | `frontend/src/app/check/page.tsx`<br>`frontend/src/components/RiskCard.tsx`<br>`frontend/src/components/ChainTimeline.tsx` | Citizen pre-purchase risk gauge (0–100), bilingual explanations (Bangla/English), masked citizen identity privacy. |
| **Public Deed Verification** | Student 1 | Student 2 | `frontend/src/app/verify/page.tsx`<br>`frontend/src/components/QRScanner.tsx`<br>`backend/app/services/qr.py` | Live html5-qrcode camera scanning over HTTPS, status badge resolution (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`). |
| **Fraud Engine & Rules** | Student 2 | Student 1 | `backend/app/services/fraud/*`<br>`backend/tests/test_fraud_engine.py`<br>`backend/tests/test_rules_r3_r4_r6.py` | Layered rule pipeline, R1 (Double Sale / Oversold), R2 (Stranger Seller), R3 (Missing Mutation >90d), R4 (Rapid Transfers), R6 (Flagged Land), HTTP 409 `FRAUD_BLOCKED`. |
| **Mutation State Machine** | Student 2 | Student 1 | `backend/app/services/mutation_fsm.py`<br>`backend/app/api/v1/mutations.py`<br>`frontend/src/app/officer/page.tsx` | 5-state mutation workflow (`SUBMITTED` -> `AUTO_CHECKED` -> `UNDER_REVIEW` -> `APPROVED` / `REJECTED`), officer override notes, holdings recomputation. |
| **Synthetic Seed & Scenarios** | Student 2 | Student 1 | `backend/scripts/seed.py`<br>`data/scenarios/scenarios.json`<br>`backend/tests/test_seed.py` | Faker generator with authentic Bangla names, 300 plots, 120 citizens, deterministic benchmark scenarios S1–S8. |
| **Auth & Staff Portals** | Student 2 | Student 1 | `backend/app/security.py`<br>`backend/app/deps.py`<br>`frontend/src/app/registrar/page.tsx`<br>`frontend/src/app/admin/page.tsx` | Argon2 password hashing, JWT HS256 tokens, RBAC roles (Registrar, Officer, Admin), Sub-Registrar deed creation portal, Admin Tamper Lab. |
| **DevOps & Cloud Deploy** | Both | Both | `backend/Dockerfile`<br>`frontend/Dockerfile`<br>`render.yaml`<br>`docs/DEPLOY.md` | Multi-stage Docker builds, Render FastAPI + Postgres deployment, Vercel Next.js edge deployment, CORS and healthcheck routing. |
| **Documentation & Video** | Both | Both | `docs/DEMO_SCRIPT.md`<br>`docs/concept-note/*`<br>`README.md` | Rehearsed 3-minute video presentation, 4-page official Concept Note PDF, Rule Book regulatory compliance. |

---

## 3. Mutual Review Protocol
1. **Zero Unreviewed Merges:** Every Pull Request created by one student must be reviewed and approved by the other student before merging into `develop` or `main`.
2. **Commit Alternation:** Pull requests alternate between Student 1 and Student 2 to maintain balanced contribution metrics in git history.
3. **Oral Cross-Examination:** Prior to competition submission, both students conduct mock Q&A sessions ensuring mutual proficiency across all modules.
