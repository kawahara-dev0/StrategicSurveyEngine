const baseUrl = import.meta.env.VITE_API_URL ?? "/api";

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
