import { LayoutDashboard } from "lucide-react";

export function Home() {
  return (
    <div className="max-w-lg mx-auto py-12 text-center">
      <LayoutDashboard className="w-14 h-14 mx-auto mb-4 text-slate-400" />
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">Strategic Survey Engine</h1>
      <p className="text-slate-600">
        Use the URL provided by the system administrator to submit or view opinions.
      </p>
    </div>
  );
}
