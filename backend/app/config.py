"""Application configuration from environment."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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


settings = Settings()
