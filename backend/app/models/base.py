"""Base classes and conventions for SQLAlchemy 2.0 models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all models."""

    pass
