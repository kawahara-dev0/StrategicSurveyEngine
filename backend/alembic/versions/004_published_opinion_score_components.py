"""Add importance, urgency, expected_impact, supporter_points to published_opinions (tenant schemas).

Revision ID: 004
Revises: 003
Create Date: Published opinion score components (Imp, Urg, Impact, supporters)

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        for col in ("importance", "urgency", "expected_impact", "supporter_points"):
            op.execute(text(f"ALTER TABLE {s}.published_opinions ADD COLUMN IF NOT EXISTS {col} INTEGER NOT NULL DEFAULT 0"))


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT schema_name FROM public.surveys"))
    rows = result.fetchall()
    for row in rows:
        s = str(row[0])
        op.execute(text(f"ALTER TABLE {s}.published_opinions DROP COLUMN IF EXISTS importance"))
        op.execute(text(f"ALTER TABLE {s}.published_opinions DROP COLUMN IF EXISTS urgency"))
        op.execute(text(f"ALTER TABLE {s}.published_opinions DROP COLUMN IF EXISTS expected_impact"))
        op.execute(text(f"ALTER TABLE {s}.published_opinions DROP COLUMN IF EXISTS supporter_points"))
