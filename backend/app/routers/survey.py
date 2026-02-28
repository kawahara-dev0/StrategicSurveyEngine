"""Public Survey API: contributor submission (Phase 3), opinions & search (Phase 5). No auth; UUID in path."""
import hashlib
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.public import Survey, SurveyStatus
from app.models.tenant import Question, RawAnswer, RawResponse, PublishedOpinion, Upvote, UpvoteStatus
from app.schemas.public_opinion import PublicOpinionItem, UpvoteCreate
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


def _opinions_to_public_items(
    opinions: list,
    upvotes_by_opinion: dict,
    supporters_by_opinion: dict[int, int],
    supported_opinion_ids: set[int] | None = None,
) -> list[PublicOpinionItem]:
    """Build public list with supporters, additional_comments, and current_user_has_supported."""
    supported = supported_opinion_ids or set()
    out = []
    for o in opinions:
        votes = upvotes_by_opinion.get(o.id, [])
        additional_comments = [v for v in votes if v]
        supporters = supporters_by_opinion.get(o.id, 0)
        out.append(
            PublicOpinionItem(
                id=o.id,
                title=o.title,
                content=o.content,
                priority_score=o.priority_score,
                supporters=supporters,
                additional_comments=additional_comments,
                current_user_has_supported=(o.id in supported),
            )
        )
    return out


@router.get("/{survey_id}/opinions", response_model=list[PublicOpinionItem])
async def list_public_opinions(
    survey_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    List published opinions for public view (no PII).
    Includes supporter count and [Additional Comment] from approved upvotes.
    """
    _require_survey_schema(request)
    schema_name = request.state.survey_schema_name
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Survey not found")
    await db.execute(text(f"SET search_path TO {schema_name}"))
    try:
        o_result = await db.execute(
            select(PublishedOpinion).order_by(PublishedOpinion.updated_at.desc(), PublishedOpinion.id)
        )
        opinions = o_result.scalars().all()
    except ProgrammingError:
        raise HTTPException(status_code=404, detail="Survey data not found")
    if not opinions:
        return []
    opinion_ids = [o.id for o in opinions]
    u_result = await db.execute(
        select(Upvote.opinion_id, Upvote.published_comment).where(
            Upvote.opinion_id.in_(opinion_ids),
            Upvote.status == UpvoteStatus.published,
        )
    )
    upvotes_by_opinion: dict[int, list[str]] = {oid: [] for oid in opinion_ids}
    for row in u_result.all():
        oid, comment = row[0], row[1]
        if comment and comment.strip():
            upvotes_by_opinion[oid].append(comment.strip())
    user_hash = _user_hash_from_request(request)
    supported_result = await db.execute(
        select(Upvote.opinion_id).where(
            Upvote.opinion_id.in_(opinion_ids),
            Upvote.user_hash == user_hash,
        )
    )
    supported_opinion_ids = {row[0] for row in supported_result.all()}
    # Count all upvotes per opinion (supporters = number of Support clicks)
    supporters_result = await db.execute(
        select(Upvote.opinion_id, func.count(Upvote.id).label("cnt"))
        .where(Upvote.opinion_id.in_(opinion_ids))
        .group_by(Upvote.opinion_id)
    )
    supporters_by_opinion = {
        row[0]: int(row[1]) if row[1] is not None else 0
        for row in supporters_result.all()
    }
    return _opinions_to_public_items(
        opinions, upvotes_by_opinion, supporters_by_opinion, supported_opinion_ids
    )


@router.get("/{survey_id}/search", response_model=list[PublicOpinionItem])
async def search_public_opinions(
    survey_id: UUID,
    request: Request,
    q: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search on published opinions (title + content). GIN index used.
    Returns public list with supporter count and additional comments.
    """
    _require_survey_schema(request)
    schema_name = request.state.survey_schema_name
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Survey not found")
    await db.execute(text(f"SET search_path TO {schema_name}"))
    query = q.strip() if q else ""
    try:
        if not query:
            o_result = await db.execute(
                select(PublishedOpinion).order_by(PublishedOpinion.updated_at.desc(), PublishedOpinion.id)
            )
            opinions = o_result.scalars().all()
        else:
            # FTS: search_path already set to tenant schema
            safe_q = query.replace("'", "''")
            raw = await db.execute(
                text(
                    """SELECT id, title, content, priority_score
                        FROM published_opinions
                        WHERE to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))
                              @@ plainto_tsquery('simple', :q)
                        ORDER BY updated_at DESC, id"""
                ).bindparams(q=safe_q)
            )
            rows = raw.mappings().all()
            opinions = [
                type("_OpinionRow", (), {"id": r["id"], "title": r["title"], "content": r["content"], "priority_score": r["priority_score"]})()
                for r in rows
            ]
    except ProgrammingError:
        raise HTTPException(status_code=404, detail="Survey data not found")
    if not opinions:
        return []
    opinion_ids = [o.id for o in opinions]
    u_result = await db.execute(
        select(Upvote.opinion_id, Upvote.published_comment).where(
            Upvote.opinion_id.in_(opinion_ids),
            Upvote.status == UpvoteStatus.published,
        )
    )
    upvotes_by_opinion: dict[int, list[str]] = {oid: [] for oid in opinion_ids}
    for row in u_result.all():
        oid, comment = row[0], row[1]
        if comment and comment.strip():
            upvotes_by_opinion[oid].append(comment.strip())
    user_hash = _user_hash_from_request(request)
    supported_result = await db.execute(
        select(Upvote.opinion_id).where(
            Upvote.opinion_id.in_(opinion_ids),
            Upvote.user_hash == user_hash,
        )
    )
    supported_opinion_ids = {row[0] for row in supported_result.all()}
    supporters_result = await db.execute(
        select(Upvote.opinion_id, func.count(Upvote.id).label("cnt"))
        .where(Upvote.opinion_id.in_(opinion_ids))
        .group_by(Upvote.opinion_id)
    )
    supporters_by_opinion = {
        row[0]: int(row[1]) if row[1] is not None else 0
        for row in supporters_result.all()
    }
    return _opinions_to_public_items(
        opinions, upvotes_by_opinion, supporters_by_opinion, supported_opinion_ids
    )


def _user_hash_from_request(request: Request) -> str:
    """Derive a stable hash from client IP + User-Agent for upvote deduplication."""
    client = getattr(request.client, "host", "") or ""
    ua = request.headers.get("user-agent", "") or ""
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else client
    raw = f"{ip}:{ua}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:64]


@router.post("/{survey_id}/opinions/{opinion_id}/upvote")
async def create_upvote(
    survey_id: UUID,
    opinion_id: int,
    request: Request,
    body: UpvoteCreate = UpvoteCreate(),
    db: AsyncSession = Depends(get_db),
):
    """
    Record an upvote (support) for a published opinion. Optional comment (raw_comment); moderator approves as published_comment.
    One vote per user_hash per opinion; returns 409 if already voted.
    """
    _require_survey_schema(request)
    schema_name = request.state.survey_schema_name
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Survey not found")
    await db.execute(text(f"SET search_path TO {schema_name}"))
    o_result = await db.execute(select(PublishedOpinion).where(PublishedOpinion.id == opinion_id))
    if not o_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Opinion not found")
    user_hash = _user_hash_from_request(request)
    existing = await db.execute(
        select(Upvote).where(Upvote.opinion_id == opinion_id, Upvote.user_hash == user_hash)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already voted for this opinion")
    disclosed_pii = {}
    if body.is_disclosure_agreed:
        if body.dept and body.dept.strip():
            disclosed_pii["Dept"] = body.dept.strip()
        if body.name and body.name.strip():
            disclosed_pii["Name"] = body.name.strip()
        if body.email and body.email.strip():
            disclosed_pii["Email"] = body.email.strip()
    raw_comment = body.comment.strip() if body.comment and body.comment.strip() else None
    status = UpvoteStatus.published if raw_comment is None else UpvoteStatus.pending
    upvote = Upvote(
        opinion_id=opinion_id,
        user_hash=user_hash,
        raw_comment=raw_comment,
        status=status,
        is_disclosure_agreed=bool(disclosed_pii),
        disclosed_pii=disclosed_pii if disclosed_pii else None,
    )
    db.add(upvote)
    await db.commit()
    return {"status": "ok", "message": "Vote recorded. Comment will appear after moderator approval."}
