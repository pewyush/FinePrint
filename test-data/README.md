# test-data — the 14 inputs behind REPORT.md §4

Every file in `inputs/` was run through the **real shipped pipeline** against the live API; the results are saved in `outputs/` (`.json` = structured report exactly as the side panel receives it, `.md` = human-readable copy).

## Regenerate

```bash
cd code
npm run demo            # reads repo-root .env automatically (LITELLM_KEY, LITELLM_MODEL, LITELLM_BASE_URL)
```

An input with no `outputs/<name>.*` file failed by design (see input 12).

## Inputs

| # | File | Type | What it exercises |
|---|---|---|---|
| 1 | `01_shopeasy_terms.txt` | Normal | auto-renewal, arbitration, liability cap, data sharing, unilateral changes |
| 2 | `02_shopeasy_privacy.txt` | Normal | data collection / sharing policy |
| 3 | `03_streamvault_terms.txt` | Normal | auto-renewal + termination + venue clause |
| 4 | `04_fitpulse_terms.txt` | Normal | health data + arbitration + cancellation fee |
| 5 | `05_bidbarn_refunds.txt` | Normal | refund / cancellation policy focus |
| 6 | `06_cloudkit_master_terms.txt` | Normal | liability cap, "as is" warranty, unilateral modification |
| 7 | `07_microterms_short.txt` | **Edge** | 153-char document — must still produce a grounded report |
| 8 | `08_loudsite_allcaps.txt` | **Edge** | all-caps wall of text — output must be normal-case and readable |
| 9 | `09_sneakyco_injection.txt` | **Edge** | prompt injection embedded in the document — must not be obeyed |
| 10 | `10_desideal_hinglish.txt` | **Edge** | mixed English + Hinglish — explanations must stay plain English |
| 11 | `11_garbage_idk.txt` | **Invalid** | "idk lol" — no invented risks, everything under `not_mentioned` |
| 12 | `12_empty_file.txt` | **Invalid** | empty file — clear error, no crash, no output written |
| 13 | `13_long_multichunk_terms.txt` | **Edge** | 5,195 chars → 2 chunks → P2 merge into one report |
| 14 | `14_pure_hindi_terms.txt` | **Edge** | Devanagari-only document — English output expected |

## Headline results (from `outputs/`)

- **13/14 inputs produced a report** (input 12 fails earlier at chunking, by design).
- **62 risk flags emitted, 62 grounded against the source, 0 dropped, 0 failed chunks.**
- Injection input (9): injected instruction quoted and flagged, never obeyed.
- Multi-chunk input (13): exactly 2 chunks, merged into 1 report, 8 grounded flags.

Saved raw prompt-experiment outputs (v1 prose vs v2 JSON vs v3 grounded JSON) are quoted in `PROMPT_LOG.md`.
