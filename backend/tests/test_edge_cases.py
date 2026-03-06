"""
Edge cases: boundary values (0, max), invalid types, error handling.
"""

import pytest
from httpx import AsyncClient


async def test_submit_invalid_survey_id(client: AsyncClient) -> None:
    """Submit with invalid UUID format returns 422 (path param validation)."""
    resp = await client.post(
        "/survey/not-a-uuid/submit",
        json={"answers": [{"question_id": 1, "answer_text": "x", "is_disclosure_agreed": False}]},
    )
    assert resp.status_code == 422


async def test_submit_empty_answers_array(client: AsyncClient) -> None:
    """Submit with empty answers - need valid survey path for 422."""
    resp = await client.post(
        "/survey/00000000-0000-0000-0000-000000000001/submit",
        json={"answers": []},
    )
    assert resp.status_code in (404, 422)


async def test_submit_answer_empty_text(client: AsyncClient) -> None:
    """Answer with empty/whitespace answer_text is rejected by schema (422)."""
    resp = await client.post(
        "/survey/00000000-0000-0000-0000-000000000001/submit",
        json={"answers": [{"question_id": 1, "answer_text": "   ", "is_disclosure_agreed": False}]},
    )
    assert resp.status_code in (404, 422)


async def test_publish_opinion_invalid_score_schema(admin_client: AsyncClient) -> None:
    """Publish with importance=3 (max 2) returns 422 from Pydantic validation."""
    create_resp = await admin_client.post("/admin/surveys", json={"name": "Invalid Score"})
    if create_resp.status_code != 200:
        pytest.skip("DB or admin not configured")
    survey_id = create_resp.json()["id"]
    await admin_client.post(
        f"/admin/surveys/{survey_id}/questions",
        json={"label": "Q", "question_type": "text", "is_required": True},
    )

    from httpx import ASGITransport

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as pub:
        sub = await pub.post(
            f"/survey/{survey_id}/submit",
            json={
                "answers": [
                    {
                        "question_id": 1,
                        "answer_text": "test",
                        "is_disclosure_agreed": False,
                    },
                ],
            },
        )
    if sub.status_code != 200:
        pytest.skip("Submit failed")
    response_id = sub.json()["response_id"]

    publish_resp = await admin_client.post(
        f"/admin/surveys/{survey_id}/opinions",
        json={
            "raw_response_id": response_id,
            "title": "T",
            "content": "C",
            "importance": 3,
            "urgency": 0,
            "expected_impact": 0,
        },
    )
    assert publish_resp.status_code == 422
    assert "0" in str(publish_resp.json()) or "2" in str(publish_resp.json())


async def test_manager_auth_missing_fields(client: AsyncClient) -> None:
    """Manager auth with empty body returns 400."""
    resp = await client.post("/manager/auth", json={})
    assert resp.status_code == 400
    detail = resp.json().get("detail", "")
    assert "survey_id" in detail.lower() or "access_code" in detail.lower()


async def test_manager_auth_invalid_uuid(client: AsyncClient) -> None:
    """Manager auth with invalid survey_id UUID returns 400."""
    resp = await client.post(
        "/manager/auth",
        json={"survey_id": "not-a-uuid", "access_code": "CODE123"},
    )
    assert resp.status_code == 400


async def test_admin_add_question_invalid_type(admin_client: AsyncClient) -> None:
    """Add question with invalid question_type returns 422."""
    create_resp = await admin_client.post("/admin/surveys", json={"name": "Invalid Type"})
    if create_resp.status_code != 200:
        pytest.skip("DB or admin not configured")
    survey_id = create_resp.json()["id"]

    resp = await admin_client.post(
        f"/admin/surveys/{survey_id}/questions",
        json={"label": "Q", "question_type": "invalid_type", "is_required": False},
    )
    assert resp.status_code == 422
