/**
 * F-064 Phase 3 · Bridge Token (Option C) — backend acceptance (Journeys 0a-0d).
 *
 * The browser extension's service worker fetches off a `chrome-extension://<id>`
 * origin which is NOT in the site Origin allowlist. A per-install bridge token
 * (minted Origin-gated, then sent as `X-Awareness-Bridge-Token`) bypasses the
 * allowlist on write. This suite proves the four backend contracts the
 * extension depends on:
 *   0a  mint → write-bypass       (chrome-extension origin + valid token → 200)
 *   0b  mint rejects web origin    (https://evil.com → 403 forbidden_origin)
 *   0c  invalid token falls back   (garbage token + evil origin → 403)
 *   0d  Kimi origin trusted        (kimi.com / moonshot.cn allowlisted)
 *
 * L2 (real indexer + memoryStore + remember engine) + L3 (mint origin gate).
 * Token store is backed by a tmp file so the real ~/.awareness is untouched.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Readable } from 'node:stream';

import {
  apiRecordMemory,
  apiMintBridgeToken,
  apiBridgeTokenStatus,
  apiRevokeBridgeToken,
  isTokenMintOrigin,
  isTrustedBridgeOrigin,
} from '../src/daemon/api-handlers.mjs';
import {
  BridgeTokenStore,
  generateBridgeToken,
} from '../src/core/bridge-token-store.mjs';

let daemon;
let tmpDir;
let tokensFile;

/** Build a mock IncomingMessage carrying an optional JSON body + headers. */
function mockReq(bodyObj, headers = {}, method = 'POST') {
  const json = bodyObj == null
    ? ''
    : (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj));
  const req = Readable.from([Buffer.from(json, 'utf-8')]);
  req.headers = headers;
  req.method = method;
  return req;
}

/** Build a mock ServerResponse capturing status + body. */
function mockRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body) { this.body = body ? JSON.parse(body) : null; },
  };
}

async function record(bodyObj, headers = {}) {
  const res = mockRes();
  await apiRecordMemory(daemon, mockReq(bodyObj, headers), res);
  return res;
}

async function mint(headers = {}, bodyObj = null) {
  const res = mockRes();
  await apiMintBridgeToken(daemon, mockReq(bodyObj, headers), res);
  return res;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-f064-p3-'));
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'memories'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'tasks'), { recursive: true });

  const mod = await import('../src/daemon.mjs');
  daemon = new mod.AwarenessLocalDaemon({ projectDir: tmpDir, port: 0, background: true });

  const { MemoryStore } = await import('../src/core/memory-store.mjs');
  const { Indexer } = await import('../src/core/indexer.mjs');
  daemon.memoryStore = new MemoryStore(tmpDir);
  daemon.indexer = new Indexer(path.join(tmpDir, '.awareness', 'index.db'));

  // Inject a tmp-file-backed token store so the real ~/.awareness is untouched.
  tokensFile = path.join(tmpDir, '.awareness', 'bridge-tokens.json');
  daemon.bridgeTokenStore = new BridgeTokenStore(tokensFile);

  // Minimal wiring for _remember (mirror f064-record-endpoint harness).
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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('F-064 P3 · isTokenMintOrigin (pure)', () => {
  it('allows extension + localhost + no-origin', () => {
    assert.equal(isTokenMintOrigin(undefined), true);
    assert.equal(isTokenMintOrigin('chrome-extension://abcdefghijklmnop'), true);
    assert.equal(isTokenMintOrigin('moz-extension://abcdefghijklmnop'), true);
    assert.equal(isTokenMintOrigin('http://localhost:37800'), true);
    assert.equal(isTokenMintOrigin('http://127.0.0.1:5173'), true);
  });
  it('rejects websites + malformed', () => {
    assert.equal(isTokenMintOrigin('https://evil.com'), false);
    assert.equal(isTokenMintOrigin('https://chatgpt.com'), false); // even a trusted write-site can't MINT
    assert.equal(isTokenMintOrigin('not-a-url'), false);
  });
});

describe('F-064 P3 · Journey 0d — Kimi origin trusted', () => {
  it('kimi.com + moonshot.cn are in the write allowlist', () => {
    assert.equal(isTrustedBridgeOrigin('https://www.kimi.com'), true);
    assert.equal(isTrustedBridgeOrigin('https://kimi.moonshot.cn'), true);
    // suffix-spoof guard still holds
    assert.equal(isTrustedBridgeOrigin('https://evilkimi.com'), false);
  });
});

describe('F-064 P3 · BridgeTokenStore (unit, tmp file)', () => {
  it('generateBridgeToken has the brg_ prefix and is unguessable', () => {
    const t = generateBridgeToken();
    assert.match(t, /^brg_[0-9a-f]{48}$/);
    assert.notEqual(generateBridgeToken(), generateBridgeToken());
  });
  it('mint → isValid → revoke round-trip persists to disk', () => {
    const file = path.join(tmpDir, '.awareness', 'unit-tokens.json');
    const store = new BridgeTokenStore(file);
    assert.equal(store.hasAny(), false);
    const { token } = store.mint('chrome-ext');
    assert.equal(store.hasAny(), true);
    assert.equal(store.count(), 1);
    assert.equal(store.isValid(token), true);
    assert.equal(store.isValid('brg_garbage'), false);

    // Reload from disk → token survives
    const reopened = new BridgeTokenStore(file);
    assert.equal(reopened.isValid(token), true);

    assert.equal(store.revoke(token), true);
    assert.equal(store.revoke(token), false); // already gone
    assert.equal(store.isValid(token), false);
  });
});

// ---------------------------------------------------------------------------
// Endpoint journeys
// ---------------------------------------------------------------------------

describe('F-064 P3 · Journey 0a — mint then write-bypass', () => {
  it('SW mints from chrome-extension origin, then writes with token past the allowlist', async () => {
    // status is empty for a fresh install path (this daemon's store is tmp)
    const statusRes = mockRes();
    await apiBridgeTokenStatus(daemon, mockReq(null, {}, 'GET'), statusRes);
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.body.has_token, false);

    // mint (origin = chrome-extension://) → { status:'ok', token, created_at }
    const minted = await mint({ origin: 'chrome-extension://mnbagldalglfacjhbdmphdefgbcdefgh' }, { label: 'chrome-ext' });
    assert.equal(minted.statusCode, 200);
    assert.equal(minted.body.status, 'ok');
    assert.match(minted.body.token, /^brg_[0-9a-f]{48}$/);
    const token = minted.body.token;

    // status now reflects the minted token
    const statusRes2 = mockRes();
    await apiBridgeTokenStatus(daemon, mockReq(null, {}, 'GET'), statusRes2);
    assert.equal(statusRes2.body.has_token, true);
    assert.equal(statusRes2.body.count, 1);

    // Write from the chrome-extension origin (NOT in the site allowlist) but
    // carrying the valid token → 200 (token bypasses Origin check).
    const write = await record(
      {
        content: 'Bridge write: chose service-worker fetch over content-script fetch because the SW origin is fixed (chrome-extension://) and bypasses CORS via host_permissions, while page CSP connect-src blocks content-script 127.0.0.1 fetch on strict sites like ChatGPT.',
        source: 'external_chat',
        metadata: { site: 'chatgpt', via: 'service_worker' },
      },
      {
        origin: 'chrome-extension://mnbagldalglfacjhbdmphdefgbcdefgh',
        'x-awareness-bridge-token': token,
      },
    );
    assert.equal(write.statusCode, 200);
    assert.equal(write.body.status, 'ok');
    assert.ok(write.body.id, 'must persist a memory id');
  });
});

describe('F-064 P3 · Journey 0b — mint rejects web origin', () => {
  it('POST /bridge/token from https://evil.com → 403 forbidden_origin', async () => {
    const res = await mint({ origin: 'https://evil.com' }, { label: 'attacker' });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'forbidden_origin');
  });
});

describe('F-064 P3 · Journey 0c — invalid token falls back to origin check', () => {
  it('garbage token + evil origin → 403 (does NOT bypass allowlist)', async () => {
    const res = await record(
      { content: 'should never be written via a forged token', source: 'external_chat' },
      { origin: 'https://evil.example.com', 'x-awareness-bridge-token': 'brg_garbagegarbagegarbage' },
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'forbidden_origin');
  });

  it('garbage token but TRUSTED origin still writes (falls back to origin allowlist)', async () => {
    const res = await record(
      { content: 'A genuine doubao capture whose bad token is simply ignored; the trusted Origin carries the write.', source: 'external_chat' },
      { origin: 'https://www.doubao.com', 'x-awareness-bridge-token': 'brg_garbage' },
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'ok');
  });
});

describe('F-064 P3 · revoke endpoint', () => {
  it('DELETE /bridge/token?token=... revokes and blocks future writes', async () => {
    const minted = await mint({ origin: 'chrome-extension://revoketestidididididididid' });
    const token = minted.body.token;

    // token works
    const ok = await record(
      { content: 'Write that succeeds while the token is live and valid for the bridge.', source: 'external_chat' },
      { origin: 'chrome-extension://revoketestidididididididid', 'x-awareness-bridge-token': token },
    );
    assert.equal(ok.statusCode, 200);

    // revoke
    const revRes = mockRes();
    const url = new URL(`http://localhost/api/v1/bridge/token?token=${encodeURIComponent(token)}`);
    await apiRevokeBridgeToken(daemon, mockReq(null, {}, 'DELETE'), revRes, url);
    assert.equal(revRes.statusCode, 200);
    assert.equal(revRes.body.status, 'ok');
    assert.equal(revRes.body.revoked, true);

    // revoked token no longer bypasses → chrome-extension origin now blocked
    const blocked = await record(
      { content: 'This must be rejected because the token was revoked.', source: 'external_chat' },
      { origin: 'chrome-extension://revoketestidididididididid', 'x-awareness-bridge-token': token },
    );
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.body.error, 'forbidden_origin');
  });

  it('DELETE with no token → 400', async () => {
    const res = mockRes();
    const url = new URL('http://localhost/api/v1/bridge/token');
    await apiRevokeBridgeToken(daemon, mockReq(null, {}, 'DELETE'), res, url);
    assert.equal(res.statusCode, 400);
  });
});
