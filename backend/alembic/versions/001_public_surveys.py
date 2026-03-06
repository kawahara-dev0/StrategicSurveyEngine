"""Create public.surveys table and survey_status enum.

Revision ID: 001
Revises:
Create Date: Public schema for survey registry

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Skip if type already exists (idempotent for DuplicateObject)
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE survey_status AS ENUM ('active', 'suspended', 'deleted');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    survey_status_type = postgresql.ENUM(
        "active",
        "suspended",
        "deleted",
        name="survey_status",
        create_type=False,
    )

    op.create_table(
        "surveys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("schema_name", sa.String(length=255), nullable=False),
        sa.Column("status", survey_status_type, nullable=False),
        sa.Column("contract_end_date", sa.Date(), nullable=True),
        sa.Column("deletion_due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("access_code_plain", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="public",
    )
    op.create_index(
        op.f("ix_surveys_schema_name"),
        "surveys",
        ["schema_name"],
        unique=True,
        schema="public",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_surveys_schema_name"),
        table_name="surveys",
        schema="public",
    )
    op.drop_table("surveys", schema="public")

    survey_status = postgresql.ENUM(
        "active",
        "suspended",
        "deleted",
        name="survey_status",
        create_type=False,
    )
    survey_status.drop(op.get_bind(), checkfirst=True)
