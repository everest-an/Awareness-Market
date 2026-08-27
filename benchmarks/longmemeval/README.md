# LongMemEval Benchmark Scripts

Two harnesses, two published runs — both fully reproducible on any machine.

| Harness | Script | Published result |
| --- | --- | --- |
| **Daemon path** (production pipeline: `unifiedCascadeSearch` + live SQLite + FTS5 + embeddings) | `run_f053_daemon_path.mjs` | **R@5 = 96.0% (480 / 500)** — 2026-08, primary |
| Independent Python harness (hybrid RRF sweep) | `run_benchmark.py` (+ `run_experiments.py`) | R@5 = 95.6% (478 / 500) — 2026-04 |

- **Dataset**: [xiaowu0162/longmemeval-cleaned](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned) on HuggingFace (LongMemEval_S, 500 questions, ~115k tokens each)
- **Hardware for the published runs**: Apple M1, 8 GB RAM — no GPU, no hosted API
- **Embeddings**: `multilingual-e5-small` (daemon production model) / `all-MiniLM-L6-v2` (2026-04 harness)
- **LLM calls on retrieval**: 0

Full methodology and honest comparison (including where we lose):

- https://awareness.market/benchmarks
- https://awareness.market/sdk-docs/LONGMEMEVAL.md
