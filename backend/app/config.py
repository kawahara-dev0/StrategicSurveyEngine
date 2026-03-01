"""Application configuration from environment."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# プロジェクトルートの .env を読む（backend/app/config.py -> ../../.env）
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"  # backend/app -> backend -> ルート


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

    # Schema names
    public_schema: str = "public"

    # Admin API (Phase 2)
    admin_api_key: str = ""

    # Manager JWT (Phase 6)
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480  # 8 hours


settings = Settings()
