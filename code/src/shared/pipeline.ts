/**
 * The prompt pipeline: chunk → P1 (per chunk) → grounding → P2 (merge).
 * Pure (no DOM, no chrome.*): used by the side panel and by the CLI runner.
 */

import { chunkText } from "./chunker.js";
import { chatCompletion, LlmError, type LlmConfig } from "./llm.js";
import { OutputParseError, parseP1, parseP2 } from "./parse.js";
import { buildP1Messages, buildP2Messages } from "./prompts.js";
import {
  CATEGORY_IDS,
  DISCLAIMER,
  type ChunkAnalysis,
  type RiskFlag,
  type Severity,
  type SourceReport,
} from "./types.js";

export interface PipelineSource {
  title: string;
  url: string;
  text: string;
}

export interface PipelineProgress {
  phase: "chunking" | "p1" | "p2";
  done: number;
  total: number;
  label: string;
}

export type ProgressHandler = (progress: PipelineProgress) => void;

export interface PipelineOptions {
  config: LlmConfig;
  onProgress?: ProgressHandler;
  maxChunks?: number;
}

const MAX_CHUNKS_DEFAULT = 24;

function reportError(context: string, error: unknown): Error {
  if (error instanceof LlmError || error instanceof OutputParseError) {
    return new Error(`${context}: ${error.message}`);
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`${context}: ${detail}`);
}

/** One P1 call with a single corrective retry when the model returns unusable JSON. */
async function runP1(
  config: LlmConfig,
  source: PipelineSource,
  chunk: string,
  index: number,
  total: number,
): Promise<{ analysis: ChunkAnalysis; dropped: number }> {
  const messages = buildP1Messages({
    docTitle: source.title,
    chunkText: chunk,
    chunkIndex: index + 1,
    chunkCount: total,
  });
  try {
    const first = await chatCompletion(config, messages);
    return parseP1(first, chunk);
  } catch (firstError) {
    if (firstError instanceof OutputParseError) {
      const retryMessages = [
        ...messages,
        { role: "user" as const, content: "Your previous reply was not valid JSON. Return ONLY the JSON object, nothing else." },
      ];
      const second = await chatCompletion(config, retryMessages);
      return parseP1(second, chunk);
    }
    throw reportError(`Chunk ${index + 1} of ${source.title}`, firstError);
  }
}

/** Last-resort merge used when P2 itself fails: plain concatenation, flagged in the UI. */
function mergeLocally(analyses: ChunkAnalysis[], source: PipelineSource): SourceReport {
  const seen = new Set<string>();
  const risks: RiskFlag[] = [];
  let dropped = 0;
  for (const analysis of analyses) {
    for (const raw of analysis.risks) {
      const key = `${raw.category}::${raw.clause_quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      risks.push({
        category: raw.category as RiskFlag["category"],
        severity: raw.severity as Severity,
        clauseQuote: raw.clause_quote,
        explanation: raw.explanation,
        grounded: true,
      });
      dropped += 0;
    }
  }
  const flagged = new Set(risks.map((risk) => risk.category));
  return {
    title: source.title,
    url: source.url,
    summary: analyses.map((analysis) => analysis.chunkSummary).join(" ").slice(0, 900),
    keyPoints: [],
    risks,
    notMentioned: CATEGORY_IDS.filter((id) => !flagged.has(id)),
    chunkCount: analyses.length,
    failedChunks: 0,
    droppedUngrounded: dropped,
    fetchedChars: source.text.length,
    mergedLocally: true,
    disclaimer: DISCLAIMER,
  };
}

/** Run the full pipeline over one document and return a render-ready report. */
export async function analyzeSource(
  source: PipelineSource,
  options: PipelineOptions,
): Promise<SourceReport> {
  const { config, onProgress } = options;
  const maxChunks = options.maxChunks ?? MAX_CHUNKS_DEFAULT;

  onProgress?.({ phase: "chunking", done: 0, total: 0, label: `Splitting "${source.title}"` });
  const chunks = chunkText(source.text).slice(0, maxChunks);
  if (chunks.length === 0) {
    throw new Error(`No readable text found in "${source.title}".`);
  }

  const analyses: ChunkAnalysis[] = [];
  let failedChunks = 0;
  let droppedUngrounded = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i] ?? "";
    onProgress?.({
      phase: "p1",
      done: i,
      total: chunks.length,
      label: `Analysing chunk ${i + 1}/${chunks.length}`,
    });
    try {
      const { analysis, dropped } = await runP1(config, source, chunk, i, chunks.length);
      analyses.push(analysis);
      droppedUngrounded += dropped;
    } catch (error) {
      // Honest failure: record the chunk as failed and keep going with the rest.
      failedChunks += 1;
      if (i === 0 && chunks.length === 1) throw error;
    }
  }

  if (analyses.length === 0) {
    throw new Error(`All ${failedChunks} chunk(s) failed for "${source.title}".`);
  }

  onProgress?.({ phase: "p2", done: 0, total: 1, label: "Merging into one report" });
  let summary: string;
  let keyPoints: string[];
  let risks: RiskFlag[];
  let notMentioned: SourceReport["notMentioned"];
  let mergedLocally = false;

  try {
    const mergeMessages = buildP2Messages({ docTitle: source.title, analyses });
    const mergeRaw = await chatCompletion(config, mergeMessages);
    const { report, dropped } = parseP2(mergeRaw, source.text);
    summary = report.summary;
    keyPoints = report.keyPoints;
    notMentioned = report.notMentioned;
    droppedUngrounded += dropped;

    // P2 must copy P1 risks verbatim; anything that drifted fails grounding and is dropped.
    const flagged = new Set<string>();
    risks = report.risks.map((raw) => ({
      category: raw.category as RiskFlag["category"],
      severity: raw.severity as Severity,
      clauseQuote: raw.clause_quote,
      explanation: raw.explanation,
      grounded: true,
    }));
    for (const risk of risks) flagged.add(risk.category);
    if (notMentioned.length === 0) {
      notMentioned = CATEGORY_IDS.filter((id) => !flagged.has(id));
    }
    onProgress?.({ phase: "p2", done: 1, total: 1, label: "Merged" });
  } catch (error) {
    if (error instanceof LlmError || error instanceof OutputParseError) {
      const local = mergeLocally(analyses, source);
      summary = local.summary;
      keyPoints = local.keyPoints;
      risks = local.risks;
      notMentioned = local.notMentioned;
      mergedLocally = true;
      droppedUngrounded += local.droppedUngrounded;
    } else {
      throw error;
    }
  }

  risks.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  return {
    title: source.title,
    url: source.url,
    summary,
    keyPoints,
    risks: risks.slice(0, 8),
    notMentioned,
    chunkCount: chunks.length,
    failedChunks,
    droppedUngrounded,
    fetchedChars: source.text.length,
    mergedLocally,
    disclaimer: DISCLAIMER,
  };
}

function severityRank(severity: Severity): number {
  switch (severity) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}
