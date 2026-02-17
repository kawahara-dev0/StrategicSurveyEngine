"""Question API schemas."""
from pydantic import BaseModel, field_validator


class QuestionCreate(BaseModel):
    label: str
    question_type: str  # text, textarea, select, radio
    options: list[str] | None = None
    is_required: bool = False
    is_personal_data: bool = False

    @field_validator("question_type")
    @classmethod
    def question_type_one_of(cls, v: str) -> str:
        allowed = {"text", "textarea", "select", "radio"}
        if v not in allowed:
            raise ValueError(f"Must be one of {allowed}")
        return v


class QuestionResponse(BaseModel):
    id: int
    survey_id: str
    label: str
    question_type: str
    options: list[str] | None
    is_required: bool
    is_personal_data: bool

    class Config:
        from_attributes = True
