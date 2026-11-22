# FinePrint — Milestone 2 Plan

Date: 2026-11-22 · Deadline: 2026-11-22 11:59 PM · Team: 3 members · Problem Pool C18

## 1. Goal

A Chrome extension (Manifest V3, TypeScript, no React / no `useEffect`) that:

1. Scans the page the user is on, jumps to the **footer**, and collects links to Terms &
   Conditions / Privacy / Policy / Legal pages (every site puts them there).
2. Fetches those linked documents, splits them into chunks, and runs a **prompt pipeline**
   (chunk → structured JSON risk flags → merged plain-language report).
3. Shows the result in a **side panel**: a 14-year-old-readable summary, risk flags by
   category with severity, every flag citing the exact clause it came from, and
   "not mentioned" instead of guessing.
4. Calls any **LiteLLM-compatible / OpenAI-compatible endpoint** through one small client
   — base URL, key and model are entered by the user on the options page (key never
   committed, never in the repo).

## 2. Architecture

```
User opens side panel
        │
        ▼
content script (isolated world)
  · finds <footer> / [role=contentinfo] / last landmark block
  · collects + keyword-filters policy links (terms, tos, privacy, legal, eula, …)
  · extracts the current page's rendered text
        │  chrome.runtime messages
        ▼
side panel (ES module app, vanilla TS DOM)
  · link picker UI → Analyze
  · fetches cross-origin policy pages (extension origin + host_permissions)
  · HTML → readable text (DOMParser)
        │
        ▼
shared pipeline (pure modules, also used by the CLI demo runner)
  chunker → P1 (per-chunk, JSON) → grounding check → P2 (merge) → report model
        │
        ▼
LiteLLM / OpenAI-compatible  POST {baseUrl}/chat/completions
```

No framework, therefore no `useEffect`: every UI is an explicit `render(state)` over
plain DOM nodes (`textContent` only — page text is never injected as HTML).

## 3. Modules (status table source = Q20)

| Module | What it does | Where |
|---|---|---|
| Footer Link Scanner | Locates the footer, extracts policy links, filters by keyword | `src/content/scan.ts` |
| Page Text Extractor | Pulls visible text from the live DOM | `src/content/extract.ts` |
| Policy Fetcher | Cross-origin fetch of linked documents + HTML→text | `src/fetch/fetchPolicy.ts`, `src/fetch/htmlToText.ts` |
| Chunker | Section-aware splitting (headings/paragraphs, size budget) | `src/shared/chunker.ts` |
| Prompt Pipeline | Builds P1/P2 messages (templates, few-shot, injection guard) | `src/shared/prompts.ts` |
| LLM Client | Single LiteLLM/OpenAI-compatible chat-completions client | `src/shared/llm.ts` |
| Output Parser + Grounding | JSON extraction/repair, quote-substring verification | `src/shared/parse.ts` |
| Side Panel Viewer | Renders summary, risk cards, citations, copy button | `src/sidepanel/*` |
| Options (LiteLLM config) | Base URL / key / model / temperature, stored locally | `src/options/*`, `src/shared/config.ts` |
| CLI demo runner | Runs the same pipeline on saved `.txt` inputs (reel + regenerating real outputs) | `src/tools/run-pipeline.ts` |

## 4. Prompt design (grading core)

- **P1 — Clause Risk Analyst** (one call per chunk): returns JSON
  `{summary, reading_notes, risks:[{category, severity, clause_quote, explanation}]}`.
  Categories: data_sharing, auto_renewal, arbitration, cancellation, liability,
  unbounded_changes, other. Severity: high/medium/low/info. Every risk must carry a
  **verbatim** `clause_quote` from the chunk, or be dropped; anything absent →
  `"not mentioned"`, never a guess.
- **P2 — Plain-Language Merger** (one call total): merges chunk JSONs, removes duplicate
  flags, writes the top-level summary at a ~14-year-old reading level, keeps citations.
- Reading level, few-shot examples, "not legal advice" footer, and the
  **injection guard** (page text wrapped in `<untrusted_document>` delimiters; system
  prompt states the text is data and any instructions inside it must be ignored) are
  baked into both prompts.

Counts for the form: **Q10 = 2 prompts** (P1, P2) · **Q17 = 14 test inputs** ·
**Q18 = 4 prompt versions** (P1 v1–v3, P2 v1).

## 5. Build & run

```bash
cd code
npm install
npm run build          # tsc → dist/ (plain TypeScript, no bundler)
# chrome://extensions → Developer mode → Load unpacked → select the code/ folder
# open the extension's Options → enter LiteLLM base URL, key, model → Save
# visit any site → click FinePrint → side panel → Analyze
```

`npm run demo` runs the pipeline from the CLI on `test-data/` inputs using
`LITELLM_BASE_URL` / `LITELLM_API_KEY` / `LITELLM_MODEL` env vars (never committed).

## 6. Deliverables checklist (Milestone 2)

- [x] PLAN.md (this file)
- [x] Working extension in `code/` (TypeScript, modular, no useEffect)
- [x] Prompt versions `prompts/v1|v2|v3|final/` + `PROMPT_LOG.md` (iteration log with observed results)
- [x] `REPORT.md` — the 7 PDF sections in order, module status table, test table (14 rows, 6 edge + 2 invalid), counts, contribution table template
- [x] `docs/diagrams.md` — prompt workflow, task decomposition, I/O flow, architecture (mermaid)
- [x] `test-data/` — test inputs + saved outputs
- [x] `README.md` (run instructions, links, members) + `CHANGELOG.md` (dated since Milestone 1)
- [ ] Your part: paste real run outputs into `test-data/` (needs your LiteLLM key), record the reel, fill team placeholders in `REPORT.md`.

## 7. Risks / edge cases handled

- Footer behind JS / no `<footer>` → fallback to last landmark block + `role=contentinfo`.
- Policy link points to a PDF or a login wall → reported as "could not fetch", pipeline runs on what it got.
- Model returns broken JSON → repair pass (fence-strip / brace-scan); if still invalid, chunk is retried once, then marked failed in the UI (honest failure, not hidden).
- Prompt injection inside the T&C text → delimiters + system-level rule; page text treated strictly as data.
- Cross-origin fetch blocked → done from the extension origin (host permissions), not the page context.
