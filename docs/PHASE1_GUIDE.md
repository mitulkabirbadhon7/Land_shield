> **ERRATA (read first):** the rule semantics for R1/R2/R3/R4, deed status, FraudBlocked handling and Tamper Lab backup were corrected after review. TRD.md section 6B and ANTIGRAVITY_PHASE1_PROMPTS.md are authoritative. If this guide's code differs, follow those two files.

# LandShield - PHASE 1 GUIDE (Round 1)
Goal: a deployed, demo-ready core + submission pack by **Oct 15, 2026** (deadline Oct 16).
Read PRD.md and TRD.md first. Every command below assumes Linux/macOS/WSL; Windows PowerShell users replace
`source .venv/bin/activate` with `.venv\Scripts\Activate.ps1`.

---------------------------------------------------------------------
## 0. Definition of Done (Phase 1)
- [ ] Registrar registers a synthetic deed -> deed is hashed, signed, chained, QR generated
- [ ] Anyone verifies a deed by ID/QR -> VALID / TAMPERED / UNKNOWN (+ "superseded" status)
- [ ] Tamper Lab changes a deed field -> verification fails
- [ ] Fraud rules R1-R6 fire with reasons and a 0-100 risk score
- [ ] Double-sale attempt is blocked (HTTP 409) and an alert is created
- [ ] Mutation state machine works with audit log
- [ ] Citizen "check before you buy" page (Bangla + English)
- [ ] Roles: public, registrar, officer, admin (403 tests pass)
- [ ] Deployed live link, README, concept note PDF (max 4 pages), demo video (max 3 min)

## 1. Before you write code (Day 0)
1. **Registration**: the rulebook says registration closed Oct 6. Email csetech@diu.edu.bd / call +880 1756-808027 today and ask if late registration is possible. Do not build for days before knowing.
2. **Team**: 2 students (one leader) + 1 faculty mentor + 1 industry mentor. Ask mentors to review the workflow (registration -> mutation) for 30 minutes.
3. **Module ownership** (put in docs/MODULE_OWNERS.md). Suggested:
   - Student A: crypto, ledger, deeds/verify API, QR, citizen + verify pages
   - Student B: seed data, fraud rules, mutation FSM, auth/RBAC, registrar/officer pages
   - Both: tests, docs, deployment, video
   Each student must be able to explain every module, so do a daily 10-minute walkthrough.
4. **Pay the fee** (200 BDT via bKash/Rocket) and keep the confirmation.

## 2. Install tools
| Tool | Version | Check |
|---|---|---|
| Git | any recent | `git --version` |
| Python | 3.11+ | `python --version` |
| Node.js | 20+ | `node --version` |
| Docker Desktop | recent | `docker --version` |
| VS Code (or Cursor) | - | - |
| AI coding agent (e.g. Claude Code) | - | disclose in README |
| OBS Studio | - | for the demo video |

---------------------------------------------------------------------
## 3. GitHub: setup and workflow (read fully)
### 3.1 Create the repository
1. Student A (Team Leader) creates repo `landshield` on GitHub. Choose **Public** (simplest for judges) or Private and share with organizers later. Add README, MIT license, Python .gitignore.
2. Add Student B as collaborator (Settings > Collaborators). Optionally add mentors with read access.
3. Both clone:
```bash
git clone https://github.com/<leader>/landshield.git
cd landshield
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
```
Both students must make real commits (judges can check authorship).

### 3.2 .gitignore (append these)
```
.env
keys/
*.pem
.venv/
__pycache__/
*.pyc
node_modules/
.next/
*.db
data/seed/*.big.json
.DS_Store
```
**Never commit secrets or private keys.** If you commit one by mistake: rotate it immediately (generate a new key / API key), then remove it from the repo. Deleting it in a later commit is not enough because history keeps it.

### 3.3 Branching model (simple and safe)
- `main` = always working, deployable.
- Feature branches: `feat/<module>` (e.g., `feat/crypto-ledger`), `fix/<bug>`, `docs/<topic>`.
- Work: branch -> small commits -> push -> Pull Request -> the *other* student reviews -> merge (squash or merge commit) -> delete branch.
- Protect main (Settings > Branches > Add rule): require a pull request before merging, require status checks (CI) to pass.

### 3.4 Daily routine
```bash
git checkout main && git pull
git checkout -b feat/fraud-rules
# work, test
git add -p                      # review what you stage
git commit -m "feat(fraud): add R1 double-sale and R2 seller-not-owner rules"
git push -u origin feat/fraud-rules
# open PR on GitHub, request review, merge, then:
git checkout main && git pull
```
### 3.5 Commit message convention
`type(scope): message` where type is `feat | fix | test | docs | chore | refactor`.
Examples: `feat(crypto): canonical json hashing and ed25519 signing`, `test(ledger): tampered deed fails verify`.
Commit at least every hour of work. Good history = proof of authorship.

### 3.6 Issues and project board (10 minutes, worth it)
Create a GitHub Project with columns Todo / Doing / Done. Create one issue per item in the Definition of Done. Reference them in PRs (`Closes #4`).

### 3.7 AI agent + Git rules
- Agent works only on a feature branch, never main.
- You read the diff (`git diff`) before committing.
- Do not paste secrets into the agent.
- Keep a running list in docs/AI_USAGE.md (tool, what for, date).

### 3.8 Submission tagging
When submitted, mark the exact submitted commit:
```bash
git tag -a v1.0-round1 -m "Round 1 submission"
git push origin v1.0-round1
```
Phase 2 starts from this tag (see PHASE2_GUIDE.md).

---------------------------------------------------------------------
## 4. Project skeleton
```bash
cd landshield
mkdir -p docs/diagrams docs/concept-note \
  backend/app/{models,schemas,api/v1,services/fraud,utils} backend/scripts backend/tests \
  data/scenarios keys .github/workflows
touch backend/app/__init__.py backend/app/{models,schemas,api,api/v1,services,services/fraud,utils}/__init__.py
cp <downloaded>/docs/*.md docs/        # PRD, TRD, SECURITY, README_TEMPLATE, this guide
git checkout -b chore/skeleton && git add . && git commit -m "chore: project skeleton and docs" && git push -u origin chore/skeleton
```
(For the first skeleton commit you may push straight to main before enabling branch protection.)

## 5. Backend setup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" sqlalchemy alembic pydantic-settings pynacl "qrcode[pil]" \
  faker argon2-cffi "python-jose[cryptography]" slowapi networkx pytest httpx ruff
pip freeze > requirements.txt
```
### 5.1 Config - `backend/app/config.py`
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./landshield.db"
    jwt_secret: str = "dev-only-change-me"
    jwt_expire_minutes: int = 60
    signing_key_path: str = "../keys/registrar_ed25519.hex"
    demo_mode: bool = True
    allowed_origins: str = "http://localhost:3000"
    class Config:
        env_file = ".env"

settings = Settings()
```
### 5.2 Database - `backend/app/db.py`
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import settings

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```
### 5.3 Models - `backend/app/models/__init__.py` (compact; split into files if you prefer)
```python
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, JSON, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db import Base

class Person(Base):
    __tablename__ = "persons"
    id: Mapped[int] = mapped_column(primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120))
    id_token_hash: Mapped[str] = mapped_column(String(64), default="")   # salted hash, never a real NID
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)

class Plot(Base):
    __tablename__ = "plots"
    id: Mapped[int] = mapped_column(primary_key=True)
    district: Mapped[str] = mapped_column(String(60))
    upazila: Mapped[str] = mapped_column(String(60))
    mouza: Mapped[str] = mapped_column(String(80))
    dag_no: Mapped[str] = mapped_column(String(20))
    area_decimal: Mapped[float] = mapped_column(Float)
    land_type: Mapped[str] = mapped_column(String(40), default="residential")
    flags: Mapped[list] = mapped_column(JSON, default=list)      # ["khas","acquisition","disputed"]
    current_owner_id: Mapped[int] = mapped_column(ForeignKey("persons.id"))

class Deed(Base):
    __tablename__ = "deeds"
    id: Mapped[int] = mapped_column(primary_key=True)
    deed_no: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    plot_id: Mapped[int] = mapped_column(ForeignKey("plots.id"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("persons.id"))
    buyer_id: Mapped[int] = mapped_column(ForeignKey("persons.id"))
    area_sold: Mapped[float] = mapped_column(Float)
    deed_type: Mapped[str] = mapped_column(String(30), default="sale")
    sub_registry: Mapped[str] = mapped_column(String(80))
    registered_at: Mapped[str] = mapped_column(String(40))        # ISO string, part of the signed payload
    deed_hash: Mapped[str] = mapped_column(String(64))
    signature: Mapped[str] = mapped_column(String(128))

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    plot_id: Mapped[int] = mapped_column(ForeignKey("plots.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    deed_id: Mapped[int] = mapped_column(ForeignKey("deeds.id"))
    prev_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(40))

class Mutation(Base):
    __tablename__ = "mutations"
    id: Mapped[int] = mapped_column(primary_key=True)
    deed_id: Mapped[int] = mapped_column(ForeignKey("deeds.id"), unique=True)
    plot_id: Mapped[int] = mapped_column(ForeignKey("plots.id"))
    state: Mapped[str] = mapped_column(String(30), default="SUBMITTED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class MutationEvent(Base):
    __tablename__ = "mutation_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    mutation_id: Mapped[int] = mapped_column(ForeignKey("mutations.id"))
    from_state: Mapped[str] = mapped_column(String(30))
    to_state: Mapped[str] = mapped_column(String(30))
    actor: Mapped[str] = mapped_column(String(60))
    note: Mapped[str] = mapped_column(Text, default="")
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Case(Base):
    __tablename__ = "cases"
    id: Mapped[int] = mapped_column(primary_key=True)
    plot_id: Mapped[int] = mapped_column(ForeignKey("plots.id"))
    case_no: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="pending")

class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    plot_id: Mapped[int] = mapped_column(ForeignKey("plots.id"))
    deed_no: Mapped[str] = mapped_column(String(30), default="")
    rule_id: Mapped[str] = mapped_column(String(10))
    severity: Mapped[str] = mapped_column(String(10))
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(40), unique=True)
    role: Mapped[str] = mapped_column(String(20))   # registrar | officer | admin
    password_hash: Mapped[str] = mapped_column(String(200))

class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor: Mapped[str] = mapped_column(String(60))
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str] = mapped_column(String(60))
    at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```
Design note: **a registered deed does not change `plots.current_owner_id`. Ownership changes only when the mutation reaches KHATIAN_UPDATED.** This mirrors the real two-office process and is what lets R1 detect a pending sale.

---------------------------------------------------------------------
## 6. Core code
### 6.1 Crypto - `backend/app/services/crypto.py`
```python
import json, hashlib, os
from nacl.signing import SigningKey, VerifyKey
from nacl.encoding import HexEncoder
from nacl.exceptions import BadSignatureError

DEED_FIELDS = ["deed_no", "plot_id", "seller_id", "buyer_id", "area_sold",
               "deed_type", "registered_at", "sub_registry"]

def canonical(payload: dict) -> bytes:
    data = {k: payload[k] for k in DEED_FIELDS}
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def deed_hash(payload: dict) -> str:
    return sha256_hex(canonical(payload))

def load_or_create_key(path: str) -> SigningKey:
    if os.path.exists(path):
        return SigningKey(open(path).read().strip(), encoder=HexEncoder)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    sk = SigningKey.generate()
    open(path, "w").write(sk.encode(encoder=HexEncoder).decode())
    return sk

def public_key_hex(sk: SigningKey) -> str:
    return sk.verify_key.encode(encoder=HexEncoder).decode()

def sign_hash(sk: SigningKey, h: str) -> str:
    return sk.sign(bytes.fromhex(h)).signature.hex()

def verify_signature(pub_hex: str, h: str, sig_hex: str) -> bool:
    try:
        VerifyKey(pub_hex, encoder=HexEncoder).verify(bytes.fromhex(h), bytes.fromhex(sig_hex))
        return True
    except (BadSignatureError, ValueError):
        return False
```
### 6.2 Ledger - `backend/app/services/ledger.py`
```python
from datetime import datetime, timezone
from sqlalchemy import select
from ..models import LedgerEntry, Deed
from .crypto import sha256_hex, deed_hash, verify_signature

GENESIS = "0" * 64

def entry_hash(prev: str, dhash: str, seq: int, ts: str) -> str:
    return sha256_hex(f"{prev}|{dhash}|{seq}|{ts}".encode())

def append(db, plot_id: int, deed: Deed) -> LedgerEntry:
    last = db.scalars(select(LedgerEntry).where(LedgerEntry.plot_id == plot_id)
                      .order_by(LedgerEntry.seq.desc())).first()
    prev = last.entry_hash if last else GENESIS
    seq = (last.seq + 1) if last else 1
    ts = datetime.now(timezone.utc).isoformat()
    e = LedgerEntry(plot_id=plot_id, seq=seq, deed_id=deed.id, prev_hash=prev,
                    entry_hash=entry_hash(prev, deed.deed_hash, seq, ts), created_at=ts)
    db.add(e)
    return e

def deed_payload(d: Deed) -> dict:
    return dict(deed_no=d.deed_no, plot_id=d.plot_id, seller_id=d.seller_id, buyer_id=d.buyer_id,
                area_sold=d.area_sold, deed_type=d.deed_type, registered_at=d.registered_at,
                sub_registry=d.sub_registry)

def verify_deed(d: Deed, pub_hex: str) -> tuple[bool, str]:
    if deed_hash(deed_payload(d)) != d.deed_hash:
        return False, "Deed content does not match its recorded hash (altered)."
    if not verify_signature(pub_hex, d.deed_hash, d.signature):
        return False, "Signature invalid."
    return True, "ok"

def verify_chain(db, plot_id: int, pub_hex: str) -> tuple[bool, str]:
    entries = db.scalars(select(LedgerEntry).where(LedgerEntry.plot_id == plot_id)
                         .order_by(LedgerEntry.seq)).all()
    prev = GENESIS
    for e in entries:
        d = db.get(Deed, e.deed_id)
        ok, why = verify_deed(d, pub_hex)
        if not ok:
            return False, f"Entry {e.seq}: {why}"
        if e.prev_hash != prev or e.entry_hash != entry_hash(e.prev_hash, d.deed_hash, e.seq, e.created_at):
            return False, f"Entry {e.seq}: chain link broken."
        prev = e.entry_hash
    return True, "ok"
```
### 6.3 Fraud engine - `backend/app/services/fraud/engine.py`
```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from sqlalchemy import select
from ...models import Deed, Mutation, Case, Plot
from .. import ledger

@dataclass
class Finding:
    rule_id: str
    severity: str          # critical | high | medium
    weight: int
    reasons: list = field(default_factory=list)

# ctx keys: db, plot, seller_id, buyer_id, area_sold, now (datetime), pub_hex
def r1_double_sale(ctx):
    db, plot = ctx["db"], ctx["plot"]
    pending = db.scalars(select(Deed).join(Mutation, Mutation.deed_id == Deed.id, isouter=True)
        .where(Deed.plot_id == plot.id)).all()
    reasons = []
    for d in pending:
        m = db.scalars(select(Mutation).where(Mutation.deed_id == d.id)).first()
        if (m is None or m.state != "KHATIAN_UPDATED") and d.buyer_id != ctx["buyer_id"]:
            reasons.append(f"Deed {d.deed_no} already sells this plot to another buyer and is not yet mutated.")
    if ctx["area_sold"] > plot.area_decimal:
        reasons.append(f"Area sold ({ctx['area_sold']}) exceeds recorded plot area ({plot.area_decimal}).")
    return Finding("R1", "critical", 60, reasons) if reasons else None

def r2_seller_not_owner(ctx):
    if ctx["seller_id"] != ctx["plot"].current_owner_id:
        return Finding("R2", "critical", 60, ["Seller is not the current recorded owner of this plot."])

def r3_missing_mutation(ctx, days=30):
    db, plot = ctx["db"], ctx["plot"]
    limit = ctx["now"] - timedelta(days=days)
    for d in db.scalars(select(Deed).where(Deed.plot_id == plot.id)).all():
        m = db.scalars(select(Mutation).where(Mutation.deed_id == d.id)).first()
        if (m is None or m.state != "KHATIAN_UPDATED") and datetime.fromisoformat(d.registered_at) < limit:
            return Finding("R3", "medium", 20, [f"Deed {d.deed_no} registered over {days} days ago with no completed mutation."])

def r4_rapid_transfers(ctx, n=3, days=30):
    db, plot = ctx["db"], ctx["plot"]
    since = ctx["now"] - timedelta(days=days)
    recent = [d for d in db.scalars(select(Deed).where(Deed.plot_id == plot.id)).all()
              if datetime.fromisoformat(d.registered_at) >= since]
    if len(recent) + 1 >= n:
        return Finding("R4", "high", 30, [f"{len(recent)+1} transfers of this plot within {days} days."])

def r5_integrity(ctx):
    ok, why = ledger.verify_chain(ctx["db"], ctx["plot"].id, ctx["pub_hex"])
    if not ok:
        return Finding("R5", "critical", 100, [f"Integrity failure: {why}"])

def r6_flagged_land(ctx):
    db, plot = ctx["db"], ctx["plot"]
    reasons = [f"Plot is flagged: {f}." for f in (plot.flags or [])]
    if db.scalars(select(Case).where(Case.plot_id == plot.id, Case.status == "pending")).first():
        reasons.append("A court case is pending on this plot.")
    return Finding("R6", "high", 40, reasons) if reasons else None

RULES = [r1_double_sale, r2_seller_not_owner, r3_missing_mutation, r4_rapid_transfers, r5_integrity, r6_flagged_land]

def level(score: int) -> str:
    return "LOW" if score < 25 else "MEDIUM" if score < 60 else "HIGH" if score < 85 else "CRITICAL"

def evaluate(ctx) -> dict:
    findings = [f for r in RULES if (f := r(ctx))]
    score = min(100, sum(f.weight for f in findings))
    return {"score": score, "level": level(score), "findings": findings}
```
### 6.4 Mutation state machine - `backend/app/services/mutation_fsm.py`
```python
TRANSITIONS = {
    "SUBMITTED":    ["AUTO_CHECKED", "REJECTED"],
    "AUTO_CHECKED": ["UNDER_REVIEW", "REJECTED"],
    "UNDER_REVIEW": ["APPROVED", "REJECTED"],
    "APPROVED":     ["KHATIAN_UPDATED"],
}

def can_move(src: str, dst: str) -> bool:
    return dst in TRANSITIONS.get(src, [])

def move(db, mutation, dst, actor, note=""):
    from ..models import MutationEvent, Plot, Deed
    if not can_move(mutation.state, dst):
        raise ValueError(f"Illegal transition {mutation.state} -> {dst}")
    db.add(MutationEvent(mutation_id=mutation.id, from_state=mutation.state, to_state=dst, actor=actor, note=note))
    mutation.state = dst
    if dst == "KHATIAN_UPDATED":
        deed = db.get(Deed, mutation.deed_id)
        db.get(Plot, mutation.plot_id).current_owner_id = deed.buyer_id
```
Auto-check step (`AUTO_CHECKED`): re-run `verify_deed` and `evaluate`; if findings are critical, auto-reject with reasons.

### 6.5 Seed script - `backend/scripts/seed.py` (outline)
1. Create tables (`Base.metadata.create_all(engine)`).
2. Create users: `registrar1`, `officer1`, `admin1` with argon2 hashes (demo passwords documented in DEMO_SCRIPT.md).
3. Use `Faker("bn_BD")` or a handwritten list of Bangla first/last names to create ~200 persons (all `is_synthetic=True`, no NID).
4. Create 300 plots across a few fake mouzas with random areas (3-50 decimal) and owners.
5. For ~100 plots, register a historical deed via the same service function the API uses (so signatures and ledger are real), and complete its mutation.
6. Add the **named demo scenarios** (fixed IDs, documented in data/scenarios/README):
   - Plot 118: clean plot with 2 valid transfers (green demo)
   - Plot 120: deed sold to buyer X, mutation pending (for double-sale demo)
   - Plot 207: 3 transfers in 25 days (R4)
   - Plot 330: flagged `acquisition` + pending case (R6)
   - Plot 401: deed with no mutation, registered 45 days ago (R3)
7. Use `random.seed(42)` so data is deterministic.

### 6.6 API - key route `backend/app/api/v1/deeds.py`
```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from ...db import get_db
from ...models import Deed, Plot, Alert, LedgerEntry
from ...schemas import DeedIn
from ...security import require_role
from ...services import ledger, crypto
from ...services.fraud.engine import evaluate
from ...config import settings

router = APIRouter()
SK = crypto.load_or_create_key(settings.signing_key_path)
PUB = crypto.public_key_hex(SK)

@router.post("/deeds")
def register_deed(body: DeedIn, db: Session = Depends(get_db), user=Depends(require_role("registrar"))):
    plot = db.get(Plot, body.plot_id)
    if not plot: raise HTTPException(404, "Plot not found")
    now = datetime.now(timezone.utc)
    result = evaluate(dict(db=db, plot=plot, seller_id=body.seller_id, buyer_id=body.buyer_id,
                           area_sold=body.area_sold, now=now.replace(tzinfo=None), pub_hex=PUB))
    if result["level"] == "CRITICAL" or any(f.severity == "critical" for f in result["findings"]):
        for f in result["findings"]:
            db.add(Alert(plot_id=plot.id, deed_no=body.deed_no, rule_id=f.rule_id, severity=f.severity, reasons=f.reasons))
        db.commit()
        raise HTTPException(409, detail={"blocked": True, "score": result["score"],
                            "findings": [f.__dict__ for f in result["findings"]]})
    payload = dict(deed_no=body.deed_no, plot_id=body.plot_id, seller_id=body.seller_id, buyer_id=body.buyer_id,
                   area_sold=body.area_sold, deed_type=body.deed_type, registered_at=now.isoformat(),
                   sub_registry=body.sub_registry)
    h = crypto.deed_hash(payload)
    deed = Deed(**payload, deed_hash=h, signature=crypto.sign_hash(SK, h))
    db.add(deed); db.flush()
    ledger.append(db, plot.id, deed)
    db.commit()
    return {"deed_no": deed.deed_no, "hash": h, "score": result["score"], "level": result["level"]}

@router.get("/deeds/{deed_no}/verify")
def verify(deed_no: str, db: Session = Depends(get_db)):
    d = db.scalars(select(Deed).where(Deed.deed_no == deed_no)).first()
    if not d: return {"status": "UNKNOWN"}
    ok, why = ledger.verify_deed(d, PUB)
    if not ok: return {"status": "TAMPERED", "detail": why}
    latest = db.scalars(select(LedgerEntry).where(LedgerEntry.plot_id == d.plot_id)
                        .order_by(LedgerEntry.seq.desc())).first()
    mine = db.scalars(select(LedgerEntry).where(LedgerEntry.deed_id == d.id)).first()
    superseded = latest.seq > mine.seq
    return {"status": "VALID", "superseded": superseded,
            "detail": "Valid deed, but a later transfer exists." if superseded else "Valid and current."}
```
Also add: `GET /deeds/{no}/qr` (PNG via `qrcode`, content = `{FRONTEND_URL}/verify?deed=<deed_no>&h=<first 16 hex of hash>`), `GET /plots/{id}/chain`, `GET /risk/plot/{id}` (runs `evaluate` with the plot's current state and returns score + reasons), mutation routes, alerts route.
Remember: `DeedIn` schema (pydantic) with `deed_no, plot_id, seller_id, buyer_id, area_sold, deed_type, sub_registry`.

### 6.7 Auth and RBAC - `backend/app/security.py`
- Hash passwords with argon2 (`argon2.PasswordHasher`).
- `POST /auth/login` returns a JWT containing `sub` and `role`, expiry from settings.
- `require_role(*roles)` dependency decodes the token and raises 403 if the role is not allowed (admin passes all).
- Public routes (verify, plot chain, risk) require no token but return **masked names**: `mask("রহিম উদ্দিন")` -> keep first letter + `***`.

### 6.8 Tamper Lab
```python
@router.post("/dev/tamper/{deed_no}")
def tamper(deed_no: str, db: Session = Depends(get_db), user=Depends(require_role("admin"))):
    if not settings.demo_mode: raise HTTPException(404)
    d = db.scalars(select(Deed).where(Deed.deed_no == deed_no)).first()
    d.area_sold = d.area_sold + 1      # change one field without re-hashing
    db.commit(); return {"tampered": True}
```
Add `POST /dev/restore/{deed_no}` (sets the value back) so you can repeat the demo.

### 6.9 App entry - `backend/app/main.py`
Create `FastAPI()`, add CORS (origins from settings), include routers under `/api/v1`, add slowapi rate limiting, create tables on startup. Run: `uvicorn app.main:app --reload` from `backend/`. Open http://localhost:8000/docs to test.

---------------------------------------------------------------------
## 7. Tests (write while coding, not after)
`backend/tests/test_core.py` (use an in-memory SQLite and a fixture that seeds a tiny plot):
```python
def test_hash_changes_when_field_changes():
    p = dict(deed_no="D1", plot_id=1, seller_id=1, buyer_id=2, area_sold=5.0,
             deed_type="sale", registered_at="2026-10-01T00:00:00", sub_registry="Test")
    h1 = deed_hash(p); p["area_sold"] = 6.0
    assert deed_hash(p) != h1

def test_signature_roundtrip(): ...        # sign then verify -> True; flip a char -> False
def test_tampered_deed_fails_verify(): ... # change area_sold in DB -> verify_deed returns False
def test_chain_break_detected(): ...       # change entry.prev_hash -> verify_chain False
def test_double_sale_blocked(): ...        # two deeds same plot, second returns 409 with R1
def test_seller_not_owner(): ...           # R2
def test_illegal_mutation_transition(): ...# SUBMITTED -> APPROVED raises
def test_citizen_cannot_register(): ...    # no token -> 401/403
```
Run: `cd backend && pytest -q`. Aim for the core services covered and every seeded scenario having a test.

---------------------------------------------------------------------
## 8. Frontend
```bash
cd landshield
npx create-next-app@latest frontend   # TypeScript yes, Tailwind yes, App Router yes
cd frontend && npm i html5-qrcode next-intl
```
Create `.env.local`: `NEXT_PUBLIC_API=http://localhost:8000/api/v1`.
Pages (build in this order):
1. `/check` - search by plot ID -> calls `/risk/plot/{id}` + `/plots/{id}/chain` -> shows RiskCard (color by level), reasons list, ownership timeline, flags. Bangla text first.
2. `/verify` - input deed number or scan QR (html5-qrcode) -> status badge VALID (green) / TAMPERED (red) / superseded (amber).
3. `/registrar` - login, form to register a deed, shows QR image on success and blocked-reasons on 409.
4. `/officer` - mutation list, move state buttons (only legal ones), alerts table.
5. `/admin` - Tamper Lab buttons (visible only in demo mode).
Fonts: use Noto Sans Bengali via `next/font/google`. Put all strings in `locales/bn.json` and `en.json`. Keep the design clean: large status badges, mobile friendly, high contrast.

## 9. Docker and deployment
`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:15
    environment: { POSTGRES_USER: landshield, POSTGRES_PASSWORD: landshield, POSTGRES_DB: landshield }
    volumes: [pgdata:/var/lib/postgresql/data]
  backend:
    build: ./backend
    env_file: .env
    depends_on: [db]
    ports: ["8000:8000"]
  frontend:
    build: ./frontend
    environment: { NEXT_PUBLIC_API: "http://localhost:8000/api/v1" }
    ports: ["3000:3000"]
volumes: { pgdata: {} }
```
(If Docker costs you time, deploy without it: backend on Render/Railway using the start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, frontend on Vercel, set env vars in their dashboards, run `python -m scripts.seed` once.)
After deploying: open the live URL on your phone, run the whole demo, and fix CORS/env issues.

## 10. CI - `.github/workflows/ci.yml`
```yaml
name: ci
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: cd backend && pip install -r requirements.txt && ruff check . && pytest -q
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd frontend && npm ci && npm run build
```
Make the CI check required on `main`.

---------------------------------------------------------------------
## 11. Using the agentic AI properly (Phase 1 prompts)
Write `CLAUDE.md` in the repo root:
```
Project: LandShield. Read docs/PRD.md and docs/TRD.md before any change.
Rules: synthetic data only; no real personal data; no scraping; write pytest tests for every module;
keep functions small; do not modify files outside the requested module; never print or commit secrets.
```
Prompt pattern (one module at a time):
1. "Read docs/TRD.md section 4 and backend/app/services/crypto.py. Add tests in tests/test_crypto.py for hash change, signature roundtrip and tamper detection. Run them and fix failures."
2. "Implement R3 and R4 in fraud/engine.py per TRD section 6, with tests using the seeded scenarios."
3. "Build the /check page per PRD FR-6 using the API in TRD section 5. Bangla strings in locales."
After each result: run tests, read the diff, ask the agent to explain anything you don't understand, then commit.

## 12. Concept note (PDF, max 4 pages) - outline
1. Title, team, mentors, chosen problem statements (P2 primary; P3, P4, P5)
2. Problem in Bangladesh context (land disputes, forged deeds, double-selling, three offices, survey generations)
3. Proposed solution + what makes it different (verification layer, not replacement)
4. System architecture diagram + tech stack
5. Key features (Phase 1) and what's coming in the Final
6. Fraud rules table and risk score explanation
7. Security, privacy and data policy (synthetic data)
8. Countrywide implementation plan (pilot upazila -> district -> national, integration with existing gateway, key management, cost)
9. Limitations and next steps
Write in Google Docs/Word, export PDF, check page count.

## 13. README (use README_TEMPLATE.md)
Must include: setup instructions, data sources (synthetic), AI tool disclosure, demo credentials, screenshots, architecture image.

## 14. Demo video script (max 3:00)
- 0:00-0:20 Problem (one forged deed, one double sale)
- 0:20-0:50 Citizen checks a risky plot -> risk report with reasons (Bangla)
- 0:50-1:30 Registrar registers a deed -> QR appears -> scan/verify = VALID
- 1:30-2:00 Tamper Lab changes the deed -> verify = TAMPERED
- 2:00-2:30 Second sale of the same plot blocked with R1 reasons
- 2:30-2:50 Mutation moves through states; ownership updates
- 2:50-3:00 Closing: verification layer on top of existing systems, countrywide plan
Record in OBS at 1080p, rehearse twice, keep under 3:00.

## 15. Timeline recap and submission
| Day | Do |
|---|---|
| Oct 9 | Sections 1-4, skeleton, GitHub, models |
| Oct 10 | crypto, ledger, seed, deeds API, QR, tests |
| Oct 11 | fraud rules, FSM, auth, Tamper Lab, tests |
| Oct 12 | frontend pages, deploy |
| Oct 13 | concept note, README, video |
| Oct 14 | bug fixes, fresh-clone test, security checklist (SECURITY.md section 6) |
| Oct 15 | upload on landtech.diu.edu.bd/landtech, tag `v1.0-round1` |

## 16. Final pre-submission checklist
- [ ] `git clone` into a new folder + `docker compose up` works
- [ ] All tests pass in CI
- [ ] No secrets or real data in repo (`git grep -i "password\|secret\|nid"`)
- [ ] Both students have commits
- [ ] README has AI disclosure and data statement
- [ ] Concept note <= 4 pages, video <= 3 minutes, live link works
- [ ] Submission uploaded and confirmation screenshot saved

## 17. Troubleshooting
| Problem | Fix |
|---|---|
| CORS error | Add frontend URL to ALLOWED_ORIGINS |
| Signature invalid after restart | Signing key regenerated; keep `keys/` persistent or reseed after key creation |
| Verify says tampered after seed | Seed must create deeds through the same service functions |
| Bangla shows boxes | Load Noto Sans Bengali font |
| Render sleeps (cold start) | Open the app 2 minutes before the demo / recording |
