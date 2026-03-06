"""
Happy path: survey creation -> questions -> submit response -> moderation -> manager export.

Requires PostgreSQL and alembic upgrade head. Set ADMIN_API_KEY in .env for admin endpoints
(or leave empty for dev mode).
"""

from httpx import AsyncClient


async def test_health(client: AsyncClient) -> None:
    """Health check."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_admin_create_survey_list(admin_client: AsyncClient) -> None:
    """Create survey, list surveys, verify created survey appears."""
    create_resp = await admin_client.post(
        "/admin/surveys",
        json={"name": "Happy Path Test Survey"},
    )
    assert create_resp.status_code == 200
    data = create_resp.json()
    survey_id: str = data["id"]
    access_code: str = data["access_code"]
    assert survey_id
    assert access_code
    assert data["name"] == "Happy Path Test Survey"

    list_resp = await admin_client.get("/admin/surveys")
    assert list_resp.status_code == 200
    surveys = list_resp.json()
    assert any(s["id"] == survey_id for s in surveys)


async def test_admin_add_questions(admin_client: AsyncClient) -> None:
    """Create survey, add questions, list questions."""
    create_resp = await admin_client.post(
        "/admin/surveys",
        json={"name": "Questions Test"},
    )
    assert create_resp.status_code == 200
    survey_id = create_resp.json()["id"]

    add_resp = await admin_client.post(
        f"/admin/surveys/{survey_id}/questions",
        json={
            "label": "What is your concern?",
            "question_type": "text",
            "is_required": True,
        },
    )
    assert add_resp.status_code == 200

    list_resp = await admin_client.get(f"/admin/surveys/{survey_id}/questions")
    assert list_resp.status_code == 200
    questions = list_resp.json()
    assert len(questions) >= 1
    assert any(q["label"] == "What is your concern?" for q in questions)


async def test_survey_submit_full_flow(admin_client: AsyncClient, client: AsyncClient) -> None:
    """
    Full flow: create survey -> add question -> submit response via public API
    -> list responses in admin -> publish opinion -> manager gets opinions.
    """
    # Create survey
    create_resp = await admin_client.post(
        "/admin/surveys",
        json={"name": "Full Flow Survey"},
    )
    assert create_resp.status_code == 200
    survey_id = create_resp.json()["id"]
    access_code = create_resp.json()["access_code"]

    # Add question
    await admin_client.post(
        f"/admin/surveys/{survey_id}/questions",
        json={
            "label": "Your feedback",
            "question_type": "text",
            "is_required": True,
        },
    )

    # Get questions (public) to know question_id
    q_resp = await client.get(f"/survey/{survey_id}/questions")
    assert q_resp.status_code == 200
    questions = q_resp.json()["questions"]
    question_id = questions[0]["id"]

    # Submit response (public)
    submit_resp = await client.post(
        f"/survey/{survey_id}/submit",
        json={
            "answers": [
                {"question_id": question_id, "answer_text": "Great product!", "is_disclosure_agreed": False},
            ],
        },
    )
    assert submit_resp.status_code == 200
    response_id = submit_resp.json()["response_id"]
    assert response_id

    # List responses (admin)
    list_resp = await admin_client.get(f"/admin/surveys/{survey_id}/responses")
    assert list_resp.status_code == 200
    responses = list_resp.json()
    assert len(responses) >= 1

    # Get response detail
    detail_resp = await admin_client.get(
        f"/admin/surveys/{survey_id}/responses/{response_id}"
    )
    assert detail_resp.status_code == 200

    # Publish opinion
    publish_resp = await admin_client.post(
        f"/admin/surveys/{survey_id}/opinions",
        json={
            "raw_response_id": response_id,
            "title": "Positive feedback",
            "content": "Great product!",
            "importance": 1,
            "urgency": 1,
            "expected_impact": 1,
        },
    )
    assert publish_resp.status_code == 200

    # Manager auth
    auth_resp = await client.post(
        "/manager/auth",
        json={"survey_id": survey_id, "access_code": access_code},
    )
    assert auth_resp.status_code == 200
    token = auth_resp.json()["access_token"]

    # Manager get opinions
    opinions_resp = await client.get(
        f"/manager/{survey_id}/opinions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert opinions_resp.status_code == 200
    opinions = opinions_resp.json()
    assert len(opinions) >= 1
    assert any(o["title"] == "Positive feedback" for o in opinions)
