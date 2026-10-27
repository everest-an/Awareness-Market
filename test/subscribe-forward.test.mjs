/**
 * subscribe-forward.test.mjs — "server half" of the welcome-step email opt-in
 * (F-040 Phase B; client half: onboarding-email-optin.test.mjs).
 *
 * Contract:
 *   - POST /api/v1/subscribe forwards {email, source} to the cloud /subscribe
 *   - NEVER attaches installation_id (address stays unlinked from the install)
 *   - invalid JSON → 400; missing email → 400
 *   - cloud failure → soft 502, never throws
 *   - route is registered in handleApiRoute (L1 verify-endpoints parity)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { apiSubscribe, handleApiRoute } from '../src/daemon/api-handlers.mjs';

function mockRes() {
  let _status = 200;
  let _body = '';
  return {
    writeHead(status) { _status = status; },
    end(body) { _body = body; },
    get status() { return _status; },
    get json() { return JSON.parse(_body); },
  };
}

function mockReq(body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const chunks = [Buffer.from(payload)];
  return {
    on(event, handler) {
      if (event === 'data') {
        for (const c of chunks) handler(c);
      } else if (event === 'end') {
        handler();
      }
    },
  };
}

/** Fake daemon mirroring the real one: config is read via `_loadConfig()`
 * (never `daemon.config` — see the F-035 note in cloud-auth-handlers.test.mjs). */
function fakeDaemon({ onPost, configOverride } = {}) {
  const calls = [];
  const config = configOverride ?? {
    cloud: { api_base: 'https://backend.test/api/v1' },
  };
  return {
    _loadConfig() {
      return config;
    },
    async _httpJson(method, url, body) {
      calls.push({ method, url, body });
      if (onPost) return onPost({ method, url, body, callIndex: calls.length - 1 });
      return { status: 'ok' };
    },
    _calls: calls,
  };
}

describe('apiSubscribe (F-040 Phase B server half)', () => {
  it('forwards the trimmed email with source and no installation_id', async () => {
    const daemon = fakeDaemon();
    const res = mockRes();
    await apiSubscribe(daemon, mockReq({ email: ' User@Example.com ', source: 'daemon-onboarding' }), res);

    assert.equal(res.status, 200);
    assert.equal(daemon._calls.length, 1);
    assert.equal(daemon._calls[0].method, 'POST');
    assert.equal(daemon._calls[0].url, 'https://backend.test/api/v1/subscribe');
    assert.deepEqual(daemon._calls[0].body, {
      email: 'User@Example.com',
      source: 'daemon-onboarding',
    });
    assert.ok(!('installation_id' in daemon._calls[0].body), 'address must stay unlinked');
  });

  it('defaults the source when the caller omits it', async () => {
    const daemon = fakeDaemon();
    const res = mockRes();
    await apiSubscribe(daemon, mockReq({ email: 'a@b.co' }), res);
    assert.equal(res.status, 200);
    assert.equal(daemon._calls[0].body.source, 'daemon-onboarding');
  });

  it('rejects invalid JSON with 400 and forwards nothing', async () => {
    const daemon = fakeDaemon();
    const res = mockRes();
    await apiSubscribe(daemon, mockReq('{not-json'), res);
    assert.equal(res.status, 400);
    assert.equal(daemon._calls.length, 0);
  });

  it('rejects a missing/blank email with 400', async () => {
    const daemon = fakeDaemon();
    const res = mockRes();
    await apiSubscribe(daemon, mockReq({ email: '   ' }), res);
    assert.equal(res.status, 400);
    assert.equal(daemon._calls.length, 0);
  });

  it('surfaces cloud failure as a soft 502 (never throws)', async () => {
    const daemon = fakeDaemon({
      onPost: () => { throw new Error('Timeout'); },
    });
    const res = mockRes();
    await apiSubscribe(daemon, mockReq({ email: 'a@b.co' }), res);
    assert.equal(res.status, 502);
    assert.equal(res.json.error, 'subscribe_unreachable');
  });

  it('is registered on POST /api/v1/subscribe in handleApiRoute', async () => {
    const daemon = fakeDaemon();
    const res = mockRes();
    const req = mockReq({ email: 'a@b.co' });
    req.method = 'POST';
    await handleApiRoute(daemon, req, res, new URL('http://localhost:37800/api/v1/subscribe'));
    assert.equal(daemon._calls.length, 1);
    assert.equal(daemon._calls[0].url, 'https://backend.test/api/v1/subscribe');
  });
});
