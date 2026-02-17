"""Dynamic schema-switching: resolve survey UUID to schema_name and store for request-scoped DB sessions."""
import re
from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.public import Survey

# Paths that carry survey UUID: /survey/{uuid}, /manager/{uuid}, /admin/surveys/{uuid}
SURVEY_PATH_PATTERN = re.compile(
    r"^/(?:survey|manager|admin/surveys)/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
)
HEADER_SURVEY_UUID = "X-Survey-UUID"


def _survey_uuid_from_request(request: Request) -> UUID | None:
    """Extract survey UUID from path (e.g. /survey/{uuid}/...) or header X-Survey-UUID."""
    # Header takes precedence for API clients
    header = request.headers.get(HEADER_SURVEY_UUID)
    if header:
        try:
            return UUID(header)
        except ValueError:
            pass
    match = SURVEY_PATH_PATTERN.match(request.scope.get("path", ""))
    if match:
        try:
            return UUID(match.group(1))
        except ValueError:
            pass
    return None


async def _resolve_schema_name(survey_id: UUID) -> str | None:
    """Look up schema_name from public.surveys by survey id. Uses default search_path (public)."""
    async with AsyncSessionLocal() as session:
        await session.execute(text("SET search_path TO public"))
        result = await session.execute(
            select(Survey.schema_name).where(Survey.id == survey_id)
        )
        row = result.scalar_one_or_none()
        return row


class SchemaSwitchingMiddleware(BaseHTTPMiddleware):
    """
    For requests that include a survey UUID (path or X-Survey-UUID header),
    resolve the tenant schema_name from public.surveys and set request.state.survey_schema_name.
    Route dependencies (get_db) then set search_path on the DB connection so tenant tables are used.
    """

    async def dispatch(self, request: Request, call_next):
        survey_id = _survey_uuid_from_request(request)
        if survey_id is not None:
            schema_name = await _resolve_schema_name(survey_id)
            if schema_name is not None:
                request.state.survey_schema_name = schema_name
                request.state.survey_id = survey_id
        response = await call_next(request)
        return response
