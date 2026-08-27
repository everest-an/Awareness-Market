#!/usr/bin/env python3
"""
LongMemEval Optimization Experiments

Exp 1: Turn-level chunking (vs session-level baseline)
Exp 2: RRF weight grid search
Exp 3: Cross-encoder rerank on top-20
Final: Best combo

Usage:
    python3 run_experiments.py                    # all 500, all experiments
    python3 run_experiments.py --limit 20         # pilot
    python3 run_experiments.py --exp 1            # single experiment
    python3 run_experiments.py --exp 2            # weight scan only (fast)
"""

import json
import time
import argparse
import gc
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
from tqdm import tqdm
from rank_bm25 import BM25Okapi


EMBED_MODEL = "all-MiniLM-L6-v2"
RRF_K = 60
KS = (1, 3, 5, 10)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------
@dataclass
class QuestionResult:
    qid: str
    qtype: str
    gold_ids: list[str]
    # Per-doc rankings (indices into doc list)
    vec_rank: list[int] = field(default_factory=list)
    bm25_rank: list[int] = field(default_factory=list)
    # Doc-to-session mapping
    doc_session_ids: list[str] = field(default_factory=list)


def load_dataset(path: str, limit: int | None = None) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    return data[:limit] if limit else data


def format_session(session: list[dict]) -> str:
    return "\n".join(f"{t['role']}: {t['content']}" for t in session)


def format_turn_pair(session: list[dict], turn_idx: int) -> str:
    """Format a user+assistant turn pair (or single turn)."""
    parts = []
    if turn_idx < len(session):
        parts.append(f"{session[turn_idx]['role']}: {session[turn_idx]['content']}")
    if turn_idx + 1 < len(session) and session[turn_idx]['role'] == 'user':
        parts.append(f"{session[turn_idx + 1]['role']}: {session[turn_idx + 1]['content']}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Core: embed + BM25 for one question
# ---------------------------------------------------------------------------
def compute_rankings(
    model,
    question: str,
    doc_texts: list[str],
) -> tuple[np.ndarray, np.ndarray]:
    """Return (vec_rank, bm25_rank) as arrays of doc indices."""
    # Vector
    doc_embeds = model.encode(doc_texts, batch_size=16, show_progress_bar=False,
                              normalize_embeddings=True)
    q_embed = model.encode([question], normalize_embeddings=True)[0]
    vec_scores = doc_embeds @ q_embed
    vec_rank = np.argsort(-vec_scores)

    # BM25
    tokenized = [t.lower().split() for t in doc_texts]
    bm25 = BM25Okapi(tokenized)
    bm25_scores = bm25.get_scores(question.lower().split())
    bm25_rank = np.argsort(-bm25_scores)

    return vec_rank, bm25_rank


def rrf_fuse(
    vec_rank: np.ndarray,
    bm25_rank: np.ndarray,
    vw: float = 0.7,
    bw: float = 0.3,
    k: int = RRF_K,
) -> list[int]:
    """RRF fusion returning doc indices sorted by fused score."""
    n = len(vec_rank)
    v_map = {int(idx): rank for rank, idx in enumerate(vec_rank)}
    b_map = {int(idx): rank for rank, idx in enumerate(bm25_rank)}
    scores = []
    for i in range(n):
        s = vw / (k + v_map.get(i, n)) + bw / (k + b_map.get(i, n))
        scores.append((i, s))
    scores.sort(key=lambda x: -x[1])
    return [idx for idx, _ in scores]


def eval_recall(
    ranked_doc_indices: list[int],
    doc_session_ids: list[str],
    gold_session_ids: set[str],
    ks: tuple[int, ...] = KS,
) -> dict[int, bool]:
    """Check Recall@k. Map doc indices → session IDs, deduplicate."""
    hits = {}
    seen_sessions = set()
    unique_sessions = []
    for doc_idx in ranked_doc_indices:
        sid = doc_session_ids[doc_idx]
        if sid not in seen_sessions:
            seen_sessions.add(sid)
            unique_sessions.append(sid)
    for k_val in ks:
        top_k = set(unique_sessions[:k_val])
        hits[k_val] = bool(gold_session_ids & top_k)
    return hits


# ---------------------------------------------------------------------------
# Phase 1: Build rankings for both granularities
# ---------------------------------------------------------------------------
def build_all_rankings(
    model, data: list[dict], debug: bool = False, skip_turn: bool = False,
) -> tuple[list[QuestionResult], list[QuestionResult]]:
    """Build session-level and (optionally) turn-level rankings."""
    session_results = []
    turn_results = []

    for idx, item in enumerate(tqdm(data, desc="Embedding", ncols=80)):
        qid = item["question_id"]
        qtype = item["question_type"]
        question = item["question"]
        gold_ids = list(item["answer_session_ids"])
        sess_ids = item["haystack_session_ids"]
        sessions = item["haystack_sessions"]

        # --- Session-level ---
        sess_texts = [format_session(s) for s in sessions]
        vec_r, bm25_r = compute_rankings(model, question, sess_texts)
        session_results.append(QuestionResult(
            qid=qid, qtype=qtype, gold_ids=gold_ids,
            vec_rank=vec_r.tolist(), bm25_rank=bm25_r.tolist(),
            doc_session_ids=sess_ids,
        ))

        # --- Turn-level (optional) ---
        if not skip_turn:
            turn_texts = []
            turn_session_map = []
            for si, session in enumerate(sessions):
                for ti in range(0, len(session), 2):
                    text = format_turn_pair(session, ti)
                    turn_texts.append(text)
                    turn_session_map.append(sess_ids[si])

            vec_r_t, bm25_r_t = compute_rankings(model, question, turn_texts)
            turn_results.append(QuestionResult(
                qid=qid, qtype=qtype, gold_ids=gold_ids,
                vec_rank=vec_r_t.tolist(), bm25_rank=bm25_r_t.tolist(),
                doc_session_ids=turn_session_map,
            ))

        if idx % 50 == 49:
            gc.collect()

    return session_results, turn_results


# ---------------------------------------------------------------------------
# Phase 2: Evaluate with different configs (instant, no re-embedding)
# ---------------------------------------------------------------------------
def evaluate_config(
    results: list[QuestionResult],
    vw: float = 0.7,
    bw: float = 0.3,
    reranker=None,
    rerank_question_map: Optional[dict] = None,
    rerank_doc_texts_map: Optional[dict] = None,
    label: str = "",
) -> dict:
    """Evaluate Recall@k for a list of QuestionResults with given weights."""
    hits_at_k = defaultdict(int)
    hits_by_type = defaultdict(lambda: defaultdict(int))
    total_by_type = Counter()
    n = len(results)

    for qr in results:
        gold_set = set(qr.gold_ids)
        vec_rank = np.array(qr.vec_rank)
        bm25_rank = np.array(qr.bm25_rank)
        fused = rrf_fuse(vec_rank, bm25_rank, vw=vw, bw=bw)

        # Optional cross-encoder rerank
        if reranker is not None and rerank_question_map and rerank_doc_texts_map:
            question = rerank_question_map[qr.qid]
            doc_texts = rerank_doc_texts_map[qr.qid]
            # Take top-20 from fused
            top20_indices = fused[:20]
            # Strategy: for each candidate doc, find the best ~500 char window
            # by using BM25 keywords to locate the relevant passage
            q_tokens = set(question.lower().split())
            pairs = []
            for i in top20_indices:
                text = doc_texts[i]
                # Split into ~400-char chunks, pick the one with most query keyword overlap
                chunks = [text[j:j+400] for j in range(0, len(text), 300)]  # overlapping
                if not chunks:
                    chunks = [text[:400]]
                best_chunk = max(chunks, key=lambda c: len(q_tokens & set(c.lower().split())))
                pairs.append((question, best_chunk))
            ce_scores = reranker.predict(pairs, show_progress_bar=False)
            reranked = [top20_indices[i] for i in np.argsort(-np.array(ce_scores))]
            remaining = [i for i in fused[20:]]
            fused = reranked + remaining

        recall = eval_recall(fused, qr.doc_session_ids, gold_set)
        total_by_type[qr.qtype] += 1
        for k_val in KS:
            if recall[k_val]:
                hits_at_k[k_val] += 1
                hits_by_type[qr.qtype][k_val] += 1

    return {
        "label": label,
        "vw": vw, "bw": bw,
        "n": n,
        "recall": {k: hits_at_k[k] / n for k in KS},
        "by_type": {
            qt: {k: hits_by_type[qt].get(k, 0) / total_by_type[qt] for k in KS}
            for qt in sorted(total_by_type.keys())
        },
    }


def print_result(r: dict) -> None:
    label = r["label"]
    n = r["n"]
    recall = r["recall"]
    print(f"\n  [{label}] (vw={r['vw']}, bw={r['bw']})")
    for k in KS:
        hits = int(recall[k] * n)
        print(f"    R@{k:>2}: {recall[k]*100:6.2f}%  ({hits}/{n})")
    print(f"    --- by type (R@5) ---")
    for qt in sorted(r["by_type"].keys()):
        r5 = r["by_type"][qt].get(5, 0) * 100
        print(f"    {qt:<30} {r5:5.1f}%")


def main(args):
    print("=" * 60)
    print("LongMemEval Optimization Experiments")
    print("=" * 60)

    data = load_dataset(args.data, args.limit)
    n = len(data)
    print(f"\nQuestions: {n}")

    # Load embedding model
    print("\nLoading embedding model...")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(EMBED_MODEL, device="cpu")
    model.max_seq_length = 512
    print(f"Model: {EMBED_MODEL} ({model.get_sentence_embedding_dimension()}d)")

    # Phase 1: Build rankings
    t0 = time.time()
    skip_turn = getattr(args, 'skip_turn', False)
    print(f"\n--- Phase 1: Building embeddings + rankings {'(session only)' if skip_turn else '(session + turn)'} ---")
    sess_results, turn_results = build_all_rankings(model, data, args.debug, skip_turn=skip_turn)
    embed_time = time.time() - t0
    print(f"Embedding done in {embed_time:.0f}s ({embed_time/n:.1f}s/q)")

    all_results = []

    # ===== Experiment 2: Weight scan (instant) =====
    print("\n" + "=" * 60)
    print("Experiment 2: RRF Weight Grid Search (session-level)")
    print("=" * 60)
    weight_configs = [
        (0.5, 0.5), (0.55, 0.45), (0.6, 0.4), (0.65, 0.35),
        (0.7, 0.3), (0.75, 0.25), (0.8, 0.2),
    ]
    best_r5 = 0
    best_weights = (0.7, 0.3)
    for vw, bw in weight_configs:
        r = evaluate_config(sess_results, vw=vw, bw=bw,
                            label=f"session vw={vw} bw={bw}")
        r5 = r["recall"][5]
        marker = " ***" if r5 > best_r5 else ""
        print(f"  vw={vw:.2f} bw={bw:.2f} → R@5={r5*100:.2f}%{marker}")
        if r5 > best_r5:
            best_r5 = r5
            best_weights = (vw, bw)
        all_results.append(r)

    print(f"\n  Best session weights: vw={best_weights[0]}, bw={best_weights[1]} → R@5={best_r5*100:.2f}%")

    # ===== Experiment 1: Turn-level =====
    best_turn_r5 = 0
    best_turn_weights = (0.7, 0.3)
    if turn_results:
        print("\n" + "=" * 60)
        print("Experiment 1: Turn-Level Chunking")
        print("=" * 60)
        for vw, bw in weight_configs:
            r = evaluate_config(turn_results, vw=vw, bw=bw,
                                label=f"turn vw={vw} bw={bw}")
            r5 = r["recall"][5]
            marker = " ***" if r5 > best_turn_r5 else ""
            print(f"  vw={vw:.2f} bw={bw:.2f} → R@5={r5*100:.2f}%{marker}")
            if r5 > best_turn_r5:
                best_turn_r5 = r5
                best_turn_weights = (vw, bw)
            all_results.append(r)
        print(f"\n  Best turn weights: vw={best_turn_weights[0]}, bw={best_turn_weights[1]} → R@5={best_turn_r5*100:.2f}%")
    else:
        print("\n  [Skipped turn-level experiment (--skip-turn)]")

    # Decide best granularity
    if turn_results and best_turn_r5 > best_r5:
        best_gran = "turn"
        best_base = turn_results
        best_w = best_turn_weights
        best_score = best_turn_r5
    else:
        best_gran = "session"
        best_base = sess_results
        best_w = best_weights
        best_score = best_r5

    print(f"\n  >>> Best pre-rerank: {best_gran} vw={best_w[0]} bw={best_w[1]} → R@5={best_score*100:.2f}%")

    # ===== Experiment 3: Cross-Encoder Rerank =====
    skip_rerank = getattr(args, 'skip_rerank', False)
    if skip_rerank:
        print("\n  [Skipped rerank experiment (--skip-rerank)]")
        reranker = None
    else:
        print("\n" + "=" * 60)
        print("Experiment 3: Cross-Encoder Rerank (top-20)")
        print("=" * 60)

        print("Loading cross-encoder: cross-encoder/ms-marco-MiniLM-L-6-v2 ...")
        from sentence_transformers import CrossEncoder
        reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu")
        print("Cross-encoder loaded.")

    if reranker is not None:
        # Build text maps for reranking
        q_map = {item["question_id"]: item["question"] for item in data}
        doc_map = {}
        for item in data:
            doc_map[item["question_id"]] = [format_session(s) for s in item["haystack_sessions"]]

        # Try rerank on top-3 weight configs
        best_session_configs = sorted(
            [(r["vw"], r["bw"], r) for r in all_results if r["label"].startswith("session")],
            key=lambda x: -x[2]["recall"][5]
        )[:3]

        for vw, bw, _ in best_session_configs:
            r_rerank = evaluate_config(
                sess_results, vw=vw, bw=bw,
                reranker=reranker, rerank_question_map=q_map, rerank_doc_texts_map=doc_map,
                label=f"session+rerank vw={vw} bw={bw}",
            )
            all_results.append(r_rerank)
            r5 = r_rerank["recall"][5] * 100
            print(f"  vw={vw:.2f} bw={bw:.2f} + rerank → R@5={r5:.2f}%")

    # Print best overall config with detailed output
    best_overall = max(all_results, key=lambda x: x["recall"][5])
    print_result(best_overall)

    # ===== Summary =====
    print("\n" + "=" * 60)
    print("SUMMARY — Top Configurations")
    print("=" * 60)

    # Sort by R@5
    top = sorted(all_results, key=lambda x: -x["recall"][5])[:8]
    print(f"\n  {'Config':<50} R@1     R@3     R@5     R@10")
    print(f"  {'-'*50} {'-'*7} {'-'*7} {'-'*7} {'-'*7}")
    for r in top:
        scores = "  ".join(f"{r['recall'][k]*100:5.1f}%" for k in KS)
        print(f"  {r['label']:<50} {scores}")

    # vs MemPalace
    final_r5 = top[0]["recall"][5] * 100
    print(f"\n  MemPalace (all-MiniLM, raw):                R@5 = 96.6%")
    print(f"  Awareness BEST:                             R@5 = {final_r5:.1f}%")
    if final_r5 > 96.6:
        print(f"  >>> EXCEEDED MemPalace by {final_r5 - 96.6:.1f}% <<<")
    else:
        print(f"  >>> Gap: {96.6 - final_r5:.1f}%")

    # Save
    out_path = Path(args.data).parent / "experiment_results.json"
    with open(out_path, "w") as f:
        json.dump({
            "model": EMBED_MODEL,
            "n": n,
            "embed_time_s": embed_time,
            "best_config": top[0],
            "all_configs": all_results,
        }, f, indent=2)
    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(Path(__file__).parent / "longmemeval_s_cleaned.json"))
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--debug", action="store_true")
    p.add_argument("--skip-turn", action="store_true", help="Skip turn-level (saves ~50% time)")
    p.add_argument("--skip-rerank", action="store_true", help="Skip cross-encoder rerank")
    main(p.parse_args())
