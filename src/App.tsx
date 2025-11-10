// src/App.tsx
import { useEffect, useState, useCallback } from "react";
import { DataList } from "./components/DataList";
import { SystemHealth } from "./components/SystemHealth";
import type { DBRecord, AnalyzedRecord } from "./data/types";

/* ---- Env (Vite) ---- */
const SB_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Optional: put this in .env for easy swapping between envs
 * VITE_ANALYZE_FUNC_URL=https://ronuqzvkaljzfwhpoqrk.functions.supabase.co/analyze-records
 */
const ANALYZE_FUNC_URL =
  (import.meta.env.VITE_ANALYZE_FUNC_URL as string) ??
  "https://ronuqzvkaljzfwhpoqrk.functions.supabase.co/analyze-records";

/* ---- Fetch + map DB -> UI shape ---- */
async function fetchRecords(): Promise<AnalyzedRecord[]> {
  const url = new URL(`${SB_URL}/rest/v1/records`);
  url.searchParams.set(
    "select",
    "id,source,url,content,created_at,summary,keywords,sentiment,sentiment_score,analyzed_at"
  );
  // If your table uses `inserted_at`, keep this. Otherwise change to `created_at.desc`.
  url.searchParams.set("order", "inserted_at.desc");
  url.searchParams.set("limit", "200");

  const r = await fetch(url.toString(), {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` }
  });
  if (!r.ok) throw new Error(await r.text());

  const rows = (await r.json()) as DBRecord[];

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    url: row.url,
    content: row.content,
    created_at: row.created_at,
    analysis: {
      summary: row.summary ?? "",
      keywords: row.keywords ?? [],
      sentiment: (row.sentiment ?? "neutral") as
        | "positive"
        | "neutral"
        | "negative",
      // Convert -1..1 to 0..1 for the UI “confidence”
      confidence:
        typeof row.sentiment_score === "number"
          ? Math.max(0, Math.min(1, (row.sentiment_score + 1) / 2))
          : 0.5
    }
  }));
}

/* Shape we *might* get back from your Edge Function */
type AnalyzeResponse = Partial<{
  analyzedCount: number;
  count: number;
  processed: number;
  total: number;
  message: string;
  // include any other fields you return
}>;

export default function App() {
  const [activeTab, setActiveTab] = useState<"data" | "health">("data");
  const [records, setRecords] = useState<AnalyzedRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Analyze states
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [analyzedCount, setAnalyzedCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const data = await fetchRecords();
      setRecords(data);
    } catch (e) {
      console.log(e);
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const triggerAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeMsg(null);
    setAnalyzedCount(null);

    try {
      const res = await fetch(ANALYZE_FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
          // Add auth header if your Edge Function is protected by RLS/JWT:
          // Authorization: `Bearer ${SB_ANON}`,
        }
        // body: JSON.stringify({ /* if your function expects a payload */ }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} – ${text || "Request failed"}`);
      }

      let json: AnalyzeResponse | undefined;
      try {
        json = (await res.json()) as AnalyzeResponse;
      } catch {
        // function might return no body, that's fine
      }

      const count =
        json?.analyzedCount ??
        json?.count ??
        json?.processed ??
        json?.total ??
        0;

      setAnalyzedCount(Number(count));
      const msg = `Analyzed ${count} ${
        Number(count) === 1 ? "record" : "records"
      } successfully.`;
      setAnalyzeMsg(`✅ ${msg}`);

      // Optional: jump to health tab to see the latest counters
      // setActiveTab("health");

      // Refresh UI data
      await load();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
          ? e
          : JSON.stringify(e);
      const emsg = `Analyze failed: ${msg || "Unknown error"}`;
      setAnalyzeMsg(`❌ ${emsg}`);
    } finally {
      setAnalyzing(false);
    }
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-xl bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-[220px]">
              <h1 className="text-white">SaaS Data Analysis Platform</h1>
              <p className="text-slate-400 mt-1">
                Apify → Supabase → OpenAI Integration
              </p>
            </div>

            {/* Analyze Records */}
            <button
              onClick={triggerAnalyze}
              className="px-4 py-2 rounded-xl border border-white/10 text-white bg-indigo-600/90 hover:bg-indigo-600 transition disabled:opacity-60"
              disabled={loading || analyzing}
              title="Trigger analysis via Supabase Edge Function"
            >
              {analyzing ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M12 3a9 9 0 100 18 9 9 0 000-18z"
                      strokeWidth="2"
                      strokeOpacity="0.2"
                    />
                    <path d="M12 3a9 9 0 019 9" strokeWidth="2" />
                  </svg>
                  Analyzing…
                </span>
              ) : (
                "Analyze Records"
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl border border-white/10 text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 transition disabled:opacity-60"
              disabled={loading || analyzing}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* Inline notifications */}
          {(err || analyzeMsg) && (
            <div
              className={`mt-3 text-sm rounded-lg px-3 py-2 border ${
                err
                  ? "text-rose-300 bg-rose-900/30 border-rose-600/30"
                  : "text-emerald-300 bg-emerald-900/30 border-emerald-600/30"
              }`}
            >
              {err || analyzeMsg}
              {analyzedCount !== null && !err && (
                <span className="ml-2 text-emerald-200/80">
                  • Total analyzed: {analyzedCount}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <nav className="flex space-x-2 bg-slate-800/50 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 w-fit shadow-2xl">
          <button
            onClick={() => setActiveTab("data")}
            className={`px-8 py-3 rounded-xl transition-all duration-300 relative ${
              activeTab === "data"
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/50"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Analyzed Data
            </span>
          </button>
          <button
            onClick={() => setActiveTab("health")}
            className={`px-8 py-3 rounded-xl transition-all duration-300 relative ${
              activeTab === "health"
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/50"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              System Health
            </span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !records ? (
          <div className="text-slate-300">Loading records…</div>
        ) : records && records.length > 0 ? (
          activeTab === "data" ? (
            <DataList records={records} />
          ) : (
            <SystemHealth records={records} />
          )
        ) : (
          <div className="text-slate-400">No records found.</div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative mt-16 py-8 border-t border-white/10 backdrop-blur-xl bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400">
          <p>Full-Stack Technical Challenge Demo</p>
          <p className="mt-1 text-slate-500">
            Stack: Apify • Supabase • OpenAI • React • TypeScript
          </p>
        </div>
      </footer>
    </div>
  );
}
