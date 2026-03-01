"""Add admin_notes to published_opinions (tenant schemas). Manager-only field.

Revision ID: 007
Revises: 006
Create Date: Administrator comments and notes

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "007"
down_revision: Union[str, None] = "006"
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
                "ADD COLUMN IF NOT EXISTS admin_notes TEXT"
            )
        )


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        op.execute(text(f"ALTER TABLE {s}.published_opinions DROP COLUMN IF EXISTS admin_notes"))
