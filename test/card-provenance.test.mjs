// W3 · card_provenance side table — authority inference + persistence.
// The side table records where a card came from (user vs extraction vs inference)
// WITHOUT touching knowledge_cards columns (summary/tags/status are in the
// ERC-8350 digest preimage; a provenance column there would risk the hash).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Indexer, inferSourceAuthority } from '../src/core/indexer.mjs';

function freshIndexer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-provenance-'));
  const indexer = new Indexer(path.join(dir, 'index.db'));
  return { indexer, dir };
}

test('inferSourceAuthority: user-authored sources map to user_input', () => {
  assert.equal(inferSourceAuthority({ source: 'user' }), 'user_input');
  assert.equal(inferSourceAuthority({ source: 'user_input' }), 'user_input');
  assert.equal(inferSourceAuthority({ source: 'explicit' }), 'user_input');
  assert.equal(inferSourceAuthority({ source: 'USER' }), 'user_input', 'case-insensitive');
});

test('inferSourceAuthority: MOC and default map to auto_extraction', () => {
  assert.equal(inferSourceAuthority({ card_type: 'moc' }), 'auto_extraction');
  assert.equal(inferSourceAuthority({}), 'auto_extraction', 'no source defaults to extraction');
  assert.equal(inferSourceAuthority({ source: 'llm' }), 'auto_extraction');
  assert.equal(inferSourceAuthority({ source: 'coherence-eval' }), 'auto_extraction');
});

test('inferSourceAuthority: inference source maps to inference', () => {
  assert.equal(inferSourceAuthority({ source: 'inference' }), 'inference');
  assert.equal(inferSourceAuthority({ source: 'inferred' }), 'inference');
});

test('indexKnowledgeCard writes provenance side table', () => {
  const { indexer, dir } = freshIndexer();
  try {
    indexer.indexKnowledgeCard({
      id: 'kc_prov_1',
      category: 'decision',
      title: 'Provenance test',
      summary: 'Side table record',
      source: 'user',
      source_memories: '[]',
      status: 'active',
      tags: '[]',
      filepath: '/tmp/prov-1.md',
    });

    const row = indexer.db.prepare(
      'SELECT * FROM card_provenance WHERE card_id = ?',
    ).get('kc_prov_1');
    assert.ok(row, 'provenance row must exist');
    assert.equal(row.source_authority, 'user_input');
    assert.ok(row.recorded_at, 'recorded_at must be set');
  } finally {
    indexer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('indexKnowledgeCard: extraction source records auto_extraction', () => {
  const { indexer, dir } = freshIndexer();
  try {
    indexer.indexKnowledgeCard({
      id: 'kc_prov_2',
      category: 'workflow',
      title: 'Extracted',
      summary: 'From insights',
      source: 'insights-extraction',
      source_memories: '[]',
      status: 'active',
      tags: '[]',
      filepath: '/tmp/prov-2.md',
    });

    const row = indexer.db.prepare(
      'SELECT source_authority FROM card_provenance WHERE card_id = ?',
    ).get('kc_prov_2');
    assert.equal(row.source_authority, 'auto_extraction');
  } finally {
    indexer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('indexKnowledgeCard: provenance upsert is idempotent on card_id', () => {
  const { indexer, dir } = freshIndexer();
  try {
    indexer.indexKnowledgeCard({
      id: 'kc_prov_3', category: 'decision', title: 'A', summary: 'first',
      source: 'user', source_memories: '[]', status: 'active', tags: '[]',
      filepath: '/tmp/prov-3a.md',
    });
    indexer.indexKnowledgeCard({
      id: 'kc_prov_3', category: 'decision', title: 'A updated', summary: 'second',
      source: 'user', source_memories: '[]', status: 'active', tags: '[]',
      filepath: '/tmp/prov-3a.md',
    });

    const count = indexer.db.prepare(
      "SELECT COUNT(*) AS n FROM card_provenance WHERE card_id = 'kc_prov_3'",
    ).get().n;
    assert.equal(count, 1, 're-index must not duplicate provenance rows');
  } finally {
    indexer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('indexKnowledgeCard: MOC card records auto_extraction via side table', () => {
  const { indexer, dir } = freshIndexer();
  try {
    indexer.indexKnowledgeCard({
      id: 'kc_prov_moc',
      category: 'decision',
      title: 'Database MOC',
      summary: 'Covers: x',
      card_type: 'moc',
      source_memories: '[]',
      status: 'active',
      tags: '["database"]',
      filepath: '/tmp/prov-moc.md',
    });

    const row = indexer.db.prepare(
      'SELECT source_authority FROM card_provenance WHERE card_id = ?',
    ).get('kc_prov_moc');
    assert.equal(row.source_authority, 'auto_extraction',
      'an internally generated MOC is not user-authored');
  } finally {
    indexer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('inferSourceAuthority: explicit user source beats moc type (authority order)', () => {
  // user_input > auto_extraction: a user-authored MOC (rare but possible via
  // explicit source) must rank above the type-derived default. This is the
  // only input that distinguishes "moc mapping runs first" from "user mapping
  // runs first" — the ordering is the point.
  assert.equal(inferSourceAuthority({ card_type: 'moc', source: 'user' }), 'user_input');
  assert.equal(inferSourceAuthority({ card_type: 'moc', source: 'llm' }), 'auto_extraction');
});

test('knowledge_cards schema unchanged — no provenance column (red line)', () => {
  const { indexer, dir } = freshIndexer();
  try {
    const cols = indexer.db.prepare(
      "SELECT name FROM pragma_table_info('knowledge_cards')",
    ).all().map((r) => r.name);
    for (const forbidden of ['source_authority', 'origin_device_id', 'delivery_message_id']) {
      assert.ok(!cols.includes(forbidden),
        `knowledge_cards must NOT gain a "${forbidden}" column — summary/tags/status ` +
        'are in the ERC-8350 digest preimage');
    }
  } finally {
    indexer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});