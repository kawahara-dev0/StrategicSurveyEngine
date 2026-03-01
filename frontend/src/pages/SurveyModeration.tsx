import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listResponses,
  getResponse,
  createOpinion,
  listOpinions,
  updateOpinion,
  getSurvey,
  listUpvotesForOpinion,
  updateUpvote,
} from "@/lib/api";
import type { PublishOpinionPayload, PublishedOpinion, UpvoteItem } from "@/types/api";
import { ArrowLeft, Send, FileText, Star, Pencil, Check, MessageSquare } from "lucide-react";

/** Score component 0-2 to display label */
const SCORE_LABELS: Record<number, string> = { 0: "Low", 1: "Medium", 2: "High" };

/** Star rating from priority score (0-14): 12-14=5★, 9-11=4★, 6-8=3★, 3-5=2★, 0-2=1★ */
function priorityStars(score: number): { full: number; label: string } {
  if (score >= 12) return { full: 5, label: "Immediate action recommended" };
  if (score >= 9) return { full: 4, label: "Consider including in improvement plan" };
  if (score >= 6) return { full: 3, label: "Worth monitoring for future action" };
  if (score >= 3) return { full: 2, label: "Low priority" };
  return { full: 1, label: "Currently not needed / archived" };
}

function StarRating({ score }: { score: number }) {
  const { full, label } = priorityStars(score);
  return (
    <span className="inline-flex items-center gap-1" title={label}>
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

function UpvotesSection({
  surveyId,
  opinionId,
  onClose,
}: {
  surveyId: string;
  opinionId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: upvotes = [], isLoading } = useQuery({
    queryKey: ["upvotes", surveyId, opinionId],
    queryFn: () => listUpvotesForOpinion(surveyId, opinionId),
    enabled: !!surveyId && !!opinionId,
  });
  const updateMutation = useMutation({
    mutationFn: ({ upvoteId, payload }: { upvoteId: number; payload: { published_comment?: string | null; status?: string } }) =>
      updateUpvote(surveyId, upvoteId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upvotes", surveyId, opinionId] });
      queryClient.invalidateQueries({ queryKey: ["opinions", surveyId] });
    },
  });
  const [edits, setEdits] = useState<Record<number, { published_comment: string; status: string }>>({});
  const getEdit = (u: UpvoteItem) =>
    edits[u.id] ?? { published_comment: u.published_comment ?? "", status: u.status };

  if (isLoading) return <div className="mt-3 text-sm text-slate-500">Loading upvotes…</div>;
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">Upvotes / Additional comments</span>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
      {(() => {
        const withComment = upvotes.filter((u) => u.raw_comment != null && u.raw_comment.trim() !== "");
        if (withComment.length === 0) {
          return <p className="text-sm text-slate-500">No additional comments to moderate.</p>;
        }
        return (
          <ul className="space-y-3">
            {withComment.map((u) => (
              <li key={u.id} className="rounded border border-slate-200 bg-slate-50/50 p-2 text-sm">
                {u.is_disclosure_agreed && u.disclosed_pii && Object.keys(u.disclosed_pii).length > 0 && (
                  <p className="text-slate-600 mb-1 text-xs">
                    Dept: {u.disclosed_pii["Dept"] ?? "—"}, Name: {u.disclosed_pii["Name"] ?? "—"}, Email: {u.disclosed_pii["Email"] ?? "—"}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      u.status === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : u.status === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.status}
                  </span>
                </div>
                <p className="text-slate-600 mb-1">
                  Raw: {u.raw_comment}
                </p>
                <div className="flex flex-wrap gap-2 items-start">
                  <div className="min-w-[200px]">
                    <label className="block text-xs text-slate-500">Published comment</label>
                    <textarea
                      value={getEdit(u).published_comment}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [u.id]: { ...getEdit(u), published_comment: e.target.value },
                        }))
                      }
                      rows={2}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500">Status</label>
                    <select
                      value={getEdit(u).status}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [u.id]: { ...getEdit(u), status: e.target.value },
                        }))
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="pending">pending</option>
                      <option value="published">published</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateMutation.mutate({
                        upvoteId: u.id,
                        payload: {
                          published_comment: getEdit(u).published_comment.trim() || null,
                          status: getEdit(u).status,
                        },
                      })
                    }
                    disabled={updateMutation.isPending}
                    className="px-2 py-1 rounded bg-slate-700 text-white text-xs hover:bg-slate-600 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </li>
            ))}
          </ul>
        );
      })()}
    </div>
  );
}

export function SurveyModeration() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [importance, setImportance] = useState(1);
  const [urgency, setUrgency] = useState(1);
  const [expectedImpact, setExpectedImpact] = useState(1);

  const { data: survey } = useQuery({
    queryKey: ["survey", surveyId],
    queryFn: () => getSurvey(surveyId!),
    enabled: !!surveyId,
  });

  const {
    data: responses = [],
    isLoading: loadingResponses,
    error: responsesError,
  } = useQuery({
    queryKey: ["responses", surveyId],
    queryFn: () => listResponses(surveyId!),
    enabled: !!surveyId,
  });

  const { data: responseDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["response", surveyId, selectedResponseId],
    queryFn: () => getResponse(surveyId!, selectedResponseId!),
    enabled: !!surveyId && !!selectedResponseId,
  });

  const { data: opinions = [] } = useQuery({
    queryKey: ["opinions", surveyId],
    queryFn: () => listOpinions(surveyId!),
    enabled: !!surveyId,
  });

  const publishedResponseIds = useMemo(
    () => new Set(opinions.map((o) => o.raw_response_id)),
    [opinions]
  );
  const sortedResponses = useMemo(() => {
    return [...responses].sort((a, b) => {
      const aPublished = publishedResponseIds.has(a.id);
      const bPublished = publishedResponseIds.has(b.id);
      if (!aPublished && bPublished) return -1;
      if (aPublished && !bPublished) return 1;
      return 0;
    });
  }, [responses, publishedResponseIds]);

  const publishMutation = useMutation({
    mutationFn: (payload: PublishOpinionPayload) =>
      createOpinion(surveyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opinions", surveyId] });
      queryClient.invalidateQueries({ queryKey: ["responses", surveyId] });
      setSelectedResponseId(null);
      setTitle("");
      setContent("");
      setAdminNotes("");
    },
  });

  const [editingOpinionId, setEditingOpinionId] = useState<number | null>(null);
  const [expandedUpvotesId, setExpandedUpvotesId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    content: string;
    admin_notes: string;
    importance: number;
    urgency: number;
    expected_impact: number;
    supporter_points: number;
  }>({ title: "", content: "", admin_notes: "", importance: 0, urgency: 0, expected_impact: 0, supporter_points: 0 });
  const updateOpinionMutation = useMutation({
    mutationFn: ({
      opinionId,
      title,
      content,
      admin_notes,
      importance,
      urgency,
      expected_impact,
      supporter_points,
    }: {
      opinionId: number;
      title: string;
      content: string;
      admin_notes: string;
      importance: number;
      urgency: number;
      expected_impact: number;
      supporter_points: number;
    }) =>
      updateOpinion(surveyId!, opinionId, {
        title,
        content,
        admin_notes: admin_notes.trim() || null,
        importance,
        urgency,
        expected_impact,
        supporter_points,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opinions", surveyId] });
      setEditingOpinionId(null);
    },
  });
  const startEdit = (o: PublishedOpinion) => {
    setEditingOpinionId(o.id);
    setEditForm({
      title: o.title,
      content: o.content,
      admin_notes: o.admin_notes ?? "",
      importance: o.importance ?? 0,
      urgency: o.urgency ?? 0,
      expected_impact: o.expected_impact ?? 0,
      supporter_points: o.supporter_points ?? 0,
    });
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResponseId || !title.trim() || !content.trim()) return;
    publishMutation.mutate({
      raw_response_id: selectedResponseId,
      title: title.trim(),
      content: content.trim(),
      admin_notes: adminNotes.trim() || null,
      importance,
      urgency,
      expected_impact: expectedImpact,
    });
  };

  if (!surveyId) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(`/admin/surveys/${surveyId}`)}
        className="flex items-center gap-1 text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to survey
      </button>

      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        Moderation · {survey?.name ?? "Survey"}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Review submissions and publish as opinions with a priority score.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Submitted responses + publish form */}
        <div className="space-y-4">
          <h2 className="font-medium text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Submitted responses
          </h2>
          {loadingResponses ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 text-sm">
              Loading…
            </div>
          ) : responsesError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
              Failed to load responses:{" "}
              {responsesError instanceof Error ? responsesError.message : String(responsesError)}
            </div>
          ) : responses.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 text-sm">
              No submissions yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedResponses.map((r) => {
                const isPublished = publishedResponseIds.has(r.id);
                const isSelected = selectedResponseId === r.id;
                return (
                  <li key={r.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResponseId(isSelected ? null : r.id);
                        if (!isSelected) {
                          setTitle("");
                          setContent("");
                          setAdminNotes("");
                        }
                      }}
                      className={`w-full text-left px-4 py-2 transition ${
                        isPublished
                          ? "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : isSelected
                            ? "border-slate-400 bg-slate-100"
                            : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-mono text-xs text-slate-500">{r.id}</span>
                      {isPublished && (
                        <span className="ml-2 text-xs text-emerald-600 font-medium">Published</span>
                      )}
                      <span className="block text-sm text-slate-700">
                        {new Date(r.submitted_at).toLocaleString()}
                      </span>
                    </button>
                    {isSelected && (
                      <div className="border-t border-slate-200 p-4 bg-slate-50/50">
                        {loadingDetail ? (
                          <div className="animate-pulse h-20 bg-slate-100 rounded" />
                        ) : responseDetail ? (
                          <>
                            <h3 className="font-medium text-slate-800 mb-2 text-sm">Response content</h3>
                            {publishedResponseIds.has(r.id) ? (
                              <p className="text-sm text-slate-600 mb-4 rounded bg-slate-100 px-3 py-2">
                                This response is already published as an opinion. It cannot be published again.
                              </p>
                            ) : null}
                            <ul className="space-y-2 mb-4 text-sm">
                              {responseDetail.answers.map((a) => (
                                <li key={a.question_id} className="border-b border-slate-100 pb-2">
                                  <span className="text-slate-500">{a.label}:</span>{" "}
                                  <span className="text-slate-800">{a.answer_text}</span>
                                  {a.is_disclosure_agreed && (
                                    <span className="ml-2 text-xs text-emerald-600">(Disclosure agreed)</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {!publishedResponseIds.has(r.id) && (
                              <form onSubmit={handlePublish} className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    placeholder="Anonymized summary title"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Content</label>
                                  <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={3}
                                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    placeholder="Refined content for publication"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Administrator Comments & Notes</label>
                                  <textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                    placeholder="Internal notes (visible only on Manager dashboard and exports)"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { label: "Importance", value: importance, set: setImportance },
                                    { label: "Urgency", value: urgency, set: setUrgency },
                                    { label: "Expected impact", value: expectedImpact, set: setExpectedImpact },
                                  ].map(({ label, value, set }) => (
                                    <div key={label}>
                                      <label className="block text-xs font-medium text-slate-600 mb-1">
                                        {label} (0–2)
                                      </label>
                                      <select
                                        value={value}
                                        onChange={(e) => set(Number(e.target.value))}
                                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                      >
                                        {[0, 1, 2].map((n) => (
                                          <option key={n} value={n}>
                                            {n}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-slate-500">
                                  Priority score = (Imp+Urg+Impact)×2 + supporters → max 14
                                </p>
                                {publishMutation.isError && (
                                  <p className="text-sm text-red-600">
                                    {publishMutation.error instanceof Error
                                      ? publishMutation.error.message
                                      : "Failed to publish"}
                                  </p>
                                )}
                                <button
                                  type="submit"
                                  disabled={publishMutation.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-50"
                                >
                                  <Send className="w-3 h-3" />
                                  {publishMutation.isPending ? "Publishing…" : "Publish opinion"}
                                </button>
                              </form>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: Published opinions */}
        <div>
          <h2 className="font-medium text-slate-800 flex items-center gap-2 mb-4">
            <Star className="w-4 h-4" />
            Published opinions
          </h2>
          {opinions.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 text-sm">
              No published opinions yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {opinions.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  {editingOpinionId === o.id ? (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-slate-500">
                        Response ID: {o.raw_response_id}
                      </p>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Title</label>
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Content</label>
                        <textarea
                          value={editForm.content}
                          onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                          rows={3}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-0.5">Administrator Comments & Notes</label>
                        <textarea
                          value={editForm.admin_notes}
                          onChange={(e) => setEditForm((f) => ({ ...f, admin_notes: e.target.value }))}
                          rows={2}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                          placeholder="Visible only on Manager dashboard and exports"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs font-medium text-slate-500">Imp</label>
                        <select
                          value={editForm.importance}
                          onChange={(e) => setEditForm((f) => ({ ...f, importance: Number(e.target.value) }))}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {([0, 1, 2] as const).map((i) => (
                            <option key={i} value={i}>{SCORE_LABELS[i]}</option>
                          ))}
                        </select>
                        <label className="text-xs font-medium text-slate-500">Urg</label>
                        <select
                          value={editForm.urgency}
                          onChange={(e) => setEditForm((f) => ({ ...f, urgency: Number(e.target.value) }))}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {([0, 1, 2] as const).map((i) => (
                            <option key={i} value={i}>{SCORE_LABELS[i]}</option>
                          ))}
                        </select>
                        <label className="text-xs font-medium text-slate-500">Impact</label>
                        <select
                          value={editForm.expected_impact}
                          onChange={(e) => setEditForm((f) => ({ ...f, expected_impact: Number(e.target.value) }))}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {([0, 1, 2] as const).map((i) => (
                            <option key={i} value={i}>{SCORE_LABELS[i]}</option>
                          ))}
                        </select>
                        <label className="text-xs font-medium text-slate-500">Supporters</label>
                        <select
                          value={editForm.supporter_points}
                          onChange={(e) => setEditForm((f) => ({ ...f, supporter_points: Number(e.target.value) }))}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {([0, 1, 2] as const).map((i) => (
                            <option key={i} value={i}>{SCORE_LABELS[i]}</option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-500">
                          → {(editForm.importance + editForm.urgency + editForm.expected_impact) * 2 + editForm.supporter_points}/14
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateOpinionMutation.mutate({
                              opinionId: o.id,
                              title: editForm.title,
                              content: editForm.content,
                              admin_notes: editForm.admin_notes,
                              importance: editForm.importance,
                              urgency: editForm.urgency,
                              expected_impact: editForm.expected_impact,
                              supporter_points: editForm.supporter_points,
                            })
                          }
                          disabled={updateOpinionMutation.isPending}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingOpinionId(null)}
                          className="px-2 py-1 rounded border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                      {updateOpinionMutation.isError &&
                        updateOpinionMutation.variables?.opinionId === o.id && (
                          <p className="text-sm text-red-600">
                            {updateOpinionMutation.error instanceof Error
                              ? updateOpinionMutation.error.message
                              : "Failed to update"}
                          </p>
                        )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">
                          Response ID: {o.raw_response_id}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(o)}
                            className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            title="Edit title, content, Imp, Urg, Impact, supporters"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedUpvotesId((prev) => (prev === o.id ? null : o.id))}
                            className={`p-1.5 rounded ${
                              (o.pending_upvotes_count ?? 0) > 0
                                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            }`}
                            title="View / moderate upvotes"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="font-medium text-slate-900">{o.title}</p>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap mt-0.5">
                        {o.content}
                      </p>
                      {o.admin_notes && o.admin_notes.trim() && (
                        <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <p className="text-xs font-medium text-slate-500 mb-0.5">Administrator Comments & Notes</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{o.admin_notes}</p>
                        </div>
                      )}
                      {o.disclosed_pii && Object.keys(o.disclosed_pii).length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          PII: {Object.entries(o.disclosed_pii).map(([k, v]) => `${k}=${v}`).join(", ")}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-end gap-3 mt-1 text-sm text-slate-500">
                        <span>
                          {(o.supporters ?? 0)} supporter{(o.supporters ?? 0) !== 1 ? "s" : ""}
                        </span>
                        <StarRating score={o.priority_score} />
                      </div>
                      {expandedUpvotesId === o.id && (
                        <UpvotesSection surveyId={surveyId!} opinionId={o.id} onClose={() => setExpandedUpvotesId(null)} />
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
