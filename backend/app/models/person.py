from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class Person(Base):
    __tablename__ = "persons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    masked_nid_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
