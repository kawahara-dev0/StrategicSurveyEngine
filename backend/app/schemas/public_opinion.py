"""Public API: published opinions (no PII)."""

from pydantic import BaseModel


class PublicOpinionItem(BaseModel):
    """Published opinion for public view: no disclosed_pii; includes supporters and approved comments."""

    id: int
    title: str
    content: str
    priority_score: int
    supporters: int
    additional_comments: list[str]
    current_user_has_supported: bool = False


class UpvoteCreate(BaseModel):
    """Optional comment and PII (name, email, department) with single is_disclosure_agreed."""

    comment: str | None = None
    dept: str | None = None  # Maps to Department in disclosed_pii
    name: str | None = None
    email: str | None = None
    is_disclosure_agreed: bool = False
