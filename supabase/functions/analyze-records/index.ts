/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/* ========= Env ========= */
const SB_URL = Deno.env.get("SB_URL");
const SERVICE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// New: allow custom base URL & model (works with OpenRouter)
const OPENAI_BASE_URL =
  Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const AI_MODEL = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";

// Optional (used by OpenRouter; harmless for OpenAI)
const APP_URL = Deno.env.get("APP_URL") ?? "";
const APP_TITLE = Deno.env.get("APP_TITLE") ?? "SaaS Data Analysis App";

// CORS: allow configuring specific origin in deployment (fallback to *)
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "*";

function requireEnv(name: string, v?: string | null) {
  if (!v || !v.trim()) throw new Error(`Server misconfigured: ${name} not set`);
  return v;
}

const SUPABASE_URL = requireEnv("SB_URL", SB_URL);
const SERVICE_ROLE = requireEnv("SB_SERVICE_ROLE_KEY", SERVICE_KEY);
const OPENAI_KEY = requireEnv("OPENAI_API_KEY", OPENAI_API_KEY);

/* ========= CORS helpers ========= */
const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  // ensure CORS on every response
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

function withCors(init: ResponseInit = {}) {
  const headers = new Headers(init.headers ?? {});
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return { ...init, headers };
}

/* ========= Types ========= */
type RecordRow = { id: string; content: string };
type AiResult = {
  summary: string;
  keywords: string[];
  sentiment: "positive" | "neutral" | "negative";
  sentiment_score: number;
};

/* ========= Supabase helpers ========= */
async function supabaseGetPending(limit = 25): Promise<RecordRow[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/records`);
  url.searchParams.set("select", "id,content");
  url.searchParams.set("analyzed_at", "is.null");
  url.searchParams.set("order", "inserted_at.asc");
  url.searchParams.set("limit", String(limit));

  const r = await fetch(url, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!r.ok) {
    throw new Error(`Supabase select error ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as RecordRow[];
}

async function supabasePatchAnalysis(id: string, ai: AiResult) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/records?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({
      summary: ai.summary,
      keywords: ai.keywords,
      sentiment: ai.sentiment,
      sentiment_score: ai.sentiment_score,
      analyzed_at: new Date().toISOString(),
    }),
  });
  if (!r.ok) {
    throw new Error(`Supabase patch error ${r.status}: ${await r.text()}`);
  }
}

/* ========= OpenAI / OpenRouter ========= */

// Retry wrapper — do NOT retry on quota errors
async function callOpenAIWithRetry(
  text: string,
  tries = 3,
  baseDelayMs = 300,
): Promise<AiResult> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await callOpenAI(text);
    } catch (e) {
      lastErr = e;
      const msg = String(e instanceof Error ? e.message : e);

      // Bail immediately on quota/insufficient credits
      if (msg.includes("insufficient_quota")) break;

      // Retry only on 429 (non-quota) or 5xx
      if (/ (429|5\d{2}):/.test(msg)) {
        const delay =
          baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function callOpenAI(text: string): Promise<AiResult> {
  const sys =
    `You are a data analyst. Return STRICT JSON with keys:` +
    ` summary (string, <= 120 words),` +
    ` keywords (array of 3-8 concise keywords),` +
    ` sentiment (one of "positive","neutral","negative"),` +
    ` sentiment_score (float between -1 and 1).`;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
      // OpenRouter-friendly headers (ignored by OpenAI)
      "HTTP-Referer": APP_URL,
      "X-Title": APP_TITLE,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Analyze the following text:\n\n${text}` },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const jsonRes = await res.json();
  const content = jsonRes?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  if (
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.keywords) ||
    !["positive", "neutral", "negative"].includes(parsed.sentiment) ||
    typeof parsed.sentiment_score !== "number"
  ) {
    throw new Error(`OpenAI returned unexpected shape: ${content}`);
  }
  return parsed as AiResult;
}

/* ========= Handler ========= */
export const handler = async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", withCors());
  }

  // Self-test: sanity ping to the configured model/provider
  if (req.headers.get("x-selftest") === "1") {
    try {
      const ping = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
          "HTTP-Referer": APP_URL,
          "X-Title": APP_TITLE,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{ role: "user", content: "ping" }],
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
      const txt = await ping.text();
      return json({
        ok: ping.ok,
        status: ping.status,
        body: txt.slice(0, 600),
        provider: OPENAI_BASE_URL,
        model: AI_MODEL,
      });
    } catch (e) {
      return json({ ok: false, error: String(e) }, { status: 500 });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", withCors({ status: 405 }));
  }

  console.log("ENV CHECK", {
    SB_URL: !!Deno.env.get("SB_URL"),
    SB_SERVICE_ROLE_KEY: !!Deno.env.get("SB_SERVICE_ROLE_KEY"),
    OPENAI_API_KEY: !!Deno.env.get("OPENAI_API_KEY"),
    OPENAI_BASE_URL,
    AI_MODEL,
    CORS_ORIGIN,
  });

  try {
    const pending = await supabaseGetPending(20);
    if (!pending.length) {
      return json({ processed: 0, failed: 0, note: "no pending rows" });
    }

    let ok = 0,
      fail = 0;
    let firstError: string | null = null;

    for (const row of pending) {
      try {
        const ai = await callOpenAIWithRetry((row.content || "").slice(0, 4000));
        await supabasePatchAnalysis(row.id, ai);
        ok++;
        await new Promise((r) => setTimeout(r, 120));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!firstError) firstError = msg;
        console.error("Analyze error", row.id, msg);
        fail++;

        // Stop the batch early on quota to save requests
        if (msg.includes("insufficient_quota") || /OpenAI 429:/.test(msg)) break;
      }
    }

    return json({ processed: ok, failed: fail, firstError });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Fatal handler error:", message);
    return json({ error: message }, { status: 500 });
  }
};

Deno.serve(handler);
