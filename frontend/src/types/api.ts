export interface Survey {
  id: string;
  name: string;
  schema_name: string;
  status: string;
  contract_end_date: string | null;
  deletion_due_date: string | null;
  notes?: string | null;
  /** Manager access code (admin only; null if not stored). */
  access_code?: string | null;
}

export interface SurveyCreateResponse extends Survey {
  access_code: string;
}

export interface Question {
  id: number;
  survey_id: string;
  label: string;
  question_type: string;
  options: string[] | null;
  is_required: boolean;
  is_personal_data: boolean;
}

export interface QuestionCreatePayload {
  label: string;
  question_type: "text" | "textarea" | "select" | "radio";
  options?: string[] | null;
  is_required?: boolean;
  is_personal_data?: boolean;
}

/** Public API: survey form for contributors (Phase 3) */
export interface SurveyQuestionsResponse {
  survey_name: string;
  status: string;
  questions: Question[];
}

export interface AnswerSubmit {
  question_id: number;
  answer_text: string;
  is_disclosure_agreed?: boolean;
}

export interface SubmitResponse {
  response_id: string;
  message: string;
}

/** Moderation (Phase 4) */
export interface RawResponseListItem {
  id: string;
  submitted_at: string;
}

export interface RawAnswerWithLabel {
  question_id: number;
  label: string;
  answer_text: string;
  is_disclosure_agreed: boolean;
}

export interface RawResponseDetail {
  id: string;
  submitted_at: string;
  answers: RawAnswerWithLabel[];
}

export interface PublishOpinionPayload {
  raw_response_id: string;
  title: string;
  content: string;
  admin_notes?: string | null;
  importance: number;
  urgency: number;
  expected_impact: number;
}

export interface PublishedOpinion {
  id: number;
  raw_response_id: string;
  title: string;
  content: string;
  admin_notes?: string | null;
  priority_score: number;
  importance: number;
  urgency: number;
  expected_impact: number;
  supporter_points: number;
  supporters: number;
  pending_upvotes_count?: number;
  disclosed_pii: Record<string, string> | null;
}

export interface OpinionUpdatePayload {
  title?: string;
  content?: string;
  admin_notes?: string | null;
  importance?: number;
  urgency?: number;
  expected_impact?: number;
  supporter_points?: number;
}

/** Public API: published opinions (Phase 5) – no PII; includes supporters and approved comments */
export interface PublicOpinionItem {
  id: number;
  title: string;
  content: string;
  priority_score: number;
  supporters: number;
  additional_comments: string[];
  current_user_has_supported: boolean;
}

/** Upvote create payload: comment and PII with is_disclosure_agreed */
export interface UpvoteCreatePayload {
  comment?: string | null;
  dept?: string | null;
  name?: string | null;
  email?: string | null;
  is_disclosure_agreed?: boolean;
}

/** Upvote (moderation): raw_comment, published_comment, status, disclosed_pii when is_disclosure_agreed */
export interface UpvoteItem {
  id: number;
  opinion_id: number;
  user_hash: string;
  raw_comment: string | null;
  published_comment: string | null;
  status: string;
  created_at: string;
  is_disclosure_agreed?: boolean;
  disclosed_pii?: Record<string, string> | null;
}
