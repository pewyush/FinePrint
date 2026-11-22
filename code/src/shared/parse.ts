/**
 * Model output → validated structures, plus grounding:
 * every risk quote must appear verbatim in the source text it claims to come from.
 */

import {
  CATEGORY_IDS,
  type ChunkAnalysis,
  type MergedReport,
  type RawRisk,
  type RiskCategory,
  type Severity,
} from "./types.js";

export class OutputParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputParseError";
  }
}

function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1];
  return raw;
}

/** Pull the first balanced JSON object out of a model response. */
export function extractJsonObject(raw: string): unknown {
  const cleaned = stripFences(raw).trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new OutputParseError("No JSON object found in model output.");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          break;
        }
      }
    }
  }
  throw new OutputParseError("Model output was not a valid JSON object.");
}

export function normalizeSeverity(value: unknown): Severity {
  const text = String(value ?? "").toLowerCase().trim();
  if (text === "high" || text === "critical") return "high";
  if (text === "medium" || text === "moderate") return "medium";
  if (text === "low") return "low";
  return "info";
}

export function normalizeCategory(value: unknown): RiskCategory {
  const text = String(value ?? "").toLowerCase().trim();
  return (CATEGORY_IDS as string[]).includes(text) ? (text as RiskCategory) : "other";
}

/** Collapse whitespace + case so a slightly re-spaced quote still grounds. */
function normalizeForSearch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when the quote appears (verbatim modulo whitespace/case) in the source. */
export function isGrounded(quote: string, sourceText: string): boolean {
  const needle = normalizeForSearch(quote);
  if (needle.length < 12) return false;
  return normalizeForSearch(sourceText).includes(needle);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function validateRisks(value: unknown, sourceText: string): { risks: RawRisk[]; dropped: number } {
  if (!Array.isArray(value)) return { risks: [], dropped: 0 };
  const risks: RawRisk[] = [];
  let dropped = 0;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const quote = typeof record.clause_quote === "string" ? record.clause_quote.trim() : "";
    const explanation = typeof record.explanation === "string" ? record.explanation.trim() : "";
    if (quote.length === 0 || explanation.length === 0) continue;
    if (!isGrounded(quote, sourceText)) {
      dropped += 1;
      continue;
    }
    risks.push({
      category: typeof record.category === "string" ? record.category : "other",
      severity: typeof record.severity === "string" ? record.severity : "info",
      clause_quote: quote,
      explanation,
    });
  }
  return { risks, dropped };
}

export interface ParsedChunk {
  analysis: ChunkAnalysis;
  dropped: number;
}

/** Validate one P1 response against the chunk it analysed. */
export function parseP1(raw: string, chunkText: string): ParsedChunk {
  const object = extractJsonObject(raw) as Record<string, unknown>;
  const { risks, dropped } = validateRisks(object.risks, chunkText);
  const summary =
    typeof object.chunk_summary === "string" && object.chunk_summary.trim().length > 0
      ? object.chunk_summary.trim()
      : "(no summary returned)";
  return {
    analysis: {
      chunkSummary: summary,
      risks,
      notMentioned: asStringArray(object.not_mentioned).map(normalizeCategory),
    },
    dropped,
  };
}

export interface ParsedMerge {
  report: MergedReport;
  dropped: number;
}

/** Validate the P2 response against the full document text. */
export function parseP2(raw: string, sourceText: string): ParsedMerge {
  const object = extractJsonObject(raw) as Record<string, unknown>;
  const { risks, dropped } = validateRisks(object.risks, sourceText);
  const summary =
    typeof object.summary === "string" && object.summary.trim().length > 0
      ? object.summary.trim()
      : "(no summary returned)";
  return {
    report: {
      summary,
      keyPoints: asStringArray(object.key_points).map((point) => point.trim()).filter(Boolean),
      risks,
      notMentioned: asStringArray(object.not_mentioned).map(normalizeCategory),
    },
    dropped,
  };
}
