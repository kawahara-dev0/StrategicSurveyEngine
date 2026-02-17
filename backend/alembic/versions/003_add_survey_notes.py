"""Add notes to public.surveys.

Revision ID: 003
Revises: 002
Create Date: Admin memo/notes for survey

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "surveys",
        sa.Column("notes", sa.Text(), nullable=True),
        schema="public",
    )


def downgrade() -> None:
    op.drop_column("surveys", "notes", schema="public")
