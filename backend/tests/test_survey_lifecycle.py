"""Test survey lifecycle batch: suspend and delete."""

from datetime import date, timedelta
from uuid import UUID

import pytest_asyncio
from app.database import AsyncSessionLocal
from app.models.public import Survey
from app.services.survey_lifecycle import run_survey_lifecycle
from app.services.survey_provisioning import create_survey, delete_survey
from httpx import AsyncClient
from sqlalchemy import select, text


@pytest_asyncio.fixture
async def expired_survey():
    """Create a survey with contract_end_date and deletion_due_date in the past."""
    survey_id: str
    async with AsyncSessionLocal() as session:
        await session.execute(text("SET search_path TO public"))
        survey, _ = await create_survey(session, "Lifecycle Test", contract_days=30)
        await session.commit()
        survey_id = str(survey.id)
        # Set dates to past so batch will process
        yesterday = date.today() - timedelta(days=1)
        result = await session.execute(select(Survey).where(Survey.id == survey.id))
        s = result.scalar_one()
        s.contract_end_date = yesterday
        s.deletion_due_date = yesterday
        await session.commit()
    yield survey_id
    # Cleanup: delete if not already deleted by batch
    async with AsyncSessionLocal() as session:
        await session.execute(text("SET search_path TO public"))
        result2 = await session.execute(select(Survey).where(Survey.id == UUID(survey_id)))
        if result2.scalar_one_or_none():
            await delete_survey(session, UUID(survey_id))
            await session.commit()


async def test_lifecycle_suspends_and_deletes(expired_survey: str) -> None:
    """Run lifecycle batch: expired survey should be deleted (skip suspend if already past deletion)."""
    async with AsyncSessionLocal() as session:
        result = await run_survey_lifecycle(session)
        await session.commit()

    # Survey had both contract_end and deletion_due in past, so it gets deleted
    assert result.deleted_count >= 1
    assert expired_survey in result.deleted_ids


async def test_lifecycle_empty_db() -> None:
    """Run lifecycle with no expired surveys."""
    async with AsyncSessionLocal() as session:
        result = await run_survey_lifecycle(session)
        await session.commit()

    assert result.suspended_count == 0
    assert result.deleted_count == 0


async def test_admin_lifecycle_endpoint(admin_client: AsyncClient) -> None:
    """POST /admin/jobs/survey-lifecycle returns result."""
    resp = await admin_client.post("/admin/jobs/survey-lifecycle")
    assert resp.status_code == 200
    data = resp.json()
    assert "suspended_count" in data
    assert "deleted_count" in data
    assert "suspended_ids" in data
    assert "deleted_ids" in data
