"""Pytest fixtures for API tests. Requires PostgreSQL (DATABASE_URL). Run: alembic upgrade head."""

import asyncio
from collections.abc import AsyncGenerator

from httpx import ASGITransport, AsyncClient
import pytest
import pytest_asyncio

from app.config import settings
from app.main import app

# Survey IDs created during tests (for cleanup)
_created_survey_ids: list[str] = []


def pytest_sessionfinish(_session: pytest.Session, _exitstatus: int) -> None:
    """After all tests, delete surveys created during the test run."""
    if not _created_survey_ids or not settings.admin_api_key:
        return
    async def _cleanup() -> None:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            ac.headers["X-Admin-API-Key"] = settings.admin_api_key
            for survey_id in _created_survey_ids:
                await ac.delete(f"/admin/surveys/{survey_id}")
    asyncio.run(_cleanup())


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_client(client: AsyncClient) -> AsyncGenerator[AsyncClient, None]:
    """Client with admin auth headers. Tracks surveys created via POST /admin/surveys for cleanup."""
    if settings.admin_api_key:
        client.headers["X-Admin-API-Key"] = settings.admin_api_key

    original_post = client.post

    async def tracking_post(url, *args, **kwargs):
        resp = await original_post(url, *args, **kwargs)
        # Record survey ID from successful survey creation (POST /admin/surveys only)
        path = url if isinstance(url, str) else str(url)
        if (
            resp.status_code == 200
            and path.rstrip("/").endswith("/admin/surveys")
            and "/questions" not in path
        ):
            data = resp.json()
            if isinstance(data, dict) and "id" in data:
                _created_survey_ids.append(str(data["id"]))
        return resp

    client.post = tracking_post
    yield client
