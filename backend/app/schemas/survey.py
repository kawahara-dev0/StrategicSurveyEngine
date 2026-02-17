"""Survey API schemas."""
from datetime import date
from uuid import UUID

from pydantic import BaseModel


class SurveyCreate(BaseModel):
    name: str


class SurveyResponse(BaseModel):
    id: UUID
    name: str
    schema_name: str
    status: str
    contract_end_date: date | None
    deletion_due_date: date | None

    class Config:
        from_attributes = True


class SurveyCreateResponse(SurveyResponse):
    """Response when creating a survey - includes access_code (plain, show once)."""
    access_code: str
