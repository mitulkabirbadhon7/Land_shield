from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./landshield.db"
    jwt_secret: str = "dev-secret-key-change-in-production-32-bytes"
    jwt_expire_minutes: int = 60
    signing_key_path: str = "./keys/registrar.key"
    signing_key_hex: str | None = None
    SIGNING_KEY_HEX: str | None = None
    demo_mode: bool = True
    allowed_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"
    rate_limit: str = "60/minute"
    RATE_LIMIT: str | None = None
    mutation_days: int = 90
    seed_on_start: bool = False
    SEED_ON_START: bool | None = None
    port: int = 8000
    PORT: int | None = None

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url_val(cls, v: str) -> str:
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("postgres://"):
                return "postgresql+psycopg://" + v_clean[len("postgres://"):]
            if v_clean.startswith("postgresql://") and not v_clean.startswith("postgresql+"):
                return "postgresql+psycopg://" + v_clean[len("postgresql://"):]
            return v_clean
        return v

    @property
    def should_seed_on_start(self) -> bool:
        if self.SEED_ON_START is not None:
            return bool(self.SEED_ON_START)
        return self.seed_on_start

    @property
    def effective_signing_key_hex(self) -> str | None:
        if self.SIGNING_KEY_HEX:
            return self.SIGNING_KEY_HEX.strip()
        if self.signing_key_hex:
            return self.signing_key_hex.strip()
        return None

    @property
    def effective_port(self) -> int:
        if self.PORT is not None:
            return int(self.PORT)
        return self.port

    @property
    def normalized_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg://" + url[len("postgres://"):]
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
