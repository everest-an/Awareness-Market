/**
 * Supplementary coverage for src/core/telemetry.mjs (F-040 Phase 2).
 * The base file (telemetry-core.test.mjs) covers opt-out, whitelist, and
 * basic flush. This file adds coverage for:
 *   - anonymous installation_id fallback when device_id is missing
 *   - BATCH_TRIGGER auto-flush at 20 events
 *   - listRecent(limit) returns tail slice
 *   - shutdown() clears timer AND calls flush
 *   - queue restored from disk on construction
 *   - endpoint trailing slash normalization
 *   - setEnabled(true) starts flush loop; idempotent when already enabled
 *   - flush() is a no-op when queue is empty (no POST)
 *   - deleteLocal() swallows fetch rejections (fire-and-forget)
 *   - track() with dict property is dropped (only allowed primitives pass)
 *   - flush() POST payload shape matches backend contract
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Telemetry } from '../src/core/telemetry.mjs';

function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-tel-extra-'));
  fs.mkdirSync(path.join(dir, '.awareness'), { recursive: true });
  return dir;
}

function makeTel({ enabled = true, fetchImpl, endpoint = 'https://example.test/api/v1', deviceId = 'dev-test-1' } = {}) {
  const projectDir = tmpProject();
  const realFetch = global.fetch;
  if (fetchImpl) global.fetch = fetchImpl;
  const tel = new Telemetry({
    config: { telemetry: { enabled, endpoint }, device: { id: deviceId } },
    projectDir,
    version: '0.6.0-test',
  });
  return { tel, projectDir, restore() { global.fetch = realFetch; } };
}

test('Telemetry: default-on when config has no telemetry section (fresh install)', () => {
  // Regression for selection-B policy: if the user never touched the opt-in,
  // telemetry should still run (they can opt out via Settings → Privacy).
  const projectDir = tmpProject();
  const realFetch = global.fetch;
  try {
    const tel = new Telemetry({
      config: { device: { id: 'fresh-install' } }, // NO telemetry key
      projectDir,
      version: '0.6.1-test',
    });
    assert.equal(tel.enabled, true, 'fresh install must default to opted-in');
  } finally {
    global.fetch = realFetch;
  }
});

test('Telemetry: explicit enabled:false disables even though default is on', () => {
  const projectDir = tmpProject();
  const realFetch = global.fetch;
  try {
    const tel = new Telemetry({
      config: { telemetry: { enabled: false }, device: { id: 'opted-out' } },
      projectDir,
      version: '0.6.1-test',
    });
    assert.equal(tel.enabled, false, 'explicit opt-out must disable');
    tel.track('daemon_started', { os: 'darwin' });
    assert.equal(tel.queue.length, 0);
  } finally {
    global.fetch = realFetch;
  }
});

test('Telemetry: anon installation_id fallback when deviceId missing', () => {
  const { tel, restore } = makeTel({ deviceId: '' });
  try {
    assert.match(tel.installationId, /^anon-[0-9a-f]{12}$/);
  } finally { restore(); }
});

test('Telemetry: BATCH_TRIGGER (20) auto-flushes when reached', async () => {
  const calls = [];
  const { tel, restore } = makeTel({
    fetchImpl: async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return { ok: true };
    },
  });
  try {
    for (let i = 0; i < 20; i++) tel.track('daemon_started', { os: 'darwin' });
    // track() calls flush() inline (not awaited), so microtask loop resolves it
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(calls.length, 1, 'expected exactly one flush POST');
    assert.equal(calls[0].body.events.length, 20);
  } finally { restore(); }
});

test('Telemetry: listRecent(limit) returns at most limit tail events', () => {
  const { tel, restore } = makeTel();
  try {
    for (let i = 0; i < 10; i++) tel.track('daemon_started', { step_number: i });
    const recent = tel.listRecent(3);
    assert.equal(recent.length, 3);
    assert.deepEqual(recent.map((e) => e.properties.step_number), [7, 8, 9]);
  } finally { restore(); }
});

test('Telemetry: shutdown() clears interval timer and triggers a final flush', async () => {
  let flushed = 0;
  const { tel, restore } = makeTel({
    fetchImpl: async () => { flushed += 1; return { ok: true }; },
  });
  try {
    tel.track('daemon_started', { os: 'darwin' });
    assert.ok(tel.timer, 'flush timer should be set when enabled');
    await tel.shutdown();
    assert.equal(tel.timer, null, 'timer cleared on shutdown');
    assert.equal(flushed, 1);
  } finally { restore(); }
});

test('Telemetry: constructor restores queue from disk', () => {
  const { tel: first, projectDir, restore } = makeTel();
  try {
    first.track('daemon_started', { os: 'darwin' });
    first.track('mcp_tool_called', { tool_name: 'awareness_recall' });
    // Simulate a daemon restart — new Telemetry over same projectDir
    const second = new Telemetry({
      config: { telemetry: { enabled: true }, device: { id: 'dev-test-1' } },
      projectDir,
      version: '0.6.0-test',
    });
    assert.equal(second.queue.length, 2);
    assert.equal(second.queue[0].event_type, 'daemon_started');
    assert.equal(second.queue[1].event_type, 'mcp_tool_called');
  } finally { restore(); }
});

test('Telemetry: endpoint trailing slash is normalized before POST', async () => {
  const urls = [];
  const { tel, restore } = makeTel({
    endpoint: 'https://example.test/api/v1/',
    fetchImpl: async (url) => { urls.push(url); return { ok: true }; },
  });
  try {
    tel.track('daemon_started', { os: 'darwin' });
    await tel.flush();
    assert.equal(urls[0], 'https://example.test/api/v1/telemetry/events');
  } finally { restore(); }
});

test('Telemetry: setEnabled(true) starts flush loop; setEnabled(true) again is idempotent', () => {
  const { tel, restore } = makeTel({ enabled: false });
  try {
    assert.equal(tel.timer, null);
    tel.setEnabled(true);
    const t1 = tel.timer;
    assert.ok(t1, 'timer started');
    tel.setEnabled(true);
    assert.equal(tel.timer, t1, 'timer not recreated on idempotent re-enable');
  } finally { restore(); }
});

test('Telemetry: flush() is a no-op when queue is empty (no POST)', async () => {
  let called = 0;
  const { tel, restore } = makeTel({
    fetchImpl: async () => { called += 1; return { ok: true }; },
  });
  try {
    await tel.flush();
    assert.equal(called, 0);
  } finally { restore(); }
});

test('Telemetry: deleteLocal() swallows fetch rejection silently', async () => {
  const { tel, restore } = makeTel({
    fetchImpl: async () => { throw new Error('network down'); },
  });
  try {
    tel.track('daemon_started', { os: 'darwin' });
    await assert.doesNotReject(() => tel.deleteLocal());
    assert.equal(tel.queue.length, 0, 'local queue cleared regardless of network result');
  } finally { restore(); }
});

test('Telemetry: dict-typed property is dropped (prevents PII leaks via nested objects)', () => {
  const { tel, restore } = makeTel();
  try {
    tel.track('daemon_started', { os: 'darwin', feature_name: { nested: 'leak' } });
    const evt = tel.queue[0];
    assert.equal(evt.properties.os, 'darwin');
    assert.ok(!('feature_name' in evt.properties));
  } finally { restore(); }
});

test('Telemetry: flush() POST body matches backend contract', async () => {
  let body = null;
  const { tel, restore } = makeTel({
    fetchImpl: async (_url, opts) => { body = JSON.parse(opts.body); return { ok: true }; },
  });
  try {
    tel.track('daemon_started', { os: 'darwin', daemon_version: '0.6.0' });
    await tel.flush();
    assert.ok(Array.isArray(body.events));
    assert.equal(body.events.length, 1);
    const e = body.events[0];
    assert.equal(e.event_type, 'daemon_started');
    assert.match(e.installation_id, /^[0-9a-f]{64}$/);
    assert.match(e.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(e.properties, { os: 'darwin', daemon_version: '0.6.0' });
  } finally { restore(); }
});

test('Telemetry: remote:false never POSTs — test-mode guard', async () => {
  // Regression: a test that enabled telemetry without overriding the endpoint
  // shipped its fixture events to the PRODUCTION analytics endpoint (242
  // `awareness_not_real` rows over 6 months). remote:false is the guard.
  let calls = 0;
  const projectDir = tmpProject();
  const realFetch = global.fetch;
  global.fetch = async () => { calls += 1; return { ok: true }; };
  try {
    const tel = new Telemetry({
      config: { telemetry: { enabled: true }, device: { id: 'dev-test-1' } },
      projectDir,
      version: 'test',
      remote: false,
    });
    tel.track('daemon_started', { os: 'darwin' });
    tel.track('feature_blocked', { feature_name: 'awareness_not_real' });
    await tel.flush();
    assert.equal(calls, 0, 'remote:false must not POST events');
    assert.equal(tel.queue.length, 2, 'events stay in memory for the privacy page');
    await tel.deleteLocal();
    assert.equal(calls, 0, 'remote:false must not POST forget either');
  } finally { global.fetch = realFetch; }
});

test('Telemetry: a test run cannot reach the PRODUCTION endpoint even without remote:false', async () => {
  // Structural guard: NODE_TEST_CONTEXT is set under `node --test`, so a test
  // that forgets remote:false must still be unable to hit the real endpoint.
  assert.ok(process.env.NODE_TEST_CONTEXT, 'expected to run under node --test');
  let calls = 0;
  const projectDir = tmpProject();
  const realFetch = global.fetch;
  global.fetch = async () => { calls += 1; return { ok: true }; };
  try {
    const tel = new Telemetry({
      // no endpoint override -> falls through to the production default
      config: { telemetry: { enabled: true }, device: { id: 'dev-test-1' } },
      projectDir,
      version: 'test',
      // deliberately NOT passing remote:false
    });
    assert.equal(tel.remote, false, 'test run must not ship to the prod default');
    tel.track('daemon_started', { os: 'darwin' });
    await tel.flush();
    assert.equal(calls, 0, 'no network from a test run to the production endpoint');
  } finally { global.fetch = realFetch; }
});

test('Telemetry: a test run MAY still send to an explicit non-prod endpoint', async () => {
  // The guard blocks only the production URL, not the send path — existing
  // tests that verify POST behaviour against their own endpoint keep working.
  let calls = 0;
  const projectDir = tmpProject();
  const realFetch = global.fetch;
  global.fetch = async () => { calls += 1; return { ok: true }; };
  try {
    const tel = new Telemetry({
      config: { telemetry: { enabled: true, endpoint: 'https://example.test/api/v1' }, device: { id: 'dev-test-1' } },
      projectDir,
      version: 'test',
    });
    assert.equal(tel.remote, true, 'explicit non-prod endpoint should still send');
    tel.track('daemon_started', { os: 'darwin' });
    await tel.flush();
    assert.equal(calls, 1, 'explicit endpoint receives the POST');
  } finally { global.fetch = realFetch; }
});
