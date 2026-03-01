import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listQuestions, createQuestion, getSurvey, deleteQuestion, resetSurveyAccessCode } from "@/lib/api";
import type { QuestionCreatePayload } from "@/types/api";
import { ArrowLeft, Plus, ListChecks, Trash2, ExternalLink, Gavel, Copy, Check, KeyRound } from "lucide-react";

const QUESTION_TYPES: QuestionCreatePayload["question_type"][] = [
  "text",
  "textarea",
  "select",
  "radio",
];

function ManagerAccessCodeBlock({
  surveyId,
  survey,
  queryClient,
}: {
  surveyId: string;
  survey: { access_code?: string | null } | undefined;
  queryClient: ReturnType<typeof import("@tanstack/react-query").useQueryClient>;
}) {
  const [copied, setCopied] = useState(false);
  const resetMutation = useMutation({
    mutationFn: () => resetSurveyAccessCode(surveyId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["survey", surveyId] });
      navigator.clipboard.writeText(data.access_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
  });
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 mb-6">
      <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
        <KeyRound className="w-3.5 h-3.5" />
        Manager access code
      </p>
      {survey?.access_code ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm tracking-wider bg-white border border-slate-200 rounded px-2 py-1.5">
            {survey.access_code}
          </code>
          <button
            type="button"
            onClick={() => copyCode(survey.access_code!)}
            className="p-2 rounded border border-slate-300 hover:bg-slate-100 text-slate-600"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Not stored (or created before this feature).</span>
          <button
            type="button"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="px-3 py-1.5 rounded bg-slate-700 text-white text-sm hover:bg-slate-600 disabled:opacity-50"
          >
            {resetMutation.isPending ? "Resetting…" : "Reset access code"}
          </button>
          {resetMutation.isSuccess && copied && (
            <span className="text-sm text-emerald-600">New code copied to clipboard.</span>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500 mt-1.5">
        Share with the manager to access the Manager dashboard. Keep it confidential.
      </p>
    </div>
  );
}

export function SurveyDetail() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [questionType, setQuestionType] = useState<QuestionCreatePayload["question_type"]>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [isPersonalData, setIsPersonalData] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const { data: survey } = useQuery({
    queryKey: ["survey", surveyId],
    queryFn: () => getSurvey(surveyId!),
    enabled: !!surveyId,
  });

  const { data: questions, isLoading, error } = useQuery({
    queryKey: ["questions", surveyId],
    queryFn: () => listQuestions(surveyId!),
    enabled: !!surveyId,
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) =>
      deleteQuestion(surveyId!, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", surveyId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: QuestionCreatePayload) =>
      createQuestion(surveyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", surveyId] });
      setShowForm(false);
      setLabel("");
      setQuestionType("text");
      setIsRequired(false);
      setIsPersonalData(false);
      setOptionsText("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const options =
      questionType === "select" || questionType === "radio"
        ? optionsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    createMutation.mutate({
      label: label.trim(),
      question_type: questionType,
      options: options ?? null,
      is_required: isRequired,
      is_personal_data: isPersonalData,
    });
  };

  if (!surveyId) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/admin/")}
        className="flex items-center gap-1 text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to surveys
      </button>

      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        {survey?.name ?? "Survey questions"}
      </h1>
      {survey?.notes && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 mb-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Admin notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{survey.notes}</p>
        </div>
      )}
      <p className="text-sm text-slate-500 mb-2">Survey ID: {surveyId}</p>

      <ManagerAccessCodeBlock surveyId={surveyId!} survey={survey} queryClient={queryClient} />

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <a
          href={`/survey/${surveyId}/post`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ExternalLink className="w-4 h-4" />
          Open submission form (share with contributors)
        </a>
        <button
          type="button"
          onClick={() => navigate(`/admin/surveys/${surveyId}/moderation`)}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <Gavel className="w-4 h-4" />
          Moderation workspace
        </button>
      </div>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition mb-6"
        >
          <Plus className="w-4 h-4" />
          Add question
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm mb-6"
        >
          <h2 className="font-medium text-slate-800 mb-4">New question</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Improvement idea"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <select
                value={questionType}
                onChange={(e) =>
                  setQuestionType(e.target.value as QuestionCreatePayload["question_type"])
                }
                className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {(questionType === "select" || questionType === "radio") && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Options (comma-separated)
                </label>
                <input
                  type="text"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="e.g. IT, HR, Sales"
                  className="w-full rounded border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            )}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPersonalData}
                  onChange={(e) => setIsPersonalData(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Personal data (PII)</span>
              </label>
            </div>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "Failed to add question"}
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={createMutation.isPending || !label.trim()}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding…" : "Add question"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600" />
        </div>
      ) : error ? (
        <p className="text-red-600">Failed to load questions.</p>
      ) : !questions?.length ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          <ListChecks className="w-10 h-10 mx-auto mb-2 text-slate-400" />
          <p>No questions yet. Add one above.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li
              key={q.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{q.label}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {q.question_type}
                    {q.is_required && " · Required"}
                    {q.is_personal_data && " · PII"}
                  </p>
                  {q.options?.length ? (
                    <p className="text-xs text-slate-400 mt-1">
                      Options: {q.options.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">#{q.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete question "${q.label}"?`)) {
                        deleteQuestionMutation.mutate(q.id);
                      }
                    }}
                    disabled={deleteQuestionMutation.isPending}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
