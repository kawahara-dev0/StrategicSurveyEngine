"""Admin API: survey provisioning and question definition."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.public import Survey
from app.models.tenant import Question, QuestionType
from app.schemas.question import QuestionCreate, QuestionResponse
from app.schemas.survey import SurveyCreate, SurveyCreateResponse, SurveyResponse
from app.services.survey_provisioning import create_survey


def _require_admin(admin_api_key: str | None = Header(default=None, alias="X-Admin-API-Key")):
    if not settings.admin_api_key:
        return  # No key configured = allow (dev mode)
    if not admin_api_key or admin_api_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-API-Key")


router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/surveys", response_model=SurveyCreateResponse)
async def create_survey_endpoint(
    body: SurveyCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """
    Create a new survey. Generates UUID, Access Code, tenant schema and tables.
    Access code is returned only once - store it securely.
    """
    survey, access_code = await create_survey(db, body.name)
    return SurveyCreateResponse(
        id=survey.id,
        name=survey.name,
        schema_name=survey.schema_name,
        status=survey.status.value,
        contract_end_date=survey.contract_end_date,
        deletion_due_date=survey.deletion_due_date,
        access_code=access_code,
    )


@router.get("/surveys", response_model=list[SurveyResponse])
async def list_surveys(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List all surveys (public schema)."""
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).order_by(Survey.contract_end_date.desc()))
    surveys = result.scalars().all()
    return [
        SurveyResponse(
            id=s.id,
            name=s.name,
            schema_name=s.schema_name,
            status=s.status.value,
            contract_end_date=s.contract_end_date,
            deletion_due_date=s.deletion_due_date,
        )
        for s in surveys
    ]


@router.post("/surveys/{survey_id}/questions", response_model=QuestionResponse)
async def create_question(
    survey_id: UUID,
    body: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """
    Add a question to the survey. Requires survey_id in path (middleware sets tenant schema).
    """
    try:
        qt = QuestionType(body.question_type)
    except ValueError:
        raise HTTPException(400, detail=f"Invalid question_type: {body.question_type!r}")
    options_json = body.options if body.options else None
    q = Question(
        survey_id=survey_id,
        label=body.label,
        question_type=qt,
        options=options_json,
        is_required=body.is_required,
        is_personal_data=body.is_personal_data,
    )
    db.add(q)
    await db.flush()
    await db.refresh(q)
    return QuestionResponse(
        id=q.id,
        survey_id=str(q.survey_id),
        label=q.label,
        question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
        options=q.options,
        is_required=q.is_required,
        is_personal_data=q.is_personal_data,
    )


@router.get("/surveys/{survey_id}/questions", response_model=list[QuestionResponse])
async def list_questions(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List questions for a survey (tenant schema)."""
    result = await db.execute(
        select(Question).where(Question.survey_id == survey_id).order_by(Question.id)
    )
    questions = result.scalars().all()
    return [
        QuestionResponse(
            id=q.id,
            survey_id=str(q.survey_id),
            label=q.label,
            question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
            options=q.options,
            is_required=q.is_required,
            is_personal_data=q.is_personal_data,
        )
        for q in questions
    ]
