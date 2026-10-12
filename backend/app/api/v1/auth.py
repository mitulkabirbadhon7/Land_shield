from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.user import User
from app.security import create_access_token, verify_password

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_rate_limit() -> str:
    if hasattr(settings, "RATE_LIMIT"):
        return settings.RATE_LIMIT
    if hasattr(settings, "rate_limit") and settings.rate_limit not in ("60/minute", "100000/minute"):
        return settings.rate_limit
    return "10/minute"


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    role: str
    name: str


@router.post("/login", response_model=LoginResponse)
@limiter.limit(_auth_rate_limit)
def login(
    request: Request,
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    from app.services.audit import log
    user = db.scalars(select(User).where(User.username == body.username)).first()

    if user is None or not verify_password(body.password, user.password_hash):
        log(
            db,
            actor=user,
            action="LOGIN_FAILURE",
            entity="user",
            entity_id=user.id if user else None,
            detail=f"Failed login attempt for username '{body.username}'",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(sub=user.username, role=user.role)
    log(
        db,
        actor=user,
        action="LOGIN_SUCCESS",
        entity="user",
        entity_id=user.id,
        detail=f"User '{user.username}' logged in successfully",
    )
    db.commit()
    return LoginResponse(
        access_token=token,
        role=user.role,
        name=user.name,
    )

