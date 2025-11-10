import type { AnalyzedRecord } from "../data/types";

interface SystemHealthProps {
  records: AnalyzedRecord[];
}

export function SystemHealth({ records }: SystemHealthProps) {
  // Calculate statistics
  const totalRecords = records.length;
  const analyzedRecords = records.filter((r) => r.analysis).length;
  const avgConfidence =
    records.reduce((sum, r) => sum + r.analysis.confidence, 0) / records.length;

  const sentimentBreakdown = {
    positive: records.filter((r) => r.analysis.sentiment === "positive").length,
    neutral: records.filter((r) => r.analysis.sentiment === "neutral").length,
    negative: records.filter((r) => r.analysis.sentiment === "negative").length
  };

  const ratedRecords = records.filter((r) => r.userRating);
  const avgUserRating =
    ratedRecords.length > 0
      ? ratedRecords.reduce((sum, r) => sum + (r.userRating || 0), 0) /
        ratedRecords.length
      : 0;

  // Get last analysis timestamp
  const lastAnalysis =
    records.length > 0
      ? new Date(
          Math.max(...records.map((r) => new Date(r.created_at).getTime()))
        )
      : null;

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  };

  const getSystemStatus = () => {
    if (totalRecords === 0)
      return { status: "warning", text: "No Data", color: "yellow" };
    if (analyzedRecords === totalRecords && avgConfidence > 0.85) {
      return { status: "healthy", text: "Operational", color: "green" };
    }
    return { status: "degraded", text: "Degraded", color: "yellow" };
  };

  const systemStatus = getSystemStatus();

  return (
    <div className="space-y-6">
      {/* System Status Header */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg
                  className="w-6 h-6 text-white"
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
              </div>
              <h2 className="text-white">System Status</h2>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full ${
                  systemStatus.color === "green"
                    ? "bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"
                    : systemStatus.color === "yellow"
                    ? "bg-yellow-500 shadow-lg shadow-yellow-500/50"
                    : "bg-rose-500 shadow-lg shadow-rose-500/50"
                }`}
              />
              <span
                className={`px-4 py-2 rounded-xl backdrop-blur-xl border ${
                  systemStatus.color === "green"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : systemStatus.color === "yellow"
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                }`}
              >
                {systemStatus.text}
              </span>
            </div>
          </div>

          {lastAnalysis && (
            <div className="flex items-center gap-2 text-slate-400 bg-slate-700/30 rounded-xl p-4 border border-white/5">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Last OpenAI call:</span>
              <span className="text-white">
                {formatTimestamp(lastAnalysis)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Records */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 hover:border-blue-500/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400">Total Records</h3>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <div className="text-white mb-2">{totalRecords}</div>
          <div className="text-slate-500">Processed items</div>
        </div>

        {/* Analyzed Records */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 hover:border-emerald-500/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400">Analyzed</h3>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-emerald-400"
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
            </div>
          </div>
          <div className="text-white mb-2">{analyzedRecords}</div>
          <div className="text-slate-500">
            {totalRecords > 0
              ? ((analyzedRecords / totalRecords) * 100).toFixed(1)
              : 0}
            % completion
          </div>
        </div>

        {/* Average Confidence */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 hover:border-purple-500/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400">Avg Confidence</h3>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-purple-400"
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
            </div>
          </div>
          <div className="text-white mb-2">
            {(avgConfidence * 100).toFixed(1)}%
          </div>
          <div className="text-slate-500">AI accuracy</div>
        </div>

        {/* Average Rating */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 hover:border-amber-500/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400">User Rating</h3>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6 text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
          <div className="text-white mb-2">
            {avgUserRating.toFixed(1)} / 5.0
          </div>
          <div className="text-slate-500">{ratedRecords.length} ratings</div>
        </div>
      </div>

      {/* Sentiment Distribution */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 md:p-8">
        <h2 className="text-white mb-6 flex items-center gap-3">
          <svg
            className="w-6 h-6 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          Sentiment Distribution
        </h2>
        <div className="space-y-5">
          {/* Positive */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">😊</span>
                <span className="text-slate-300">Positive</span>
              </div>
              <span className="text-white">{sentimentBreakdown.positive}</span>
            </div>
            <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500 shadow-lg"
                style={{
                  width: `${
                    (sentimentBreakdown.positive / totalRecords) * 100
                  }%`
                }}
              />
            </div>
          </div>

          {/* Neutral */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">😐</span>
                <span className="text-slate-300">Neutral</span>
              </div>
              <span className="text-white">{sentimentBreakdown.neutral}</span>
            </div>
            <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-slate-500 to-gray-500 rounded-full transition-all duration-500 shadow-lg"
                style={{
                  width: `${(sentimentBreakdown.neutral / totalRecords) * 100}%`
                }}
              />
            </div>
          </div>

          {/* Negative */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">😞</span>
                <span className="text-slate-300">Negative</span>
              </div>
              <span className="text-white">{sentimentBreakdown.negative}</span>
            </div>
            <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-red-500 rounded-full transition-all duration-500 shadow-lg"
                style={{
                  width: `${
                    (sentimentBreakdown.negative / totalRecords) * 100
                  }%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* API Health Monitoring */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-6 md:p-8">
        <h2 className="text-white mb-6 flex items-center gap-3">
          <svg
            className="w-6 h-6 text-blue-400"
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
          API Integration Health
        </h2>
        <div className="space-y-4">
          {/* Apify */}
          <div className="flex items-center justify-between p-5 bg-slate-700/30 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 animate-pulse" />
              <div>
                <div className="text-white mb-1">Apify Scraper</div>
                <div className="text-slate-400">Last scrape: 2 minutes ago</div>
              </div>
            </div>
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl backdrop-blur-xl">
              Active
            </span>
          </div>

          {/* Supabase */}
          <div className="flex items-center justify-between p-5 bg-slate-700/30 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 animate-pulse" />
              <div>
                <div className="text-white mb-1">Supabase Database</div>
                <div className="text-slate-400">Connection: Healthy</div>
              </div>
            </div>
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl backdrop-blur-xl">
              Connected
            </span>
          </div>

          {/* OpenAI */}
          <div className="flex items-center justify-between p-5 bg-slate-700/30 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50 animate-pulse" />
              <div>
                <div className="text-white mb-1">OpenAI API</div>
                <div className="text-slate-400">Rate limit: 85% available</div>
              </div>
            </div>
            <span className="px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl backdrop-blur-xl">
              Operational
            </span>
          </div>
        </div>
      </div>

      {/* Uptime Information */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 p-6 md:p-8 backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-white mb-3">
              How This Powers Uptime Monitoring
            </h3>
            <p className="text-slate-300 leading-relaxed mb-3">
              This System Health dashboard provides real-time visibility into
              the data pipeline. By tracking total analyzed records and the
              timestamp of the last successful OpenAI call, teams can quickly
              detect when the pipeline stalls or API integrations fail.
            </p>
            <p className="text-slate-300 leading-relaxed">
              In production, these metrics would trigger alerts when: (1) the
              last analysis timestamp exceeds a threshold, (2) confidence scores
              drop below acceptable levels, or (3) API health indicators show
              degraded performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
