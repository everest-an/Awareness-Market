/**
 * F-085 (R1) · /prompt/inject trust gate — ACCEPTANCE Journey 1.
 *
 * Before F-085, `GET /api/v1/prompt/inject?q=...` was a no-key endpoint: any
 * same-machine web page could `fetch('http://127.0.0.1:37800/api/v1/prompt/
 * inject?q=password')` and read the user's local memories (privacy red-line).
 *
 * This suite proves the gate now applied in `handleApiRoute`:
 *   - anonymous cross-origin (evil site, no token) → 403 forbidden_origin
 *   - native host-LLM (no Origin) / whitelisted site / valid bridge token → 200
 *   - garbage token + evil origin → still 403
 *   - escape hatch AWARENESS_PROMPT_INJECT_OPEN=1 → gate disabled
 *
 * Routed through the real `handleApiRoute` so the test exercises the actual
 * dispatch path, not the handler in isolation. Token store is tmp-file-backed.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Readable } from 'node:stream';

import { handleApiRoute } from '../src/daemon/api-handlers.mjs';
import { BridgeTokenStore } from '../src/core/bridge-token-store.mjs';

let daemon;
let tmpDir;
let validToken;

function mockReq(headers = {}, method = 'GET') {
  const req = Readable.from([Buffer.from('', 'utf-8')]);
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

async function inject(headers = {}, query = 'q=anything') {
  const res = mockRes();
  const url = new URL(`http://localhost/api/v1/prompt/inject?${query}`);
  await handleApiRoute(daemon, mockReq(headers, 'GET'), res, url);
  return res;
}

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-f085-r1-'));
  fs.mkdirSync(path.join(tmpDir, '.awareness'), { recursive: true });

  // Lightweight daemon stub: inject only needs a search/indexer surface, and
  // the gate needs a tmp-file bridge token store (real ~/.awareness untouched).
  const tokensFile = path.join(tmpDir, '.awareness', 'bridge-tokens.json');
  const store = new BridgeTokenStore(tokensFile);
  validToken = store.mint('test-ext').token;

  daemon = {
    bridgeTokenStore: store,
    search: null,
    indexer: { search: () => [] }, // empty index → "No memory found", still 200
  };
});

after(() => {
  delete process.env.AWARENESS_PROMPT_INJECT_OPEN;
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

describe('F-085 R1 · /prompt/inject trust gate', () => {
  it('BLOCKS an anonymous cross-origin page (evil site, no token) → 403', async () => {
    const res = await inject({ origin: 'https://evil.example' });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'forbidden_origin');
    assert.equal(res.body.markdown, undefined, 'must not leak any memory content');
  });

  it('ALLOWS a native host-LLM (no Origin) → 200', async () => {
    const res = await inject({}); // no origin header
    assert.equal(res.statusCode, 200);
    assert.equal(typeof res.body.markdown, 'string');
  });

  it('ALLOWS a whitelisted site Origin (doubao) → 200', async () => {
    const res = await inject({ origin: 'https://www.doubao.com' });
    assert.equal(res.statusCode, 200);
  });

  it('ALLOWS a valid bridge token even from a non-whitelisted origin → 200', async () => {
    const res = await inject({
      origin: 'chrome-extension://mnbagldalglfacjhbdmphdefgbcdefgh',
      'x-awareness-bridge-token': validToken,
    });
    assert.equal(res.statusCode, 200);
  });

  it('BLOCKS a garbage token + evil origin → 403 (forged token does not bypass)', async () => {
    const res = await inject({
      origin: 'https://evil.example',
      'x-awareness-bridge-token': 'brg_garbagegarbagegarbage',
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'forbidden_origin');
  });

  it('escape hatch: AWARENESS_PROMPT_INJECT_OPEN=1 disables the gate → 200', async () => {
    process.env.AWARENESS_PROMPT_INJECT_OPEN = '1';
    try {
      const res = await inject({ origin: 'https://evil.example' });
      assert.equal(res.statusCode, 200);
    } finally {
      delete process.env.AWARENESS_PROMPT_INJECT_OPEN;
    }
  });
});
