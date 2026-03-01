"""Admin API: survey provisioning, question definition, moderation (Phase 4)."""
import re
from uuid import UUID

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import func, select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.public import Survey
from app.models.tenant import Question, QuestionType, PublishedOpinion, RawAnswer, RawResponse, Upvote, UpvoteStatus
from app.schemas.question import QuestionCreate, QuestionResponse
from app.schemas.moderation import (
    RawAnswerWithLabel,
    RawResponseDetail,
    RawResponseListItem,
    OpinionUpdate,
    PublishOpinionCreate,
    PublishedOpinionResponse,
    UpvoteResponse,
    UpvoteUpdate,
    _score_from_components,
)
from app.schemas.survey import SurveyCreate, SurveyCreateResponse, SurveyResponse
from app.services.survey_provisioning import create_survey, delete_survey, _generate_access_code


def _require_admin(admin_api_key: str | None = Header(default=None, alias="X-Admin-API-Key")):
    if not settings.admin_api_key:
        return  # No key configured = allow (dev mode)
    if not admin_api_key or admin_api_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-API-Key")


router = APIRouter(prefix="/admin", tags=["admin"])


class _VerifyPasswordBody(BaseModel):
    password: str = ""


@router.post("/verify-password")
def verify_admin_password(body: _VerifyPasswordBody) -> None:
    """
    Verify the admin password (for frontend login when VITE_ADMIN_API_KEY is not set, e.g. in Docker).
    Returns 200 if password matches ADMIN_API_KEY, 401 if not, 404 if admin is not configured.
    """
    if not settings.admin_api_key:
        raise HTTPException(status_code=404, detail="Admin access is not configured on the server")
    password = (body.password or "").strip()
    if password != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Incorrect password")
    return None


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
    survey, access_code = await create_survey(db, body.name, notes=body.notes)
    return SurveyCreateResponse(
        id=survey.id,
        name=survey.name,
        schema_name=survey.schema_name,
        status=survey.status.value,
        contract_end_date=survey.contract_end_date,
        deletion_due_date=survey.deletion_due_date,
        notes=survey.notes,
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
            notes=s.notes,
            access_code=getattr(s, "access_code_plain", None),
        )
        for s in surveys
    ]


@router.get("/surveys/{survey_id}", response_model=SurveyResponse)
async def get_survey(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Get a single survey by ID (public schema)."""
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return SurveyResponse(
        id=survey.id,
        name=survey.name,
        schema_name=survey.schema_name,
        status=survey.status.value,
        contract_end_date=survey.contract_end_date,
        deletion_due_date=survey.deletion_due_date,
        notes=survey.notes,
        access_code=getattr(survey, "access_code_plain", None),
    )


@router.post("/surveys/{survey_id}/reset-access-code")
async def reset_access_code(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Generate a new Manager access code for the survey. Returns the new code (store it securely)."""
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    new_code = _generate_access_code()
    survey.access_code_plain = new_code
    await db.flush()
    await db.refresh(survey)
    return {"access_code": new_code}


@router.delete("/surveys/{survey_id}")
async def delete_survey_endpoint(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Delete a survey (drops tenant schema and removes from public.surveys)."""
    try:
        await delete_survey(db, survey_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
    try:
        db.add(q)
        await db.flush()
        await db.refresh(q)
    except ProgrammingError as e:
        raise HTTPException(
            400,
            detail="Survey schema or tables not found. Create the survey via the Admin API first.",
        ) from e
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


@router.delete("/surveys/{survey_id}/questions/{question_id}")
async def delete_question(
    survey_id: UUID,
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Delete a question from the survey (tenant schema)."""
    result = await db.execute(
        select(Question).where(
            Question.survey_id == survey_id,
            Question.id == question_id,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(q)
    return {"deleted": question_id}


# --- Phase 4: Moderation & Published Opinions ---


def _priority_score(importance: int, urgency: int, expected_impact: int, supporter_count: int = 0) -> int:
    """14-point scale: (Imp+Urg+Exp)*2 + supporters(0-2). Supporters mapped: 0->0, 1-2->1, 3+->2."""
    supporters_pts = min(2, (supporter_count > 0) + (supporter_count >= 3))
    return (importance + urgency + expected_impact) * 2 + supporters_pts


def _supporters_pts_from_count(supporter_count: int) -> int:
    """Map supporter count to 0-2 points."""
    return min(2, (supporter_count > 0) + (supporter_count >= 3))


_SCHEMA_NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


async def _get_tenant_schema(db: AsyncSession, survey_id: UUID) -> str:
    """Resolve tenant schema_name from public.surveys. Raises 404 if not found."""
    await db.execute(text("SET search_path TO public"))
    # Use raw SQL to avoid any ORM/schema resolution ambiguity
    r = await db.execute(
        text("SELECT schema_name FROM public.surveys WHERE id = :id"),
        {"id": str(survey_id)},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Survey not found: {survey_id}. Check GET /admin/surveys and ensure the same DB is used.",
        )
    schema_name = row["schema_name"]
    if not _SCHEMA_NAME_PATTERN.match(schema_name):
        raise HTTPException(status_code=400, detail="Invalid schema name")
    return schema_name


@router.get("/surveys/{survey_id}/responses/{response_id}", response_model=RawResponseDetail)
async def get_response(
    survey_id: UUID,
    response_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Get one raw response with answers and question labels (moderation workspace)."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(RawResponse)
        .where(RawResponse.id == response_id)
        .options(selectinload(RawResponse.raw_answers).selectinload(RawAnswer.question))
    )
    response = result.scalar_one_or_none()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    answers = [
        RawAnswerWithLabel(
            question_id=a.question_id,
            label=a.question.label,
            answer_text=a.answer_text,
            is_disclosure_agreed=a.is_disclosure_agreed,
        )
        for a in sorted(response.raw_answers, key=lambda x: x.question_id)
    ]
    return RawResponseDetail(
        id=str(response.id),
        submitted_at=response.submitted_at.isoformat() if response.submitted_at else "",
        answers=answers,
    )


@router.get("/surveys/{survey_id}/responses", response_model=list[RawResponseListItem])
async def list_responses(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List raw responses (alias: same as /submissions). Kept for backward compatibility."""
    return await _list_raw_responses_impl(db, survey_id)


@router.get("/surveys/{survey_id}/submissions", response_model=list[RawResponseListItem])
async def list_submissions(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List raw responses for moderation."""
    return await _list_raw_responses_impl(db, survey_id)


@router.get("/moderation/{survey_id}/submissions", response_model=list[RawResponseListItem])
async def list_submissions_alt(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List raw responses (alternative path under /admin/moderation/ to avoid any route conflicts)."""
    return await _list_raw_responses_impl(db, survey_id)


@router.patch("/moderation/{survey_id}/opinions/{opinion_id}", response_model=PublishedOpinionResponse)
async def update_opinion(
    survey_id: UUID,
    opinion_id: int,
    body: OpinionUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Update title, content, and/or score components (Imp, Urg, Impact, supporters 0-2). Recomputes priority_score."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(select(PublishedOpinion).where(PublishedOpinion.id == opinion_id))
    opinion = result.scalar_one_or_none()
    if not opinion:
        raise HTTPException(status_code=404, detail="Opinion not found")
    if body.title is not None:
        opinion.title = body.title
    if body.content is not None:
        opinion.content = body.content
    if body.admin_notes is not None:
        opinion.admin_notes = (body.admin_notes or "").strip() or None
    if body.importance is not None:
        opinion.importance = body.importance
    if body.urgency is not None:
        opinion.urgency = body.urgency
    if body.expected_impact is not None:
        opinion.expected_impact = body.expected_impact
    if body.supporter_points is not None:
        opinion.supporter_points = body.supporter_points
    opinion.priority_score = _score_from_components(
        opinion.importance,
        opinion.urgency,
        opinion.expected_impact,
        opinion.supporter_points,
    )
    await db.flush()
    await db.refresh(opinion)
    return PublishedOpinionResponse(
        id=opinion.id,
        raw_response_id=str(opinion.raw_response_id),
        title=opinion.title,
        content=opinion.content,
        admin_notes=opinion.admin_notes,
        priority_score=opinion.priority_score,
        importance=opinion.importance,
        urgency=opinion.urgency,
        expected_impact=opinion.expected_impact,
        supporter_points=opinion.supporter_points,
        disclosed_pii=opinion.disclosed_pii,
    )


@router.get("/moderation/{survey_id}/opinions", response_model=list[PublishedOpinionResponse])
async def list_opinions_alt(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List published opinions (alternative path under /admin/moderation/)."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(PublishedOpinion).order_by(PublishedOpinion.updated_at.desc(), PublishedOpinion.id)
    )
    opinions = result.scalars().all()
    opinion_ids = [o.id for o in opinions]
    supporters_by_opinion: dict[int, int] = {}
    pending_by_opinion: dict[int, int] = {}
    if opinion_ids:
        supporters_result = await db.execute(
            select(Upvote.opinion_id, func.count(Upvote.id).label("cnt"))
            .where(Upvote.opinion_id.in_(opinion_ids))
            .group_by(Upvote.opinion_id)
        )
        supporters_by_opinion = {
            row[0]: int(row[1]) if row[1] is not None else 0
            for row in supporters_result.all()
        }
        pending_result = await db.execute(
            select(Upvote.opinion_id, func.count(Upvote.id).label("cnt"))
            .where(
                Upvote.opinion_id.in_(opinion_ids),
                Upvote.status == UpvoteStatus.pending,
            )
            .group_by(Upvote.opinion_id)
        )
        pending_by_opinion = {
            row[0]: int(row[1]) if row[1] is not None else 0
            for row in pending_result.all()
        }
    return [
        PublishedOpinionResponse(
            id=o.id,
            raw_response_id=str(o.raw_response_id),
            title=o.title,
            content=o.content,
            admin_notes=getattr(o, "admin_notes", None),
            priority_score=o.priority_score,
            importance=getattr(o, "importance", 0),
            urgency=getattr(o, "urgency", 0),
            expected_impact=getattr(o, "expected_impact", 0),
            supporter_points=getattr(o, "supporter_points", 0),
            supporters=supporters_by_opinion.get(o.id, 0),
            pending_upvotes_count=pending_by_opinion.get(o.id, 0),
            disclosed_pii=o.disclosed_pii,
        )
        for o in opinions
    ]


@router.get("/moderation/{survey_id}/opinions/{opinion_id}/upvotes", response_model=list[UpvoteResponse])
async def list_upvotes_for_opinion(
    survey_id: UUID,
    opinion_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List upvotes (with raw_comment, published_comment, status) for an opinion. For moderation."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(select(Upvote).where(Upvote.opinion_id == opinion_id).order_by(Upvote.created_at.desc()))
    upvotes = result.scalars().all()
    return [
        UpvoteResponse(
            id=u.id,
            opinion_id=u.opinion_id,
            user_hash=u.user_hash,
            raw_comment=u.raw_comment,
            published_comment=u.published_comment,
            status=u.status.value,
            created_at=u.created_at.isoformat() if u.created_at else "",
            is_disclosure_agreed=u.is_disclosure_agreed,
            disclosed_pii=u.disclosed_pii,
        )
        for u in upvotes
    ]


@router.patch("/moderation/{survey_id}/upvotes/{upvote_id}", response_model=UpvoteResponse)
async def update_upvote(
    survey_id: UUID,
    upvote_id: int,
    body: UpvoteUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Set published_comment and/or status (pending, published, rejected) for an upvote."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(select(Upvote).where(Upvote.id == upvote_id))
    upvote = result.scalar_one_or_none()
    if not upvote:
        raise HTTPException(status_code=404, detail="Upvote not found")
    if body.published_comment is not None:
        upvote.published_comment = body.published_comment.strip() or None
    if body.status is not None:
        try:
            upvote.status = UpvoteStatus(body.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="status must be pending, published, or rejected")
    await db.flush()
    await db.refresh(upvote)
    return UpvoteResponse(
        id=upvote.id,
        opinion_id=upvote.opinion_id,
        user_hash=upvote.user_hash,
        raw_comment=upvote.raw_comment,
        published_comment=upvote.published_comment,
        status=upvote.status.value,
        created_at=upvote.created_at.isoformat() if upvote.created_at else "",
        is_disclosure_agreed=upvote.is_disclosure_agreed,
        disclosed_pii=upvote.disclosed_pii,
    )


async def _list_raw_responses_impl(db: AsyncSession, survey_id: UUID) -> list[RawResponseListItem]:
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(RawResponse).order_by(RawResponse.submitted_at.desc())
    )
    responses = result.scalars().all()
    return [
        RawResponseListItem(
            id=str(r.id),
            submitted_at=r.submitted_at.isoformat() if r.submitted_at else "",
        )
        for r in responses
    ]


@router.post("/surveys/{survey_id}/opinions", response_model=PublishedOpinionResponse)
async def create_opinion(
    survey_id: UUID,
    body: PublishOpinionCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """Create published_opinion from a raw response. Builds disclosed_pii from PII answers with consent (order follows question order)."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(RawResponse)
        .where(RawResponse.id == UUID(body.raw_response_id))
        .options(selectinload(RawResponse.raw_answers).selectinload(RawAnswer.question))
    )
    response = result.scalar_one_or_none()
    if not response:
        raise HTTPException(status_code=404, detail="Raw response not found")
    questions_result = await db.execute(
        select(Question).where(Question.survey_id == survey_id, Question.is_personal_data.is_(True)).order_by(Question.id)
    )
    pii_questions = questions_result.scalars().all()
    answers_by_qid = {a.question_id: a for a in response.raw_answers}
    disclosed_pii = {}
    for q in pii_questions:
        a = answers_by_qid.get(q.id)
        if a and a.is_disclosure_agreed and a.answer_text and a.answer_text.strip():
            disclosed_pii[q.label] = a.answer_text.strip()
    supporter_count = 0  # Phase 5 will add upvotes
    supporter_pts = _supporters_pts_from_count(supporter_count)
    priority = _priority_score(
        body.importance,
        body.urgency,
        body.expected_impact,
        supporter_count,
    )
    opinion = PublishedOpinion(
        raw_response_id=response.id,
        title=body.title,
        content=body.content,
        admin_notes=(body.admin_notes or "").strip() or None,
        priority_score=priority,
        importance=body.importance,
        urgency=body.urgency,
        expected_impact=body.expected_impact,
        supporter_points=supporter_pts,
        disclosed_pii=disclosed_pii if disclosed_pii else None,
    )
    db.add(opinion)
    await db.flush()
    await db.refresh(opinion)
    return PublishedOpinionResponse(
        id=opinion.id,
        raw_response_id=str(opinion.raw_response_id),
        title=opinion.title,
        content=opinion.content,
        admin_notes=opinion.admin_notes,
        priority_score=opinion.priority_score,
        importance=opinion.importance,
        urgency=opinion.urgency,
        expected_impact=opinion.expected_impact,
        supporter_points=opinion.supporter_points,
        disclosed_pii=opinion.disclosed_pii,
    )


@router.get("/surveys/{survey_id}/opinions", response_model=list[PublishedOpinionResponse])
async def list_opinions(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_admin),
):
    """List published opinions for the survey (tenant schema)."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(PublishedOpinion).order_by(PublishedOpinion.updated_at.desc(), PublishedOpinion.id)
    )
    opinions = result.scalars().all()
    opinion_ids = [o.id for o in opinions]
    supporters_by_opinion: dict[int, int] = {}
    pending_by_opinion: dict[int, int] = {}
    if opinion_ids:
        supporters_result = await db.execute(
            select(Upvote.opinion_id, func.count(Upvote.id).label("cnt"))
            .where(Upvote.opinion_id.in_(opinion_ids))
            .group_by(Upvote.opinion_id)
        )
        supporters_by_opinion = {
            row[0]: int(row[1]) if row[1] is not None else 0
            for row in supporters_result.all()
        }
        pending_result = await db.execute(
            select(Upvote.opinion_id, func.count(Upvote.id).label("cnt"))
            .where(
                Upvote.opinion_id.in_(opinion_ids),
                Upvote.status == UpvoteStatus.pending,
            )
            .group_by(Upvote.opinion_id)
        )
        pending_by_opinion = {
            row[0]: int(row[1]) if row[1] is not None else 0
            for row in pending_result.all()
        }
    return [
        PublishedOpinionResponse(
            id=o.id,
            raw_response_id=str(o.raw_response_id),
            title=o.title,
            content=o.content,
            admin_notes=getattr(o, "admin_notes", None),
            priority_score=o.priority_score,
            importance=getattr(o, "importance", 0),
            urgency=getattr(o, "urgency", 0),
            expected_impact=getattr(o, "expected_impact", 0),
            supporter_points=getattr(o, "supporter_points", 0),
            supporters=supporters_by_opinion.get(o.id, 0),
            pending_upvotes_count=pending_by_opinion.get(o.id, 0),
            disclosed_pii=o.disclosed_pii,
        )
        for o in opinions
    ]
