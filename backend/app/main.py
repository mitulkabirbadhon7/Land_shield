from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.db import Base, engine
from app.errors import DomainError, FraudBlocked
import app.models  # noqa: F401 - ensure models are registered with Base.metadata
from app.api.v1 import alerts, auth, deeds, plots, risk
from app.api.v1.auth import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.demo_mode and settings.jwt_secret in ("change-me", "dev-secret-key-change-in-production-32-bytes"):
        raise RuntimeError("Refusing to run: default JWT_SECRET configured when DEMO_MODE is false")
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="LandShield API",
    description="Tamper-evident deed verification and fraud prevention for Bangladesh land records",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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

# Also include risk and alerts at root for convenient direct routing
app.include_router(risk.router)
app.include_router(alerts.router)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}


