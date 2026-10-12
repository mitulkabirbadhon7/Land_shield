from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import DomainError, IllegalTransition
from app.models.audit import AuditLog
from app.models.deed import Deed
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.models.person import Person
from app.models.plot import Plot
from app.models.user import User
from app.services.holdings import recompute_current_owner
from app.services.pipeline.base import AnalysisContext
from app.services.pipeline.engine import assess
from app.services.pipeline.registry import get_layers

TRANSITIONS: dict[str, list[str]] = {
    "SUBMITTED": ["AUTO_CHECKED", "REJECTED"],
    "AUTO_CHECKED": ["UNDER_REVIEW", "REJECTED"],
    "UNDER_REVIEW": ["APPROVED", "REJECTED"],
    "APPROVED": ["KHATIAN_UPDATED"],
}


def transition(
    db: Session,
    mutation: Mutation,
    to_state: str,
    actor: User | int | None = None,
    note: str | None = None,
) -> Mutation:
    """Transition mutation to a new state with full validation, events, and audit logging."""
    allowed = TRANSITIONS.get(mutation.state, [])
    target_state = to_state.strip().upper()

    if target_state not in allowed:
        raise IllegalTransition(mutation.state, target_state, allowed)

    clean_note = note.strip() if (note and note.strip()) else None

    # Rejection requires mandatory explanation note
    if target_state == "REJECTED" and not clean_note:
        raise DomainError("Rejection requires a mandatory explanation note")

    # Override note is required to progress past AUTO_CHECKED if critical risk was flagged
    if mutation.requires_override and target_state != "REJECTED" and not clean_note:
        raise DomainError("Officer override note is mandatory to proceed when risk auto-check requires override")

    actor_id: int | None = None
    if isinstance(actor, User):
        actor_id = actor.id
    elif isinstance(actor, int):
        actor_id = actor

    from_state = mutation.state
    mutation.state = target_state
    mutation.updated_at = datetime.now(timezone.utc)
    if actor_id is not None:
        mutation.officer_id = actor_id

    # Record event in chronological order
    event = MutationEvent(
        mutation_id=mutation.id,
        from_state=from_state,
        to_state=target_state,
        actor_id=actor_id,
        note=clean_note,
        at=datetime.now(timezone.utc),
    )
    db.add(event)

    # Record audit log
    from app.services.audit import log
    log(
        db,
        actor=actor,
        action=f"MUTATION_{target_state}",
        entity="mutation",
        entity_id=mutation.id,
        detail=f"State transitioned from {from_state} to {target_state}. Note: {clean_note or ''}",
    )

    # State-specific side effects
    if target_state == "REJECTED":
        deed = db.get(Deed, mutation.deed_id)
        if deed:
            deed.status = "CANCELLED"
            log(
                db,
                actor=actor,
                action="DEED_CANCELLED",
                entity="deed",
                entity_id=deed.id,
                detail=f"Deed cancelled due to mutation rejection (Mutation #{mutation.id}). Note: {clean_note or ''}",
            )


    elif target_state == "KHATIAN_UPDATED":
        # Flush so MutationEvent is queryable by record_holdings
        db.flush()
        plot = db.get(Plot, mutation.plot_id)
        if plot:
            recompute_current_owner(db, plot)

    db.flush()
    return mutation


def start_mutation(
    db: Session,
    deed_id: int,
    applicant_id: int | None = None,
) -> Mutation:
    """Initiate a mutation application from an active deed."""
    deed = db.get(Deed, deed_id)
    if not deed:
        raise DomainError(f"Deed with ID {deed_id} not found")

    if deed.status != "ACTIVE":
        raise DomainError(f"Deed status is {deed.status}; must be ACTIVE to start mutation")

    # Default applicant to deed buyer
    if applicant_id is None:
        applicant_id = deed.buyer_id

    applicant = db.get(Person, applicant_id)
    if not applicant:
        raise DomainError(f"Applicant person with ID {applicant_id} not found")

    # Refuse second open mutation on the same deed
    open_mutation = db.scalars(
        select(Mutation).where(
            Mutation.deed_id == deed.id,
            Mutation.state.notin_(["KHATIAN_UPDATED", "REJECTED"]),
        )
    ).first()
    if open_mutation:
        raise DomainError(
            f"An open mutation (ID {open_mutation.id}) in state '{open_mutation.state}' already exists for deed {deed.deed_no}"
        )

    mutation = Mutation(
        deed_id=deed.id,
        plot_id=deed.plot_id,
        applicant_id=applicant_id,
        state="SUBMITTED",
        requires_override=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(mutation)
    db.flush()

    # Initial submission event
    event = MutationEvent(
        mutation_id=mutation.id,
        from_state="NONE",
        to_state="SUBMITTED",
        actor_id=None,
        note="Mutation application initiated",
        at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.flush()
    return mutation


def auto_check(db: Session, mutation: Mutation) -> Mutation:
    """Execute automated PLOT-mode fraud evaluation and transition to AUTO_CHECKED."""
    plot = db.get(Plot, mutation.plot_id)
    if not plot:
        raise DomainError(f"Plot {mutation.plot_id} not found for mutation")

    ctx = AnalysisContext(
        db=db,
        plot=plot,
        now=datetime.now(timezone.utc),
        proposed=None,
    )
    report = assess(ctx, get_layers())
    mutation.auto_check_json = report

    if report.get("has_critical", False):
        mutation.requires_override = True

    return transition(
        db=db,
        mutation=mutation,
        to_state="AUTO_CHECKED",
        actor=None,
        note="Automated fraud risk assessment complete",
    )
