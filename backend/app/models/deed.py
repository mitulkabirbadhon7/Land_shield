from sqlalchemy import Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Deed(Base):
    __tablename__ = "deeds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    deed_no: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    plot_id: Mapped[int] = mapped_column(Integer, ForeignKey("plots.id"), nullable=False)
    seller_id: Mapped[int] = mapped_column(Integer, ForeignKey("persons.id"), nullable=False)
    buyer_id: Mapped[int] = mapped_column(Integer, ForeignKey("persons.id"), nullable=False)
    area_sold: Mapped[float] = mapped_column(Float, nullable=False)
    deed_type: Mapped[str] = mapped_column(String(30), default="sale", nullable=False)
    sub_registry: Mapped[str] = mapped_column(String(80), nullable=False)
    registered_at: Mapped[str] = mapped_column(String(40), nullable=False)  # ISO string stored verbatim
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    deed_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    signature: Mapped[str] = mapped_column(String(128), nullable=False)
    signer_key_id: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)  # "ACTIVE" | "CANCELLED"
    price_bdt: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    tamper_backup: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)  # Tamper Lab only
