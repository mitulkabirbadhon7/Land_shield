from datetime import datetime, timezone
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class IngestDraft(Base):
    __tablename__ = "ingest_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False)  # "khatian", "deed"
    image_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    extracted_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    confidence_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)  # "DRAFT", "APPROVED", "REJECTED"
    reviewer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
