// src/data/types.ts
export type DBRecord = {
  id: string;
  source: string;
  url: string | null;
  content: string;
  created_at: string;
  summary: string | null;
  keywords: string[] | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  sentiment_score: number | null;   // -1..1
  analyzed_at: string | null;
};

export type AnalyzedRecord = {
  id: string;
  source: string;
  url?: string | null;
  content: string;
  created_at: string;
  userRating?: number;
  analysis: {
    summary: string;
    keywords: string[];
    sentiment: "positive" | "neutral" | "negative";
    confidence: number; // 0..1
  };
};
