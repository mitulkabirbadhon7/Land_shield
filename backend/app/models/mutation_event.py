from datetime import datetime, timezone
from sqlalchemy import Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class MutationEvent(Base):
    __tablename__ = "mutation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mutation_id: Mapped[int] = mapped_column(Integer, ForeignKey("mutations.id"), nullable=False, index=True)
    from_state: Mapped[str] = mapped_column(String(30), nullable=False)
    to_state: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
