from datetime import datetime, timezone
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class MerkleRoot(Base):
    __tablename__ = "merkle_roots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)  # YYYY-MM-DD
    root: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hex
    entry_count: Mapped[int] = mapped_column(Integer, nullable=False)
    max_entry_id: Mapped[int] = mapped_column(Integer, nullable=False)
    signature: Mapped[str] = mapped_column(String(128), nullable=False)  # Ed25519 signature
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), nullable=False)
