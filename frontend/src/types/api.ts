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
