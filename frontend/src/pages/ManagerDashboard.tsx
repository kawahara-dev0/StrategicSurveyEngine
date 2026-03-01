import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  managerAuth,
  getManagerSurvey,
  listManagerOpinions,
  listManagerUpvotes,
  exportManagerReport,
  getManagerToken,
  setManagerToken,
  clearManagerToken,
} from "@/lib/api";
import type { PublishedOpinion, UpvoteItem } from "@/types/api";
import { Star, FileSpreadsheet, FileText, LogOut } from "lucide-react";

/** Score component 0-2 to display label */
const SCORE_LABELS: Record<number, string> = { 0: "Low", 1: "Medium", 2: "High" };

/** Star rating from priority score (0-14): 12-14=5★, 9-11=4★, 6-8=3★, 3-5=2★, 0-2=1★ */
function StarRating({ score }: { score: number }) {
  const full = score >= 12 ? 5 : score >= 9 ? 4 : score >= 6 ? 3 : score >= 3 ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= full ? "fill-amber-400 text-amber-500" : "text-slate-200"}`}
        />
      ))}
      <span className="ml-1 text-sm text-slate-500">({score})</span>
    </span>
  );
}

function ManagerUpvotes({ surveyId, opinionId }: { surveyId: string; opinionId: number }) {
  const { data: upvotes = [] } = useQuery({
    queryKey: ["manager-upvotes", surveyId, opinionId],
    queryFn: () => listManagerUpvotes(surveyId, opinionId),
    enabled: !!surveyId && !!opinionId,
  });
  const withComment = upvotes.filter(
    (u: UpvoteItem) => u.published_comment != null && u.published_comment.trim() !== ""
  );
  if (withComment.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <p className="text-xs font-medium text-slate-500 mb-2">Upvotes / Additional comments</p>
      <ul className="space-y-2">
        {withComment.map((u: UpvoteItem) => (
          <li key={u.id} className="rounded border border-slate-200 bg-slate-50/50 p-2 text-sm">
            <p className="text-slate-700">{u.published_comment}</p>
            {u.is_disclosure_agreed && u.disclosed_pii && Object.keys(u.disclosed_pii).length > 0 && (
              <p className="text-xs text-slate-600 mt-1">
                PII (disclosed): {Object.entries(u.disclosed_pii).map(([k, v]) => `${k}=${v}`).join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ManagerDashboard() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const queryClient = useQueryClient();
  const [accessCode, setAccessCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [logoutTrigger, setLogoutTrigger] = useState(0);

  const token = surveyId ? getManagerToken(surveyId) : null;
  const isLoggedIn = !!token;

  const authMutation = useMutation({
    mutationFn: () => managerAuth(surveyId!, accessCode),
    onSuccess: (data) => {
      if (surveyId) {
        setManagerToken(surveyId, data.access_token);
        queryClient.invalidateQueries({ queryKey: ["manager-opinions", surveyId] });
        queryClient.invalidateQueries({ queryKey: ["manager-survey", surveyId] });
      }
    },
    onError: (err) => {
      setAuthError(err instanceof Error ? err.message : "Invalid access code");
    },
  });

  const { data: survey } = useQuery({
    queryKey: ["manager-survey", surveyId],
    queryFn: () => getManagerSurvey(surveyId!),
    enabled: !!surveyId && isLoggedIn,
  });

  const {
    data: opinions = [],
    isLoading: loadingOpinions,
    error: opinionsError,
  } = useQuery({
    queryKey: ["manager-opinions", surveyId],
    queryFn: () => listManagerOpinions(surveyId!),
    enabled: !!surveyId && isLoggedIn,
  });

  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!surveyId) return;
    setExporting(format);
    try {
      const { blob, filename } = await exportManagerReport(surveyId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExporting(null);
    }
  };

  const handleLogout = () => {
    if (surveyId) clearManagerToken(surveyId);
    queryClient.removeQueries({ queryKey: ["manager-opinions", surveyId] });
    setLogoutTrigger((t) => t + 1);
  };

  if (!surveyId) return null;

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Manager access</h1>
        <p className="text-sm text-slate-500 mb-4">
          Enter the Access Code for this survey to view the dashboard and export reports.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAuthError(null);
            authMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Survey ID</label>
            <p className="text-xs font-mono text-slate-500 break-all">{surveyId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Access Code</label>
            <input
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Access Code"
              required
              autoComplete="current-password"
            />
          </div>
          {authError && (
            <p className="text-sm text-red-600">{authError}</p>
          )}
          <button
            type="submit"
            disabled={authMutation.isPending}
            className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium"
          >
            {authMutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Manager dashboard</h1>
          {survey?.name && (
            <p className="text-sm text-slate-500 mt-0.5">Survey: {survey.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("xlsx")}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 text-sm hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>

      {loadingOpinions ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-slate-100 rounded-lg" />
          <div className="h-24 bg-slate-100 rounded-lg" />
        </div>
      ) : opinionsError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          {opinionsError instanceof Error ? opinionsError.message : "Failed to load opinions"}
        </div>
      ) : opinions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-slate-600 text-sm">
          No published opinions yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {opinions.map((o: PublishedOpinion) => (
            <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-900">{o.title}</p>
              <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{o.content}</p>
              {o.admin_notes && o.admin_notes.trim() && (
                <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500 mb-1">Administrator Comments & Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{o.admin_notes}</p>
                </div>
              )}
              {o.disclosed_pii && Object.keys(o.disclosed_pii).length > 0 && (
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  PII (disclosed): {Object.entries(o.disclosed_pii).map(([k, v]) => `${k}=${v}`).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-3 mt-2 text-xs text-slate-500">
                <span>Imp: {SCORE_LABELS[o.importance ?? 0] ?? "—"}</span>
                <span>Urg: {SCORE_LABELS[o.urgency ?? 0] ?? "—"}</span>
                <span>Impact: {SCORE_LABELS[o.expected_impact ?? 0] ?? "—"}</span>
                <span>Supporters: {SCORE_LABELS[o.supporter_points ?? 0] ?? "—"}</span>
                <span className="text-slate-400">
                  ({(o.supporters ?? 0)} supporter{(o.supporters ?? 0) !== 1 ? "s" : ""})
                </span>
                <StarRating score={o.priority_score} />
              </div>
              <ManagerUpvotes surveyId={surveyId!} opinionId={o.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
