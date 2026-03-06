"""SQLAlchemy 2.0 async engine and session management."""

import re
from collections.abc import AsyncGenerator

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings

# PostgreSQL identifier pattern; search_path cannot use bound params so we validate and embed
_SCHEMA_NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

# Use NullPool so each request gets a clean connection and search_path is per-connection
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    poolclass=NullPool,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency: yield an async session.
    If SchemaSwitchingMiddleware set request.state.survey_schema_name,
    runs SET search_path TO that schema so tenant tables are used.
    """
    async with AsyncSessionLocal() as session:
        schema_name = getattr(request.state, "survey_schema_name", None)
        if schema_name:
            if not _SCHEMA_NAME_PATTERN.match(schema_name):
                raise ValueError(f"Invalid schema name: {schema_name!r}")
            await session.execute(text(f"SET search_path TO {schema_name}"))
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
