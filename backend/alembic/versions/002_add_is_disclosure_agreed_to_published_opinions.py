"""Add is_disclosure_agreed to published_opinions in all tenant schemas.

Revision ID: 002
Revises: 001
Create Date: Add is_disclosure_agreed (PII disclose yes/no at opinion level)

Adds column, sets TRUE for legacy rows with disclosed_pii, then corrects to FALSE
where source raw_answers have is_disclosure_agreed=false.
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add is_disclosure_agreed; set TRUE for legacy, correct FALSE from raw_answers."""
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for (schema_name,) in rows:
        op.execute(
            text(
                f"""
                ALTER TABLE {schema_name}.published_opinions
                ADD COLUMN IF NOT EXISTS is_disclosure_agreed BOOLEAN NOT NULL DEFAULT FALSE
                """
            )
        )
        op.execute(
            text(
                f"""
                UPDATE {schema_name}.published_opinions
                SET is_disclosure_agreed = TRUE
                WHERE disclosed_pii IS NOT NULL
                  AND disclosed_pii != 'null'::jsonb
                  AND disclosed_pii != '{{}}'::jsonb
                """
            )
        )
        op.execute(
            text(
                f"""
                UPDATE {schema_name}.published_opinions po
                SET is_disclosure_agreed = FALSE
                WHERE po.disclosed_pii IS NOT NULL
                  AND po.disclosed_pii != 'null'::jsonb
                  AND po.disclosed_pii != '{{}}'::jsonb
                  AND EXISTS (
                    SELECT 1
                    FROM {schema_name}.raw_responses rr
                    JOIN {schema_name}.raw_answers ra ON ra.response_id = rr.id
                    JOIN {schema_name}.questions q ON q.id = ra.question_id
                    WHERE rr.id = po.raw_response_id
                      AND q.is_personal_data = true
                      AND ra.answer_text IS NOT NULL
                      AND trim(ra.answer_text) != ''
                      AND ra.is_disclosure_agreed = false
                  )
                """
            )
        )


def downgrade() -> None:
    """Remove is_disclosure_agreed column."""
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for (schema_name,) in rows:
        op.execute(
            text(
                f"""
                ALTER TABLE {schema_name}.published_opinions
                DROP COLUMN IF EXISTS is_disclosure_agreed
                """
            )
        )
