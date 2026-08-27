// Batch A · Envelope validation, the envelope/card separation rule, and the retry
// decision table.
//
// The disjointness test below is the point of the file. Everything else here is
// ordinary input validation; that one encodes a constraint that spans two subsystems
// which have no reason to import each other, and which therefore cannot notice when
// they start to overlap.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
  makeEnvelope, parseEnvelope, isExpired,
  ENVELOPE_FIELDS, MESSAGE_KINDS, PROTOCOL, PROTOCOL_VERSION,
} from '../src/core/sync/envelope.mjs';
import {
  nextDeliveryAction, scheduleNextAttempt, isTerminal,
  DEFAULT_MAX_ATTEMPTS, DEFAULT_RETRY_DELAY_MS,
} from '../src/core/sync/delivery-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ANCHORING = path.join(here, '..', 'src', 'daemon', 'anchoring', 'anchoring.mjs');

const T0 = new Date('2026-08-05T10:00:00.000Z');
const base = {
  messageId: 'msg-1', kind: 'card.upsert', payload: {cardId: 'c-1'},
  userId: 'u-1', sourceDeviceId: 'dev-1', now: T0,
};

// --- the rule ---------------------------------------------------------------------

test('envelope fields are disjoint from the card digest preimage', () => {
  // Read the preimage fields from anchoring.mjs rather than restating them, so this
  // test tracks the real definition instead of a copy that can quietly fall behind.
  const src = readFileSync(ANCHORING, 'utf8');
  const body = src.match(/_cardHash\s*\(row\)\s*\{([\s\S]*?)\n {2}\}/);
  assert.ok(body, 'could not read _cardHash; the disjointness check would be vacuous.');
  const preimage = [...body[1].matchAll(/row\.(\w+)/g)].map((m) => m[1]);
  assert.ok(preimage.length >= 6, `expected >=6 preimage fields, parsed ${preimage.length}`);

  const overlap = ENVELOPE_FIELDS.filter((f) => preimage.includes(f));
  assert.deepEqual(
    overlap, [],
    `Envelope and card-digest preimage now share ${JSON.stringify(overlap)}. Transport ` +
    'metadata has reached the letter. Any field in the preimage is (a) hashed into ' +
    'every Sepolia commitment and (b) — for summary — 0.50 of the ranking weight via ' +
    'title_summary_embedding. Move it to a side table (the anchor_state / F-088 D3 ' +
    'pattern); do not rename it to dodge this assertion.',
  );
});

test('unknown keys are rejected, so card fields cannot ride along', () => {
  for (const stowaway of ['summary', 'tags', 'status', 'category', 'title']) {
    assert.throws(
      () => parseEnvelope({...makeEnvelope(base), [stowaway]: 'x'}),
      new RegExp(`${stowaway} is not an envelope field`),
      `a stray "${stowaway}" key must be refused, not ignored`,
    );
  }
});

// --- envelope validation ------------------------------------------------------------

test('makeEnvelope produces a valid, self-consistent envelope', () => {
  const e = makeEnvelope(base);
  assert.equal(e.protocol, PROTOCOL);
  assert.equal(e.version, PROTOCOL_VERSION);
  assert.equal(e.createdAt, '2026-08-05T10:00:00.000Z');
  assert.equal(e.expiresAt, '2026-08-06T10:00:00.000Z');
  assert.equal(e.correlationId, 'msg-1', 'correlationId defaults to messageId');
  assert.ok(!('targetDeviceId' in e), 'absent target must stay absent, not become null');
});

test('correlationId is preserved so a retry stays part of its original operation', () => {
  const first = makeEnvelope({...base, messageId: 'm-1'});
  const follow = makeEnvelope({...base, messageId: 'm-2', correlationId: first.correlationId});
  assert.equal(follow.correlationId, 'm-1');
  assert.notEqual(follow.messageId, first.messageId);
});

test('timestamps must be strict ISO 8601', () => {
  const valid = makeEnvelope(base);
  for (const bad of ['2026-08-05', '2026-08-05T10:00:00Z ', '2026-08-05T10:00:00+02:00', 'now', '']) {
    assert.throws(
      () => parseEnvelope({...valid, createdAt: bad}),
      /createdAt must be a strict ISO 8601/,
      `${JSON.stringify(bad)} must be rejected: two nodes disagreeing on an instant ` +
      'will disagree on whether a message expired',
    );
  }
});

test('expiresAt must be after createdAt', () => {
  const e = makeEnvelope(base);
  assert.throws(() => parseEnvelope({...e, expiresAt: e.createdAt}), /expiresAt must be after/);
  assert.throws(() => makeEnvelope({...base, ttlMs: 0}), /expiresAt must be after/);
  assert.throws(() => makeEnvelope({...base, ttlMs: -1000}), /expiresAt must be after/);
});

test('required identity fields reject blank as well as missing', () => {
  const e = makeEnvelope(base);
  for (const f of ['messageId', 'correlationId', 'sourceDeviceId', 'userId']) {
    assert.throws(() => parseEnvelope({...e, [f]: '   '}), new RegExp(`${f} is required`));
    const without = {...e};
    delete without[f];
    assert.throws(() => parseEnvelope(without), new RegExp(`${f} is required`));
  }
});

test('payload is required but may legitimately be falsy-ish', () => {
  const e = makeEnvelope(base);
  assert.throws(() => parseEnvelope({...e, payload: null}), /payload is required/);
  assert.doesNotThrow(() => parseEnvelope({...e, payload: {}}), 'an empty object is a payload');
  assert.doesNotThrow(() => parseEnvelope({...e, payload: []}), 'an empty batch is a payload');
});

test('unknown kinds and protocol versions are refused', () => {
  assert.throws(() => makeEnvelope({...base, kind: 'card.frobnicate'}), /kind is invalid/);
  const e = makeEnvelope(base);
  assert.throws(() => parseEnvelope({...e, version: 2}), /unsupported protocol version/);
  assert.throws(() => parseEnvelope({...e, protocol: 'rwhn'}), /protocol must be/);
});

test('non-objects are refused before any field access', () => {
  for (const bad of [null, undefined, 'x', 42, []]) {
    assert.throws(() => parseEnvelope(bad), /envelope must be an object/);
  }
});

test('every declared kind round-trips', () => {
  for (const kind of MESSAGE_KINDS) {
    assert.doesNotThrow(() => makeEnvelope({...base, kind}), `kind ${kind} must be constructible`);
  }
});

test('isExpired reads the boundary as expired', () => {
  const e = makeEnvelope(base);
  const exp = Date.parse(e.expiresAt);
  assert.equal(isExpired(e, exp - 1), false);
  assert.equal(isExpired(e, exp), true, 'at the deadline the message is already dead');
});

// --- delivery policy ----------------------------------------------------------------

const policy = (over = {}) => nextDeliveryAction({
  attempts: 0, maxAttempts: DEFAULT_MAX_ATTEMPTS,
  nowMs: 1000, expiresAtMs: 100000, nextAttemptAtMs: 1000, ...over,
});

test('TTL outranks remaining attempts', () => {
  assert.deepEqual(
    policy({attempts: 0, nowMs: 100000, expiresAtMs: 100000}),
    {action: 'expired', reason: 'TTL_EXPIRED'},
    'a fresh message past its deadline must expire, not retry: a late write can ' +
    'resurrect a card the user already deleted',
  );

  // Both conditions true at once is the only input that can tell the two orderings
  // apart. The case above cannot: with attempts=0 the attempts branch is false either
  // way, so it passes whichever check runs first — mutation testing caught this file
  // asserting a priority it was not actually exercising.
  assert.deepEqual(
    policy({attempts: DEFAULT_MAX_ATTEMPTS, nowMs: 100000, expiresAtMs: 100000}),
    {action: 'expired', reason: 'TTL_EXPIRED'},
    'expired-and-exhausted must report TTL_EXPIRED, not MAX_ATTEMPTS. The reason is ' +
    'the stored explanation for why this write never landed; "we gave up retrying" ' +
    'and "it was too old to be safe to apply" call for different follow-up.',
  );
});

test('attempts are bounded once inside the TTL', () => {
  assert.deepEqual(policy({attempts: DEFAULT_MAX_ATTEMPTS}), {action: 'failed', reason: 'MAX_ATTEMPTS'});
  assert.deepEqual(policy({attempts: DEFAULT_MAX_ATTEMPTS - 1}), {action: 'send'},
    'the last permitted attempt must still be attempted (off-by-one guard)');
});

test('a message that is neither dead nor due waits', () => {
  assert.deepEqual(policy({nowMs: 1000, nextAttemptAtMs: 5000}),
    {action: 'wait', nextAttemptAtMs: 5000});
  assert.deepEqual(policy({nowMs: 5000, nextAttemptAtMs: 5000}), {action: 'send'},
    'due exactly now means send');
});

test('retry scheduling is clamped to the deadline', () => {
  assert.equal(scheduleNextAttempt({nowMs: 1000, expiresAtMs: 100000}), 1000 + DEFAULT_RETRY_DELAY_MS);
  assert.equal(
    scheduleNextAttempt({nowMs: 99900, expiresAtMs: 100000}), 100000,
    'without the clamp a row sits "pending, retry soon" while already expired — it ' +
    'reads as healthy in a status view and never sends',
  );
});

test('terminal states are exactly the ones a worker stops touching', () => {
  for (const s of ['acked', 'failed', 'expired']) assert.equal(isTerminal(s), true, s);
  for (const s of ['pending', 'sending', undefined]) assert.equal(isTerminal(s), false, String(s));
});
