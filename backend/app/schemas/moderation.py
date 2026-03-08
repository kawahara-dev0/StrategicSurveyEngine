"""Moderation & published opinions API schemas."""

from pydantic import BaseModel, ConfigDict, field_validator


class RawAnswerWithLabel(BaseModel):
    """Answer with question label for moderation view."""

    question_id: int
    label: str
    answer_text: str
    is_disclosure_agreed: bool
    is_personal_data: bool = False


class RawResponseListItem(BaseModel):
    """Summary of a raw response for list view."""

    id: str
    submitted_at: str
    status: str  # "published" | "converted_to_support" | "pending"


class RawResponseDetail(BaseModel):
    """Full raw response with answers (for moderation workspace)."""

    id: str
    submitted_at: str
    answers: list[RawAnswerWithLabel]


class PublishOpinionCreate(BaseModel):
    """Create a published opinion from a raw response."""

    raw_response_id: str
    title: str
    content: str
    admin_notes: str | None = None
    importance: int = 0  # 0-2
    urgency: int = 0  # 0-2
    expected_impact: int = 0  # 0-2

    @field_validator("importance", "urgency", "expected_impact")
    @classmethod
    def score_0_to_2(cls, v: int) -> int:
        if not 0 <= v <= 2:
            raise ValueError("Must be between 0 and 2")
        return v


class PublishedOpinionResponse(BaseModel):
    """Published opinion (admin view, includes disclosed_pii, supporters, and score components)."""

    id: int
    raw_response_id: str
    title: str
    content: str
    admin_notes: str | None = None
    priority_score: int
    importance: int = 0
    urgency: int = 0
    expected_impact: int = 0
    supporter_points: int = 0
    supporters: int = 0  # Number of upvotes (supporters count)
    pending_upvotes_count: int = (
        0  # Upvotes not yet published/rejected (show "View / moderate" when > 0)
    )
    is_disclosure_agreed: bool = False
    disclosed_pii: dict | None = None  # {label: value}

    model_config = ConfigDict(from_attributes=True)


def _score_from_components(
    importance: int, urgency: int, expected_impact: int, supporter_points: int
) -> int:
    """(Imp+Urg+Impact)*2 + supporters → max 14."""
    return (importance + urgency + expected_impact) * 2 + supporter_points


class OpinionUpdate(BaseModel):
    """Update title, content, admin_notes, and/or score components (Imp, Urg, Impact, supporters 0-2) for a published opinion."""

    title: str | None = None
    content: str | None = None
    admin_notes: str | None = None
    importance: int | None = None
    urgency: int | None = None
    expected_impact: int | None = None
    supporter_points: int | None = None

    @field_validator("importance", "urgency", "expected_impact", "supporter_points")
    @classmethod
    def score_0_to_2(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if not 0 <= v <= 2:
            raise ValueError("Must be between 0 and 2")
        return v


class UpvoteResponse(BaseModel):
    """Upvote for moderation: list and update published_comment / status."""

    id: int
    opinion_id: int
    user_hash: str
    raw_comment: str | None
    published_comment: str | None
    status: str
    created_at: str
    is_disclosure_agreed: bool = False
    disclosed_pii: dict | None = None  # Name, Email, Department when is_disclosure_agreed

    model_config = ConfigDict(from_attributes=True)


class UpvoteUpdate(BaseModel):
    """Moderator: set published_comment and/or status (pending, published, rejected)."""

    published_comment: str | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def status_enum(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in ("pending", "published", "rejected"):
            raise ValueError("Must be pending, published, or rejected")
        return v


class ConvertToSupportCreate(BaseModel):
    """Convert a submitted response to support (upvote) for an existing opinion."""

    opinion_id: int
    published_comment: str = ""
    is_disclosure_agreed: bool = False
    disclosed_pii: dict | None = None  # Name, Email, Department
