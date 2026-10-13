# LandShield: Tamper-Evident Deed Verification and Explainable Fraud Prevention for Bangladesh Land Records

**Event:** LandTech Innovation Hackathon 2026  
**Track:** Digital Land Records, Verification & Digitization  
**Document Type:** Official Concept Note (Round 1 Submission)  
**Target Length:** ~1,650 Words (Equivalent to 4 Standard Formatted Pages)  

---

## 1. Executive Summary

Land administration in Bangladesh faces severe systemic friction characterized by high litigation volumes, paper-based deed forgery, unrecorded multiple sales of identical plots, and administrative desynchronization between deed registration (under the Directorate of Registration, Ministry of Law) and land mutation (under the Ministry of Land). Citizens lack independent, real-time mechanisms to evaluate ownership risks before entering property transactions, leaving buyers vulnerable to financial loss and decades-long court battles.

**LandShield** is an independent, zero-trust verification and reconciliation platform designed to operate seamlessly on top of Bangladesh's existing land governance systems without requiring wholesale legislative replacement. Combining asymmetric digital signatures (Ed25519), per-plot SHA-256 hash-chained ledgers, automated rule-based fraud detection, and explainable bilingual risk analytics, LandShield solves four critical national challenges:
1. **Primary Challenge (P2):** Instant cryptographic deed and ownership integrity verification.
2. **Supporting Challenge (P3):** Automated detection and blocking of double-selling and unauthorized transfers.
3. **Supporting Challenge (P4):** State-machine tracking and fraud audit trails for e-Mutation workflows.
4. **Supporting Challenge (P5):** A citizen-facing "Check Before You Buy" pre-purchase risk assessment portal in plain Bangla.

By enforcing mathematical integrity at registration and empowering citizens with explainable transparency, LandShield delivers a practical, highly scalable foundation for Smart Governance under Smart Bangladesh 2041.

---

## 2. Chosen Problem Statements

LandShield directly addresses the LandTech Innovation Hackathon 2026 problem statements with a clear hierarchy:

* **Primary Focus — P2: Deed & Ownership Verification:**  
  Current paper deeds and scanned porchas can be visually forged, altered, or presented after being cancelled or superseded. LandShield provides mathematical certainty: every registered deed is canonically hashed, digitally signed with Ed25519, chained into an immutable ledger, and instantly verifiable via a secure QR code.
* **Supporting Focus — P3: Fraud & Double-Selling Detection:**  
  Corrupt sellers frequently exploit registration delays to sell the same plot to multiple unsuspecting buyers. LandShield introduces an algorithmic pre-registration fraud blocker that evaluates proposed transactions against live plot holdings, intercepting double sales at HTTP 409 before records are committed.
* **Supporting Focus — P4: Smart e-Mutation Tracking:**  
  Mutations often stall in manual review queues without automated integrity cross-checks. LandShield implements a formal 5-stage Finite State Machine (FSM) tracking mutations with automated fraud screening, officer override documentation, and an append-only audit trail.
* **Supporting Focus — P5: Citizen Pre-Purchase Verification:**  
  Prospective land buyers are forced to rely on informal brokers and manual record checks. LandShield's public portal provides an intuitive 0–100 risk score and plain-Bangla explanations of encumbrances, ownership gaps, and ongoing disputes.

---

## 3. The Problem in Bangladesh Context

Land disputes represent one of the most pervasive socioeconomic challenges in Bangladesh. Historical analyses indicate that over 75% of civil litigation in the country stems directly or indirectly from conflicting land claims [CITATION NEEDED]. Several deep structural realities drive this crisis:

1. **The Institutional Division of Land Administration:**  
   In Bangladesh, land administration is divided across two separate ministries. The **Sub-Registry Offices** (operating under the Directorate of Registration, Ministry of Law, Justice and Parliamentary Affairs) handle deed registration under the Registration Act, 1908. Meanwhile, the **Assistant Commissioner (Land) / AC Land Offices** (operating under the Ministry of Land) handle mutation, khatians, and land revenue collection under the State Acquisition and Tenancy Act, 1950. Because deed registration and mutation are not atomically linked in real time, a substantial time lag exists between purchase and mutation—creating an exploitable window where dishonest individuals execute multiple sales of the same property.
2. **Multi-Generational Survey Discrepancies:**  
   Land administration in Bangladesh has evolved through sequential land surveys: Cadastral Survey (CS), State Acquisition (SA), Revisional Survey (RS), and Bangladesh Survey (BS). Inconsistencies, missing khatian records, or unrecorded lineage transfers between successive surveys frequently lead to overlapping claims that remain unresolved for decades [CITATION NEEDED].
3. **Vulnerability of Paper-Based Documents:**  
   Physical deeds, stamp papers, and manually written porchas are vulnerable to single-character alterations, unauthorized seal replication, or physical loss. While government initiatives such as the Land Service Gateway, e-Mutation pilot, and e-Porcha have digitized record archives, digitization alone does not prevent double-selling if records are checked manually.

---

## 4. Proposed Solution: The LandShield Framework

LandShield does not seek to replace existing government portals or establish a speculative blockchain network. Instead, it provides a lightweight, tamper-evident **verification and fraud prevention layer** that integrates with existing registries.

### Architectural Philosophy: The Separation of Roles
LandShield adheres to three fundamental operational principles:
* **Cryptographic Integrity & Rules Decide:** Cryptographic signatures (Ed25519) and deterministic mathematical rules (e.g. area conservation) hold ultimate decision-making authority. They block illegal transfers automatically.
* **Machine Learning Advises:** In Phase 2, statistical ML models provide advisory anomaly detection without the power to lower risk or override deterministic rules.
* **Language Models Explain:** Generative AI is strictly restricted to linguistic translation and plain-language summary generation; language models never evaluate risk scores or alter decision metrics.

```text
[ Citizen / Buyer ]      [ Sub-Registrar ]      [ AC Land Officer ]
        |                       |                       |
        v                       v                       v
+---------------------------------------------------------------+
|                      LandShield Layer                         |
|  * 0–100 Citizen Risk Gauge (Bangla/English Explanations)     |
|  * Pre-Registration Fraud Interceptor (Blocks Double Sales)   |
|  * e-Mutation 5-Stage State Machine with Audit Log            |
|  * Ed25519 Signature & Per-Plot SHA-256 Ledger Chain         |
+---------------------------------------------------------------+
                                |
                                v
           [ Integrated Database (PostgreSQL / SQLite) ]
```

---

## 5. System Architecture & Technical Stack

The LandShield platform is built entirely upon production-grade, open-source technologies:

* **Presentation Tier:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Google Noto Sans Bengali typography, and native `html5-qrcode` camera integration over HTTPS. Complete bilingual localization is implemented via decoupled translation catalogs (`bn.json` and `en.json`).
* **Application Tier:** FastAPI (Python 3.11), Uvicorn ASGI server, Pydantic v2 schemas, and SQLAlchemy 2 ORM.
* **Security & Authentication:** Argon2id password hashing, JSON Web Tokens (JWT HS256) with role-based access control (Registrar, Officer, Admin), `slowapi` rate limiting, and automated startup protection against default secrets.
* **Cryptographic Primitives:** PyNaCl (libsodium Ed25519), SHA-256 canonical hashing compliant with RFC 8785 (sorted keys, compact delimiters, UTF-8), and persistent key seed configuration via `SIGNING_KEY_HEX`.
* **Database & Cloud Deployment:** PostgreSQL 15, containerized via multi-stage Dockerfiles, deployed on Render (backend) and Vercel (frontend).

---

## 6. Key Features: Built vs. Planned Roadmap

| System Feature | Status | Functional Capability & Technical Implementation |
|---|---|---|
| **Cryptographic Deed Verification** | **Built (Round 1)** | Asymmetric Ed25519 digital signature signing; per-plot hash chain walking back to genesis; status resolution (`VALID`, `TAMPERED`, `SUPERSEDED`, `CANCELLED`). |
| **Interactive Tamper Lab** | **Built (Round 1)** | Admin portal demonstrating that single-byte database manipulation without the private key immediately triggers cryptographic invalidation (`HASH_MISMATCH`). |
| **Pre-Registration Fraud Blocker** | **Built (Round 1)** | Evaluates proposed transactions prior to database commit; halts double-selling and unauthorized sales with HTTP 409 `FRAUD_BLOCKED`. |
| **Citizen Pre-Purchase Portal** | **Built (Round 1)** | Search by Dag, Mouza, or Deed number; animated 0–100 risk gauge; plain-Bangla explanations; privacy-preserving citizen name masking. |
| **e-Mutation Finite State Machine** | **Built (Round 1)** | 5-stage lifecycle (`SUBMITTED` -> `AUTO_CHECKED` -> `UNDER_REVIEW` -> `APPROVED` / `REJECTED`) with automated fraud screening and officer hearing notes. |
| **Live Camera QR Scanner** | **Built (Round 1)** | Browser-native camera scanning over HTTPS decoding instant cryptographic verification URLs on mobile devices. |
| **Cross-Office Reconciliation (R8)** | *Planned (Phase 2)* | Automated discrepancy detection matching Sub-Registry deeds with AC Land mutation records (`OWNER_MISMATCH`, `MUTATION_STALLED`, `AREA_NOT_CONSERVED`). |
| **Survey Lineage Graph (R7)** | *Planned (Phase 2)* | Directed acyclic graph tracking khatian continuity across historical survey generations (CS -> SA -> RS -> BS). |
| **Offline Browser QR Verification** | *Planned (Phase 2)* | Client-side Web Crypto API Ed25519 verification without requiring server connectivity. |
| **AI Due-Diligence Agent** | *Planned (Phase 2)* | Deterministic fact collection with schema-validated Bangla summary generation and template fallback. |
| **Merkle Transparency Log** | *Planned (Phase 2)* | Daily signed cryptographic roots published publicly to detect historical database rewriting. |

---

## 7. Countrywide Implementation & Phased Rollout Plan

To transition LandShield from an academic prototype to a nationwide public infrastructure, a disciplined three-phase deployment roadmap is proposed:

```text
+-----------------------+     +-----------------------+     +-----------------------+
|  PHASE I: PILOT       |     |  PHASE II: DISTRICT   |     |  PHASE III: NATIONAL  |
|  * 1 Upazila          | --> |  * 1 Complete District| --> |  * Countrywide Rollout|
|  * 1 Sub-Registry     |     |  * Cross-Office Sync  |     |  * Land Service GW    |
|  * 1 AC Land Office   |     |  * Cloud-Managed HSM  |     |  * Hardware HSM Array |
|  * 3 Months           |     |  * 6 Months           |     |  * 12 Months          |
+-----------------------+     +-----------------------+     +-----------------------+
```

### Phase I: Upazila Pilot (Months 1–3)
* **Scope:** Deployment in a single selected Upazila (e.g. Savar or Gazipur Sadar) featuring high transaction velocity.
* **Architecture:** Parallel operation alongside existing registration workflows. Deeds registered in the Sub-Registry are ingested into LandShield; AC Land mutation officers access LandShield's auto-check dashboard.
* **Key Management:** Sub-Registrar signing keys managed via air-gapped secure hardware tokens (e.g. FIPS 140-2 Level 2 USB authenticators).

### Phase II: District-Wide Integration (Months 4–9)
* **Scope:** Expansion across all Upazilas within a single administrative District (e.g. Dhaka District).
* **System Upgrades:** Migration from standalone tokens to centralized Hardware Security Modules (Cloud KMS / HSM) under national government data center hosting.
* **Inter-Agency Reconciliation:** Activation of Layer R8 to automatically reconcile all pending mutation backlogs against registered deeds.

### Phase III: Nationwide Deployment (Months 10–21)
* **Scope:** Full integration into the Ministry of Land's **Land Service Gateway (LSG)** and the Directorate of Registration's central database.
* **Capacity Building & Training:** Deployment of localized training modules across all 500+ Sub-Registry offices and 500+ Upazila Land Offices nationwide.
* **Citizen Access Points:** Integration into Union Digital Centers (UDC) allowing rural citizens without smartphones to generate printed Pre-Purchase Risk Reports before purchasing property.

---

## 8. Data Privacy, Legal Compliance & Synthetic Data Statement

### Regulatory Compliance with LandTech 2026 Rules
* **100% Synthetic Data:** All records within this project—including 300 land plots, 120 citizen personas, and 8 benchmark fraud scenarios—were generated via deterministic synthetic scripts. Zero real National ID (NID) numbers, real telephone numbers, real citizen names, or genuine physical land records have been collected or stored.
* **No External Scraping:** No government server, API, or portal (such as e-Mutation, e-Porcha, or Land Service Gateway) was scraped, probed, or security-tested. All operations execute strictly within the isolated application container.
* **Privacy by Design:** All citizen names in public API endpoints and UI displays are masked (e.g., `র***ন খ***ন`). Personal identity numbers are never exposed.

---

## 9. Team & Mentorship Directory

* **Student 1 (Team Leader):** `[STUDENT 1 NAME - TEAM LEADER]` — Department of CSE, Daffodil International University (DIU). Responsible for Cryptographic Architecture, Hash Chaining, Ledger Verification, and Public Citizen Portals.
* **Student 2 (Team Member):** `[STUDENT 2 NAME - TEAM MEMBER]` — Department of CSE, Daffodil International University (DIU). Responsible for Fraud Engine Rules, Mutation FSM, Synthetic Seed Generation, and Staff Dashboards.
* **Faculty Mentor:** `[FACULTY MENTOR NAME]` — Daffodil International University (DIU). Academic advisor overseeing methodology and project alignment.
* **Industry Mentor:** `[INDUSTRY MENTOR NAME]` — `[ORGANIZATION / COMPANY]`. Technical advisor overseeing scalability, cloud deployment, and security posture.

---

## 10. Conclusion

LandShield bridges the historical chasm between registration and mutation in Bangladesh. By transforming static paper deeds into cryptographically signed, tamper-evident digital assets, preventing double-selling before it occurs, and giving ordinary citizens an intuitive, explainable risk score in plain Bangla, LandShield provides an actionable blueprint for equitable, transparent, and dispute-free land governance in Bangladesh.
