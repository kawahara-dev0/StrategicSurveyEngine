"""Add access_code_plain to public.surveys (admin can view Manager access code).

Revision ID: 008
Revises: 007
Create Date: Access code plain storage for admin

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        text(
            "ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS access_code_plain VARCHAR(64)"
        )
    )


def downgrade() -> None:
    op.execute(text("ALTER TABLE public.surveys DROP COLUMN IF EXISTS access_code_plain"))
