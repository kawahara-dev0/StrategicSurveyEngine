import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createSurvey } from "@/lib/api";
import { Copy, Check } from "lucide-react";

export function SurveyCreate() {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [created, setCreated] = useState<{ id: string; access_code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => createSurvey(name.trim(), notes.trim() || null),
    onSuccess: (data) => {
      setCreated({ id: data.id, access_code: data.access_code });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  const copyAccessCode = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.access_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (created) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900 mb-4">
            Survey created
          </h2>
          <p className="text-sm text-emerald-800 mb-2">
            Save the Access Code — it is shown only once.
          </p>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-emerald-200 p-3">
            <code className="flex-1 font-mono text-lg tracking-wider">
              {created.access_code}
            </code>
            <button
              type="button"
              onClick={copyAccessCode}
              className="p-2 rounded hover:bg-slate-100 transition"
              title="Copy"
            >
              {copied ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5 text-slate-600" />
              )}
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => navigate(`/admin/surveys/${created.id}`)}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition"
            >
              Open survey & add questions
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setName("");
                setNotes("");
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Create another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">New Survey</h1>
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Survey name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q1 2025 Feedback"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          required
        />
        <label className="block text-sm font-medium text-slate-700 mb-2 mt-4">
          Admin notes (target company, etc.)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Target: ABC Corp, Q1 2025"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-y"
        />
        {mutation.isError && (
          <p className="mt-2 text-sm text-red-600">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to create survey"}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || !name.trim()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Creating…" : "Create survey"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/")}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
