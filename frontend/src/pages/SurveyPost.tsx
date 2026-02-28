import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSurveyQuestions, submitSurveyResponse } from "@/lib/api";
import type { Question, AnswerSubmit } from "@/types/api";
import { ArrowLeft, Send } from "lucide-react";

export function SurveyPost() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [disclosureAgreed, setDisclosureAgreed] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["survey-questions", surveyId],
    queryFn: () => getSurveyQuestions(surveyId!),
    enabled: !!surveyId,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: AnswerSubmit[]) =>
      submitSurveyResponse(surveyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId] });
      setSubmitted(true);
    },
  });

  const [submitted, setSubmitted] = useState(false);

  const updateAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.questions) return;
    const payload: AnswerSubmit[] = data.questions
      .filter((q) => {
        const v = answers[q.id]?.trim();
        return v !== undefined && v !== "";
      })
      .map((q) => ({
        question_id: q.id,
        answer_text: (answers[q.id] ?? "").trim(),
        is_disclosure_agreed: q.is_personal_data ? disclosureAgreed : false,
      }));
    if (payload.length === 0) return;
    submitMutation.mutate(payload);
  };

  const allRequiredAnswered = () => {
    if (!data?.questions) return false;
    return data.questions
      .filter((q) => q.is_required)
      .every((q) => (answers[q.id] ?? "").trim() !== "");
  };

  if (!surveyId) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
        Failed to load survey. The survey may not exist or the URL may be incorrect.
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900 mb-2">
            Thank you for your submission
          </h2>
          <p className="text-emerald-800 mb-4">
            Your feedback has been recorded. We appreciate your input.
          </p>
          <Link
            to={`/survey/${surveyId}`}
            className="inline-flex items-center gap-1 text-emerald-800 font-medium hover:text-emerald-900 underline"
          >
            View this survey&apos;s opinions
          </Link>
        </div>
      </div>
    );
  }

  if (data.status !== "active") {
    return (
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-2">
            Submissions are closed
          </h2>
          <p className="text-amber-800">
            This survey (&quot;{data.survey_name}&quot;) is not currently accepting new responses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        {data.survey_name}
      </h1>
      <p className="text-sm text-slate-500 mb-6">Share your feedback</p>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-5">
          {data.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => updateAnswer(q.id, v)}
            />
          ))}
        </div>

        {data.questions.some((q) => q.is_personal_data) && (
          <label className="flex items-center gap-2 cursor-pointer mt-4 pt-4 border-t border-slate-200 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={disclosureAgreed}
              onChange={(e) => setDisclosureAgreed(e.target.checked)}
              className="rounded border-slate-300"
            />
            I agree to disclose my personal information (above) to managers for evaluation or hearings.
          </label>
        )}

        {submitMutation.isError && (
          <p className="mt-4 text-sm text-red-600">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : "Submission failed"}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={submitMutation.isPending || !allRequiredAnswered()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = (
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {question.label}
      {question.is_required && (
        <span className="text-red-500 ml-1">*</span>
      )}
      {question.is_personal_data && (
        <span className="text-slate-400 font-normal ml-1">(Personal data)</span>
      )}
    </label>
  );

  const baseInputClass =
    "w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400";

  const renderInput = () => {
    switch (question.question_type) {
      case "textarea":
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={`${baseInputClass} resize-y`}
            required={question.is_required}
          />
        );
      case "select":
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            required={question.is_required}
          >
            <option value="">-- Select --</option>
            {(question.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                />
                <span className="text-slate-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            required={question.is_required}
          />
        );
    }
  };

  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      {label}
      {renderInput()}
    </div>
  );
}
