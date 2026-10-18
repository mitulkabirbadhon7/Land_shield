# LandShield Data Policy & Redaction Standards

## 1. Synthetic Data Boundary & Provenance

LandShield is a research and hackathon prototype designed to demonstrate tamper-evident deed verification, cross-office reconciliation, survey lineage tracking, and fraud prevention for Bangladesh land administration.

### Strict Non-Real Data Invariant
- **100% Synthetic Records**: All records—including citizen names, National ID (NID) numbers, phone numbers, deed numbers, khatian numbers, and plot boundaries—are synthetically generated.
- **Zero Real Personally Identifiable Information (PII)**: No authentic or confidential government records or real citizens' identities exist within this codebase, database, or test fixtures.
- **Zero Scraping / Live Government Access**: LandShield does not connect to, query, or scrape any live government website or external administrative registry.

---

## 2. Universal Privacy & Redaction Standards

To prevent information disclosure and enforce the principle of least privilege, LandShield implements a **dual-tier visibility model**:

| Viewer Tier | Authentication | Visibility Scope | Personal Data Redaction |
|---|---|---|---|
| **Public / Citizen** | Unauthenticated | Pre-purchase verification & transparency | Names are masked (`Md. A*** R***`, `র***ম উ***ন`); internal database PKs and NID hashes are completely excluded. |
| **Institutional Staff** | Authenticated (JWT: `registrar`, `officer`, `admin`) | Official deed registration, mutation adjudication, and system administration | Full synthetic names and casework identifiers visible for official duties. |

### Centralized `person_view` Serializer
All personal entity serialization across plot inquiries, chain of title, survey lineage, reconciliation audits, and mutation workflows is routed through a single centralized helper:
```python
from app.utils.privacy import person_view

# Automatically detects staff role from request authentication:
# - If citizen: returns masked name, suppresses internal IDs
# - If staff: returns full synthetic name and casework IDs
view = person_view(person, viewer=current_user)
```

### Identifier Redaction Rules
1. **National ID (NID)**: Raw NID numbers are never stored in the database. In the synthetic dataset, only a one-way salted hash (`masked_nid_hash`) exists for deterministic duplicate-detection. This hash is strictly excluded from all public API response schemas.
2. **Internal Primary Keys**: Foreign keys to the `persons` table (e.g. `initial_owner_id`, `current_owner_id`, `applicant_id`, `officer_id`) are excluded or set to `None` on all unauthenticated endpoints.

---

## 3. Protocol Headers

Every HTTP response emitted by the LandShield backend automatically includes the data policy declaration header:
```http
X-Data-Policy: synthetic-demo
```
This header signals to client browsers, automated audit agents, and evaluating judges that all payload entities are synthetic test artifacts.

---

## 4. AI & LLM Data Protection Boundaries

LandShield's AI Due-Diligence Report Engine enforces strict deterministic boundaries before any payload reaches an external Large Language Model:
1. **Pre-Masked Fact Synthesis**: The `gather_facts` service redacts all personal names and removes database identifiers before constructing the LLM fact dictionary.
2. **Zero Key Logging**: Outbound HTTP requests to OpenAI/Anthropic/custom providers never log API credentials or raw prompts.
3. **Prompt Injection Sanitization**: Database strings are treated as untrusted data. The LLM is instructed to ignore embedded instructions.
4. **Deterministic Score Enforcement**: The LLM is mathematically forbidden from altering risk scores or dismissing rule findings; post-validation unconditionally overwrites output scores with the deterministic rule engine's findings.

---

## 5. Security & Verification Checklist
- [x] All public endpoints (`/plots/{id}`, `/plots/{id}/chain`, `/plots/search`, `/lineage/{id}`, `/deeds/{no}/verify`, `/reports/due-diligence`, `/mutations/{id}`) enforce name masking.
- [x] Zero raw NIDs or unmasked personal names in public API responses.
- [x] Global `X-Data-Policy: synthetic-demo` header verified on all endpoints.
- [x] Automated comprehensive privacy test suite (`backend/tests/test_privacy.py`).
