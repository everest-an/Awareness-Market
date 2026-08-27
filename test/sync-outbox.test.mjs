// Batch A · Outbox semantics against in-memory SQLite: idempotent enqueue, due
// selection, terminal-state guards, user isolation, problems aggregation, and pruning.
// No daemon, no HTTP.
//
// 2026-08-05 revision: user_id enforced on every query, envelope_json replaced by ref_id.
// Stats/listDue/pruneSettled all require userId; problems() added for the sync panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  ensureOutboxTable, enqueue, get, listDue, recordAttempt, markTerminal,
  stats, problems, pruneSettled,
} from '../src/core/sync/sync-outbox.mjs';
import {nextDeliveryAction, scheduleNextAttempt} from '../src/core/sync/delivery-policy.mjs';

const T0 = new Date('2026-08-05T10:00:00.000Z');
const at = (ms) => new Date(T0.getTime() + ms);
const USER = 'u-1';

function db() {
  const d = new Database(':memory:');
  ensureOutboxTable(d);
  return d;
}

const env = (over = {}) => {
  const ttlMs = over.ttlMs ?? 24 * 60 * 60 * 1000;
  return {
    userId: over.userId ?? USER,
    messageId: over.messageId ?? 'm-1',
    kind: over.kind ?? 'card.upsert',
    refId: over.refId ?? 'c-1',
    correlationId: over.correlationId ?? (over.messageId ?? 'm-1'),
    targetDeviceId: over.targetDeviceId ?? null,
    expiresAt: new Date((over.now ?? T0).getTime() + ttlMs).toISOString(),
  };
};

test('stats are isolated by user_id', () => {
  const d = db();
  enqueue(d, env({messageId: 'a'}), {now: T0});
  enqueue(d, env({messageId: 'b', userId: 'u-2'}), {now: T0});
  assert.deepEqual(stats(d, 'u-1'), {pending: 1, acked: 0, failed: 0, expired: 0});
  assert.deepEqual(stats(d, 'u-2'), {pending: 1, acked: 0, failed: 0, expired: 0});
  assert.deepEqual(stats(d, 'u-3'), {pending: 0, acked: 0, failed: 0, expired: 0});
});

test('listDue is scoped to one user', () => {
  const d = db();
  enqueue(d, env({messageId: 'due-u1'}), {now: T0});
  enqueue(d, env({messageId: 'due-u2', userId: 'u-2'}), {now: T0});
  const ids = listDue(d, 'u-1', {now: at(1000)}).map((r) => r.message_id);
  assert.deepEqual(ids, ['due-u1']);
});

test('pruneSettled is scoped to one user', () => {
  const d = db();
  enqueue(d, env({messageId: 'old-u1'}), {now: T0});
  enqueue(d, env({messageId: 'old-u2', userId: 'u-2'}), {now: T0});
  markTerminal(d, 'old-u1', 'acked', {now: T0});
  markTerminal(d, 'old-u2', 'acked', {now: T0});
  const removed = pruneSettled(d, 'u-1', {before: at(60_000)});
  assert.equal(removed, 1);
  assert.equal(get(d, 'old-u1'), null);
  assert.ok(get(d, 'old-u2'));
});

test('enqueue is idempotent on messageId', () => {
  const d = db();
  assert.equal(enqueue(d, env(), {now: T0}).enqueued, true);
  const second = enqueue(d, env(), {now: at(5000)});
  assert.equal(second.enqueued, false);
  assert.equal(d.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get().n, 1);
  assert.equal(second.row.created_at, T0.toISOString());
});

test('a replay cannot resurrect a settled row', () => {
  const d = db();
  enqueue(d, env(), {now: T0});
  markTerminal(d, 'm-1', 'acked', {now: at(1000)});
  assert.equal(enqueue(d, env(), {now: at(2000)}).enqueued, false);
  assert.equal(get(d, 'm-1').status, 'acked');
  assert.deepEqual(stats(d, USER), {pending: 0, acked: 1, failed: 0, expired: 0});
});

test('ref_id is stored, not card content', () => {
  const d = db();
  enqueue(d, env({refId: 'kc_abc123'}), {now: T0});
  const row = get(d, 'm-1');
  assert.equal(row.ref_id, 'kc_abc123');
  assert.ok(!('envelope_json' in row));
});

test('listDue returns rows that are due, and expired rows even when not due', () => {
  const d = db();
  enqueue(d, env({messageId: 'due'}), {now: T0});
  enqueue(d, env({messageId: 'later'}), {now: T0});
  recordAttempt(d, 'later', {nextAttemptAtMs: at(60_000).getTime(), now: T0});
  const ids = listDue(d, USER, {now: at(1000)}).map((r) => r.message_id);
  assert.deepEqual(ids, ['due']);
  enqueue(d, env({messageId: 'stranded'}), {now: T0});
  recordAttempt(d, 'stranded', {nextAttemptAtMs: at(48 * 60 * 60 * 1000).getTime(), now: T0});
  const past = listDue(d, USER, {now: at(25 * 60 * 60 * 1000)}).map((r) => r.message_id).sort();
  assert.deepEqual(past, ['due', 'later', 'stranded']);
});

test('recordAttempt increments and reschedules only pending rows', () => {
  const d = db();
  enqueue(d, env(), {now: T0});
  assert.equal(recordAttempt(d, 'm-1', {nextAttemptAtMs: at(1000).getTime(), error: 'ECONNRESET', now: T0}), true);
  const row = get(d, 'm-1');
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error, 'ECONNRESET');
  markTerminal(d, 'm-1', 'failed', {now: at(2000)});
  assert.equal(recordAttempt(d, 'm-1', {nextAttemptAtMs: at(3000).getTime(), now: at(3000)}), false);
  assert.equal(get(d, 'm-1').attempts, 1);
});

test('terminal transitions are one-way and single-winner', () => {
  const d = db();
  enqueue(d, env(), {now: T0});
  assert.equal(markTerminal(d, 'm-1', 'expired', {now: at(1000)}), true);
  assert.equal(markTerminal(d, 'm-1', 'acked', {now: at(2000)}), false);
  assert.equal(get(d, 'm-1').status, 'expired');
  assert.throws(() => markTerminal(d, 'm-1', 'pending'), /not a terminal status/);
});

test('policy drives a row from pending to failed without extra sends', () => {
  const d = db();
  enqueue(d, env(), {now: T0, maxAttempts: 3});
  let sends = 0;
  for (let tick = 0; tick < 10; tick++) {
    const now = at(tick * 1000);
    const [row] = listDue(d, USER, {now});
    if (!row) continue;
    const action = nextDeliveryAction({
      attempts: row.attempts, maxAttempts: row.max_attempts, nowMs: now.getTime(),
      expiresAtMs: Date.parse(row.expires_at), nextAttemptAtMs: Date.parse(row.next_attempt_at),
    });
    if (action.action === 'send') {
      sends++;
      recordAttempt(d, row.message_id, {
        nextAttemptAtMs: scheduleNextAttempt({nowMs: now.getTime(), expiresAtMs: Date.parse(row.expires_at)}),
        error: 'HTTP 502', now,
      });
    } else if (action.action !== 'wait') {
      markTerminal(d, row.message_id, action.action, {error: action.reason, now});
    }
  }
  assert.equal(sends, 3);
  const row = get(d, 'm-1');
  assert.equal(row.status, 'failed');
  assert.equal(row.last_error, 'MAX_ATTEMPTS');
});

test('an expired row settles as expired even with attempts left', () => {
  const d = db();
  enqueue(d, env(), {now: T0, maxAttempts: 3});
  const now = at(25 * 60 * 60 * 1000);
  const [row] = listDue(d, USER, {now});
  const action = nextDeliveryAction({
    attempts: row.attempts, maxAttempts: row.max_attempts, nowMs: now.getTime(),
    expiresAtMs: Date.parse(row.expires_at), nextAttemptAtMs: Date.parse(row.next_attempt_at),
  });
  assert.equal(action.action, 'expired');
  markTerminal(d, 'm-1', 'expired', {error: action.reason, now});
  assert.equal(get(d, 'm-1').attempts, 0);
});

test('pruning removes settled rows and never pending ones', () => {
  const d = db();
  enqueue(d, env({messageId: 'old-acked'}), {now: T0});
  enqueue(d, env({messageId: 'still-pending'}), {now: T0});
  markTerminal(d, 'old-acked', 'acked', {now: T0});
  const removed = pruneSettled(d, USER, {before: at(60_000)});
  assert.equal(removed, 1);
  assert.equal(get(d, 'old-acked'), null);
  assert.ok(get(d, 'still-pending'));
});

test('stats report what a sync indicator renders', () => {
  const d = db();
  for (const id of ['a', 'b', 'c']) enqueue(d, env({messageId: id}), {now: T0});
  markTerminal(d, 'a', 'acked', {now: T0});
  markTerminal(d, 'b', 'failed', {now: T0});
  assert.deepEqual(stats(d, USER), {pending: 1, acked: 1, failed: 1, expired: 0});
});

test('problems groups failed and expired rows by kind', () => {
  const d = db();
  enqueue(d, env({messageId: 'f1', kind: 'card.upsert'}), {now: T0});
  enqueue(d, env({messageId: 'f2', kind: 'card.upsert'}), {now: T0});
  enqueue(d, env({messageId: 'f3', kind: 'task.upsert'}), {now: T0});
  enqueue(d, env({messageId: 'e1', kind: 'card.upsert'}), {now: T0});
  markTerminal(d, 'f1', 'failed', {error: 'HTTP 502', now: at(1000)});
  markTerminal(d, 'f2', 'failed', {error: 'HTTP 502', now: at(2000)});
  markTerminal(d, 'f3', 'failed', {error: 'ECONNRESET', now: at(3000)});
  markTerminal(d, 'e1', 'expired', {error: 'TTL_EXPIRED', now: at(4000)});
  const result = problems(d, USER);
  assert.equal(result.length, 2);
  const card = result.find((r) => r.kind === 'card.upsert');
  assert.ok(card);
  assert.equal(card.count, 3);
  assert.ok(card.last_error);
  assert.ok(card.last_attempt_at);
});

test('problems excludes acked and pending rows', () => {
  const d = db();
  enqueue(d, env({messageId: 'p', kind: 'card.upsert'}), {now: T0});
  enqueue(d, env({messageId: 'a', kind: 'card.upsert'}), {now: T0});
  enqueue(d, env({messageId: 'f', kind: 'card.upsert'}), {now: T0});
  markTerminal(d, 'a', 'acked', {now: T0});
  markTerminal(d, 'f', 'failed', {now: T0});
  const result = problems(d, USER);
  assert.equal(result.length, 1);
  assert.equal(result[0].count, 1);
});

test('problems is isolated by user_id', () => {
  const d = db();
  enqueue(d, env({messageId: 'fu1', kind: 'card.upsert'}), {now: T0});
  enqueue(d, env({messageId: 'fu2', kind: 'card.upsert', userId: 'u-2'}), {now: T0});
  markTerminal(d, 'fu1', 'failed', {now: T0});
  markTerminal(d, 'fu2', 'failed', {now: T0});
  assert.equal(problems(d, 'u-1').length, 1);
  assert.equal(problems(d, 'u-2').length, 1);
  assert.equal(problems(d, 'u-3').length, 0);
});

test('problems response excludes card content', () => {
  const d = db();
  enqueue(d, env({refId: 'kc_secret_abc'}), {now: T0});
  markTerminal(d, 'm-1', 'failed', {error: 'HTTP 500', now: T0});
  const result = problems(d, USER);
  assert.equal(result.length, 1);
  const allowed = new Set(['kind', 'count', 'last_error', 'last_attempt_at']);
  for (const row of result) {
    for (const key of Object.keys(row)) {
      assert.ok(allowed.has(key), `problems row must not expose "${key}"`);
    }
  }
  assert.ok(!result[0].ref_id);
  assert.ok(!result[0].title);
});