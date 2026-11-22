# Changelog

All notable changes to FinePrint, dated. Milestone 1 was the problem statement + design; everything below is the Milestone 2 work.

## 2026-11-22 (Milestone 2)

### Added
- **Working Chrome MV3 extension** in `code/` — strict TypeScript compiled with `tsc` (no bundler, no framework, no `useEffect`), load-unpacked ready with committed `dist/`.
- **Footer Link Scanner** (content script): finds `<footer>` / `role=contentinfo` / footer-classed blocks, extracts Terms/Privacy/Cookie/Legal links by keyword, pre-ticks footer links.
- **Page Text Extractor**: readable-text extraction from the live DOM (nav/header/footer/forms stripped).
- **Policy Fetcher + HTML→text**: cross-origin fetch from the extension origin with timeout; non-text content (PDF) and HTTP errors surfaced as honest in-panel messages.
- **Prompt pipeline** (`src/shared/`): section-aware chunker → **P1 Clause Risk Analyst** per chunk → grounding check (verbatim quote must exist in the source) → **P2 Plain-Language Merger** → report model; retry-once on bad JSON, local fallback merge if P2 fails after retries.
- **LLM client**: single OpenAI-compatible client (LiteLLM/Groq/OpenAI) with exponential backoff that honours the provider's "try again in Xs" hint.
- **Side panel UI**: link picker, progress states, risk cards with severity badges + verbatim citations, `not_mentioned` chips, copy-as-markdown, disclaimer.
- **Options page (BYOK)**: LiteLLM base URL / API key / model / temperature stored in `chrome.storage.local` — key never committed.
- **CLI demo runner** (`npm run demo`): runs the identical pipeline on `test-data/inputs/` and writes `.json` + `.md` outputs.
- **Prompt history**: `prompts/v1|v2|v3|final/` + `PROMPT_LOG.md` with observed, numbered results for all 4 versions (JSON validity 0/3 → 3/3; grounded flags 0 → 100%).
- **14-input test set** with saved real outputs (`test-data/`): 6 edge cases, 2 invalid inputs; 62/62 risk quotes grounded.
- **`REPORT.md`** (the 7 Milestone 2 sections, prompt sheets with real sample runs, module status table, test table), **`PLAN.md`**, **`docs/diagrams.md`**, real-run screenshots in `docs/screenshots/`.

### Fixed
- **HTTP 429 rate-limit failures** (Groq free tier, 8k tokens/min): first real batch run failed 8/12 inputs → added retry with backoff honouring the provider hint → re-run completed 13/13, 0 fallback merges.
- **Content-script module loading**: TypeScript emitted `export {}` into the classic-script bootstrap (SyntaxError in the page) → post-build step strips it; verified by loading the extension in headless Chromium.
- **Empty LLM content on reasoning models**: removed the `max_tokens: 2000` cap on P2 (observed `content: ""` + `finish_reason: length` while probing).

### Verified (real runs, not mocks)
- Footer scan on a live test site: 3/3 policy links found, non-policy links excluded.
- End-to-end through the actual side panel UI: footer links → fetch (dead link → honest HTTP 404 warning) → P1/P2 on Groq → 2 rendered report cards.
- Multi-chunk document (5,195 chars → 2 chunks) merged into one report with 8 grounded risks.
- Prompt-injection input resisted: injected instruction quoted and flagged, not obeyed.

## 2026-10-11 (Milestone 1)

- Repository created with the problem statement and suggested design in `README.md` (chunking, structured output, grounding, reading level, few-shot, safety — all now implemented in Milestone 2).
