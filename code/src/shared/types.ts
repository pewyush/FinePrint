/** Domain types shared by the extension UI, the pipeline and the CLI runner. */

export type RiskCategory =
  | "data_sharing"
  | "auto_renewal"
  | "arbitration"
  | "cancellation"
  | "liability"
  | "unbounded_changes"
  | "other";

export type Severity = "high" | "medium" | "low" | "info";

/** Risk exactly as it comes out of the model (snake_case, unvalidated). */
export interface RawRisk {
  category: string;
  severity: string;
  clause_quote: string;
  explanation: string;
}

/** Validated output of one P1 (per-chunk) call. */
export interface ChunkAnalysis {
  chunkSummary: string;
  risks: RawRisk[];
  notMentioned: RiskCategory[];
}

/** Validated output of the P2 (merge) call. */
export interface MergedReport {
  summary: string;
  keyPoints: string[];
  risks: RawRisk[];
  notMentioned: RiskCategory[];
}

/** A risk flag after validation + grounding (quote verified against source text). */
export interface RiskFlag {
  category: RiskCategory;
  severity: Severity;
  clauseQuote: string;
  explanation: string;
  grounded: boolean;
}

/** Final per-document report rendered in the side panel. */
export interface SourceReport {
  title: string;
  url: string;
  summary: string;
  keyPoints: string[];
  risks: RiskFlag[];
  notMentioned: RiskCategory[];
  chunkCount: number;
  failedChunks: number;
  droppedUngrounded: number;
  fetchedChars: number;
  mergedLocally: boolean;
  disclaimer: string;
}

export const DISCLAIMER =
  "This is an automated plain-language summary, not legal advice. Check the original document for anything that matters to you.";

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  data_sharing: "Data sharing",
  auto_renewal: "Auto-renewal / billing",
  arbitration: "Arbitration / dispute",
  cancellation: "Cancellation / refunds",
  liability: "Liability",
  unbounded_changes: "Company can change terms freely",
  other: "Other",
};

export const CATEGORY_IDS: RiskCategory[] = [
  "data_sharing",
  "auto_renewal",
  "arbitration",
  "cancellation",
  "liability",
  "unbounded_changes",
  "other",
];

export const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};
