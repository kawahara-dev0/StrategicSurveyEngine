"""Base classes and conventions for SQLAlchemy 2.0 models."""
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import DateTime, Date, Enum, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """Declarative base for all models."""
    pass


def uuid_pk() -> Mapped[UUID]:
    return mapped_column(PG_UUID(as_uuid=True), primary_key=True)


def timestamp_created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def date_col() -> Mapped[date]:
    return mapped_column(Date, nullable=True)
