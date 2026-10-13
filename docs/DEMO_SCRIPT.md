# LandShield — 3-Minute Demo Video Script (Round 1)

**Event:** LandTech Innovation Hackathon 2026  
**Track:** Digital Land Records, Verification & Digitization  
**Target Duration:** Exactly 3 minutes (180 seconds)  
**Recording Tool:** OBS Studio (Full HD 1080p, 60fps)  
**Presenter:** Both student team members (Student A: 0:00–1:30; Student B: 1:30–3:00)

---

## Pre-Recording Setup Checklist
- [ ] Local stack running or live deployment open: [Live Web App](https://land-shield.vercel.app)
- [ ] Backend running at `https://land-shield.onrender.com` (or local `http://localhost:8000`)
- [ ] Browser tabs prepared in order:
  1. Tab 1: `/check` (Citizen Pre-Purchase Portal)
  2. Tab 2: `/login` (Staff Login)
  3. Tab 3: `/verify` (Public Verification & Scanner)
  4. Tab 4: `/admin` (Tamper Lab & Audit Trail)
- [ ] Browser zoom set to 110% for high-DPI legibility.
- [ ] Audio microphone checked; zero background noise.

---

## Detailed Script & Action Sequence

### ⏱️ Segment 1: The Problem & Citizen "Check Before You Buy" (0:00 – 0:35)
* **Speaker:** Student A  
* **Active Screen:** Citizen Pre-Purchase Check (`/check`)  
* **Visual Action:**
  1. Open `/check`.
  2. In search box, select Mouza: `মিরপুর`, Dag Number: `401` (Scenario S1 - Double Sale).
  3. Click **"অনুসন্ধান করুন (Search)"**.
* **Spoken Narrative:**
  > *"Respected judges, in Bangladesh, over 75% of civil court cases originate from land disputes—most commonly forged deeds, double-selling, and disjointed records between the Sub-Registry and AC Land offices.  
  > This is LandShield. Before paying a single taka, a citizen opens our 'Check Before You Buy' portal.  
  > Here, searching Dag 401 instantly reveals a Risk Score of **100 / HIGH (উচ্চ ঝুঁকি)**. LandShield's automated fraud engine immediately warns the buyer in plain Bangla: 'পূর্ববর্তী বিক্রয় দলিল বলবৎ থাকা সত্ত্বেও অপর ক্রেতার অনুকূলে বিক্রয়ের চেষ্টা (Double Selling Attempt)'. Notice also that all citizen names are cryptographically masked for privacy.  
  > In contrast, searching clean Dag 601 in Dhanmondi gives a clean 0 / LOW risk score."*

---

### ⏱️ Segment 2: Cryptographic Deed Registration & Pre-Registration Fraud Blocker (0:35 – 1:15)
* **Speaker:** Student A  
* **Active Screen:** Sub-Registrar Portal (`/login` -> `/registrar`)  
* **Visual Action:**
  1. Navigate to `/login`.
  2. Enter Username: `registrar1`, Password: `RegistrarPass123!`. Click **Login**.
  3. Redirects to `/registrar`.
  4. Fill deed form: Select Plot `1`, Seller `1`, Buyer `3`, Area `30.0`. Click **"দলিল নিবন্ধন করুন (Register Deed)"**.
  5. Modal error pops up showing **HTTP 409 FRAUD_BLOCKED**!
  6. Now select clean Plot `6`, Seller `6`, Buyer `7`, Area `15.0`. Click **"Register Deed"**.
  7. Success notification appears: Deed created, signed with Ed25519, hash chained, QR displayed.
  8. Click **"Download QR"**.
* **Spoken Narrative:**
  > *"Next, we demonstrate how LandShield prevents fraud at the point of origin.  
  > Logging in as Sub-Registrar `registrar1`, we open the deed registration portal.  
  > If a corrupt or mistaken party attempts to register another sale on Plot 1, LandShield's pre-registration fraud blocker intercepts the request and refuses the transaction with **HTTP 409 Conflict: FRAUD_BLOCKED** before any database commit occurs.  
  > When we register a legitimate transaction on Plot 6, the deed payload is canonicalized, signed with our registrar's private Ed25519 key, chained into the per-plot SHA-256 ledger, and issued with an instant cryptographic QR code."*

---

### ⏱️ Segment 3: Public QR Code & Deed Verification (1:15 – 1:50)
* **Speaker:** Student B  
* **Active Screen:** Public Verification Portal (`/verify`)  
* **Visual Action:**
  1. Open `/verify`.
  2. Point camera at the QR code (or paste deed number `DHAKA-2026-000002`).
  3. Screen renders deed details with green **VALID (বৈধ)** badge and ledger position.
* **Spoken Narrative:**
  > *"Anyone—a bank loan officer, a buyer, or a land surveyor—can verify a deed in under two seconds.  
  > Navigating to `/verify`, our camera scanner decodes the QR code. Over pure HTTPS, LandShield recomputes the SHA-256 payload digest, verifies the registrar's public key signature, and walks the per-plot hash chain back to genesis.  
  > It immediately displays a verified green badge: **VALID**, confirming zero tampering and active legal standing."*

---

### ⏱️ Segment 4: The Tamper Lab — Single-Byte Tampering Invalidation (1:50 – 2:25)
* **Speaker:** Student B  
* **Active Screen:** Admin Tamper Lab (`/admin`) -> Public Verify (`/verify`)  
* **Visual Action:**
  1. Open `/admin` (Logged in as `admin1` / `AdminPass123!`).
  2. Select Deed `DHAKA-2026-000002`.
  3. Click **"Tamper Payload (সংশোধন / বিকৃত করুন)"** (simulates database administrator altering area from 30.0 to 99.0 decimals).
  4. Return to public verify: `https://land-shield.vercel.app/verify?deed=DHAKA-2026-000002`.
  5. Screen immediately turns red: **`TAMPERED (বিকৃত / অবৈধ)`**! Reasons: `HASH_MISMATCH`.
  6. Return to `/admin` -> Click **"Restore Original Payload"** -> Verify updates back to `VALID`.
* **Spoken Narrative:**
  > *"To prove our cryptographic integrity to the judges, we built the **Tamper Lab**.  
  > As Admin `admin1`, we simulate an insider threat modifying the database directly—altering land area from 30 to 99 decimals without the private signing key.  
  > Refreshing public verification immediately flags the deed as **TAMPERED** with a Cryptographic Hash Mismatch error! Because cryptographic signatures cannot be forged without the private key, silent manipulation is mathematically impossible.  
  > Restoring the original payload instantly returns the status to **VALID**."*

---

### ⏱️ Segment 5: Smart e-Mutation & Audit Trail (2:25 – 3:00)
* **Speaker:** Student B  
* **Active Screen:** AC Land Officer Portal (`/officer`) -> Audit Trail (`/admin`)  
* **Visual Action:**
  1. Switch to AC Land Officer view (`/officer`, logged in as `officer1` / `OfficerPass123!`).
  2. Show pending mutation queue with automated auto-check findings.
  3. Click through the 3-step review stepper: Auto-Check -> Field Hearing Note -> Approve/Reject.
  4. Show `/admin` Audit Trail tab displaying append-only logs of every login, registration, and tamper event.
* **Spoken Narrative:**
  > *"Finally, LandShield integrates with the AC Land office.  
  > Officer `officer1` reviews incoming mutations where our engine pre-screens ledger continuity. The officer adds hearing notes and transitions the state machine to approved or rejected.  
  > Every action, state transition, and authentication attempt is immutably logged into our append-only Audit Trail.  
  > All data demonstrated is 100% synthetic. LandShield delivers transparency, cryptographic proof, and citizen empowerment to Smart Bangladesh 2041. Thank you!"*

---

## Benchmark Scenario Reference Card
| Scenario ID | Name | Plot ID | Target Deed Number | Triggered Rule / Expected Outcome |
|---|---|---|---|---|
| **S1** | Double Sale Attempt | Plot 1 | `DHAKA-2026-000002` | `R1_DOUBLE_SALE` (Blocked at 409 / Score 100) |
| **S2** | Stranger Seller | Plot 2 | `DHAKA-2026-000003` | `R2_SELLER_NOT_OWNER` (Blocked at 409 / Score 100) |
| **S3** | Missing Mutation > 90 Days | Plot 3 | `DHAKA-2026-000004` | `R3_MISSING_MUTATION` (Medium Risk / Score 45) |
| **S4** | Rapid Transfers | Plot 4 | `DHAKA-2026-000008` | `R4_RAPID_TRANSFERS` (High Risk / Score 80) |
| **S5** | Flagged Land (Khas/Disputed) | Plot 5 | None | `R6_FLAGGED_LAND` (High Risk / Score 90) |
| **S6** | Clean Land Deal | Plot 6 | `DHAKA-2026-000010` | None (`VALID` / Score 0) |
| **S7** | Legit Pending Resale | Plot 7 | `DHAKA-2026-000012` | None (`VALID_LEDGER` / Not blocked) |
| **S8** | Partial Sales Conserved | Plot 8 | `DHAKA-2026-000014` | None (`VALID` / Not blocked) |
