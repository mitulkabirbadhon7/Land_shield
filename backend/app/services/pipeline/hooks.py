from typing import Any
from sqlalchemy.orm import Session


def pre_register_check(db: Session, proposed: dict[str, Any]) -> None:
    """Pre-registration fraud check hook stub.

    Called prior to deed registration. Returns None in Phase 1 stub;
    Session S08 implements full fraud pipeline and blocking.
    """
    return None
