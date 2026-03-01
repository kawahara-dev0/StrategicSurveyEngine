import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { verifyAdminPassword, setAdminKeyForSession, clearAdminKeySession, hasAdminKey } from "@/lib/api";

const ADMIN_AUTH_KEY = "admin_authenticated";

function getAdminAuthenticated(): boolean {
  try {
    return localStorage.getItem(ADMIN_AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

function setAdminAuthenticated(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(ADMIN_AUTH_KEY, "1");
    } else {
      localStorage.removeItem(ADMIN_AUTH_KEY);
      clearAdminKeySession();
    }
  } catch {
    // ignore
  }
}

export function AdminGuard() {
  const [authenticated, setAuthenticated] = useState(() => getAdminAuthenticated() && hasAdminKey());
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getAdminAuthenticated() && !hasAdminKey()) {
      setAdminAuthenticated(false);
      setAuthenticated(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwd = password.trim();
    if (!pwd) return;

    setSubmitting(true);
    try {
      const result = await verifyAdminPassword(pwd);
      if (result.ok) {
        setAdminKeyForSession(pwd);
        setAdminAuthenticated(true);
        setAuthenticated(true);
      } else {
        if (result.status === 404) {
          setError("Admin access is not configured on the server. Set ADMIN_API_KEY on the backend (e.g. in Docker).");
        } else {
          setError("Incorrect password.");
        }
      }
    } catch {
      setError("Could not reach the server. Check that the backend is running and VITE_API_URL is correct.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authenticated) {
    return <Outlet />;
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-2">System administrator access</h1>
      <p className="text-sm text-slate-500 mb-4">
        Enter the administrator password to access the admin area.
      </p>
      <p className="text-xs text-slate-400 mb-2">Use the same value as ADMIN_API_KEY (project root .env).</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Administrator password"
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium"
        >
          {submitting ? "Verifying…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
