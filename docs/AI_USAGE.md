# LandShield — AI Tools Usage Disclosure

**Event:** LandTech Innovation Hackathon 2026  
**Regulatory Compliance:** LandTech Official Rule Book (Section 9: AI Tools Usage Policy)  
**Status:** Mandatory Authoritative Disclosure  

---

## 1. Declarative Overview

In accordance with **Section 9 of the Official LandTech 2026 Rule Book**, the authors explicitly disclose the use of Artificial Intelligence coding assistants and Large Language Models during the research, architectural design, implementation, and documentation of the **LandShield** project.

The development methodology followed a strict human-in-the-loop pair-programming paradigm: every algorithmic module, mathematical function, and state machine was prompted on a session-by-session basis, manually reviewed by the student authors, tested against automated verification suites, and defended orally.

---

## 2. Inventory of AI Tools Utilized

| Tool / Model | Category | Scope of Application | Human Verification & Validation Method |
|---|---|---|---|
| **Google Antigravity IDE (Gemini 3.8 Flash)** | Agentic AI Coding Assistant | Code scaffolding, FastAPI endpoint structuring, Next.js page layouts, test fixture generation, and markdown documentation drafting. | Every session inspected commit-by-commit; all 105 unit tests executed locally; all UI flows tested in browser. |
| **GitHub Copilot** *(Optional / Student IDE)* | In-line Autocomplete | Line-level code completion for boilerplate TypeScript types, SQLAlchemy model attributes, and CSS utility classes. | Real-time code review; rejection of irrelevant autocompletions; syntax and type-check enforcement via strict TypeScript compiler. |
| **Large Language Model API (Planned for Phase 2)** | Runtime Application LLM | Generation of human-readable, plain-Bangla due-diligence summaries from deterministic engine findings. | Strictly schema-validated output; engine override ensures risk score cannot be altered by LLM; offline fallback template. |

---

## 3. Scope of Assistance vs. Human Engineering

### What AI Assisted With:
1. **Boilerplate Acceleration:** Rapidly generating repetitive Pydantic schemas, SQLAlchemy relational mappings, and Next.js UI component skeletons.
2. **Comprehensive Test Suite Generation:** Assisting in constructing pytest fixtures for edge cases (e.g. sequence gap detection, timestamp roundtripping, float rounding edge conditions).
3. **Drafting Documentation:** Generating preliminary drafts for technical guides (`DEPLOY.md`, `DEMO_SCRIPT.md`, and markdown templates) following student architectural guidelines.

### What Was Exclusively Human-Engineered:
1. **Domain Logic & Legal Alignment:** Analyzing Bangladesh land law (The Registration Act, 1908; State Acquisition and Tenancy Act, 1950) to conceptualize the friction between Sub-Registry deed registration and AC Land e-Mutation.
2. **Cryptographic System Design:** Deciding the zero-trust canonical payload structure, Ed25519 asymmetric signing, SHA-256 ledger hash-chaining, and offline browser verification architecture.
3. **Rule Specifications (TRD 6B / 6C):** Determining the mathematical formulations for holdings conservation (`sum(holdings) <= plot.area`), rapid transfer time windows (3+ sales within 30 days), and double-sale race conditions.
4. **Code Review & Quality Gate:** Line-by-line review of every git diff before merging, verifying zero external government endpoints were called, and ensuring zero real personal data exists in the repository.

---

## 4. Student Competence & Oral Defense Certification

Both student team members formally certify that:
1. They possess comprehensive, end-to-end oral comprehension of all submitted code files, functions, cryptographic hashes, and database relationships.
2. They are prepared to explain, modify, or debug any part of the codebase live during the Final Round evaluation before the judging panel.
3. No code has been incorporated into this repository without thorough line-by-line review and understanding by both authors.

**Signed by Team Members:**  
- [STUDENT 1 NAME - TEAM LEADER]  
- [STUDENT 2 NAME - TEAM MEMBER]  
