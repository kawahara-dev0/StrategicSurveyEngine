const baseUrl = import.meta.env.VITE_API_URL || "/api";

const ADMIN_KEY_SESSION_KEY = "admin_api_key_session";

let adminKeyMemory: string | null = null;

function getEffectiveAdminKey(): string {
  try {
    const session = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ADMIN_KEY_SESSION_KEY) : null;
    if (session) return session;
  } catch {
    // ignore
  }
  return adminKeyMemory ?? "";
}

export function setAdminKeyForSession(key: string): void {
  adminKeyMemory = key;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(ADMIN_KEY_SESSION_KEY, key);
  } catch {
    // ignore
  }
}

export function clearAdminKeySession(): void {
  adminKeyMemory = null;
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(ADMIN_KEY_SESSION_KEY);
  } catch {
    // ignore
  }
}

/** True if we have an admin key (from session or memory) to send with API requests. */
export function hasAdminKey(): boolean {
  return getEffectiveAdminKey().length > 0;
}

export async function verifyAdminPassword(password: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const r = await fetch(`${baseUrl}/admin/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: password.trim() }),
  });
  if (r.ok) return { ok: true };
  const text = await r.text();
  return { ok: false, status: r.status, message: text || r.statusText };
}

function headers(includeAdminKey = true): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = getEffectiveAdminKey();
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

export async function resetSurveyAccessCode(
  surveyId: string
): Promise<{ access_code: string }> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(`${baseUrl}/admin/surveys/${id}/reset-access-code`, {
    method: "POST",
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
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

/** Public API: opinions list and search (Phase 5) – no admin key */
export async function getPublicOpinions(
  surveyId: string
): Promise<import("@/types/api").PublicOpinionItem[]> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/survey/${id}/opinions`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function searchPublicOpinions(
  surveyId: string,
  q: string
): Promise<import("@/types/api").PublicOpinionItem[]> {
  const id = normalizeSurveyId(surveyId);
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  const r = await fetch(`${baseUrl}/survey/${id}/search?${params.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function postUpvote(
  surveyId: string,
  opinionId: number,
  payload: import("@/types/api").UpvoteCreatePayload
): Promise<{ status: string; message: string }> {
  const id = normalizeSurveyId(surveyId);
  const body: Record<string, unknown> = {
    comment: payload.comment != null && payload.comment.trim() ? payload.comment.trim() : null,
    dept: payload.dept != null && payload.dept.trim() ? payload.dept.trim() : null,
    name: payload.name != null && payload.name.trim() ? payload.name.trim() : null,
    email: payload.email != null && payload.email.trim() ? payload.email.trim() : null,
    is_disclosure_agreed: payload.is_disclosure_agreed ?? false,
  };
  const r = await fetch(`${baseUrl}/survey/${id}/opinions/${opinionId}/upvote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  if (payload.admin_notes !== undefined) body.admin_notes = payload.admin_notes;
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

/** Phase 5: list upvotes for an opinion (moderation) */
export async function listUpvotesForOpinion(
  surveyId: string,
  opinionId: number
): Promise<import("@/types/api").UpvoteItem[]> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(`${baseUrl}/admin/moderation/${id}/opinions/${opinionId}/upvotes`, {
    headers: headers(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Phase 5: update upvote (published_comment, status) */
export async function updateUpvote(
  surveyId: string,
  upvoteId: number,
  payload: { published_comment?: string | null; status?: string }
): Promise<import("@/types/api").UpvoteItem> {
  const id = surveyId.startsWith(":") ? surveyId.slice(1) : surveyId;
  const r = await fetch(`${baseUrl}/admin/moderation/${id}/upvotes/${upvoteId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Manager API (Phase 6): Access Code auth, dashboard, export */
const MANAGER_TOKEN_KEY = "manager_token";

export function getManagerToken(surveyId: string): string | null {
  try {
    return localStorage.getItem(`${MANAGER_TOKEN_KEY}_${normalizeSurveyId(surveyId)}`);
  } catch {
    return null;
  }
}

export function setManagerToken(surveyId: string, token: string): void {
  localStorage.setItem(`${MANAGER_TOKEN_KEY}_${normalizeSurveyId(surveyId)}`, token);
}

export function clearManagerToken(surveyId: string): void {
  localStorage.removeItem(`${MANAGER_TOKEN_KEY}_${normalizeSurveyId(surveyId)}`);
}

export async function managerAuth(
  surveyId: string,
  accessCode: string
): Promise<{ access_token: string; token_type: string }> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/manager/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ survey_id: id, access_code: accessCode }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function managerHeaders(surveyId: string): HeadersInit {
  const token = getManagerToken(surveyId);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getManagerSurvey(
  surveyId: string
): Promise<{ id: string; name: string }> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/manager/${id}/survey`, {
    headers: managerHeaders(surveyId),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listManagerOpinions(
  surveyId: string
): Promise<import("@/types/api").PublishedOpinion[]> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/manager/${id}/opinions`, {
    headers: managerHeaders(surveyId),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listManagerUpvotes(
  surveyId: string,
  opinionId: number
): Promise<import("@/types/api").UpvoteItem[]> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/manager/${id}/opinions/${opinionId}/upvotes`, {
    headers: managerHeaders(surveyId),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/** Parse filename from Content-Disposition header (e.g. attachment; filename="Report - Name.pdf"). */
function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

export async function exportManagerReport(
  surveyId: string,
  format: "xlsx" | "pdf"
): Promise<{ blob: Blob; filename: string }> {
  const id = normalizeSurveyId(surveyId);
  const r = await fetch(`${baseUrl}/manager/${id}/export?format=${format}`, {
    headers: managerHeaders(surveyId),
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  const filename =
    filenameFromContentDisposition(r.headers.get("Content-Disposition")) ||
    `Survey Opinions Report.${format}`;
  return { blob, filename };
}
