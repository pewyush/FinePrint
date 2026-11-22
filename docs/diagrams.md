# FinePrint — Diagrams (Milestone 2, Section 2b)

Same four diagrams as `REPORT.md` §2(b), kept here as the standalone `docs/` copy. Mermaid source renders on GitHub; for the PDF, export these as images or paste the source into a mermaid renderer.

## 1 — Prompt workflow

```mermaid
flowchart TD
    A[Policy document text] --> B[Chunker<br/>section-aware, ~3200 chars]
    B --> C[Chunk 1..n]
    C --> D["P1 — Clause Risk Analyst<br/>(1 call per chunk, temp 0.2)"]
    D --> E{JSON valid?}
    E -->|no| D2[Retry once with<br/>'return only JSON' note]
    D2 --> E
    E -->|yes| F{Quote verbatim in<br/>this chunk?}
    F -->|no| G[Drop flag<br/>count as ungrounded]
    F -->|yes| H[Chunk analysis JSON]
    H --> I["P2 — Plain-Language Merger<br/>(1 call per document)"]
    I --> J[Final report: summary,<br/>key points, ≤8 risks, not_mentioned]
    G --> I
```

## 2 — Task decomposition

```mermaid
flowchart LR
    subgraph Content[Content script - isolated world]
        S[Footer Link Scanner] --> X[Page Text Extractor]
    end
    subgraph Panel[Side panel - vanilla TS]
        UI[Link picker UI] --> COL[Policy Fetcher + HTML to text]
        COL --> PIPE[Shared pipeline]
        PIPE --> R[Report renderer]
    end
    subgraph Shared[Shared pure modules]
        PIPE --> CH[Chunker]
        CH --> P1[P1 prompt]
        P1 --> PAR[Parser + grounding]
        PAR --> P2[P2 prompt]
    end
    subgraph Config[Options page]
        OPT[LiteLLM base URL / key / model / temperature]
    end
    OPT --> PIPE
    S --> UI
```

## 3 — Input–output flow

```mermaid
flowchart LR
    IN["User opens a page<br/>and clicks FinePrint"] --> F1["Footer links found<br/>(terms, privacy, cookies…)"]
    F1 --> F2["User ticks sources<br/>+ optional 'this page'"]
    F2 --> F3["Documents fetched<br/>(extension origin)"]
    F3 --> F4["Chunk → P1 → P2<br/>(JSON, grounded)"]
    F4 --> OUT["Side panel report:<br/>plain summary + risk cards<br/>with verbatim citations"]
    OUT --> COPY[Copy as Markdown]
```

## 4 — System architecture

```mermaid
flowchart TD
    subgraph Browser[Chrome MV3]
        BG[Background service worker<br/>action click → opens side panel]
        CS[Content script<br/>dist/content-bootstrap.js → ES module graph]
        SP[Side panel<br/>sidepanel.html + dist/sidepanel/*]
        OP[Options page<br/>options.html + dist/options/*]
        ST[(chrome.storage.local<br/>BYOK config)]
    end
    SP -->|chrome.tabs.sendMessage<br/>FP_SCAN / FP_EXTRACT| CS
    OP --> ST
    SP --> ST
    SP -->|fetch policy URLs<br/>host_permissions| WEB[(Any website)]
    SP -->|POST /chat/completions<br/>OpenAI-compatible| LLM["LiteLLM / Groq / OpenAI<br/>(user-supplied base URL + key)"]
    CS -. injects into every http/https page .-> WEB
```

*No agent loop or RAG pipeline: FinePrint does not use agents or retrieval — it is a deterministic two-prompt pipeline over the document's own text.*
