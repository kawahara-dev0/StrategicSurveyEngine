"""Survey provisioning: create tenant schema and tables, register in public.surveys."""
import re
import secrets
import string
from datetime import date, timedelta
from uuid import UUID, uuid4

import bcrypt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public import Survey, SurveyStatus

_SCHEMA_NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _generate_access_code(length: int = 8) -> str:
    """Generate a random alphanumeric access code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _schema_name_from_uuid(survey_id: UUID) -> str:
    """Generate schema name from survey UUID (e.g. survey_550e8400)."""
    return f"survey_{str(survey_id).replace('-', '')[:8]}"


def _validate_schema_name(name: str) -> None:
    if not _SCHEMA_NAME_PATTERN.match(name):
        raise ValueError(f"Invalid schema name: {name!r}")


def _tenant_ddl_statements(schema: str) -> list[str]:
    s = schema
    return [
        f"CREATE TYPE {s}.question_type AS ENUM ('text', 'textarea', 'select', 'radio')",
        f"CREATE TYPE {s}.upvote_status AS ENUM ('pending', 'published', 'rejected')",
        f"""CREATE TABLE {s}.questions (
            id SERIAL PRIMARY KEY,
            survey_id UUID NOT NULL,
            label VARCHAR(512) NOT NULL,
            question_type {s}.question_type NOT NULL,
            options JSONB,
            is_required BOOLEAN NOT NULL DEFAULT FALSE,
            is_personal_data BOOLEAN NOT NULL DEFAULT FALSE
        )""",
        f"""CREATE TABLE {s}.raw_responses (
            id UUID PRIMARY KEY,
            submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        f"""CREATE TABLE {s}.raw_answers (
            id SERIAL PRIMARY KEY,
            response_id UUID NOT NULL REFERENCES {s}.raw_responses(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES {s}.questions(id) ON DELETE CASCADE,
            answer_text TEXT NOT NULL,
            is_disclosure_agreed BOOLEAN NOT NULL DEFAULT FALSE
        )""",
        f"""CREATE TABLE {s}.published_opinions (
            id SERIAL PRIMARY KEY,
            raw_response_id UUID NOT NULL,
            title VARCHAR(512) NOT NULL,
            content TEXT NOT NULL,
            priority_score INTEGER NOT NULL DEFAULT 0,
            importance INTEGER NOT NULL DEFAULT 0,
            urgency INTEGER NOT NULL DEFAULT 0,
            expected_impact INTEGER NOT NULL DEFAULT 0,
            supporter_points INTEGER NOT NULL DEFAULT 0,
            disclosed_pii JSONB,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )""",
        f"""CREATE TABLE {s}.upvotes (
            id SERIAL PRIMARY KEY,
            opinion_id INTEGER NOT NULL REFERENCES {s}.published_opinions(id) ON DELETE CASCADE,
            user_hash VARCHAR(64) NOT NULL,
            raw_comment TEXT,
            published_comment TEXT,
            status {s}.upvote_status NOT NULL DEFAULT 'pending',
            is_disclosure_agreed BOOLEAN NOT NULL DEFAULT FALSE,
            disclosed_pii JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        f"""CREATE INDEX idx_published_opinions_fts ON {s}.published_opinions
            USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')))""",
    ]


async def create_survey(
    db: AsyncSession,
    name: str,
    *,
    notes: str | None = None,
    contract_days: int = 30,
) -> tuple[Survey, str]:
    """
    Create a new survey: generate UUID, Access Code, schema, tables, and insert into public.surveys.
    Returns (Survey model, plain access_code to show to admin once).
    """
    survey_id = uuid4()
    schema_name = _schema_name_from_uuid(survey_id)
    _validate_schema_name(schema_name)

    access_code = _generate_access_code()
    # bcrypt は 72 バイトまで。バイト列に変換して切り詰める
    pw_bytes = access_code.encode("utf-8")[:72]
    access_code_hash = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("ascii")

    # Ensure we're in public schema for DDL and survey insert
    await db.execute(text("SET search_path TO public"))

    # CREATE SCHEMA
    await db.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))

    for stmt in _tenant_ddl_statements(schema_name):
        await db.execute(text(stmt))

    contract_end = date.today() + timedelta(days=contract_days)
    deletion_due = contract_end + timedelta(days=90)

    survey = Survey(
        id=survey_id,
        name=name,
        schema_name=schema_name,
        status=SurveyStatus.active,
        contract_end_date=contract_end,
        deletion_due_date=deletion_due,
        access_code_hash=access_code_hash,
        notes=notes,
    )
    db.add(survey)
    await db.flush()
    await db.refresh(survey)

    return survey, access_code


async def delete_survey(db: AsyncSession, survey_id: UUID) -> None:
    """Drop tenant schema and delete survey from public.surveys."""
    await db.execute(text("SET search_path TO public"))
    result = await db.execute(
        select(Survey).where(Survey.id == survey_id)
    )
    survey = result.scalar_one_or_none()
    if not survey:
        raise ValueError("Survey not found")
    schema_name = survey.schema_name
    _validate_schema_name(schema_name)
    await db.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))
    await db.delete(survey)
