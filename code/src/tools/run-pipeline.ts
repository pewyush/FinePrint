/**
 * CLI demo runner — runs the exact same pipeline as the extension on saved
 * plain-text inputs and writes the outputs next to them.
 *
 * Usage (from code/):   npm run demo -- [file.txt ...]
 * Env:  LITELLM_BASE_URL (default https://api.openai.com/v1)
 *       LITELLM_API_KEY  (required)
 *       LITELLM_MODEL    (default gpt-4o-mini)
 *       LITELLM_TEMPERATURE (default 0.2)
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { analyzeSource, type PipelineProgress } from "../shared/pipeline.js";
import type { LlmConfig } from "../shared/llm.js";
import type { SourceReport } from "../shared/types.js";

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.length === 0) {
    console.error(`Missing environment variable ${name}.`);
    process.exit(2);
  }
  return value;
}

/** Load the repo-root .env (KEY=VALUE lines) without overriding real env vars. */
function loadDotEnv(): void {
  for (const candidate of [".env", "../.env"]) {
    try {
      const raw = readFileSync(resolve(candidate), "utf8");
      for (const line of raw.split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || match[1] === undefined || match[2] === undefined) continue;
        if (process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
      return;
    } catch {
      // try the next candidate
    }
  }
}

function configFromEnv(): LlmConfig {
  loadDotEnv();
  return {
    baseUrl: env("LITELLM_BASE_URL", "https://api.openai.com/v1"),
    apiKey: env("LITELLM_API_KEY", env("LITELLM_KEY", "")),
    model: env("LITELLM_MODEL", "gpt-4o-mini"),
    temperature: Number(env("LITELLM_TEMPERATURE", "0.2")),
  };
}

function defaultInputDir(): string {
  const candidates = [resolve("test-data/inputs"), resolve("../test-data/inputs")];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // keep looking
    }
  }
  console.error("No test-data/inputs directory found. Pass input files explicitly.");
  process.exit(2);
}

function collectInputs(argv: string[]): string[] {
  const files: string[] = [];
  for (const arg of argv) {
    if (statSync(arg).isDirectory()) {
      for (const entry of readdirSync(arg)) {
        if (entry.endsWith(".txt")) files.push(join(arg, entry));
      }
    } else {
      files.push(arg);
    }
  }
  return files.sort();
}

function onProgress(progress: PipelineProgress): void {
  const extra = progress.total > 0 ? ` ${progress.done}/${progress.total}` : "";
  console.error(`  [${progress.phase}]${extra} ${progress.label}`);
}

async function main(): Promise<void> {
  const config = configFromEnv();
  const args = process.argv.slice(2);
  const inputs = args.length > 0 ? collectInputs(args) : collectInputs([defaultInputDir()]);
  if (inputs.length === 0) {
    console.error("No .txt inputs found.");
    process.exit(2);
  }

  const outputsDir = join(dirname(inputs[0] ?? "."), "..", "outputs");
  mkdirSync(outputsDir, { recursive: true });

  let failures = 0;
  for (const file of inputs) {
    const title = basename(file, ".txt");
    const text = readFileSync(file, "utf8");
    console.error(`\n=== ${title} (${text.length} chars) ===`);
    try {
      const started = Date.now();
      const report = await analyzeSource(
        { title, url: `local://${title}`, text },
        { config, onProgress },
      );
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      writeFileSync(
        join(outputsDir, `${title}.json`),
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8",
      );
      writeFileSync(join(outputsDir, `${title}.md`), markdownOf(report), "utf8");
      console.error(
        `  ok in ${elapsed}s — ${report.chunkCount} chunks, ${report.risks.length} risks, ` +
          `${report.droppedUngrounded} ungrounded dropped, ${report.failedChunks} failed`,
      );
    } catch (error) {
      failures += 1;
      console.error(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.error(`\nDone: ${inputs.length - failures}/${inputs.length} succeeded.`);
  process.exit(failures > 0 ? 1 : 0);
}

function markdownOf(report: SourceReport): string {
  const lines = [
    `# FinePrint report — ${report.title}`,
    "",
    report.url,
    "",
    report.summary,
    "",
  ];
  if (report.keyPoints.length > 0) {
    lines.push("## Key points");
    for (const point of report.keyPoints) lines.push(`- ${point}`);
    lines.push("");
  }
  lines.push("## Risks");
  for (const risk of report.risks) {
    lines.push(`- ${risk.category} (${risk.severity}) — ${risk.explanation}`);
    lines.push(`  > ${risk.clauseQuote}`);
  }
  lines.push("", `Not mentioned: ${report.notMentioned.join(", ")}`, "", `_${report.disclaimer}_`);
  return `${lines.join("\n")}\n`;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
