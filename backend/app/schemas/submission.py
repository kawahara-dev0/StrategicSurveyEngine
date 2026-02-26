"""Submission API schemas (Phase 3: Contributor Submission)."""
from pydantic import BaseModel, field_validator


class AnswerSubmit(BaseModel):
    """Single answer in a submission."""

    question_id: int
    answer_text: str
    is_disclosure_agreed: bool = False

    @field_validator("answer_text")
    @classmethod
    def answer_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Answer cannot be empty")
        return v


class SubmitRequest(BaseModel):
    """Request body for submitting a survey response."""

    answers: list[AnswerSubmit]


class SubmitResponse(BaseModel):
    """Response after successful submission."""

    response_id: str
    message: str = "Thank you for your submission."
