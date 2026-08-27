#!/usr/bin/env node
/**
 * F-053 daemon-path LongMemEval benchmark runner.
 *
 * Unlike `run_benchmark.py` (which independently re-implements RRF in Python
 * and therefore cannot evaluate F-053 changes), this runner drives the actual
 * `SearchEngine.unifiedCascadeSearch` that the daemon exposes. Per question:
 *
 *   1. Make a fresh tempdir + `Indexer(dbPath)` (isolated per-question pool).
 *   2. Batch-embed the question's haystack sessions via the same
 *      `@huggingface/transformers` path the daemon uses.
 *   3. `indexMemory` + `storeEmbedding` each session under its original
 *      `haystack_session_ids[i]` — so recall result `id`s are directly
 *      comparable to `answer_session_ids` (no mapping table needed).
 *   4. Call `search.unifiedCascadeSearch(question, { tokenBudget, limit })`.
 *   5. Compute hit@1/3/5/10 vs `answer_session_ids`.
 *
 * Why per-question tempdirs: LongMemEval haystacks are question-specific
 * (session IDs don't repeat across questions). Pooling all 500 questions'
 * haystacks into one DB would add cross-question interference that the
 * original Python benchmark doesn't have — breaking apples-to-apples.
 *
 * Zero impact on the user's running daemon: everything lives under
 * `os.tmpdir()/f053-bench-*` and is deleted after each question.
 *
 * Usage:
 *   node run_f053_daemon_path.mjs                       # full 500
 *   node run_f053_daemon_path.mjs --limit=50            # smoke
 *   node run_f053_daemon_path.mjs --budget=30000        # mixed tier
 *   node run_f053_daemon_path.mjs --limit=20 --budget=60000  # raw-heavy tier
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Argv parsing — two flags only, everything else implicit.
// ---------------------------------------------------------------------------
function flag(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  const n = Number(hit.slice(prefix.length));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const LIMIT = flag('limit', 0);              // 0 → full dataset
const STRATIFIED = flag('stratified', 0);    // 0 → not stratified; N → N per question_type
const USE_PHASE_3 = process.argv.includes('--phase3');  // Phase 3 archetype routing on/off
// Default budget = 999M tokens (effectively unlimited). LongMemEval sessions
// are long — 5K/30K/60K budgets trigger contextBudgeter inside recall() which
// trims results down to 1-2 items. That's production-correct for end-user
// recall, but apples-to-oranges against the Python baseline which has no
// budget cap. 999M exits the budgeter early without disabling tier shaping
// (still lands in "raw-heavy" bucket, which matches haystack semantics).
const TOKEN_BUDGET = flag('budget', 999_000_000);
const RECALL_LIMIT = flag('recall-limit', 10);

// ---------------------------------------------------------------------------
// Load internal modules — paths are relative to this file, so the benchmark
// always tracks whatever is on `main` at runtime.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.resolve(__dirname, '../../sdks/local/src');

const { Indexer } = await import(pathToFileURL(path.join(SDK_ROOT, 'core/indexer.mjs')).href);
const { SearchEngine } = await import(pathToFileURL(path.join(SDK_ROOT, 'core/search.mjs')).href);
const { detectNeedsCJK } = await import(pathToFileURL(path.join(SDK_ROOT, 'core/lang-detect.mjs')).href);
const embedderModule = await import(pathToFileURL(path.join(SDK_ROOT, 'core/embedder.mjs')).href);
const { embed, embedBatch, MODEL_MAP } = embedderModule;
const { buildArchetypeIndex, classifyQuery } =
  await import(pathToFileURL(path.join(SDK_ROOT, 'core/query-type-router.mjs')).href);

// ---------------------------------------------------------------------------
// Dataset loading.
// ---------------------------------------------------------------------------
const DATASET = path.join(__dirname, 'longmemeval_s_cleaned.json');
if (!fs.existsSync(DATASET)) {
  console.error(`Dataset missing: ${DATASET}`);
  console.error('Download it first: see docs/analysis/MEMORY_BASELINE_0.7.3_2026-04-17.md §5.1');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(DATASET, 'utf-8'));

/**
 * Select the working dataset per flag precedence:
 *   --stratified=N takes the first N items of each question_type — a low-cost
 *     way to cover all 6 types in ~60 questions instead of 500.
 *   --limit=N     takes the first N items (type distribution as-is in dataset).
 *   neither       → full 500.
 */
function selectData(all) {
  if (STRATIFIED > 0) {
    const buckets = new Map();
    for (const item of all) {
      const qt = item.question_type;
      if (!buckets.has(qt)) buckets.set(qt, []);
      if (buckets.get(qt).length < STRATIFIED) buckets.get(qt).push(item);
    }
    const out = [];
    for (const arr of buckets.values()) out.push(...arr);
    return out;
  }
  return LIMIT > 0 ? all.slice(0, LIMIT) : all;
}
const data = selectData(raw);

console.log('F-053 daemon-path LongMemEval');
console.log(`  n=${data.length}  (of ${raw.length}; stratified=${STRATIFIED})`);
console.log(`  token_budget=${TOKEN_BUDGET}  recall_limit=${RECALL_LIMIT}  phase3=${USE_PHASE_3}`);
console.log(`  SDK: ${SDK_ROOT}`);
console.log('');

// ---------------------------------------------------------------------------
// Format one session's turns into a flat text block — same shape as the
// Python benchmark so scoring is comparable.
// ---------------------------------------------------------------------------
function formatSession(turns) {
  return turns.map((t) => `${t.role}: ${t.content}`).join('\n');
}

// ---------------------------------------------------------------------------
// Per-question evaluation.
// ---------------------------------------------------------------------------
async function evaluateQuestion(item, archetypeIndex = null) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f053-bench-'));
  const dbPath = path.join(tempDir, 'index.db');

  try {
    const indexer = new Indexer(dbPath);
    // memoryStore=null: unifiedCascadeSearch's summary path only hits the
    // store via getFullContent, which we never call. _hydrateMetadata reads
    // SQLite directly. cloudSync=null: no network.
    const search = new SearchEngine(indexer, null, embedderModule, null);

    const sessionIds = item.haystack_session_ids;
    const sessionTexts = item.haystack_sessions.map(formatSession);

    // Match the daemon's default: CJK-gated. LongMemEval haystacks are
    // English → resolves to `all-MiniLM-L6-v2` (strong on long-doc English
    // retrieval). Non-English datasets would auto-switch to multilingual.
    const langSample = sessionTexts.slice(0, 5).join(' ');
    const language = detectNeedsCJK(langSample) ? 'multilingual' : 'english';
    const modelId = MODEL_MAP[language] || MODEL_MAP.english;

    // Batch-embed all sessions in one shot (big throughput win vs per-session).
    const vectors = await embedBatch(sessionTexts, 'passage', language);
    if (vectors.length !== sessionTexts.length) {
      throw new Error(`embedBatch shape mismatch: got ${vectors.length}, expected ${sessionTexts.length}`);
    }

    // Seed FTS + embedding under original session_id (so result.id == session_id).
    for (let i = 0; i < sessionIds.length; i++) {
      const sid = sessionIds[i];
      const content = sessionTexts[i];
      indexer.indexMemory(sid, {
        type: 'turn_summary',
        title: `Session ${sid}`,
        filepath: `/longmemeval/${sid}.md`,
        tags: ['longmemeval'],
        status: 'active',
      }, content);
      indexer.storeEmbedding(sid, vectors[i], modelId);
    }

    // Phase 3 archetype routing (opt-in via --phase3). The classifier uses
    // the SAME embedder pipeline we use for sessions, so no extra model load.
    let strategy = null;
    let archetype = null;
    let confidence = 0;
    if (archetypeIndex) {
      const classification = await classifyQuery(item.question, archetypeIndex);
      archetype = classification.archetype;
      confidence = classification.confidence;
      strategy = classification.strategy;
    }

    // Drive the F-053 single-parameter entry point.
    const out = await search.unifiedCascadeSearch(item.question, {
      tokenBudget: TOKEN_BUDGET,
      limit: RECALL_LIMIT,
      strategy,
    });
    const rankedIds = Array.isArray(out?.results)
      ? out.results.map((r) => r.id).filter(Boolean)
      : [];

    const goldSet = new Set(item.answer_session_ids);
    const hits = {};
    for (const k of [1, 3, 5, 10]) {
      hits[k] = rankedIds.slice(0, k).some((id) => goldSet.has(id));
    }

    indexer.close();
    return {
      qid: item.question_id,
      type: item.question_type,
      gold: [...goldSet],
      top: rankedIds.slice(0, 10),
      hits,
      nSessions: sessionIds.length,
      archetype,
      confidence: Number.isFinite(confidence) ? Number(confidence.toFixed(3)) : 0,
      ratio: strategy?.rawRatio ?? null,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------
async function main() {
  // Warm the embedder pipeline once — first call downloads/loads the ONNX
  // model (expensive). Subsequent calls reuse the cached pipeline.
  console.log('Warming embedder…');
  const tWarm = Date.now();
  await embed('hello', 'passage', 'english');
  console.log(`  Embedder ready in ${Date.now() - tWarm}ms`);

  let archetypeIndex = null;
  if (USE_PHASE_3) {
    console.log('Building Phase 3 archetype index (10 queries)…');
    const tIdx = Date.now();
    archetypeIndex = await buildArchetypeIndex();
    console.log(`  Archetype index ready in ${Date.now() - tIdx}ms`);
  }
  console.log('');

  const ks = [1, 3, 5, 10];
  const hitsAtK = { 1: 0, 3: 0, 5: 0, 10: 0 };
  const totalByType = {};
  const hitsByType5 = {};
  const archetypeDist = {};  // Phase 3: how queries routed
  const rows = [];

  const t0 = Date.now();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      const row = await evaluateQuestion(item, archetypeIndex);
      rows.push(row);
      for (const k of ks) if (row.hits[k]) hitsAtK[k] += 1;
      totalByType[row.type] = (totalByType[row.type] || 0) + 1;
      if (row.hits[5]) hitsByType5[row.type] = (hitsByType5[row.type] || 0) + 1;
      const key = row.archetype || '_fallback';
      archetypeDist[key] = (archetypeDist[key] || 0) + 1;
    } catch (err) {
      console.error(`  ⚠️  q${i} [${item.question_id}] failed: ${err.message}`);
      rows.push({ qid: item.question_id, type: item.question_type, error: err.message });
      totalByType[item.question_type] = (totalByType[item.question_type] || 0) + 1;
    }

    const done = i + 1;
    if (done % 10 === 0 || done === data.length) {
      const pct = (hitsAtK[5] / done * 100).toFixed(1);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  ${String(done).padStart(4)}/${data.length}  R@5=${pct}%  elapsed=${elapsed}s`);
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  const n = data.length;

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS — F-053 Phase 1+2 daemon-path (unifiedCascadeSearch)');
  console.log('='.repeat(60));
  console.log(`n=${n}  elapsed=${elapsed.toFixed(0)}s  (${(elapsed / n).toFixed(1)}s/q)`);
  console.log(`token_budget=${TOKEN_BUDGET}  recall_limit=${RECALL_LIMIT}  phase3=${USE_PHASE_3}`);
  console.log('');
  console.log('--- Recall@k ---');
  for (const k of ks) {
    console.log(`  R@${String(k).padStart(2)}:  ${(hitsAtK[k] / n * 100).toFixed(2)}%  (${hitsAtK[k]}/${n})`);
  }
  console.log('');
  console.log('--- R@5 by Question Type ---');
  for (const qt of Object.keys(totalByType).sort()) {
    const hit = hitsByType5[qt] || 0;
    const tot = totalByType[qt];
    console.log(`  ${qt.padEnd(30)} ${(hit / tot * 100).toFixed(1)}%  (${hit}/${tot})`);
  }

  if (USE_PHASE_3) {
    console.log('');
    console.log('--- Phase 3 archetype distribution ---');
    const sorted = Object.entries(archetypeDist).sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted) {
      console.log(`  ${key.padEnd(20)} ${String(count).padStart(4)}  (${(count / n * 100).toFixed(1)}%)`);
    }
  }

  // Baseline comparison (for quick eyeballing — numbers from
  // docs/analysis/MEMORY_BASELINE_0.7.3_2026-04-17.md §5.3).
  console.log('');
  console.log('--- vs Python-path baseline (2026-04-13, 500Q) ---');
  const baseline = { 1: 0.776, 3: 0.918, 5: 0.956, 10: 0.974 };
  for (const k of ks) {
    const ours = hitsAtK[k] / n;
    const delta = (ours - baseline[k]) * 100;
    const sign = delta >= 0 ? '+' : '';
    console.log(`  R@${k}:  ${(ours * 100).toFixed(1)}%  vs  ${(baseline[k] * 100).toFixed(1)}%  (${sign}${delta.toFixed(1)}pp)`);
  }

  // Persist results.
  const suffix = USE_PHASE_3 ? '_phase3' : '';
  const outPath = path.join(__dirname, `results_f053_daemon_path_n${n}_b${TOKEN_BUDGET}${suffix}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    label: USE_PHASE_3
      ? 'F-053 Phase 3 daemon-path (unifiedCascadeSearch + shape + archetype routing)'
      : 'F-053 Phase 1+2 daemon-path (unifiedCascadeSearch + shape)',
    n,
    elapsed_s: elapsed,
    token_budget: TOKEN_BUDGET,
    recall_limit: RECALL_LIMIT,
    phase3: USE_PHASE_3,
    archetype_dist: USE_PHASE_3 ? archetypeDist : undefined,
    model: MODEL_MAP,
    recall: Object.fromEntries(ks.map((k) => [String(k), hitsAtK[k] / n])),
    by_type_r5: Object.fromEntries(
      Object.keys(totalByType).sort().map((qt) => [
        qt,
        { hits: hitsByType5[qt] || 0, total: totalByType[qt], rate: (hitsByType5[qt] || 0) / totalByType[qt] },
      ]),
    ),
    python_baseline_r5: baseline[5],
    timestamp: new Date().toISOString(),
    details: rows,
  }, null, 2));
  console.log('');
  console.log(`Saved: ${outPath}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
