from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.db import Base, engine
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

from app.errors import DomainError, FraudBlocked, IllegalTransition
import app.models  # noqa: F401 - ensure models are registered with Base.metadata
from app.api.v1 import alerts, audit, auth, deeds, dev, features, ingest, keys, lineage, meta, metrics, mutations, persons, plots, reconcile, reports, risk, transparency
from app.api.v1.auth import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.demo_mode and settings.jwt_secret in ("change-me", "dev-secret-key-change-in-production-32-bytes"):
        raise RuntimeError("Refusing to run: default JWT_SECRET configured when DEMO_MODE is false")
    Base.metadata.create_all(bind=engine)

    # Register active system Ed25519 signing key in signing_keys table
    try:
        from sqlalchemy.orm import Session
        from sqlalchemy import select
        from app.models.signing_key import SigningKey
        from app.services.crypto import load_or_create_key, public_key_hex, key_id

        sk = load_or_create_key(settings.signing_key_path)
        k_id = key_id(sk)
        pub_hex = public_key_hex(sk)

        with Session(engine) as key_db:
            existing_key = key_db.scalars(select(SigningKey).where(SigningKey.key_id == k_id)).first()
            if existing_key is None:
                new_key = SigningKey(key_id=k_id, public_key_hex=pub_hex, status="ACTIVE")
                key_db.add(new_key)
                key_db.commit()
    except Exception:
        pass

    if settings.should_seed_on_start:
        import sys
        from pathlib import Path
        backend_dir = Path(__file__).resolve().parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        from sqlalchemy.orm import Session
        from sqlalchemy import select
        from app.models.plot import Plot
        from scripts.seed import seed_data

        with Session(engine) as check_db:
            existing = check_db.scalars(select(Plot)).first()
            if existing is None:
                seed_data(check_db)
                check_db.commit()

    yield


app = FastAPI(
    title="LandShield API",
    description="Tamper-evident deed verification and fraud prevention for Bangladesh land records",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Data-Policy"] = "synthetic-demo"
    return response


@app.exception_handler(DomainError)
def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"code": "INVALID", "detail": str(exc.message)},
    )


@app.exception_handler(FraudBlocked)
def fraud_blocked_handler(request: Request, exc: FraudBlocked):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"code": "FRAUD_BLOCKED", "report": exc.report},
    )


@app.exception_handler(IllegalTransition)
def illegal_transition_handler(request: Request, exc: IllegalTransition):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"code": "ILLEGAL_TRANSITION", "allowed": exc.allowed},
    )


@app.exception_handler(Exception)
def generic_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
        )
    if isinstance(exc, FraudBlocked):
        return fraud_blocked_handler(request, exc)
    if isinstance(exc, DomainError):
        return domain_error_handler(request, exc)
    if isinstance(exc, IllegalTransition):
        return illegal_transition_handler(request, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"code": "SERVER_ERROR"},
    )


allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(deeds.router, prefix="/api/v1")
app.include_router(plots.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(mutations.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(dev.router, prefix="/api/v1")
app.include_router(persons.router, prefix="/api/v1")
app.include_router(meta.router, prefix="/api/v1")
app.include_router(features.router, prefix="/api/v1")
app.include_router(reconcile.router, prefix="/api/v1")
app.include_router(lineage.router, prefix="/api/v1")
app.include_router(keys.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(transparency.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")

# Also include risk, alerts, mutations, audit, dev, persons, meta, features at root for convenient direct routing
app.include_router(risk.router)
app.include_router(alerts.router)
app.include_router(mutations.router)
app.include_router(audit.router)
app.include_router(dev.router)
app.include_router(persons.router)
app.include_router(meta.router)
app.include_router(features.router)
app.include_router(reconcile.router)
app.include_router(lineage.router)
app.include_router(keys.router)
app.include_router(reports.router)
app.include_router(transparency.router)
app.include_router(metrics.router)
app.include_router(ingest.router)




@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}


