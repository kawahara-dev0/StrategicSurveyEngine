import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listSurveys, deleteSurvey } from "@/lib/api";
import { Calendar, FolderOpen, Trash2, Copy, Check } from "lucide-react";

export function SurveyList() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyAccessCode = (e: React.MouseEvent, surveyId: string, code: string | null | undefined) => {
    e.preventDefault();
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(surveyId);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const { data: surveys, isLoading, error } = useQuery({
    queryKey: ["surveys"],
    queryFn: listSurveys,
  });

  const deleteMutation = useMutation({
    mutationFn: (surveyId: string) => deleteSurvey(surveyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
  });

  const handleDeleteSurvey = (e: React.MouseEvent, surveyId: string, surveyName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Delete survey "${surveyName}"? This will remove all questions and responses.`)) {
      deleteMutation.mutate(surveyId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
        Failed to load surveys. Is the backend running at the API URL?
      </div>
    );
  }

  if (!surveys?.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
        <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-400" />
        <p className="font-medium">No surveys yet</p>
        <p className="text-sm mt-1">Create your first survey to get started.</p>
        <Link
          to="/admin/surveys/new"
          className="inline-block mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
        >
          New Survey
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Surveys</h1>
      <ul className="space-y-3">
        {surveys.map((s) => (
          <li key={s.id}>
            <div className="flex items-stretch rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition group">
              <Link
                to={`/admin/surveys/${s.id}`}
                className="flex-1 p-4 min-w-0"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{s.schema_name}</p>
                    {s.contract_end_date && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Contract ends {s.contract_end_date}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded shrink-0 ${
                      s.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={(e) => copyAccessCode(e, s.id, s.access_code)}
                className="px-3 py-4 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition disabled:opacity-40"
                title={s.access_code ? "Copy Manager access code" : "No access code stored (reset in survey detail)"}
                disabled={!s.access_code}
              >
                {copiedId === s.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteSurvey(e, s.id, s.name)}
                disabled={deleteMutation.isPending}
                className="px-3 py-4 text-slate-400 hover:text-red-600 hover:bg-red-50 transition rounded-r-lg disabled:opacity-50"
                title="Delete survey"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
