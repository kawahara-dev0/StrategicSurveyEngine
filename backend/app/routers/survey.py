"""Public Survey API: contributor submission (Phase 3). No auth required; UUID in path grants access."""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.public import Survey, SurveyStatus
from app.models.tenant import Question, RawAnswer, RawResponse
from app.schemas.question import QuestionResponse
from app.schemas.submission import AnswerSubmit, SubmitRequest, SubmitResponse

router = APIRouter(prefix="/survey", tags=["survey"])


def _require_survey_schema(request: Request) -> None:
    """Ensure middleware resolved a survey (path contains valid UUID)."""
    if not getattr(request.state, "survey_schema_name", None):
        raise HTTPException(
            status_code=404,
            detail="Survey not found. Check the survey URL.",
        )


@router.get("/{survey_id}/questions")
async def get_survey_questions(
    survey_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Get survey name, status, and questions for the submission form.
    Public endpoint – no auth. Returns 404 if survey not found.
    """
    _require_survey_schema(request)
    schema_name = request.state.survey_schema_name

    # Fetch survey metadata from public schema
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Switch back to tenant for questions
    await db.execute(text(f"SET search_path TO {schema_name}"))
    try:
        q_result = await db.execute(
            select(Question).where(Question.survey_id == survey_id).order_by(Question.id)
        )
        questions = q_result.scalars().all()
    except ProgrammingError:
        raise HTTPException(status_code=404, detail="Survey data not found")

    return {
        "survey_name": survey.name,
        "status": survey.status.value,
        "questions": [
            QuestionResponse(
                id=q.id,
                survey_id=str(q.survey_id),
                label=q.label,
                question_type=q.question_type.value,
                options=q.options,
                is_required=q.is_required,
                is_personal_data=q.is_personal_data,
            )
            for q in questions
        ],
    }


@router.post("/{survey_id}/submit", response_model=SubmitResponse)
async def submit_survey_response(
    survey_id: UUID,
    body: SubmitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a contributor response with answers.
    Blocks if survey status is not 'active'.
    PII consent (is_disclosure_agreed) is stored per-answer for personal-data questions.
    """
    _require_survey_schema(request)
    schema_name = request.state.survey_schema_name

    # Check survey is active
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    if survey.status != SurveyStatus.active:
        raise HTTPException(
            status_code=403,
            detail="Submissions are closed for this survey.",
        )

    # Switch to tenant
    await db.execute(text(f"SET search_path TO {schema_name}"))

    # Load questions for validation
    q_result = await db.execute(
        select(Question).where(Question.survey_id == survey_id)
    )
    questions = {q.id: q for q in q_result.scalars().all()}
    if not questions:
        raise HTTPException(status_code=400, detail="Survey has no questions yet.")

    # Validate: required questions must have answers
    answers_by_qid = {a.question_id: a for a in body.answers}
    for q in questions.values():
        if q.is_required and q.id not in answers_by_qid:
            raise HTTPException(
                status_code=400,
                detail=f"Required question '{q.label}' (id={q.id}) must be answered.",
            )
        if q.id in answers_by_qid:
            a = answers_by_qid[q.id]
            if not a.answer_text.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"Question '{q.label}' cannot be empty.",
                )

    # Create RawResponse and RawAnswers
    response_id = uuid4()
    raw_response = RawResponse(id=response_id)
    db.add(raw_response)
    await db.flush()

    for a in body.answers:
        if a.question_id not in questions:
            continue  # Ignore unknown question_ids
        q = questions[a.question_id]
        # For PII questions, honor is_disclosure_agreed; for others, default False
        is_disclosure = a.is_disclosure_agreed if q.is_personal_data else False
        raw_answer = RawAnswer(
            response_id=response_id,
            question_id=a.question_id,
            answer_text=a.answer_text.strip(),
            is_disclosure_agreed=is_disclosure,
        )
        db.add(raw_answer)

    await db.flush()

    return SubmitResponse(response_id=str(response_id))
