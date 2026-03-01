"""Manager API (Phase 6): Client HR dashboard with Access Code auth and export."""
from datetime import datetime, timezone, timedelta
from io import BytesIO
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.public import Survey
from app.models.tenant import PublishedOpinion, Upvote, UpvoteStatus
from app.schemas.moderation import PublishedOpinionResponse, UpvoteResponse

router = APIRouter(prefix="/manager", tags=["manager"])


async def _get_tenant_schema(db: AsyncSession, survey_id: UUID) -> str:
    """Resolve tenant schema_name from public.surveys. Raises 404 if not found."""
    await db.execute(text("SET search_path TO public"))
    r = await db.execute(
        text("SELECT schema_name FROM public.surveys WHERE id = :id"),
        {"id": str(survey_id)},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Survey not found")
    return row["schema_name"]


def _verify_access_code(plain: str, stored: str | None) -> bool:
    if not stored or not plain:
        return False
    return plain.strip() == stored.strip()


def _create_manager_token(survey_id: UUID) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(survey_id), "exp": exp}
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def _decode_manager_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload.get("sub")
    except Exception:
        return None


async def require_manager(
    survey_id: UUID,
    authorization: str | None = Header(default=None),
) -> None:
    """Require valid Bearer JWT for this survey_id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:].strip()
    sub = _decode_manager_token(token)
    if not sub or sub != str(survey_id):
        raise HTTPException(status_code=403, detail="Access denied for this survey")


class ManagerAuthRequest:
    """Request body for manager login."""

    def __init__(self, survey_id: str, access_code: str):
        self.survey_id = survey_id
        self.access_code = access_code


@router.get("/{survey_id}/survey")
async def get_manager_survey(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_manager),
):
    """Get survey name for Manager dashboard (id and name only)."""
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return {"id": str(survey.id), "name": survey.name}


@router.post("/auth")
async def manager_auth(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate as Manager with Survey UUID and Access Code.
    Returns JWT to use in Authorization: Bearer <token> for /manager/{survey_id}/*.
    """
    survey_id_str = body.get("survey_id")
    access_code = body.get("access_code")
    if not survey_id_str or not access_code:
        raise HTTPException(status_code=400, detail="survey_id and access_code required")
    try:
        survey_id = UUID(survey_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid survey_id")
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    if not _verify_access_code(access_code, survey.access_code_plain):
        raise HTTPException(status_code=401, detail="Invalid access code")
    token = _create_manager_token(survey_id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/{survey_id}/opinions", response_model=list[PublishedOpinionResponse])
async def list_manager_opinions(
    survey_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_manager),
):
    """List published opinions for Manager dashboard (includes disclosed_pii and priority_score)."""
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


@router.get("/{survey_id}/opinions/{opinion_id}/upvotes", response_model=list[UpvoteResponse])
async def list_manager_upvotes(
    survey_id: UUID,
    opinion_id: int,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_manager),
):
    """List upvotes for an opinion (Published comment, PII when disclosed). For Manager dashboard."""
    schema_name = await _get_tenant_schema(db, survey_id)
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(Upvote).where(Upvote.opinion_id == opinion_id).order_by(Upvote.created_at.desc())
    )
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


@router.get("/{survey_id}/export")
async def export_survey(
    survey_id: UUID,
    format: str = "xlsx",
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_manager),
):
    """Export opinions as Excel (.xlsx) or PDF. Requires Manager JWT."""
    if format not in ("xlsx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be xlsx or pdf")
    await db.execute(text("SET search_path TO public"))
    survey_result = await db.execute(select(Survey).where(Survey.id == survey_id))
    survey = survey_result.scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    survey_name = survey.name
    schema_name = survey.schema_name
    safe_name = "".join(c if c not in '\\/:*?"<>|' else "_" for c in (survey_name or "Survey")[:80]).strip() or "Survey"
    base_filename = f"Survey Opinions Report - {safe_name}"
    await db.execute(text(f"SET search_path TO {schema_name}"))
    result = await db.execute(
        select(PublishedOpinion).order_by(PublishedOpinion.updated_at.desc(), PublishedOpinion.id)
    )
    opinions = result.scalars().all()
    opinion_ids = [o.id for o in opinions]
    supporters_by_opinion: dict[int, int] = {}
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

    if format == "xlsx":
        from fastapi.responses import Response

        from app.routers.manager_export import build_xlsx

        buf = build_xlsx(opinions, supporters_by_opinion, survey_name=survey_name)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.xlsx"'},
        )
    else:
        from fastapi.responses import Response

        from app.routers.manager_export import build_pdf

        buf = build_pdf(opinions, supporters_by_opinion, survey_name=survey_name)
        return Response(
            content=buf.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.pdf"'},
        )
