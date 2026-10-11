# LandShield (LandTech Hackathon 2026, Round 1)
Purpose: tamper-evident land deed verification, fraud detection, mutation workflow, citizen pre-purchase check.
Stack: Python 3.11 + FastAPI + SQLAlchemy 2 + SQLite(dev)/Postgres(deploy) + PyNaCl; Next.js (App Router, TS, Tailwind).
Docs: Docs/PRDupdate.md, Docs/TRD.md (architecture, data model, API, crypto, fraud). Read ONLY the sections the session names.
Progress log: Docs/PROGRESS.md (read at session start, update at session end).

HARD RULES
- Synthetic data only. Never add real names, NIDs, phones, addresses or real land records.
- No scraping or calling any government site. No security testing of external systems.
- Never commit secrets or keys. keys/, .env are gitignored. Never force-push; never push to protected branches.
- Stay inside the session scope. Do not edit unrelated files. Do not add packages outside the allowed list without asking.
- Small functions, type hints, docstrings only where non-obvious. Every module gets pytest tests.
- If blocked or something is ambiguous and important, STOP and ask. Do not guess silently.

END-OF-SESSION PROTOCOL (always do all 6)
1. Run tests (and lint/build if relevant). Fix failures within scope.
2. Update Docs/PROGRESS.md: what was done, decisions, known gaps, next session.
3. Git: Do NOT commit or push automatically. Instead, explicitly provide the user with the exact, conventional Git commands to run (e.g. `git add <files>; git commit -m "feat(<scope>): <meaningful description>"` and `git push origin <branch>`). Ensure the message clearly reflects the exact feature and phase completed so judges can easily track the commit history and authentic project progression.

4. Print "HUMAN ACTIONS": numbered, exact commands or UI steps for anything you cannot or must not do (accounts, secrets, pushing, GitHub UI, deploy dashboards, installing tools, recording, writing by hand).
5. Print "REVIEW FOCUS": 3 things the student must be able to explain from this session.
6. Print "NEXT SESSION": the id of the next prompt.
