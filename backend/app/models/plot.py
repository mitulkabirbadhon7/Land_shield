from sqlalchemy import Integer, String, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Plot(Base):
    __tablename__ = "plots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mouza: Mapped[str] = mapped_column(String(80), nullable=False)
    upazila: Mapped[str] = mapped_column(String(60), nullable=False)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    dag_no: Mapped[str] = mapped_column(String(20), nullable=False)
    area_decimal: Mapped[float] = mapped_column(Float, nullable=False)
    land_type: Mapped[str] = mapped_column(String(40), default="residential", nullable=False)
    flags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # ["khas", "acquisition", "disputed"]
    initial_owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("persons.id"), nullable=False)
    current_owner_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("persons.id"), nullable=True)  # Informational: largest record holder
