import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const isContributorPage = location.pathname.startsWith("/survey/");
  const isManagerPage = location.pathname.startsWith("/manager/");
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-800 text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {isContributorPage ? (
            <span className="font-semibold text-lg flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5" />
              Strategic Survey Engine
            </span>
          ) : (
            <Link to="/" className="font-semibold text-lg flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5" />
              Strategic Survey Engine
            </Link>
          )}
          {!isContributorPage && !isManagerPage && isAdminPage && (
            <nav className="flex gap-4">
              <Link to="/admin/" className="text-slate-200 hover:text-white transition">
                Surveys
              </Link>
              <Link
                to="/admin/surveys/new"
                className="flex items-center gap-1 text-slate-200 hover:text-white transition"
              >
                <PlusCircle className="w-4 h-4" />
                New Survey
              </Link>
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-3 text-center text-sm text-slate-500">
        {isContributorPage ? "Strategic Survey Engine" : isAdminPage ? "Strategic Survey Engine · Admin" : "Strategic Survey Engine"}
      </footer>
    </div>
  );
}
