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

    # Phase 2 Feature Flags
    feature_reconcile: bool = True
    feature_lineage: bool = True
    feature_offline_qr: bool = True
    feature_agent: bool = True
    feature_transparency: bool = True
    feature_ml: bool = False
    feature_ocr: bool = False

    # LLM Settings
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    agent_timeout_seconds: int = 20

    @property
    def should_seed_on_start(self) -> bool:
        if self.SEED_ON_START is not None:
            return bool(self.SEED_ON_START)
        return self.seed_on_start

    @property
    def is_reconcile_enabled(self) -> bool:
        return bool(self.feature_reconcile)

    @property
    def is_lineage_enabled(self) -> bool:
        return bool(self.feature_lineage)

    @property
    def is_offline_qr_enabled(self) -> bool:
        return bool(self.feature_offline_qr)

    @property
    def is_agent_enabled(self) -> bool:
        return bool(self.feature_agent)

    @property
    def is_transparency_enabled(self) -> bool:
        return bool(self.feature_transparency)

    @property
    def is_ml_enabled(self) -> bool:
        return bool(self.feature_ml)

    @property
    def is_ocr_enabled(self) -> bool:
        return bool(self.feature_ocr)

    @property
    def effective_llm_provider(self) -> str:
        return self.llm_provider

    @property
    def effective_llm_model(self) -> str:
        return self.llm_model

    @property
    def effective_llm_api_key(self) -> str:
        return self.llm_api_key

    @property
    def effective_agent_timeout_seconds(self) -> int:
        return self.agent_timeout_seconds

    @property
    def normalized_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return "postgresql+psycopg://" + url[len("postgresql://") :]
        return url

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
