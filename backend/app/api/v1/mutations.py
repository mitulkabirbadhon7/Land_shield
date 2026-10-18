from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_role
from app.models.deed import Deed
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.models.person import Person
from app.models.user import User
from app.schemas.mutations import (
    MutationCreate,
    MutationEventOut,
    MutationOut,
    MutationTransition,
)
from app.services.mutation_fsm import auto_check, start_mutation, transition
from app.utils.privacy import person_view

router = APIRouter(prefix="/mutations", tags=["mutations"])


def _build_mutation_out(
    mutation: Mutation,
    db: Session,
    include_auto_check: bool = False,
    viewer: User | None = None,
) -> MutationOut:
    applicant = db.get(Person, mutation.applicant_id)
    pv = person_view(applicant, viewer)

    deed = db.get(Deed, mutation.deed_id)
    deed_no = deed.deed_no if deed else None

    events = db.scalars(
        select(MutationEvent)
        .where(MutationEvent.mutation_id == mutation.id)
        .order_by(MutationEvent.at.asc())
    ).all()
    events_out = [MutationEventOut.model_validate(e) for e in events]

    return MutationOut(
        id=mutation.id,
        deed_id=mutation.deed_id,
        deed_no=deed_no,
        plot_id=mutation.plot_id,
        state=mutation.state,
        applicant_id=pv.identifier if not pv.is_masked else None,
        applicant_name=pv.name,
        officer_id=mutation.officer_id if not pv.is_masked else None,
        requires_override=mutation.requires_override,
        created_at=mutation.created_at,
        updated_at=mutation.updated_at,
        events=events_out,
        auto_check_json=mutation.auto_check_json if include_auto_check else None,
    )


@router.post("", response_model=MutationOut, status_code=status.HTTP_201_CREATED)
def create_mutation(
    payload: MutationCreate,
    current_user: User = Depends(require_role("registrar", "admin")),
    db: Session = Depends(get_db),
) -> MutationOut:
    """Start a mutation application from an active deed (Registrar only)."""
    mutation = start_mutation(
        db=db,
        deed_id=payload.deed_id,
        applicant_id=payload.applicant_id,
    )
    if payload.auto_check:
        mutation = auto_check(db=db, mutation=mutation)

    db.commit()
    db.refresh(mutation)
    return _build_mutation_out(mutation, db, include_auto_check=True, viewer=current_user)


@router.post("/{mutation_id}/transition", response_model=MutationOut)
def transition_mutation(
    mutation_id: int,
    payload: MutationTransition,
    current_user: User = Depends(require_role("officer", "admin")),
    db: Session = Depends(get_db),
) -> MutationOut:
    """Transition mutation workflow state with note verification (Officer only)."""
    mutation = db.get(Mutation, mutation_id)
    if not mutation:
        raise HTTPException(status_code=404, detail="Mutation not found")

    target_state = payload.to_state.strip().upper()
    if target_state == "AUTO_CHECKED" and mutation.state == "SUBMITTED":
        mutation = auto_check(db=db, mutation=mutation)
    else:
        mutation = transition(
            db=db,
            mutation=mutation,
            to_state=target_state,
            actor=current_user,
            note=payload.note,
        )

    db.commit()
    db.refresh(mutation)
    return _build_mutation_out(mutation, db, include_auto_check=True, viewer=current_user)


@router.get("", response_model=list[MutationOut])
def list_mutations(
    state: str | None = Query(None),
    current_user: User = Depends(require_role("officer", "admin")),
    db: Session = Depends(get_db),
) -> list[MutationOut]:
    """List mutation records with optional state filtering (Officer/Admin only)."""
    stmt = select(Mutation)
    if state:
        stmt = stmt.where(Mutation.state == state.strip().upper())
    stmt = stmt.order_by(Mutation.created_at.desc())
    mutations = db.scalars(stmt).all()

    return [_build_mutation_out(m, db, include_auto_check=True, viewer=current_user) for m in mutations]


@router.get("/{mutation_id}", response_model=MutationOut)
def get_mutation(
    mutation_id: int,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MutationOut:
    """Public masked view with status steps. Privileged users (officer/admin) see auto_check details."""
    mutation = db.get(Mutation, mutation_id)
    if not mutation:
        raise HTTPException(status_code=404, detail="Mutation not found")

    is_privileged = current_user is not None and current_user.role in ["officer", "admin"]
    return _build_mutation_out(mutation, db, include_auto_check=is_privileged, viewer=current_user)
