export interface Survey {
  id: string;
  name: string;
  schema_name: string;
  status: string;
  contract_end_date: string | null;
  deletion_due_date: string | null;
  notes?: string | null;
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
  importance: number;
  urgency: number;
  expected_impact: number;
}

export interface PublishedOpinion {
  id: number;
  raw_response_id: string;
  title: string;
  content: string;
  priority_score: number;
  importance: number;
  urgency: number;
  expected_impact: number;
  supporter_points: number;
  disclosed_pii: Record<string, string> | null;
}

export interface OpinionUpdatePayload {
  title?: string;
  content?: string;
  importance?: number;
  urgency?: number;
  expected_impact?: number;
  supporter_points?: number;
}
