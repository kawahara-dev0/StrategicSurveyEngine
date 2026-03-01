"""Tenant schema: per-survey tables (questions, raw_responses, raw_answers, published_opinions, upvotes)."""
import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base, timestamp_created


class QuestionType(str, enum.Enum):
    text = "text"
    textarea = "textarea"
    select = "select"
    radio = "radio"


class UpvoteStatus(str, enum.Enum):
    pending = "pending"
    published = "published"
    rejected = "rejected"


# --- Tenant tables (no schema in __table_args__; search_path selects the schema) ---


class Question(Base):
    """Dynamic form definition per survey."""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    survey_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    label: Mapped[str] = mapped_column(String(512), nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(
        SQLEnum(QuestionType, name="question_type", create_constraint=True),
        nullable=False,
    )
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_personal_data: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RawResponse(Base):
    """One submission (contributor) in the tenant schema."""

    __tablename__ = "raw_responses"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    raw_answers: Mapped[list["RawAnswer"]] = relationship(
        "RawAnswer",
        back_populates="response",
        cascade="all, delete-orphan",
    )


class RawAnswer(Base):
    """Per-question answer for a raw response."""

    __tablename__ = "raw_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    response_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("raw_responses.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_disclosure_agreed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    response: Mapped["RawResponse"] = relationship("RawResponse", back_populates="raw_answers")
    question: Mapped["Question"] = relationship("Question", backref="raw_answers")


class PublishedOpinion(Base):
    """Moderated content derived from raw data. Score: (importance+urgency+expected_impact)*2 + supporter_points (max 14)."""

    __tablename__ = "published_opinions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    raw_response_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    priority_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    importance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-2
    urgency: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-2
    expected_impact: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-2
    supporter_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-2
    disclosed_pii: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Upvote(Base):
    """Support vote and optional comment on a published opinion."""

    __tablename__ = "upvotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    opinion_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("published_opinions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[UpvoteStatus] = mapped_column(
        SQLEnum(UpvoteStatus, name="upvote_status", create_constraint=True),
        nullable=False,
        default=UpvoteStatus.pending,
    )
    is_disclosure_agreed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    disclosed_pii: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
