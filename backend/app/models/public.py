"""Public schema: shared metadata and survey lifecycle (surveys table)."""
import enum
from datetime import date
from uuid import UUID

from sqlalchemy import Date, Enum as SQLEnum, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, date_col


class SurveyStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    deleted = "deleted"


class Survey(Base):
    """Global survey registry. Each survey has a dedicated tenant schema."""

    __tablename__ = "surveys"
    __table_args__ = {"schema": "public"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    schema_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    status: Mapped[SurveyStatus] = mapped_column(
        SQLEnum(SurveyStatus, name="survey_status", create_constraint=True),
        nullable=False,
        default=SurveyStatus.active,
    )
    contract_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deletion_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
