"""Add GIN index on published_opinions (title+content) for full-text search.

Revision ID: 006
Revises: 005
Create Date: FTS GIN index for Phase 5 search

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEX_NAME = "idx_published_opinions_fts"


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        op.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS {INDEX_NAME} ON {s}.published_opinions "
                "USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')))"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        op.execute(text(f"DROP INDEX IF EXISTS {s}.{INDEX_NAME}"))
