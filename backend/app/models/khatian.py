from datetime import datetime, timezone
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Khatian(Base):
    __tablename__ = "khatians"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plot_id: Mapped[int] = mapped_column(Integer, ForeignKey("plots.id"), nullable=False, index=True)
    survey_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "CS", "SA", "RS", "BS"
    khatian_no: Mapped[str] = mapped_column(String(50), nullable=False)
    dag_no: Mapped[str] = mapped_column(String(50), nullable=False)
    area_decimal: Mapped[float] = mapped_column(Float, nullable=False)
    owners_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("khatians.id"), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
