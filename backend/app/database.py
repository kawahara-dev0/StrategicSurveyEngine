"""SQLAlchemy 2.0 async engine and session management."""
import re
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings

# PostgreSQL の識別子として許容するパターン（SET search_path はバインド引数不可のため検証して埋め込む）
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
            # SET search_path はバインドパラメータ非対応のため、検証済みの識別子をそのまま埋め込む
            await session.execute(text(f"SET search_path TO {schema_name}"))
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    """Context manager for non-request usage (e.g. middleware lookup)."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
