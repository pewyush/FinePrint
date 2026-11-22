# FinePrint

**Chrome extension that reads a website's footer, pulls its Terms & Conditions / Privacy Policy, and explains them in plain language — with every risk flag citing the exact clause it came from.**

Problem Pool C18 (T&Cs in plain language) · SCSE4041 Mini Project · Team of 3 · Milestones: 11 Oct, 2 Nov, 1 Dec

## What it does

1. You open any website and click **FinePrint** — the side panel opens.
2. The content script jumps to the **footer** (where every site hides its legal links) and collects Terms / Privacy / Cookie / Legal links.
3. You tick the documents you care about (footer links are pre-ticked; "this page" is offered when you are already on a policy page).
4. The extension fetches each document, splits it into chunks, and runs a **two-prompt pipeline**:
   - **P1 — Clause Risk Analyst** (once per chunk): structured JSON with risk flags in 7 categories, each with a **verbatim quote** that is verified against the source text (ungrounded quotes are dropped, never shown).
   - **P2 — Plain-Language Merger** (once per document): de-duplicates flags, writes a 14-year-old-readable summary and 3–6 key points, and lists categories that are *not mentioned* instead of guessing.
5. The panel shows severity-tagged risk cards, citations, a "not legal advice" disclaimer, and a **Copy report** button.

Safety: the policy text is wrapped in `<untrusted_document>` and treated strictly as data — instructions injected inside a T&C page are ignored and flagged (verified: test input 9).

## Repository layout

```
README.md            ← this file (project, run instructions, team, links)
PLAN.md              ← the build plan (architecture, modules, deliverables)
REPORT.md            ← Milestone 2 report — the 7 required sections (source of the PDF)
PROMPT_LOG.md        ← prompt iteration log: 4 versions, what changed and observed results
CHANGELOG.md         ← dated list of changes since Milestone 1
prompts/
  v1/ v2/ v3/        ← older prompt versions (one file per prompt)
  final/             ← final prompts: P1_clause_risk_analyst.txt, P2_plain_language_merger.txt
code/                ← the Chrome extension (strict TypeScript, tsc, no framework, no useEffect)
  src/               ← content/ sidepanel/ options/ background/ fetch/ shared/ tools/
  dist/              ← compiled JS (committed so the extension loads without building)
  manifest.json      ← MV3 manifest
test-data/
  inputs/            ← 14 test inputs (normal / edge / invalid)
  outputs/           ← saved real outputs (.json + .md) for every input that produces one
docs/
  diagrams.md        ← prompt workflow, task decomposition, I/O flow, architecture (mermaid)
  screenshots/       ← real-run screenshots used in REPORT.md §4
.env                 ← your API key (git-ignored — never commit it)
```

## Quick start

```bash
cd code
npm install
npm run build          # tsc → dist/ (plus a post-build fix for the content-script loader)
```

1. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **`code/`** folder.
2. Click **FinePrint** → **Settings** (options page) and enter your endpoint — **BYOK**, the key stays in this browser only:

   | Field | LiteLLM proxy | Groq direct |
   |---|---|---|
   | LiteLLM base URL | `http://localhost:4000/v1` | `https://api.groq.com/openai/v1` |
   | Model | `groq/openai/gpt-oss-120b` | `openai/gpt-oss-120b` |
   | API key | your key | your key |

3. Open any website → click **FinePrint** → tick sources → **Explain in plain language**.

Any OpenAI-compatible endpoint works (LiteLLM, Groq, OpenAI, …) — the client speaks `POST {baseUrl}/chat/completions`.

## CLI demo (regenerates `test-data/outputs/`)

```bash
cd code
# reads .env from the repo root automatically (LITELLM_KEY / LITELLM_MODEL / LITELLM_BASE_URL)
npm run demo                                   # all inputs in test-data/inputs/
npm run demo -- ../test-data/inputs/01_shopeasy_terms.txt   # one input
```

## Tests

There is intentionally **no unit-test suite** in this repo (per project decision). Testing evidence lives in **`REPORT.md` §4**: a 14-input test table (6 edge, 2 invalid) with expected vs. actual outputs, plus real-run screenshots — every output in `test-data/outputs/` was produced by the shipped pipeline against the live API.

## Team

| Enrollment | Name | Main task |
|---|---|---|
| S24CSEU1520 | Anidh Kaushik | Prompt design (P1/P2, versions v1–v3) |
| S24CSEU1488| Harshit Batra | Extension engineering (scanner, side panel, options) |
| S24CSEU1505| Piyush Khulbey | Pipeline & evaluation (chunker, grounding, runner, test set) |

**Links:** Prototype: [Q11] · Repository: [Q12] · Reel: [Q13] (90–150 s)

> Never commit API keys: `.env` is git-ignored, the extension stores its key in `chrome.storage.local` only.
