# @awareness.market/local

[![npm](https://img.shields.io/npm/v/@awareness.market/local?color=7b68ee)](https://www.npmjs.com/package/@awareness.market/local) [![LongMemEval R@5](https://img.shields.io/badge/LongMemEval_R%405-96.0%25-brightgreen)](https://arxiv.org/abs/2410.10813) [![Discord](https://img.shields.io/discord/1043506996906836079?color=5865F2&logo=discord&logoColor=white&label=Discord)](https://discord.com/invite/nMDrT538Qa)

Local-first AI agent memory system. No account needed.

## Benchmark: LongMemEval (ICLR 2025)

Awareness Memory is evaluated on **[LongMemEval](https://arxiv.org/abs/2410.10813)** — the industry standard benchmark for long-term conversational memory, published at ICLR 2025. 500 human-curated questions across 5 core capabilities.

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   Awareness Memory — LongMemEval Benchmark Results           ║
║   ─────────────────────────────────────────────────           ║
║                                                              ║
║   Benchmark:  LongMemEval (ICLR 2025)                       ║
║   Dataset:    500 human-curated questions                    ║
║   Variant:    LongMemEval_S (~115k tokens per question)      ║
║                                                              ║
║   ┌─────────────────────────────────────────────────┐        ║
║   │                                                 │        ║
║   │   Recall@1    77.6%    (388 / 500)              │        ║
║   │   Recall@3    91.8%    (459 / 500)              │        ║
║   │   Recall@5    96.0%    (480 / 500)  ◀ PRIMARY   │        ║
║   │   Recall@10   97.4%    (487 / 500)              │        ║
║   │                                                 │        ║
║   └─────────────────────────────────────────────────┘        ║
║                                                              ║
║   Method:     Hybrid RRF (BM25 + Semantic Vector Search)     ║
║   Embedding:  all-MiniLM-L6-v2 (384d)                       ║
║   LLM Calls:  0  (pure retrieval, no generation cost)        ║
║   Hardware:   Apple M1, 8GB RAM — 14 min total               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Leaderboard

```
┌─────────────────────────────────────────────────────────────┐
│          Long-Term Memory Retrieval — R@5 Leaderboard       │
│          LongMemEval (ICLR 2025, 500 questions)             │
├─────────────────────────────────┬───────────┬───────────────┤
│  System                         │  R@5      │  Note         │
├─────────────────────────────────┼───────────┼───────────────┤
│  MemPalace (ChromaDB raw)       │  96.6%    │  R@5 only *   │
│  ★ Awareness Memory (Hybrid)    │  96.0%    │  Hybrid RRF   │
│  OMEGA                          │  95.4%    │  QA Accuracy  │
│  Mastra (GPT-5-mini)            │  94.9%    │  QA Accuracy  │
│  Mastra (GPT-4o)                │  84.2%    │  QA Accuracy  │
│  Supermemory                    │  81.6%    │  QA Accuracy  │
│  Zep / Graphiti                 │  71.2%    │  QA Accuracy  │
│  GPT-4o (full context)          │  60.6%    │  QA Accuracy  │
├─────────────────────────────────┴───────────┴───────────────┤
│  * MemPalace 96.6% is Recall@5 only, not QA Accuracy.      │
│    Palace hierarchy was NOT used in the evaluation.         │
└─────────────────────────────────────────────────────────────┘
```

### Accuracy by Question Type

```
┌─────────────────────────────────────────────────────────────┐
│     Awareness Memory — R@5 by Question Type                 │
│                                                             │
│  knowledge-update        ████████████████████████████ 100%  │
│  multi-session           ███████████████████████████▋  98.5%│
│  single-session-asst     ███████████████████████████▌  98.2%│
│  temporal-reasoning      █████████████████████████▊    94.7%│
│  single-session-user     ████████████████████████▎     88.6%│
│  single-session-pref     ███████████████████████▏      86.7%│
│                                                             │
│  Overall                 █████████████████████████▉    96.0%│
│                                                             │
│  ┌───────────────────────────────────────────────┐          │
│  │  Ablation Study                               │          │
│  │  ─────────────────────────────────────────    │          │
│  │  Vector-only:   92.6%  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░     │          │
│  │  BM25-only:     91.4%  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░     │          │
│  │  Hybrid RRF:    96.0%  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░  ★  │          │
│  │                        Hybrid = +3% over any  │          │
│  │                        single method alone    │          │
│  └───────────────────────────────────────────────┘          │
│                                                             │
│  arxiv.org/abs/2410.10813          awareness.market         │
└─────────────────────────────────────────────────────────────┘
```

Zero LLM calls. Runs on Apple M1 8GB in 14 minutes. [Reproducible benchmark scripts →](https://github.com/everest-an/Awareness/tree/main/benchmarks/longmemeval)

---

## How it compares (honest)

| System | LongMemEval R@5 | Local / zero-API | Setup |
| --- | ---: | --- | --- |
| **Awareness Local** | **96.0%** | Yes | `npx @awareness.market/setup` |
| MemPalace | 96.6% | Yes | Manual |
| Mem0 | 49.0% (OSS) / 93.4% (self-reported) | Graph = paid | SDK + API key |
| Zep | 63.8% | SaaS | Cloud |

- **Workflow rules injection** — Awareness writes rules into your IDE config so the agent *automatically* uses memory (init at start, recall before work, record after changes). Mem0/Zep require manual orchestration.
- **Structured knowledge (13 categories)** — decisions, pitfalls, workflows, skills, preferences — not just raw snippets.
- **Zero LLM calls on retrieval** — hybrid FTS5 + vector, fully offline.

Full factual comparison: [Awareness vs. Alternatives](https://awareness.market/sdk-docs/ALTERNATIVES.md)

## Install



```bash
npm install -g @awareness.market/local
```

## Quick Start

```bash
# Start the local daemon
awareness-local start
```

```javascript
import { record, retrieve } from "@awareness.market/local/api";

await record({ content: "Refactored auth middleware." });
const result = await retrieve({ query: "What did we refactor?" });
console.log(result.results);
```

## Web Dashboard

The daemon serves a local web UI at **<http://localhost:37800/>** — browse your
memories, knowledge cards, tasks and sessions, and check index health.

It is available whenever the daemon is running, and only then. If the page does
not load, the daemon is not up: run `awareness-local start`.

```bash
# Print the dashboard URL and open it in your default browser
awareness-local dashboard

# Print the URL only (no browser launch) — handy over SSH
awareness-local dashboard --no-open
```

`awareness-local status` also prints the dashboard URL, and `GET /healthz`
returns it as the `ui_url` field. If you started the daemon on a custom port
(`awareness-local start --port 41000`), pass the same `--port` to `dashboard`
and `status`.

The UI is bound to localhost and is not exposed to your network.

### Re-running the setup wizard

The first-run wizard remembers that you finished it, so it will not reappear.
To walk through it again — after connecting cloud sync, or on a workspace you
set up differently — open:

```
http://localhost:37800/?onboarding=1
```

The parameter is removed from the address bar immediately, so refreshing or
bookmarking the page will not restart the wizard again.

## Perception (Record-Time Signals)

When you call `record()`, the response may include a `perception` array -- automatic signals the system surfaces without you asking. These are computed from pure DB queries (no LLM calls), adding less than 50ms of latency.

**Signal types:**

| Type | Description |
|------|-------------|
| `contradiction` | New content conflicts with an existing knowledge card |
| `resonance` | Similar past experience found in memory |
| `pattern` | Recurring theme detected (e.g., same category appearing often) |
| `staleness` | A related knowledge card hasn't been updated in a long time |
| `related_decision` | A past decision is relevant to what you just recorded |

```javascript
const result = await awareness_record({
  action: "remember",
  content: "Decided to use RS256 for JWT signing",
  insights: { knowledge_cards: [{ title: "JWT signing", category: "decision", summary: "..." }] }
});

if (result.perception) {
  for (const signal of result.perception) {
    console.log(`[${signal.type}] ${signal.message}`);
    // [pattern] This is the 4th 'decision' card -- recurring theme
    // [resonance] Similar past experience: "JWT auth migration"
  }
}
```

## What makes Awareness different

Most memory systems pick one extraction strategy. Awareness combines them:

- **Hybrid retrieval by default** — BM25 full-text + vector cosine + knowledge-graph 1-hop expansion, fused with Reciprocal Rank Fusion. 96.0% R@5 on LongMemEval, zero LLM calls on the retrieval side.
- **Salience-aware extraction** (v0.7.3+) — the client's own LLM self-scores every card on `novelty` / `durability` / `specificity`; cards scoring below 0.4 on either novelty or durability are dropped server-side. Framework metadata (`Sender (untrusted metadata)`, `turn_brief`, `[Operational context ...]`) is filtered before extraction runs, so raw logs never leak into your knowledge base.
- **Project isolation** — `X-Awareness-Project-Dir` header scopes memory per project. Your work memory doesn't leak into your personal memory, even on the same machine.
- **Learning over time** — Ebbinghaus-style card decay, skill crystallization from repeated patterns (F-032 / F-034), workspace graph self-prune to keep `index.db` bounded (F-050).
- **Zero-LLM backend** — all extraction runs on the client's LLM (Claude, GPT-4, Gemini, local Llama). The backend is a coordinator + storage layer; no inference costs pass through to you.
- **One memory, many clients** — same daemon reachable via Claude Code skills, OpenClaw plugin, npm / pip / ClawHub, and a plain MCP server. Install any one surface and the rest just work against the same memory.

See [`docs/analysis/MEMPALACE_COMPARISON_2026-04-17.md`](https://github.com/everest-an/Awareness/blob/main/docs/analysis/MEMPALACE_COMPARISON_2026-04-17.md) for the honest side-by-side against MemPalace (96.6% R@5 via raw verbatim storage) — what we'd adopt from their approach and what we keep from ours.

## License

Apache-2.0
