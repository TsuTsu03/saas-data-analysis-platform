/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/** ===== Env ===== */
const SB_URL = Deno.env.get("SB_URL");
const SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const APIFY_DATASET_ID = Deno.env.get("APIFY_DATASET_ID");

function requireEnv(name: string, v?: string | null) {
  if (!v || !v.trim()) throw new Error(`Server misconfigured: ${name} not set`);
  return v;
}
const SUPABASE_URL = requireEnv("SB_URL", SB_URL);
const SERVICE_ROLE = requireEnv("SB_SERVICE_ROLE_KEY", SERVICE_KEY);
const APIFY_KEY = requireEnv("APIFY_TOKEN", APIFY_TOKEN);
const DATASET_ID = requireEnv("APIFY_DATASET_ID", APIFY_DATASET_ID);

/** ===== Helpers ===== */
type AnyObj = Record<string, unknown>;
type Row = {
  apify_item_id?: string | null;
  source: string;
  url?: string | null;
  content: string;
  created_at: string;
};

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const get = (o: AnyObj, k: string) => o?.[k];

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Accept both `Link` and `url` (fallback) */
function pickUrl(o: AnyObj): string | null {
  const candidates = [get(o, "Link"), get(o, "url")];
  for (const v of candidates) {
    if (isStr(v) && v.startsWith("http")) return v;
  }
  return null;
}

/** Prefer "Source Name", else derive hostname from URL */
function pickSource(o: AnyObj): string {
  const srcName = get(o, "Source Name");
  if (isStr(srcName)) return srcName.trim();

  const u = pickUrl(o);
  if (u) {
    try {
      return new URL(u).hostname;
    } catch (_err) {
      console.log(_err)
    }
  }
  return "unknown";
}

/** Try to parse `Date` like "2025-11-07 12:03:48"; fallback to now() */
function pickCreatedAt(o: AnyObj): string {
  const raw = get(o, "Date");
  if (isStr(raw) && raw.trim()) {
    // Attempt ISO-ish parse: "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ssZ"
    const normalized = raw.trim().replace(" ", "T");
    const iso = /Z$/i.test(normalized) ? normalized : `${normalized}Z`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // `Published_time` is relative in sample ("3 days ago") -> not reliably parseable
  return new Date().toISOString();
}

/** Use `Id`, fallback to common Apify keys */
function pickApifyId(o: AnyObj): string | null {
  return (
    (get(o, "Id") as string | null) ??
    (get(o, "id") as string | null) ??
    (get(o, "_id") as string | null) ??
    null
  );
}

/** Targeted picker for your dataset (Title, Description, plus a little context) */
function pickContent(o: AnyObj): string {
  const parts: string[] = [];

  const title = get(o, "Title");
  const desc = get(o, "Description");
  const srcName = get(o, "Source Name");
  const published = get(o, "Published_time");

  if (isStr(title)) parts.push(title);
  if (isStr(desc)) parts.push(desc);

  // Optional helpful context (short)
  const ctx: string[] = [];
  if (isStr(srcName)) ctx.push(`Source: ${srcName}`);
  if (isStr(published)) ctx.push(`Published: ${published}`);

  if (ctx.length) parts.push(ctx.join(" · "));

  // As a last resort, scan other short string fields (excluding huge base64 Image)
  if (parts.join(" ").trim().length === 0) {
    for (const [k, v] of Object.entries(o)) {
      if (k === "Image") continue; // skip base64 blob
      if (isStr(v) && v.length <= 2000) parts.push(v);
    }
  }

  const joined = stripHtml(parts.join(" ").trim());
  return joined.slice(0, 20_000);
}

async function fetchApifyItems(limit = 100): Promise<AnyObj[]> {
  const url = new URL(`https://api.apify.com/v2/datasets/${DATASET_ID}/items`);
  url.searchParams.set("token", APIFY_KEY);
  url.searchParams.set("clean", "true");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Apify error ${res.status}: ${await res.text()}`);
  return (await res.json()) as AnyObj[];
}

async function upsertRows(rows: Row[]): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert error ${res.status}: ${await res.text()}`);

  const text = await res.text();
  if (!text) return rows.length;
  try {
    const json = JSON.parse(text);
    return Array.isArray(json) ? json.length : rows.length;
  } catch {
    return rows.length;
  }
}

/** ===== Handler ===== */
export const handler = async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const items = await fetchApifyItems(100);

    const rows: Row[] = [];
    for (const it of items) {
      const content = pickContent(it);
      if (!content) continue;

      rows.push({
        apify_item_id: pickApifyId(it),
        source: pickSource(it),
        url: pickUrl(it),
        content,
        created_at: pickCreatedAt(it),
      });
    }

    if (!rows.length) {
      // Return some diagnostics to see the incoming keys
      const sample = items[0] ?? {};
      return Response.json({
        insertedCount: 0,
        fetchedCount: items.length,
        normalizedCount: 0,
        note: "no non-empty content found",
        sampleKeys: Object.keys(sample).slice(0, 50),
        sampleItem: sample,
      });
    }

    const insertedCount = await upsertRows(rows);
    return Response.json({
      insertedCount,
      fetchedCount: items.length,
      normalizedCount: rows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Fatal handler error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
};

Deno.serve(handler);
