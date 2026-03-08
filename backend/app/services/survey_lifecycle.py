"""Survey lifecycle batch: suspend expired contracts, delete past retention."""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public import Survey, SurveyStatus
from app.services.survey_provisioning import delete_survey


@dataclass
class LifecycleResult:
    """Result of running the survey lifecycle batch."""

    suspended_count: int
    deleted_count: int
    suspended_ids: list
    deleted_ids: list


async def run_survey_lifecycle(db: AsyncSession) -> LifecycleResult:
    """
    Run the 30/90 day lifecycle batch:
    1. Suspend: surveys where contract_end_date < today and status=active → set to suspended
    2. Delete: surveys where deletion_due_date < today → DROP SCHEMA and remove from public.surveys
    """
    today = date.today()
    await db.execute(text("SET search_path TO public"))

    # 1. Suspend: contract_end_date has passed
    suspend_result = await db.execute(
        update(Survey)
        .where(
            Survey.status == SurveyStatus.active,
            Survey.contract_end_date.isnot(None),
            Survey.contract_end_date < today,
        )
        .values(status=SurveyStatus.suspended)
        .returning(Survey.id)
    )
    suspended_ids = [str(row[0]) for row in suspend_result.all()]
    suspended_count = len(suspended_ids)

    await db.flush()

    # 2. Delete: deletion_due_date has passed
    delete_result = await db.execute(
        select(Survey.id).where(
            Survey.deletion_due_date.isnot(None),
            Survey.deletion_due_date < today,
        )
    )
    to_delete_ids = [row[0] for row in delete_result.all()]
    deleted_ids: list[str] = []

    for survey_id in to_delete_ids:
        try:
            await delete_survey(db, survey_id)
            deleted_ids.append(str(survey_id))
        except (ValueError, Exception):
            # Log but continue; skip if already deleted
            pass

    await db.flush()

    return LifecycleResult(
        suspended_count=suspended_count,
        deleted_count=len(deleted_ids),
        suspended_ids=suspended_ids,
        deleted_ids=deleted_ids,
    )
