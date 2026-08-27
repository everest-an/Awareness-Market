/**
 * F-064 · POST /api/v1/memories — External AI Memory Bridge write endpoint.
 *
 * L2 integration (real indexer + memoryStore + remember engine) + L3 failure
 * modes (untrusted origin, UI noise, malformed metadata, cloud auth).
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Readable } from 'node:stream';

import {
  apiRecordMemory,
  isTrustedBridgeOrigin,
  sanitizeInboundMetadata,
} from '../src/daemon/api-handlers.mjs';

let daemon;
let tmpDir;

/** Build a mock IncomingMessage carrying a JSON body + headers. */
function mockReq(bodyObj, headers = {}) {
  const json = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
  const req = Readable.from([Buffer.from(json, 'utf-8')]);
  req.headers = headers;
  req.method = 'POST';
  return req;
}

/** Build a mock ServerResponse capturing status + body. */
function mockRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body) { this.body = body ? JSON.parse(body) : null; },
  };
  return res;
}

async function post(bodyObj, headers = {}) {
  const res = mockRes();
  await apiRecordMemory(daemon, mockReq(bodyObj, headers), res);
  return res;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-f064-ep-'));
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'memories'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'tasks'), { recursive: true });

  const mod = await import('../src/daemon.mjs');
  daemon = new mod.AwarenessLocalDaemon({ projectDir: tmpDir, port: 0, background: true });

  const { MemoryStore } = await import('../src/core/memory-store.mjs');
  const { Indexer } = await import('../src/core/indexer.mjs');
  daemon.memoryStore = new MemoryStore(tmpDir);
  daemon.indexer = new Indexer(path.join(tmpDir, '.awareness', 'index.db'));

  // Minimal wiring for _remember (mirror f057 golden harness).
  daemon._embedder = null;
  daemon.cloudSync = { isEnabled: () => false };
  daemon._sessions = new Map();
  daemon._extractAndIndex = () => {};
  daemon._embedAndStore = async () => {};
  daemon._buildPerception = async () => [];
  daemon._checkPerceptionResolution = async () => {};
  daemon._loadSpec = () => ({});
});

after(() => {
  try { daemon?.indexer?.close?.(); } catch { /* best-effort */ }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

describe('F-064 origin allowlist (pure)', () => {
  it('allows missing origin (native/curl)', () => {
    assert.equal(isTrustedBridgeOrigin(undefined), true);
  });
  it('allows localhost origins', () => {
    assert.equal(isTrustedBridgeOrigin('http://localhost:37800'), true);
    assert.equal(isTrustedBridgeOrigin('http://127.0.0.1:5173'), true);
  });
  it('allows supported chat sites', () => {
    assert.equal(isTrustedBridgeOrigin('https://www.doubao.com'), true);
    assert.equal(isTrustedBridgeOrigin('https://gemini.google.com'), true);
    assert.equal(isTrustedBridgeOrigin('https://chatgpt.com'), true);
  });
  it('rejects untrusted + malformed origins', () => {
    assert.equal(isTrustedBridgeOrigin('https://evil.example.com'), false);
    assert.equal(isTrustedBridgeOrigin('not-a-url'), false);
    // suffix-spoof: evildoubao.com must NOT match doubao.com
    assert.equal(isTrustedBridgeOrigin('https://evildoubao.com'), false);
  });
});

describe('F-064 sanitizeInboundMetadata (pure)', () => {
  it('accepts plain object', () => {
    assert.deepEqual(sanitizeInboundMetadata({ a: 1 }), { a: 1 });
  });
  it('rejects array/string/number → null', () => {
    assert.equal(sanitizeInboundMetadata([1, 2]), null);
    assert.equal(sanitizeInboundMetadata('str'), null);
    assert.equal(sanitizeInboundMetadata(42), null);
    assert.equal(sanitizeInboundMetadata(null), null);
  });
});

describe('F-064 POST /memories', () => {
  it('Journey 1: writes an external_chat memory with metadata', async () => {
    const res = await post(
      {
        content: '讨论了 pgvector vs Qdrant：Qdrant 做 ANN 召回，pgvector 做精确重排。',
        source: 'external_chat',
        session_id: 'ext_doubao_20260701_001',
        title: 'pgvector vs Qdrant',
        tags: ['vector-db'],
        metadata: { site: 'doubao', url: 'https://www.doubao.com/x', model: 'doubao-pro' },
      },
      { origin: 'https://www.doubao.com' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.id, 'must return a memory id');

    // SQLite row carries metadata + session_id
    const row = daemon.indexer.db
      .prepare('SELECT session_id, source, metadata FROM memories WHERE id = ?')
      .get(res.body.id);
    assert.equal(row.session_id, 'ext_doubao_20260701_001');
    assert.equal(row.source, 'external_chat');
    assert.equal(JSON.parse(row.metadata).site, 'doubao');

    // Markdown file front matter carries metadata
    const md = fs.readFileSync(res.body.filepath, 'utf-8');
    assert.match(md, /metadata:/);
    assert.match(md, /doubao/);
  });

  it('Journey 3: same-source dedup returns duplicate; cross-source keeps both', async () => {
    const content = 'Decision: Redis for rate-limit counters, Postgres for durable state.';
    const first = await post(
      { content, source: 'external_chat' },
      { origin: 'http://localhost:37800' },
    );
    assert.equal(first.body.status, 'ok');

    const dup = await post(
      { content, source: 'external_chat' },
      { origin: 'http://localhost:37800' },
    );
    assert.equal(dup.body.status, 'duplicate');
    assert.equal(dup.body.id, first.body.id);

    // Same content, DIFFERENT source → independent record (two rows)
    const other = await post(
      { content, source: 'claude-code' },
      { origin: 'http://localhost:37800' },
    );
    assert.equal(other.body.status, 'ok');
    assert.notEqual(other.body.id, first.body.id);
  });

  it('FM-1: untrusted origin → 403', async () => {
    const res = await post(
      { content: 'should never be written', source: 'external_chat' },
      { origin: 'https://evil.example.com' },
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'forbidden_origin');
  });

  it('FM-2: pure UI-noise capture → skipped', async () => {
    const res = await post(
      { content: '重新生成 复制 分享 内容由 AI 生成，请仔细甄别', source: 'external_chat' },
      { origin: 'https://www.doubao.com' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'skipped');
    assert.match(res.body.reason, /external_chat_ui_noise/);
  });

  it('FM-4: malformed metadata degrades to null but still writes', async () => {
    const res = await post(
      {
        content: 'Real content that must persist despite bad metadata payload.',
        source: 'external_chat',
        metadata: 'this-is-not-an-object',
      },
      { origin: 'https://www.doubao.com' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
    const row = daemon.indexer.db
      .prepare('SELECT metadata FROM memories WHERE id = ?')
      .get(res.body.id);
    assert.equal(row.metadata, null);
  });

  it('rejects missing content → 400', async () => {
    const res = await post({ source: 'external_chat' }, { origin: 'http://localhost:37800' });
    assert.equal(res.statusCode, 400);
  });

  it('FM-5: cloud auth required + no Authorization → 401', async () => {
    process.env.AWARENESS_BRIDGE_REQUIRE_AUTH = '1';
    try {
      const res = await post(
        { content: 'blocked without auth', source: 'external_chat' },
        { origin: 'http://localhost:37800' },
      );
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'authorization_required');

      // With Authorization present → allowed
      const ok = await post(
        { content: 'allowed once Authorization header is present', source: 'external_chat' },
        { origin: 'http://localhost:37800', authorization: 'Bearer test-token' },
      );
      assert.equal(ok.statusCode, 200);
    } finally {
      delete process.env.AWARENESS_BRIDGE_REQUIRE_AUTH;
    }
  });
});
