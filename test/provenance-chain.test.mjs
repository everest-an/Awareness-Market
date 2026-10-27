/**
 * provenance-chain.test.mjs - L2 integration for card provenance.
 *
 * The knowledge_cards table has had source / source_memories since day one,
 * but the write paths never filled them. These tests lock the write paths that
 * matter:
 *
 *   1. remember -> KnowledgeExtractor -> Indexer (inline insights)
 *   2. remember -> KnowledgeExtractor -> Indexer (rule fallback)
 *   3. awareness_record(submit_insights) -> Indexer (async agent submission)
 *
 * Real Indexer + real MemoryStore on a temp dir. Only the daemon methods that
 * would call an LLM / embedder are stubbed, per the L2 rule.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Indexer } from '../src/core/indexer.mjs';
import { MemoryStore } from '../src/core/memory-store.mjs';
import { KnowledgeExtractor } from '../src/core/knowledge-extractor.mjs';
import { remember } from '../src/daemon/engine/remember.mjs';

const LONG_SUMMARY =
  'PostgreSQL was chosen over MySQL because pgvector keeps embeddings in the ' +
  'same database as the relational rows, which removes a network hop from every ' +
  'recall query and makes transactions cover both stores.';

function freshProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-prov-'));
  fs.mkdirSync(path.join(dir, '.awareness', 'memories'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.awareness', 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.awareness', 'tasks'), { recursive: true });
  const indexer = new Indexer(path.join(dir, '.awareness', 'index.db'));
  return { dir, indexer };
}

function cleanup({ dir, indexer }) {
  try { indexer.close(); } catch { /* best-effort */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
}

function readCard(indexer, id) {
  return indexer.db
    .prepare('SELECT id, source, source_memories FROM knowledge_cards WHERE id = ?')
    .get(id);
}

function parseMemories(row) {
  try { return JSON.parse(row.source_memories || '[]'); } catch { return null; }
}

// ---------------------------------------------------------------------------
// 1. KnowledgeExtractor.saveCard -> Indexer
// ---------------------------------------------------------------------------

describe('KnowledgeExtractor.saveCard persists provenance', () => {
  let ctx;
  let extractor;

  before(() => {
    ctx = freshProject();
    extractor = new KnowledgeExtractor(
      { awarenessDir: path.join(ctx.dir, '.awareness') },
      ctx.indexer,
    );
  });

  after(() => cleanup(ctx));

  it('writes source and source_memories into knowledge_cards', async () => {
    const card = {
      id: 'kc_prov_save_1',
      category: 'decision',
      title: 'Use pgvector instead of a separate vector database',
      summary: LONG_SUMMARY,
      confidence: 0.9,
      tags: ['database', 'pgvector'],
      source: 'user',
      source_memory_id: 'mem_prov_1',
      created_at: new Date().toISOString(),
    };

    const filepath = await extractor.saveCard(card);
    assert.ok(filepath, 'card must pass the quality gate and be written');

    const row = readCard(ctx.indexer, card.id);
    assert.ok(row, 'card must be indexed');
    assert.equal(row.source, 'user', 'source must survive saveCard -> indexer');
    assert.deepEqual(parseMemories(row), ['mem_prov_1']);
  });
});

// ---------------------------------------------------------------------------
// 2. Awareness dir resolution (MemoryStore.rootDir)
// ---------------------------------------------------------------------------

describe('KnowledgeExtractor resolves the project awareness dir', () => {
  let ctx;
  let extractor;

  before(() => {
    ctx = freshProject();
    extractor = new KnowledgeExtractor(new MemoryStore(ctx.dir), ctx.indexer);
  });

  after(() => cleanup(ctx));

  it('saveCard writes the markdown inside the project, not process.cwd()', async () => {
    const card = {
      id: 'kc_prov_path_1',
      category: 'decision',
      title: 'Keep the knowledge markdown inside the project directory',
      summary: LONG_SUMMARY,
      confidence: 0.9,
      tags: ['filesystem'],
      source: 'user',
      source_memory_id: 'mem_path_1',
      created_at: new Date().toISOString(),
    };

    const filepath = await extractor.saveCard(card);
    assert.ok(filepath, 'card must be written');

    const rel = path.relative(ctx.dir, filepath);
    assert.ok(
      !rel.startsWith('..') && !path.isAbsolute(rel),
      `card must land under ${ctx.dir}, got ${filepath}`,
    );
    assert.ok(
      rel.includes(path.join('.awareness', 'knowledge')),
      `expected .awareness/knowledge inside the project, got ${rel}`,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Rule-based extraction carries source
// ---------------------------------------------------------------------------

describe('KnowledgeExtractor rule fallback carries source', () => {
  let ctx;
  let extractor;

  before(() => {
    ctx = freshProject();
    extractor = new KnowledgeExtractor(
      { awarenessDir: path.join(ctx.dir, '.awareness') },
      ctx.indexer,
    );
  });

  after(() => cleanup(ctx));

  it('buildCard copies metadata.source and metadata.id', () => {
    const result = extractor.extractByRules(
      'We decided to migrate from MySQL to PostgreSQL for better JSON support.',
      { id: 'mem_rule_1', source: 'user', tags: [] },
    );

    const card = result.cards.find((c) => c.category === 'decision');
    assert.ok(card, 'decision rule must match');
    assert.equal(card.source, 'user');
    assert.equal(card.source_memory_id, 'mem_rule_1');
  });

  it('extract() persists the rule-fallback card with provenance', async () => {
    const metadata = { id: 'mem_rule_2', source: 'mcp', tags: [] };
    await extractor.extract(
      'We decided to migrate the analytics pipeline from MySQL to PostgreSQL for JSON support, ' +
      'because JSONB indexing removes the nightly export job and keeps analytics rows next to the raw events.',
      metadata,
      null,
    );

    const row = ctx.indexer.db
      .prepare('SELECT id, source, source_memories FROM knowledge_cards WHERE source_memories LIKE ?')
      .get('%"mem_rule_2"%');
    assert.ok(row, 'extracted card must link back to the memory');
    assert.equal(row.source, 'mcp');
    assert.deepEqual(parseMemories(row), ['mem_rule_2']);
  });
});

// ---------------------------------------------------------------------------
// 4. remember() passes the memory id into the extraction chain
// ---------------------------------------------------------------------------

describe('remember() hands the memory id to extraction', () => {
  let ctx;
  let captured;

  before(() => {
    ctx = freshProject();
  });

  after(() => cleanup(ctx));

  it('metadata.id equals the persisted memory id', async () => {
    captured = null;

    const daemon = {
      projectDir: ctx.dir,
      indexer: ctx.indexer,
      memoryStore: new MemoryStore(ctx.dir),
      cloudSync: { isEnabled: () => false },
      _embedder: null,
      _embedAndStore: async () => {},
      _extractAndIndex: (memoryId, content, metadata, insights) => {
        captured = { memoryId, content, metadata, insights };
      },
      _buildPerception: async () => [],
      _checkPerceptionResolution: async () => {},
      _loadSpec: () => ({}),
    };

    const result = await remember(daemon, {
      content: 'We decided to use pgvector for the recall index because it co-locates with Postgres.',
      source: 'mcp',
      insights: {
        knowledge_cards: [{
          title: 'Use pgvector for the recall index',
          summary: LONG_SUMMARY,
          category: 'decision',
        }],
      },
    });

    assert.equal(result.status, 'ok');
    assert.ok(captured, 'extraction must be triggered');
    assert.equal(captured.memoryId, result.id);
    assert.equal(captured.metadata.id, result.id, 'metadata.id must be the persisted memory id');
    assert.equal(captured.metadata.source, 'mcp');
  });
});

// ---------------------------------------------------------------------------
// 5. remember() end-to-end: inline insights land with provenance
// ---------------------------------------------------------------------------

describe('remember() end-to-end provenance', () => {
  let ctx;

  before(() => {
    ctx = freshProject();
  });

  after(() => cleanup(ctx));

  it('inline insights produce a card with source and source_memories', async () => {
    const daemon = {
      projectDir: ctx.dir,
      indexer: ctx.indexer,
      memoryStore: new MemoryStore(ctx.dir),
      cloudSync: { isEnabled: () => false },
      _embedder: null,
      _embedAndStore: async () => {},
      _extractAndIndex: async (memoryId, content, metadata, insights) => {
        const extractor = new KnowledgeExtractor(daemon.memoryStore, ctx.indexer);
        await extractor.extract(content, metadata, insights);
      },
      _buildPerception: async () => [],
      _checkPerceptionResolution: async () => {},
      _loadSpec: () => ({}),
    };

    const result = await remember(daemon, {
      content: 'We decided to keep embeddings in Postgres instead of running a separate vector store.',
      source: 'mcp',
      insights: {
        knowledge_cards: [{
          title: 'Keep embeddings in Postgres with pgvector',
          summary: LONG_SUMMARY,
          category: 'decision',
        }],
      },
    });

    assert.equal(result.status, 'ok');

    const row = ctx.indexer.db
      .prepare('SELECT id, source, source_memories FROM knowledge_cards WHERE source_memories LIKE ?')
      .get(`%"${result.id}"%`);
    assert.ok(row, 'card must link to the memory that produced it');
    assert.equal(row.source, 'mcp');
    assert.deepEqual(parseMemories(row), [result.id]);
  });
});

// ---------------------------------------------------------------------------
// 6. submit_insights (async agent submission)
// ---------------------------------------------------------------------------

async function makeSubmitHarness() {
  const mod = await import('../src/daemon.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-prov-si-'));
  fs.mkdirSync(path.join(dir, '.awareness'), { recursive: true });

  const indexed = [];
  const daemon = Object.create(mod.AwarenessLocalDaemon.prototype);
  daemon.awarenessDir = path.join(dir, '.awareness');
  daemon.projectDir = dir;
  daemon.extractor = null;
  daemon._embedder = null;
  daemon.indexer = {
    indexKnowledgeCard: (card) => { indexed.push(card); },
    tryAutoMoc: () => [],
    db: { prepare: () => ({ all: () => [], get: () => null, run: () => ({}) }) },
  };
  daemon._refineMocTitles = async () => {};

  return { daemon, indexed, dir };
}

function cleanupHarness({ dir }) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
}

describe('submit_insights provenance', () => {
  it('records params.source and honours an explicit source_memory_id', async () => {
    const h = await makeSubmitHarness();
    try {
      const result = await h.daemon._submitInsights({
        source: 'mcp',
        insights: {
          knowledge_cards: [{
            title: 'Rate-limit the public API per key',
            summary: LONG_SUMMARY,
            category: 'decision',
            source_memory_id: 'mem_si_1',
          }],
        },
      });

      assert.equal(result.status, 'ok');
      assert.equal(h.indexed.length, 1);
      assert.equal(h.indexed[0].source, 'mcp');
      assert.deepEqual(JSON.parse(h.indexed[0].source_memories), ['mem_si_1']);
    } finally {
      cleanupHarness(h);
    }
  });

  it('defaults source to mcp and never writes null provenance', async () => {
    const h = await makeSubmitHarness();
    try {
      await h.daemon._submitInsights({
        insights: {
          knowledge_cards: [{
            title: 'Cache session tokens in Redis with a TTL',
            summary: LONG_SUMMARY,
            category: 'workflow',
          }],
        },
      });

      assert.equal(h.indexed.length, 1);
      assert.equal(h.indexed[0].source, 'mcp');
      assert.deepEqual(JSON.parse(h.indexed[0].source_memories), []);
    } finally {
      cleanupHarness(h);
    }
  });
});
