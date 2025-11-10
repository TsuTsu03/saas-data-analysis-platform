import { useEffect, useMemo, useState } from "react";
import { RecordCard } from "./RecordCard";
import type { AnalyzedRecord } from "../data/types";

interface DataListProps {
  records: AnalyzedRecord[];
}

/* ---- strict option unions ---- */
const SENTIMENTS = ["all", "positive", "neutral", "negative"] as const;
type SentimentFilter = (typeof SENTIMENTS)[number];

const SORT_OPTIONS = ["date", "rating", "confidence"] as const;
type SortBy = (typeof SORT_OPTIONS)[number];

export function DataList({ records }: DataListProps) {
  const [localRecords, setLocalRecords] = useState(records);
  const [filterSentiment, setFilterSentiment] =
    useState<SentimentFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  /* keep local state in sync if parent records change */
  useEffect(() => {
    setLocalRecords(records);
  }, [records]);

  /* rating update (local optimistic only; persist in parent if needed) */
  const handleRatingChange = (id: string, rating: number) => {
    setLocalRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, userRating: rating } : r))
    );
  };

  /* handlers */
  const handleSentimentChange: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ) => {
    const v = e.currentTarget.value;
    if ((SENTIMENTS as readonly string[]).includes(v)) {
      setFilterSentiment(v as SentimentFilter);
    }
  };

  const handleSortChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const v = e.currentTarget.value;
    if ((SORT_OPTIONS as readonly string[]).includes(v)) {
      setSortBy(v as SortBy);
    }
  };

  /* memoized filter + sort */
  const filteredRecords = useMemo(() => {
    if (filterSentiment === "all") return localRecords;
    return localRecords.filter(
      (r) => (r.analysis?.sentiment ?? "neutral") === filterSentiment
    );
  }, [localRecords, filterSentiment]);

  const sortedRecords = useMemo(() => {
    const arr = [...filteredRecords];
    arr.sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortBy === "rating") {
        return (b.userRating ?? 0) - (a.userRating ?? 0);
      }
      // confidence
      const ca = a.analysis?.confidence ?? 0;
      const cb = b.analysis?.confidence ?? 0;
      if (cb !== ca) return cb - ca;
      // tie-breaker by date for stability
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    return arr;
  }, [filteredRecords, sortBy]);

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/10">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <label htmlFor="sentiment-filter" className="text-slate-300">
              Filter:
            </label>
            <select
              id="sentiment-filter"
              value={filterSentiment}
              onChange={handleSentimentChange}
              className="px-5 py-2.5 border border-white/10 rounded-xl bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-xl transition-all"
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="sort-by" className="text-slate-300">
              Sort:
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={handleSortChange}
              className="px-5 py-2.5 border border-white/10 rounded-xl bg-slate-700/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-xl transition-all"
            >
              <option value="date">Date</option>
              <option value="rating">Rating</option>
              <option value="confidence">Confidence</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-700/30 rounded-xl border border-white/5">
            <svg
              className="w-4 h-4 text-blue-400"
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
            <span className="text-slate-300">{sortedRecords.length}</span>
            <span className="text-slate-500">of {records.length}</span>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-5">
        {sortedRecords.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            onRatingChange={handleRatingChange}
          />
        ))}
      </div>

      {sortedRecords.length === 0 && (
        <div className="bg-slate-800/30 backdrop-blur-xl rounded-2xl shadow-2xl p-16 border border-white/10 text-center">
          <div className="text-slate-500 mb-4">
            <svg
              className="w-20 h-20 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-slate-400 text-lg">
            No records match your filters
          </p>
          <p className="text-slate-500 mt-2">
            Try adjusting your filter settings
          </p>
        </div>
      )}
    </div>
  );
}
