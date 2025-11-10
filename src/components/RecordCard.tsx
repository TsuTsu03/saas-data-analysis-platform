import type { AnalyzedRecord } from "../data/types";
import { StarRating } from "./StarRating";

interface RecordCardProps {
  record: AnalyzedRecord;
  onRatingChange: (id: string, rating: number) => void;
}

/* --------- Raw shape support (screenshot fields) --------- */
interface RawApifyRecord {
  Id?: string;
  Title?: string;
  Description?: string;
  "Source Name"?: string;
  Published_time?: string;
  Date?: string;
  Link?: string;
  Image?: string;
  pageTitle?: string;
  h1?: string;
  random_text_from_the_page?: string;
  snippet?: string;
  summary?: string;
}

type WithUserRating = { userRating?: number };
type FlexibleRecord = AnalyzedRecord &
  Partial<RawApifyRecord> &
  Partial<WithUserRating>;

/* ----------------- Helpers ----------------- */
function coalesce<T>(...vals: (T | undefined | null)[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

/** Accept ISO or "YYYY-MM-DD HH:mm:ss" (keep timezone offsets if present) */
function parseMaybeDate(v?: string | null): Date | null {
  if (!v) return null;
  const s = v.trim();
  const hasTZ = /Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s);
  const normalized = s.includes(" ") ? s.replace(" ", "T") : s;
  const finalStr = hasTZ ? normalized : `${normalized}Z`;
  const d = new Date(finalStr);
  return isNaN(d.getTime()) ? null : d;
}

function hasUserRating(x: unknown): x is WithUserRating {
  return typeof (x as WithUserRating | undefined)?.userRating === "number";
}

/** Map hostname to a nice brand name; fallback to prettified SLD */
function brandFromHostname(host?: string | null): string | undefined {
  if (!host) return undefined;
  const h = host.toLowerCase();
  if (h.endsWith("barrons.com")) return "Barron's";
  if (h.endsWith("reuters.com")) return "Reuters";
  if (h.endsWith("britannica.com")) return "Britannica";
  if (h.endsWith("cnbc.com")) return "CNBC";
  if (h.endsWith("wsj.com")) return "WSJ";
  if (h.endsWith("bloomberg.com")) return "Bloomberg";
  // generic: take second-level part and Capitalize
  const m = h.split(".").slice(-2, -1)[0];
  if (!m) return undefined;
  return m.slice(0, 1).toUpperCase() + m.slice(1);
}

/** Remove base64 blobs, inline URLs, and trailing “Publisher … ago YYYY-MM-DD … [image]” */
function cleanForDisplay(text?: string | null): string {
  if (!text) return "";
  return (
    text
      // strip data:image base64 payloads entirely
      .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "")
      // remove bare urls (we show the main url separately)
      .replace(/https?:\/\/\S+/g, "")
      // drop common trailing “Publisher 2 weeks ago 2025-10-27 12:03:51” style
      .replace(
        /\b[a-zA-Z.'’]+(?:\s+[a-zA-Z.'’]+)*\s+\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?)\s+ago\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\b.*$/i,
        ""
      )
      // remove stray [image] or [ image ]
      .replace(/\s*\[image\]\s*$/i, "")
      // tidy spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** If content starts with the title repeated, remove the duplicate */
function dedupeTitle(title: string | undefined, body: string): string {
  if (!title) return body;
  const t = title.trim();
  if (!t) return body;
  const start = body.slice(0, Math.min(body.length, t.length * 2)).trim();
  if (start.startsWith(t)) {
    // remove the first occurrence + possible punctuation/space after
    return body
      .replace(new RegExp("^" + escapeRegExp(t) + "[\\s–—:|,-]*"), "")
      .trim();
  }
  return body;
}
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* --------- View model that unifies both shapes --------- */
function getViewModel(rec: FlexibleRecord) {
  const id = coalesce<string>(rec.id, rec.Id) ?? crypto.randomUUID();

  const title = coalesce<string>(
    (rec as { title?: string }).title,
    rec.Title,
    rec.pageTitle,
    rec.h1
  );

  const rawContent = coalesce<string>(
    typeof rec.content === "string" ? rec.content : undefined,
    (rec as { description?: string }).description,
    rec.Description,
    rec.random_text_from_the_page,
    rec.snippet,
    rec.summary
  );

  const url = coalesce<string>(rec.url, rec.Link);
  const hostname = (() => {
    try {
      return url ? new URL(url).hostname : undefined;
    } catch {
      return undefined;
    }
  })();

  const source =
    coalesce<string>(rec.source, rec["Source Name"]) ??
    brandFromHostname(hostname) ??
    "—";

  const createdAt =
    parseMaybeDate(coalesce<string>(rec.created_at, rec.Date)) ?? new Date();

  const imageDataUrl =
    typeof rec.Image === "string" && rec.Image.startsWith("data:image")
      ? rec.Image
      : undefined;

  const cleaned = cleanForDisplay(rawContent);
  const displayContent = dedupeTitle(title, cleaned);

  const analysis = {
    sentiment: (rec.analysis?.sentiment ?? "neutral") as
      | "positive"
      | "neutral"
      | "negative",
    summary: rec.analysis?.summary ?? displayContent,
    confidence:
      typeof rec.analysis?.confidence === "number"
        ? rec.analysis.confidence
        : 0.5,
    keywords: Array.isArray(rec.analysis?.keywords) ? rec.analysis.keywords : []
  };

  return {
    id,
    title,
    displayContent,
    url,
    source,
    createdAt,
    imageDataUrl,
    analysis
  };
}

/* ----------------- Component ----------------- */
export function RecordCard({ record, onRatingChange }: RecordCardProps) {
  const vm = getViewModel(record as FlexibleRecord);

  const sentimentColors = {
    positive: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
    neutral: "from-slate-500/20 to-gray-500/20 border-slate-500/30",
    negative: "from-rose-500/20 to-red-500/20 border-rose-500/30"
  } as const;

  const sentimentBadgeColors = {
    positive: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    neutral: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    negative: "bg-rose-500/20 text-rose-300 border-rose-500/30"
  } as const;

  const sentimentIcons = {
    positive: "😊",
    neutral: "😐",
    negative: "😞"
  } as const;

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);

  const cap = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1);

  return (
    <div className="group bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden hover:border-white/20 hover:shadow-blue-500/10 transition-all duration-300">
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              {/* SOURCE */}
              <span className="text-slate-300 truncate">{vm.source}</span>
            </div>

            {/* TITLE (optional) */}
            {vm.title && (
              <h3 className="text-white text-lg md:text-xl font-semibold leading-snug mb-1 line-clamp-2">
                {vm.title}
              </h3>
            )}

            {/* CREATED AT */}
            <div className="flex items-center gap-2 text-slate-500">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatDate(vm.createdAt)}
            </div>
          </div>

          <span
            className={`px-4 py-2 rounded-xl border backdrop-blur-xl ${
              sentimentBadgeColors[vm.analysis.sentiment]
            }`}
          >
            <span className="mr-2">
              {sentimentIcons[vm.analysis.sentiment]}
            </span>
            {cap(vm.analysis.sentiment)}
          </span>
        </div>

        {/* Optional image */}
        {vm.imageDataUrl && (
          <div className="mb-5 overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
            <img
              src={vm.imageDataUrl}
              alt={vm.title ?? "Article image"}
              className="w-full h-56 object-cover object-center"
              loading="lazy"
            />
          </div>
        )}

        {/* CONTENT */}
        <div className="mb-6">
          <div className="text-slate-200 leading-relaxed p-5 bg-slate-700/30 rounded-xl border border-white/5 backdrop-blur-sm">
            {vm.displayContent}
          </div>

          {/* URL (separate + clean) */}
          {vm.url && (
            <div className="mt-3">
              <a
                href={vm.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 underline decoration-blue-600/40 underline-offset-4 break-all"
              >
                {vm.url}
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h6m0 0v6m0-6L10 16"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Analysis */}
        <div
          className={`bg-gradient-to-br ${
            sentimentColors[vm.analysis.sentiment]
          } rounded-2xl p-6 border backdrop-blur-xl mb-6 group-hover:border-white/20 transition-all duration-300`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h4 className="text-white">OpenAI Analysis</h4>
          </div>

          <div className="mb-5">
            <p className="text-slate-200 leading-relaxed">
              {vm.analysis.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-slate-400 mb-1">Sentiment</div>
              <div className="text-white flex items-center gap-2">
                <span>{sentimentIcons[vm.analysis.sentiment]}</span>
                <span>{cap(vm.analysis.sentiment)}</span>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-slate-400 mb-2">Confidence</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 shadow-lg"
                    style={{
                      width: `${Math.round(vm.analysis.confidence * 100)}%`
                    }}
                  />
                </div>
                <span className="text-white min-w-[3rem] text-right">
                  {Math.round(vm.analysis.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          {vm.analysis.keywords.length > 0 && (
            <div>
              <div className="text-slate-400 mb-3">Keywords</div>
              <div className="flex flex-wrap gap-2">
                {vm.analysis.keywords.map((keyword: string, i: number) => (
                  <span
                    key={`${keyword}-${i}`}
                    className="px-4 py-2 bg-slate-800/60 backdrop-blur-sm text-slate-200 rounded-lg border border-white/10 shadow-sm hover:border-white/20 transition-all"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-2">
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
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              Rate this analysis
            </span>
            <StarRating
              rating={hasUserRating(record) ? record.userRating ?? 0 : 0}
              onRatingChange={(rating) => onRatingChange(vm.id, rating)}
              interactive
              size="md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
