const baseUrl = import.meta.env.VITE_API_URL || "/api";

function headers(includeAdminKey = true): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = import.meta.env.VITE_ADMIN_API_KEY;
  if (includeAdminKey && key) h["X-Admin-API-Key"] = key;
  return h;
}

export async function healthCheck(): Promise<{ status: string }> {
  const r = await fetch(`${baseUrl}/health`);
  if (!r.ok) throw new Error("Health check failed");
  return r.json();
}

export async function listSurveys(): Promise<import("@/types/api").Survey[]> {
  const r = await fetch(`${baseUrl}/admin/surveys`, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createSurvey(
  name: string,
  notes?: string | null
): Promise<import("@/types/api").SurveyCreateResponse> {
  const r = await fetch(`${baseUrl}/admin/surveys`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, notes: notes ?? null }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getSurvey(
  surveyId: string
): Promise<import("@/types/api").Survey> {
  const r = await fetch(`${baseUrl}/admin/surveys/${surveyId}`, {
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteSurvey(surveyId: string): Promise<void> {
  const r = await fetch(`${baseUrl}/admin/surveys/${surveyId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
}

export async function deleteQuestion(
  surveyId: string,
  questionId: number
): Promise<void> {
  const r = await fetch(
    `${baseUrl}/admin/surveys/${surveyId}/questions/${questionId}`,
    { method: "DELETE", headers: headers() }
  );
  if (!r.ok) throw new Error(await r.text());
}

export async function listQuestions(
  surveyId: string
): Promise<import("@/types/api").Question[]> {
  const r = await fetch(`${baseUrl}/admin/surveys/${surveyId}/questions`, {
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createQuestion(
  surveyId: string,
  payload: import("@/types/api").QuestionCreatePayload
): Promise<import("@/types/api").Question> {
  const r = await fetch(`${baseUrl}/admin/surveys/${surveyId}/questions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Strip leading colon if present (e.g. from router param quirk) */
function normalizeSurveyId(surveyId: string): string {
  return surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
}

/** Public API: no admin key needed (Phase 3) */
export async function getSurveyQuestions(
  surveyId: string
): Promise<import("@/types/api").SurveyQuestionsResponse> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/survey/${id}/questions`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function submitSurveyResponse(
  surveyId: string,
  answers: import("@/types/api").AnswerSubmit[]
): Promise<import("@/types/api").SubmitResponse> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/survey/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Moderation (Phase 4) - uses same surveyId normalization as public API */
export async function listResponses(
  surveyId: string
): Promise<import("@/types/api").RawResponseListItem[]> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(`${baseUrl}/admin/moderation/${id}/submissions`, {
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getResponse(
  surveyId: string,
  responseId: string
): Promise<import("@/types/api").RawResponseDetail> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(
    `${baseUrl}/admin/surveys/${id}/responses/${responseId}`,
    { headers: headers() }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createOpinion(
  surveyId: string,
  payload: import("@/types/api").PublishOpinionPayload
): Promise<import("@/types/api").PublishedOpinion> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(`${baseUrl}/admin/surveys/${id}/opinions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listOpinions(
  surveyId: string
): Promise<import("@/types/api").PublishedOpinion[]> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(`${baseUrl}/admin/moderation/${id}/opinions`, {
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateOpinion(
  surveyId: string,
  opinionId: number,
  payload: import("@/types/api").OpinionUpdatePayload
): Promise<import("@/types/api").PublishedOpinion> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.content !== undefined) body.content = payload.content;
  if (payload.importance !== undefined) body.importance = payload.importance;
  if (payload.urgency !== undefined) body.urgency = payload.urgency;
  if (payload.expected_impact !== undefined) body.expected_impact = payload.expected_impact;
  if (payload.supporter_points !== undefined) body.supporter_points = payload.supporter_points;
  const r = await fetch(`${baseUrl}/admin/moderation/${id}/opinions/${opinionId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
