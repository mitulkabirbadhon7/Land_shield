from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models.person import Person
from app.models.user import User
from app.schemas.persons import PersonOut

router = APIRouter(prefix="/persons", tags=["persons"])


@router.get("/search", response_model=list[PersonOut])
def search_persons(
    q: str = Query("", description="Search term for name or ID"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role("registrar", "admin")),
    db: Session = Depends(get_db),
) -> list[PersonOut]:
    """Search synthetic person directory (Registrar and Admin only)."""
    stmt = select(Person)
    clean_q = q.strip()
    if clean_q:
        if clean_q.isdigit():
            stmt = stmt.where(
                or_(
                    Person.id == int(clean_q),
                    Person.display_name.ilike(f"%{clean_q}%"),
                )
            )
        else:
            stmt = stmt.where(Person.display_name.ilike(f"%{clean_q}%"))

    stmt = stmt.order_by(Person.id.asc()).limit(limit)
    persons = db.scalars(stmt).all()
    return [PersonOut.model_validate(p) for p in persons]
