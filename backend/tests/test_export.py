"""Tests for Manager export (PDF, Excel)."""

from io import BytesIO

from app.routers.manager_export import build_pdf


def _mock_opinion(
    id: int = 1,
    title: str = "Test",
    content: str = "Content",
    admin_notes: str | None = None,
    priority_score: int = 8,
    importance: int = 1,
    urgency: int = 1,
    expected_impact: int = 1,
    supporter_points: int = 1,
    disclosed_pii: dict | None = None,
    is_disclosure_agreed: bool = True,
):
    """Create a minimal opinion-like object for build_pdf."""
    o = type("MockOpinion", (), {})()
    o.id = id
    o.title = title
    o.content = content
    o.admin_notes = admin_notes
    o.priority_score = priority_score
    o.importance = importance
    o.urgency = urgency
    o.expected_impact = expected_impact
    o.supporter_points = supporter_points
    o.disclosed_pii = disclosed_pii
    o.is_disclosure_agreed = is_disclosure_agreed
    o.updated_at = None
    return o


def _mock_upvote(
    published_comment: str = "Comment",
    is_disclosure_agreed: bool = True,
    disclosed_pii: dict | None = None,
):
    """Create a minimal upvote-like object for build_pdf."""
    u = type("MockUpvote", (), {})()
    u.published_comment = published_comment
    u.is_disclosure_agreed = is_disclosure_agreed
    u.disclosed_pii = disclosed_pii or {}
    return u


def test_build_pdf_basic() -> None:
    """build_pdf produces valid PDF bytes."""
    opinion = _mock_opinion()
    buf = build_pdf([opinion], {1: 0}, {1: []}, survey_name="Test Survey")
    assert isinstance(buf, BytesIO)
    data = buf.getvalue()
    assert len(data) > 100
    assert data.startswith(b"%PDF")


def test_build_pdf_special_characters_escaped() -> None:
    """build_pdf does not raise when content contains XML/HTML special characters."""
    opinion = _mock_opinion(
        title="Test <script> & Co",
        content="Content with <html> and & ampersand",
        admin_notes="Notes: A&B <tag>",
        disclosed_pii={"Name": "Alice<test>", "Email": "a&b@c.com"},
    )
    upvote = _mock_upvote(
        published_comment="Comment with <tag> & special",
        disclosed_pii={"Name": "Bob"},
    )
    buf = build_pdf(
        [opinion],
        {1: 1},
        {1: [upvote]},
        survey_name="Survey & Test",
    )
    assert isinstance(buf, BytesIO)
    data = buf.getvalue()
    assert len(data) > 100
    assert data.startswith(b"%PDF")
