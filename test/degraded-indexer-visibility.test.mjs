/**
 * A dead index must never report as healthy.
 *
 * `createNoopIndexer()` is the fallback used when better-sqlite3 cannot load.
 * It returns a truthy, shape-complete object, so every `if (!daemon.indexer)`
 * guard in the codebase passes and `getStats()` returns all zeros. The result
 * was that a completely dead index looked exactly like a brand-new empty
 * workspace at every surface:
 *
 *   - /healthz              -> {"status":"ok", stats:{totalMemories:0,...}}
 *   - awareness-local status -> "Memories: 0"
 *   - awareness_record       -> {"status":"ok"} while the write vaporised
 *   - awareness_recall       -> [] forever, reading as "no relevant memories"
 *
 * One user ran for three weeks in exactly this state. These tests pin the
 * `degraded` flag and its propagation into /healthz, which is what every other
 * surface reads.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createNoopIndexer } from '../src/daemon/helpers.mjs';
import { handleHealthz } from '../src/daemon/http-handlers.mjs';

/** Minimal res double capturing what jsonResponse writes. */
function mockRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(body) { this.body = body; return this; },
  };
}

function healthOf(indexer) {
  const daemon = {
    indexer,
    _startedAt: Date.now() - 5000,
    port: 37800,
    projectDir: '/some/project',
    _embedder: null,
  };
  const res = mockRes();
  handleHealthz(daemon, res, { version: '0.0.0-test' });
  return JSON.parse(res.body);
}

/** Stand-in for a working Indexer: no degraded flag, real-looking counts. */
function healthyIndexer() {
  return {
    getStats: () => ({ totalMemories: 42, totalKnowledge: 7, totalTasks: 3, totalSessions: 5 }),
  };
}

test('noop indexer carries a degraded flag and a reason', () => {
  const noop = createNoopIndexer();
  assert.equal(noop.degraded, true, 'the fallback must be self-identifying');
  assert.ok(noop.degradedReason, 'must explain why, so the user can act on it');
});

test('the degraded reason is propagated from the call site', () => {
  const noop = createNoopIndexer('better-sqlite3 rebuild failed: NODE_MODULE_VERSION 127');
  assert.match(noop.degradedReason, /rebuild failed/);
  assert.match(noop.degradedReason, /NODE_MODULE_VERSION/);
});

test('noop indexer stays truthy and shape-complete (guards must not break)', () => {
  // Deliberate: the flag is additive. Downstream `if (!daemon.indexer)` guards
  // still pass, so adding the flag cannot itself change behaviour.
  const noop = createNoopIndexer();
  assert.ok(noop, 'must remain truthy');
  assert.equal(typeof noop.getStats, 'function');
  assert.equal(typeof noop.search, 'function');
  assert.deepEqual(noop.search(), []);
  assert.equal(typeof noop.db.prepare, 'function');
});

test('/healthz reports degraded when the index is dead', () => {
  const body = healthOf(createNoopIndexer('SQLite indexer unavailable: cannot open shared object'));

  assert.equal(body.status, 'degraded', 'a dead index must not report status ok');
  assert.equal(body.indexer.ok, false);
  assert.match(body.indexer.reason, /SQLite indexer unavailable/);
});

test('/healthz still reports ok for a working index', () => {
  const body = healthOf(healthyIndexer());

  assert.equal(body.status, 'ok');
  assert.equal(body.indexer.ok, true);
  assert.equal(body.indexer.reason, null);
  assert.equal(body.stats.totalMemories, 42);
});

test('zero memories on a HEALTHY index is still ok, not degraded', () => {
  // The distinction that did not exist before: an empty workspace and a dead
  // index both showed zeros. Only the latter is a problem.
  const empty = { getStats: () => ({ totalMemories: 0, totalKnowledge: 0, totalTasks: 0, totalSessions: 0 }) };
  const body = healthOf(empty);

  assert.equal(body.status, 'ok', 'a genuinely empty workspace is healthy');
  assert.equal(body.indexer.ok, true);
});

test('a dead index and an empty workspace are now distinguishable', () => {
  const deadBody = healthOf(createNoopIndexer());
  const emptyBody = healthOf({
    getStats: () => ({ totalMemories: 0, totalKnowledge: 0, totalTasks: 0, totalSessions: 0 }),
  });

  // Identical stats...
  assert.deepEqual(deadBody.stats, emptyBody.stats);
  // ...but no longer identical health.
  assert.notEqual(deadBody.status, emptyBody.status);
});
