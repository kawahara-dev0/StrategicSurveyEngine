"""Drop access_code_hash from public.surveys (use access_code_plain only).

Revision ID: 009
Revises: 008
Create Date: Drop access_code_hash

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(text("ALTER TABLE public.surveys DROP COLUMN IF EXISTS access_code_hash"))


def downgrade() -> None:
    op.execute(
        text(
            "ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS access_code_hash VARCHAR(255)"
        )
    )
