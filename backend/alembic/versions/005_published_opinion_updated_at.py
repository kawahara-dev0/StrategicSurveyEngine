"""Add updated_at to published_opinions (tenant schemas) for sort order.

Revision ID: 005
Revises: 004
Create Date: Published opinion updated_at

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        op.execute(
            text(
                f"ALTER TABLE {s}.published_opinions "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        op.execute(text(f"ALTER TABLE {s}.published_opinions DROP COLUMN IF EXISTS updated_at"))

