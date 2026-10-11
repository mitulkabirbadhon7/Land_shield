from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./landshield.db"
    jwt_secret: str = "dev-secret-key-change-in-production-32-bytes"
    jwt_expire_minutes: int = 60
    signing_key_path: str = "./keys/registrar.key"
    demo_mode: bool = True
    allowed_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"
    rate_limit: str = "60/minute"
    mutation_days: int = 90

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
