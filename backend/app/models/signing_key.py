from datetime import datetime, timezone
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class SigningKey(Base):
    __tablename__ = "signing_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    public_key_hex: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)  # "ACTIVE", "RETIRED"
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
