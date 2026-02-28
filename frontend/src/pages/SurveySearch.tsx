import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSurveyQuestions, searchPublicOpinions, postUpvote } from "@/lib/api";
import type { PublicOpinionItem } from "@/types/api";
import { Search, ThumbsUp, MessageSquare } from "lucide-react";

export function SurveySearch() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [upvoteOpinionId, setUpvoteOpinionId] = useState<number | null>(null);
  const [upvoteComment, setUpvoteComment] = useState("");
  const [upvoteDept, setUpvoteDept] = useState("");
  const [upvoteName, setUpvoteName] = useState("");
  const [upvoteEmail, setUpvoteEmail] = useState("");
  const [disclosureAgreed, setDisclosureAgreed] = useState(false);

  const { data: surveyData, isLoading: loadingSurvey, error: surveyError } = useQuery({
    queryKey: ["survey-questions", surveyId],
    queryFn: () => getSurveyQuestions(surveyId!),
    enabled: !!surveyId,
  });

  const { data: opinions = [], isLoading: loadingOpinions } = useQuery({
    queryKey: ["public-opinions", surveyId, searchQuery],
    queryFn: () => searchPublicOpinions(surveyId!, searchQuery),
    enabled: !!surveyId,
  });

  const upvoteMutation = useMutation({
    mutationFn: ({
      opinionId,
      comment,
      dept,
      name,
      email,
      is_disclosure_agreed,
    }: {
      opinionId: number;
      comment?: string | null;
      dept?: string | null;
      name?: string | null;
      email?: string | null;
      is_disclosure_agreed?: boolean;
    }) =>
      postUpvote(surveyId!, opinionId, {
        comment,
        dept,
        name,
        email,
        is_disclosure_agreed,
      }),
    onSuccess: (_data, variables) => {
      const { opinionId } = variables;
      queryClient.setQueryData<PublicOpinionItem[]>(
        ["public-opinions", surveyId, searchQuery],
        (old) => {
          if (!old) return old;
          return old.map((o) =>
            o.id === opinionId
              ? {
                  ...o,
                  supporters: (o.supporters ?? 0) + 1,
                  current_user_has_supported: true,
                }
              : o
          );
        }
      );
      queryClient.invalidateQueries({ queryKey: ["public-opinions"] });
      queryClient.refetchQueries({ queryKey: ["public-opinions", surveyId, searchQuery] });
      setUpvoteOpinionId(null);
      setUpvoteComment("");
      setUpvoteDept("");
      setUpvoteName("");
      setUpvoteEmail("");
      setDisclosureAgreed(false);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(q);
  };

  if (!surveyId) return null;
  if (loadingSurvey) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse h-8 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="animate-pulse h-10 bg-slate-100 rounded w-full" />
      </div>
    );
  }
  if (surveyError || !surveyData) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-red-600">
          Survey not found. Check the URL.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        {surveyData.survey_name}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Search published opinions or post your own.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by keyword…"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm"
        />
        <button
          type="submit"
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </form>

      {loadingOpinions ? (
        <div className="space-y-3">
          <div className="animate-pulse h-24 bg-slate-100 rounded-lg" />
          <div className="animate-pulse h-24 bg-slate-100 rounded-lg" />
        </div>
      ) : opinions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-slate-600">
            No matching opinions.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {opinions.map((o: PublicOpinionItem) => (
            <li
              key={o.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h2 className="font-medium text-slate-900 mb-2">{o.title}</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap mb-3">
                {o.content}
              </p>
              {o.additional_comments.length > 0 && (
                <div className="space-y-1 mb-3 pl-3 border-l-2 border-slate-200">
                  {o.additional_comments.map((comment, i) => (
                    <p key={i} className="text-sm text-slate-600 flex items-start gap-1">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span>{comment}</span>
                    </p>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {(o.supporters ?? 0)} supporter{(o.supporters ?? 0) !== 1 ? "s" : ""}
                </span>
                {o.current_user_has_supported ? (
                  <span className="text-slate-600 font-medium">Already supported</span>
                ) : upvoteOpinionId === o.id ? (
                  <div className="flex flex-col gap-2 flex-1 max-w-md">
                    <textarea
                      value={upvoteComment}
                      onChange={(e) => setUpvoteComment(e.target.value)}
                      placeholder="Comment (optional, will be reviewed by moderator)"
                      rows={2}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div className="space-y-2 border-t border-slate-200 pt-2 mt-1">
                      <p className="text-xs font-medium text-slate-600">Optional: Share with manager</p>
                      <div className="grid gap-2">
                        <input
                          type="text"
                          value={upvoteDept}
                          onChange={(e) => setUpvoteDept(e.target.value)}
                          placeholder="Dept."
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          value={upvoteName}
                          onChange={(e) => setUpvoteName(e.target.value)}
                          placeholder="Name"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          value={upvoteEmail}
                          onChange={(e) => setUpvoteEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={disclosureAgreed}
                            onChange={(e) => setDisclosureAgreed(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I agree to disclose my personal information (above) to managers for evaluation or hearings.
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          upvoteMutation.mutate({
                            opinionId: o.id,
                            comment: upvoteComment.trim() || null,
                            dept: upvoteDept.trim() || null,
                            name: upvoteName.trim() || null,
                            email: upvoteEmail.trim() || null,
                            is_disclosure_agreed: disclosureAgreed,
                          })
                        }
                        disabled={upvoteMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 text-white text-sm hover:bg-slate-700 disabled:opacity-50"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {upvoteMutation.isPending ? "Sending…" : "Send Support"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUpvoteOpinionId(null);
                          setUpvoteComment("");
                          setUpvoteDept("");
                          setUpvoteName("");
                          setUpvoteEmail("");
                          setDisclosureAgreed(false);
                        }}
                        className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                    {upvoteMutation.isError && (
                      <span className="text-amber-600 text-xs">
                        {upvoteMutation.error instanceof Error
                          ? upvoteMutation.error.message
                          : "Already voted"}
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUpvoteOpinionId(o.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-slate-600 hover:bg-slate-100"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Support
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 text-center">
        <Link
          to={`/survey/${surveyId}/post`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700"
        >
          Post your own opinion
        </Link>
      </div>
    </div>
  );
}
