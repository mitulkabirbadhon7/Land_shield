from datetime import datetime, timezone
from sqlalchemy import Integer, String, ForeignKey, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Mutation(Base):
    __tablename__ = "mutations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    deed_id: Mapped[int] = mapped_column(Integer, ForeignKey("deeds.id"), nullable=False, index=True)
    plot_id: Mapped[int] = mapped_column(Integer, ForeignKey("plots.id"), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(30), default="SUBMITTED", nullable=False)
    applicant_id: Mapped[int] = mapped_column(Integer, ForeignKey("persons.id"), nullable=False)
    officer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    auto_check_json: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    requires_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
