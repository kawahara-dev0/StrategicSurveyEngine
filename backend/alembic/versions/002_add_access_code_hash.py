"""Add access_code_hash to public.surveys.

Revision ID: 002
Revises: 001
Create Date: Access Code for Survey Manager auth

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "surveys",
        sa.Column("access_code_hash", sa.String(length=255), nullable=True),
        schema="public",
    )


def downgrade() -> None:
    op.drop_column("surveys", "access_code_hash", schema="public")
