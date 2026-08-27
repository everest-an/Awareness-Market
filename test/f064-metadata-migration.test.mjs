/**
 * F-064 · memories.metadata column + forward-compatible migration +
 *          same-source content_hash dedup lookup.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';

let Indexer;
let tmpDir;

before(async () => {
  ({ Indexer } = await import('../src/core/indexer.mjs'));
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-f064-'));
});

after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

describe('F-064 metadata schema + dedup', () => {
  it('fresh DB has memories.metadata column', () => {
    const dbPath = path.join(tmpDir, 'fresh.db');
    const idx = new Indexer(dbPath);
    const cols = idx.db.prepare('PRAGMA table_info(memories)').all().map((c) => c.name);
    assert.ok(cols.includes('metadata'), 'metadata column must exist');
    idx.close?.();
  });

  it('indexMemory persists metadata as JSON string', () => {
    const dbPath = path.join(tmpDir, 'persist.db');
    const idx = new Indexer(dbPath);
    idx.indexMemory('mem_1', {
      filepath: '/tmp/mem_1.md',
      type: 'turn_summary',
      title: 'pgvector vs Qdrant',
      source: 'external_chat',
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
      metadata: { site: 'doubao', url: 'https://www.doubao.com/x', model: 'doubao-pro' },
    }, 'Discussed pgvector vs Qdrant tradeoffs in depth.');

    const row = idx.db.prepare('SELECT metadata FROM memories WHERE id = ?').get('mem_1');
    assert.ok(row.metadata, 'metadata should be non-null');
    const parsed = JSON.parse(row.metadata);
    assert.equal(parsed.site, 'doubao');
    assert.equal(parsed.model, 'doubao-pro');
    idx.close?.();
  });

  it('malformed metadata degrades to null (FM-4)', () => {
    const dbPath = path.join(tmpDir, 'malformed.db');
    const idx = new Indexer(dbPath);
    const circular = {};
    circular.self = circular; // JSON.stringify throws
    idx.indexMemory('mem_bad', {
      filepath: '/tmp/mem_bad.md', type: 'turn_summary',
      created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z',
      metadata: circular,
    }, 'content body for malformed metadata test');
    const row = idx.db.prepare('SELECT metadata FROM memories WHERE id = ?').get('mem_bad');
    assert.equal(row.metadata, null);
    idx.close?.();
  });

  it('same-source dedup finds identical content; cross-source does not (decision A)', () => {
    const dbPath = path.join(tmpDir, 'dedup.db');
    const idx = new Indexer(dbPath);
    const content = 'We chose Qdrant for ANN recall and pgvector for exact rerank.';
    idx.indexMemory('mem_dc', {
      filepath: '/tmp/mem_dc.md', type: 'turn_summary', source: 'external_chat',
      created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z',
    }, content);

    // Same content + same source → dup id returned
    assert.equal(idx.findByContentHashAndSource(content, 'external_chat'), 'mem_dc');
    // Same content + DIFFERENT source → no dup (keep both)
    assert.equal(idx.findByContentHashAndSource(content, 'claude-code'), null);
    // Different content → no dup
    assert.equal(idx.findByContentHashAndSource(content + ' extra', 'external_chat'), null);
    idx.close?.();
  });

  it('forward-compatible migration adds metadata to a legacy DB, keeping old rows', () => {
    const dbPath = path.join(tmpDir, 'legacy.db');
    // Simulate a pre-F-064 DB: memories table WITHOUT metadata column.
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY, filepath TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
        title TEXT, session_id TEXT, agent_role TEXT DEFAULT 'builder_agent',
        source TEXT, status TEXT DEFAULT 'active', tags TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        content_hash TEXT, synced_to_cloud INTEGER DEFAULT 0
      );
    `);
    raw.prepare(
      `INSERT INTO memories (id, filepath, type, title, created_at, updated_at)
       VALUES ('legacy_1', '/tmp/legacy_1.md', 'turn_summary', 'old memory', '2026-01-01', '2026-01-01')`
    ).run();
    raw.close();

    // Opening with the current Indexer must migrate in place.
    const idx = new Indexer(dbPath);
    const cols = idx.db.prepare('PRAGMA table_info(memories)').all().map((c) => c.name);
    assert.ok(cols.includes('metadata'), 'migration must add metadata column');
    const legacy = idx.db.prepare('SELECT id, metadata FROM memories WHERE id = ?').get('legacy_1');
    assert.equal(legacy.id, 'legacy_1', 'legacy row must survive');
    assert.equal(legacy.metadata, null, 'legacy row metadata backfills to NULL');
    idx.close?.();
  });
});
