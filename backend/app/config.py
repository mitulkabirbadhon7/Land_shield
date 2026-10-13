from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./landshield.db"
    jwt_secret: str = "dev-secret-key-change-in-production-32-bytes"
    jwt_expire_minutes: int = 60
    signing_key_path: str = "./keys/registrar.key"
    demo_mode: bool = True
    allowed_origins: str = "http://localhost:3000,https://landshield-frontend.vercel.app"
    frontend_url: str = "http://localhost:3000"
    rate_limit: str = "60/minute"
    RATE_LIMIT: str | None = None
    mutation_days: int = 90
    seed_on_start: bool = False
    SEED_ON_START: bool | None = None

    @property
    def should_seed_on_start(self) -> bool:
        if self.SEED_ON_START is not None:
            return bool(self.SEED_ON_START)
        return self.seed_on_start

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
