"""Application configuration from environment."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env from project root (backend/app/config.py -> ../../.env)
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ROOT_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Strategic Survey Engine"
    debug: bool = False

    # Database (PostgreSQL 15+)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/strategic_survey"
    database_echo: bool = False

    # Admin API
    admin_api_key: str = ""

    # Manager JWT
    jwt_secret_key: str = "change-me-in-production-min-32-bytes-required"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hours


settings = Settings()
