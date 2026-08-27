#!/usr/bin/env python3
"""
LongMemEval Recall@k Benchmark for Awareness Memory

Zero-cost local evaluation using sentence-transformers + BM25.
Tests hybrid retrieval quality matching Awareness production pipeline.

Usage:
    python3 run_benchmark.py --limit 10 --debug   # pilot
    python3 run_benchmark.py                        # full 500 questions
    python3 run_benchmark.py --offset 100 --limit 100  # batch 100-199
"""

import json
import time
import argparse
import gc
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from tqdm import tqdm
from rank_bm25 import BM25Okapi

# ---------------------------------------------------------------------------
# Config — matching Awareness production
# ---------------------------------------------------------------------------
EMBED_MODEL = "intfloat/multilingual-e5-small"  # cached locally; same family as daemon e5-small
E5_QUERY_PREFIX = "query: "
VECTOR_WEIGHT = 0.7
BM25_WEIGHT = 0.3
RRF_K = 60


def load_dataset(path: str, limit: int | None = None, offset: int = 0) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if offset:
        data = data[offset:]
    if limit:
        data = data[:limit]
    return data


def format_session(session: list[dict]) -> str:
    """Flatten a session's turns into a single text block."""
    return "\n".join(f"{t['role']}: {t['content']}" for t in session)


def cosine_sim_batch(query: np.ndarray, docs: np.ndarray) -> np.ndarray:
    """Cosine similarity between one query vector and a matrix of doc vectors."""
    q_norm = query / (np.linalg.norm(query) + 1e-10)
    d_norm = docs / (np.linalg.norm(docs, axis=1, keepdims=True) + 1e-10)
    return d_norm @ q_norm


def rrf_fuse(vector_ranking: np.ndarray, bm25_ranking: np.ndarray, k: int = RRF_K) -> list[int]:
    """RRF fusion returning doc indices sorted by fused score."""
    n = len(vector_ranking)
    v_rank = {int(idx): rank for rank, idx in enumerate(vector_ranking)}
    b_rank = {int(idx): rank for rank, idx in enumerate(bm25_ranking)}

    scores = []
    for i in range(n):
        s = VECTOR_WEIGHT / (k + v_rank.get(i, n)) + BM25_WEIGHT / (k + b_rank.get(i, n))
        scores.append((i, s))
    scores.sort(key=lambda x: -x[1])
    return [idx for idx, _ in scores]


def run_benchmark(args):
    print("=" * 60)
    print("LongMemEval Recall@k — Awareness Memory")
    print("=" * 60)

    data = load_dataset(args.data, args.limit, args.offset)
    print(f"\nQuestions: {len(data)} (offset={args.offset})")
    print(f"Model: {EMBED_MODEL}")
    print(f"Fusion: RRF vector={VECTOR_WEIGHT} bm25={BM25_WEIGHT} k={RRF_K}")

    # Load model
    print("\nLoading embedding model...")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(EMBED_MODEL, device="cpu")
    model.max_seq_length = 512  # cap for memory safety
    print(f"Model loaded ({model.get_sentence_embedding_dimension()}d)")

    ks = (1, 3, 5, 10)
    results = []
    hits_at_k = defaultdict(int)
    hits_by_type = defaultdict(lambda: defaultdict(int))
    total_by_type = Counter()

    # Also track vector-only and bm25-only for ablation
    vec_hits = defaultdict(int)
    bm25_hits = defaultdict(int)

    t0 = time.time()

    for idx, item in enumerate(tqdm(data, desc="Evaluating", ncols=80)):
        q_id = item["question_id"]
        q_type = item["question_type"]
        question = item["question"]
        gold_ids = set(item["answer_session_ids"])
        sess_ids = item["haystack_session_ids"]
        sessions = item["haystack_sessions"]

        # Format sessions
        sess_texts = [format_session(s) for s in sessions]
        n_docs = len(sess_texts)

        # --- Embed (batch_size=16 for 8GB safety) ---
        doc_embeds = model.encode(sess_texts, batch_size=16, show_progress_bar=False,
                                  normalize_embeddings=True)
        q_embed = model.encode([E5_QUERY_PREFIX + question], normalize_embeddings=True)[0]

        # Vector scores
        vec_scores = doc_embeds @ q_embed  # already normalized
        vec_rank = np.argsort(-vec_scores)

        # --- BM25 ---
        tokenized = [t.lower().split() for t in sess_texts]
        bm25 = BM25Okapi(tokenized)
        bm25_scores = bm25.get_scores(question.lower().split())
        bm25_rank = np.argsort(-bm25_scores)

        # --- RRF Fusion ---
        fused_rank = rrf_fuse(vec_rank, bm25_rank)
        ranked_ids = [sess_ids[i] for i in fused_rank]

        # --- Evaluate ---
        result = {"qid": q_id, "type": q_type, "gold": list(gold_ids)}

        for k in ks:
            # Hybrid
            hit = bool(gold_ids & set(ranked_ids[:k]))
            result[f"hit@{k}"] = hit
            if hit:
                hits_at_k[k] += 1
                hits_by_type[q_type][k] += 1

            # Vector-only
            vec_top_k = {sess_ids[int(vec_rank[j])] for j in range(k)}
            if gold_ids & vec_top_k:
                vec_hits[k] += 1

            # BM25-only
            bm25_top_k = {sess_ids[int(bm25_rank[j])] for j in range(k)}
            if gold_ids & bm25_top_k:
                bm25_hits[k] += 1

        total_by_type[q_type] += 1
        results.append(result)

        if args.debug and idx < 5:
            print(f"\n  Q{idx} [{q_type}]: {question[:70]}...")
            print(f"    Gold: {gold_ids}  |  Top-3: {ranked_ids[:3]}")
            print(f"    Vec#1: {vec_scores[vec_rank[0]]:.3f}  BM25#1: {bm25_scores[bm25_rank[0]]:.1f}")
            print(f"    Hit@5: {'YES' if result['hit@5'] else 'NO'}")

        # GC every 50 questions to stay in 8GB
        if idx % 50 == 49:
            gc.collect()

    elapsed = time.time() - t0
    n = len(data)

    # ===== RESULTS =====
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Questions: {n}  |  Time: {elapsed:.0f}s ({elapsed/n:.1f}s/q)")

    print("\n--- Recall@k (Hybrid RRF) ---")
    for k in ks:
        print(f"  R@{k:>2}: {hits_at_k[k]/n*100:6.2f}%  ({hits_at_k[k]}/{n})")

    print("\n--- Ablation ---")
    print(f"  {'':30} R@1     R@3     R@5     R@10")
    for label, h in [("Vector-only", vec_hits), ("BM25-only", bm25_hits), ("Hybrid RRF", hits_at_k)]:
        scores = "  ".join(f"{h[k]/n*100:5.1f}%" for k in ks)
        print(f"  {label:30} {scores}")

    print("\n--- R@5 by Question Type ---")
    for qt in sorted(total_by_type.keys()):
        tot = total_by_type[qt]
        hit = hits_by_type[qt].get(5, 0)
        print(f"  {qt:<30} {hit/tot*100:5.1f}%  ({hit}/{tot})")

    # Comparison
    our_r5 = hits_at_k[5] / n * 100
    print("\n--- vs. Competitors (R@5) ---")
    comps = [
        ("MemPalace (all-MiniLM, raw)", 96.6),
        ("Awareness (hybrid RRF)", our_r5),
    ]
    comps.sort(key=lambda x: -x[1])
    for name, score in comps:
        tag = " <-- us" if "Awareness" in name else ""
        print(f"  {name:<35} {score:5.1f}%{tag}")

    # Save
    out = Path(args.data).parent / f"results_offset{args.offset}.json"
    with open(out, "w") as f:
        json.dump({
            "model": EMBED_MODEL,
            "fusion": f"rrf_v{VECTOR_WEIGHT}_b{BM25_WEIGHT}_k{RRF_K}",
            "n": n, "offset": args.offset,
            "elapsed_s": elapsed,
            "recall": {str(k): hits_at_k[k]/n for k in ks},
            "recall_vec_only": {str(k): vec_hits[k]/n for k in ks},
            "recall_bm25_only": {str(k): bm25_hits[k]/n for k in ks},
            "by_type": {
                qt: {str(k): hits_by_type[qt].get(k,0)/total_by_type[qt] for k in ks}
                for qt in sorted(total_by_type.keys())
            },
            "details": results,
        }, f, indent=2)
    print(f"\nSaved: {out}")

    return our_r5


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(Path(__file__).parent / "longmemeval_s_cleaned.json"))
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--offset", type=int, default=0)
    p.add_argument("--debug", action="store_true")
    run_benchmark(p.parse_args())
