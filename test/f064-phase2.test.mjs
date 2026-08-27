/**
 * F-064 Phase 2 · Session/workspace binding + external bindings persistence +
 * global-vs-source_only dedup toggle.
 *
 * L1 pure (BindingStore, normalizeSite) + L2 integration (real Indexer +
 * MemoryStore + remember engine through the REST handlers) + L3 failure modes
 * (session_workspace_mismatch 409, binding validation 400).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Readable } from 'node:stream';

import {
  apiRecordMemory,
  apiListSessions,
  apiCreateSession,
  apiListBindings,
  apiUpsertBinding,
  apiDeleteBinding,
} from '../src/daemon/api-handlers.mjs';
import { BindingStore, normalizeSite } from '../src/core/binding-store.mjs';

let daemon;
let tmpDir;
let bindingsFile;

function mockReq(bodyObj, headers = {}, method = 'POST') {
  const json = bodyObj == null ? '' : (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj));
  const req = Readable.from([Buffer.from(json, 'utf-8')]);
  req.headers = headers;
  req.method = method;
  return req;
}

function mockRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body) { this.body = body ? JSON.parse(body) : null; },
  };
}

function mkUrl(query = '') {
  return new URL(`http://localhost/api/v1/x${query}`);
}

async function postMemory(bodyObj, headers = {}) {
  const res = mockRes();
  await apiRecordMemory(daemon, mockReq(bodyObj, headers), res);
  return res;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-f064-p2-'));
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'memories'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'tasks'), { recursive: true });
  bindingsFile = path.join(tmpDir, 'external-bindings.json');

  const mod = await import('../src/daemon.mjs');
  daemon = new mod.AwarenessLocalDaemon({ projectDir: tmpDir, port: 0, background: true });

  const { MemoryStore } = await import('../src/core/memory-store.mjs');
  const { Indexer } = await import('../src/core/indexer.mjs');
  daemon.memoryStore = new MemoryStore(tmpDir);
  daemon.indexer = new Indexer(path.join(tmpDir, '.awareness', 'index.db'));

  daemon._embedder = null;
  daemon.cloudSync = { isEnabled: () => false };
  daemon._sessions = new Map();
  daemon._extractAndIndex = () => {};
  daemon._embedAndStore = async () => {};
  daemon._buildPerception = async () => [];
  daemon._checkPerceptionResolution = async () => {};
  daemon._loadSpec = () => ({});

  // Inject a tmp-file-backed binding store so tests never touch ~/.awareness.
  daemon.bindingStore = new BindingStore(bindingsFile);
});

after(() => {
  try { daemon?.indexer?.close?.(); } catch { /* best-effort */ }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

// ---------------------------------------------------------------------------

describe('F-064 P2 · BindingStore (pure)', () => {
  it('normalizeSite strips scheme/path/port → bare hostname', () => {
    assert.equal(normalizeSite('https://www.doubao.com/chat/x'), 'www.doubao.com');
    assert.equal(normalizeSite('DOUBAO.COM'), 'doubao.com');
    assert.equal(normalizeSite('gemini.google.com:443'), 'gemini.google.com');
    assert.equal(normalizeSite(''), '');
    assert.equal(normalizeSite(42), '');
  });

  it('upsert → get → list → remove, keyed by site', () => {
    const file = path.join(tmpDir, 'unit-bindings.json');
    const store = new BindingStore(file);
    const b1 = store.upsert({ site: 'doubao.com', workspace: '/w1', session_id: 'ext_1' });
    assert.equal(b1.site, 'doubao.com');
    assert.ok(b1.id.startsWith('bind_'));

    // Same site → upsert replaces, no duplicate row.
    store.upsert({ site: 'doubao.com', workspace: '/w2', session_id: 'ext_2' });
    assert.equal(store.list().length, 1);
    assert.equal(store.get('doubao.com').workspace, '/w2');

    store.upsert({ site: 'gemini.google.com', workspace: '/w3' });
    assert.equal(store.list().length, 2);

    assert.equal(store.remove('doubao.com'), true);
    assert.equal(store.remove('doubao.com'), false); // already gone
    assert.equal(store.list().length, 1);
  });

  it('rejects empty site', () => {
    const store = new BindingStore(path.join(tmpDir, 'unit-bindings-2.json'));
    assert.throws(() => store.upsert({ site: '' }), /site is required/);
  });

  it('persists across a fresh store (daemon restart)', () => {
    const file = path.join(tmpDir, 'persist-bindings.json');
    const s1 = new BindingStore(file);
    s1.upsert({ site: 'chatgpt.com', workspace: '/persist', session_id: 'ext_persist' });

    const s2 = new BindingStore(file); // simulates daemon restart re-loading disk
    const b = s2.get('chatgpt.com');
    assert.ok(b, 'binding must survive restart');
    assert.equal(b.workspace, '/persist');
    assert.equal(b.session_id, 'ext_persist');
  });
});

describe('F-064 P2 · sessions CRUD', () => {
  it('POST creates an ext_ session stamped with the current workspace', async () => {
    const res = mockRes();
    await apiCreateSession(daemon, mockReq({ source: 'external_chat' }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.id.startsWith('ext_'), 'id must use ext_ prefix');
    assert.equal(res.body.source, 'external_chat');
    assert.equal(res.body.workspace, path.resolve(tmpDir));
  });

  it('GET ?source=external_chat isolates bridge sessions from IDE sessions', async () => {
    // Seed one IDE session + one more external session directly.
    daemon.indexer.createSession('claude-code', 'builder_agent', {
      id: 'ses_ide_1', workspace: path.resolve(tmpDir),
    });
    daemon.indexer.createSession('external_chat', 'external_agent', {
      id: 'ext_seed_1', workspace: path.resolve(tmpDir),
    });

    const res = mockRes();
    apiListSessions(daemon, mockReq(null, {}, 'GET'), res, mkUrl('?source=external_chat'));
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.total >= 2);
    assert.ok(res.body.sessions.every((s) => s.source === 'external_chat'),
      'must only return external_chat sessions');
    assert.ok(!res.body.sessions.some((s) => s.id === 'ses_ide_1'),
      'IDE session must not leak into external_chat list');
  });
});

describe('F-064 P2 · session workspace mismatch (FM-6)', () => {
  it('rejects a write whose session_id belongs to a different workspace → 409', async () => {
    daemon.indexer.createSession('external_chat', 'external_agent', {
      id: 'ext_foreign_1', workspace: path.join(os.tmpdir(), 'some-other-workspace'),
    });
    const res = await postMemory(
      { content: 'must not persist under a foreign session', source: 'external_chat', session_id: 'ext_foreign_1' },
      { origin: 'http://localhost:37800' },
    );
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, 'session_workspace_mismatch');
  });

  it('allows a write whose session_id belongs to the current workspace', async () => {
    daemon.indexer.createSession('external_chat', 'external_agent', {
      id: 'ext_local_1', workspace: path.resolve(tmpDir),
    });
    const res = await postMemory(
      { content: 'valid write under a local session', source: 'external_chat', session_id: 'ext_local_1' },
      { origin: 'http://localhost:37800' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('allows a write with a brand-new unregistered session_id (lenient)', async () => {
    const res = await postMemory(
      { content: 'fresh unregistered session write', source: 'external_chat', session_id: 'ext_brand_new_999' },
      { origin: 'http://localhost:37800' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
  });
});

describe('F-064 P2 · dedup modes (constraint A extension)', () => {
  it('source_only (default): identical content across sources keeps BOTH', async () => {
    const content = 'DEDUP-MODE-TEST source_only: Redis for counters, PG for state.';
    const first = await postMemory({ content, source: 'external_chat' }, { origin: 'http://localhost:37800' });
    assert.equal(first.body.status, 'ok');
    const cross = await postMemory({ content, source: 'claude-code' }, { origin: 'http://localhost:37800' });
    assert.equal(cross.body.status, 'ok');
    assert.notEqual(cross.body.id, first.body.id);
  });

  it('global: identical content across sources collapses to the existing id', async () => {
    const content = 'DEDUP-MODE-TEST global: Qdrant ANN + pgvector rerank hybrid recall.';
    const first = await postMemory({ content, source: 'external_chat' }, { origin: 'http://localhost:37800' });
    assert.equal(first.body.status, 'ok');

    process.env.AWARENESS_MEMORY_DEDUP_MODE = 'global';
    try {
      const cross = await postMemory({ content, source: 'claude-code' }, { origin: 'http://localhost:37800' });
      assert.equal(cross.body.status, 'duplicate');
      assert.equal(cross.body.id, first.body.id);
      assert.equal(cross.body.dedup_mode, 'global');
    } finally {
      delete process.env.AWARENESS_MEMORY_DEDUP_MODE;
    }
  });
});

describe('F-064 P2 · bindings REST', () => {
  it('POST upserts, GET lists, DELETE removes; persists across restart', async () => {
    // POST
    let res = mockRes();
    await apiUpsertBinding(daemon, mockReq({ site: 'https://www.doubao.com/chat', workspace: path.resolve(tmpDir), session_id: 'ext_seed_1' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.binding.site, 'www.doubao.com');

    // GET
    res = mockRes();
    await apiListBindings(daemon, mockReq(null, {}, 'GET'), res, mkUrl());
    assert.ok(res.body.bindings.some((b) => b.site === 'www.doubao.com'));

    // Persistence: rebuild the store from the same file (daemon restart).
    daemon.bindingStore = new BindingStore(bindingsFile);
    res = mockRes();
    await apiListBindings(daemon, mockReq(null, {}, 'GET'), res, mkUrl('?site=www.doubao.com'));
    assert.equal(res.body.total, 1);

    // DELETE
    res = mockRes();
    await apiDeleteBinding(daemon, mockReq(null, {}, 'DELETE'), res, mkUrl('?site=www.doubao.com'));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.removed, true);

    res = mockRes();
    await apiListBindings(daemon, mockReq(null, {}, 'GET'), res, mkUrl('?site=www.doubao.com'));
    assert.equal(res.body.total, 0);
  });

  it('POST without site → 400 (FM-7)', async () => {
    const res = mockRes();
    await apiUpsertBinding(daemon, mockReq({ workspace: '/x' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'site is required');
  });
});
