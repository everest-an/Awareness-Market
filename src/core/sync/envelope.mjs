// Batch A · Transport envelope for outbound sync. Pure functions only: no SQLite, no
// HTTP, no clock beyond what the caller passes in, so the delivery rules stay testable
// without a daemon.
//
// The problem it solves: today's push side is only partially idempotent. Pull is safe
// (INSERT OR IGNORE plus the cloud_id_reverse mapping), and card pushes carry
// If-Match/version so a conflicting write comes back 409. But a push whose *response*
// is lost — connection reset, proxy timeout, laptop suspended mid-flight — is
// indistinguishable from a push that never arrived, so the retry is a second write of
// the same intent. `messageId` gives the receiver a key to recognise the replay, and
// gives us a local record of what is still in flight.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE — the envelope is not the letter:
//
//   ENVELOPE_FIELDS and the card digest preimage
//   (id, category, title, summary, tags, status — see anchoring/anchoring.mjs) must
//   stay disjoint, and nothing here may ever be merged into a card body.
//
//   That is not stylistic. `summary` is load-bearing twice over: it feeds
//   `_cardHash`, so editing it invalidates every Sepolia-anchored deltaCommitment, and
//   it feeds title_summary_embedding, which carries 0.50 of the ranking weight. A
//   transport concern that leaks into a card body — a device tag appended to summary, a
//   sync status folded into status — breaks the chain and moves R@5 at the same time,
//   and neither failure announces itself. Provenance belongs in a side table, the
//   pattern F-088 D3 already chose for anchor_state.
//
//   test/sync-envelope.test.mjs asserts the disjointness mechanically, because a rule
//   nobody checks is a rule that lasts until the first busy afternoon.
//
// Scope: this is the local daemon's half. The cloud side must recognise `messageId` for
// end-to-end idempotency; until it does, this buys local dedupe and in-flight
// visibility — worth having on its own, and a prerequisite either way.

export const PROTOCOL = 'awareness';
export const PROTOCOL_VERSION = 1;

// Kinds name an intent, not an endpoint, so a route change is not a protocol change.
export const MESSAGE_KINDS = Object.freeze([
  'card.upsert',
  'card.delete',
  'task.upsert',
  'skill.upsert',
  'memory.append',
  'sync.ack',
]);

// Exported so the disjointness test can read it rather than restate it.
export const ENVELOPE_FIELDS = Object.freeze([
  'protocol', 'version', 'messageId', 'kind', 'correlationId',
  'createdAt', 'expiresAt', 'sourceDeviceId', 'userId', 'payload',
]);

const OPTIONAL_FIELDS = Object.freeze(['targetDeviceId']);
const ALLOWED = Object.freeze([...ENVELOPE_FIELDS, ...OPTIONAL_FIELDS]);

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * ISO 8601 with round-trip equality. `new Date(s).toISOString() === s` rejects the
 * near-misses that Date.parse happily accepts ('2026-08-05', '2026-08-05T10:00:00Z '
 * with a trailing space, local-offset forms), because two nodes that disagree on what
 * an instant means will disagree on whether a message has expired.
 */
function isStrictIso(value) {
  if (typeof value !== 'string' || !value) return false;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return false;
  return new Date(ms).toISOString() === value;
}

/**
 * Build an envelope. `now` and `messageId` are injected rather than generated here so
 * tests are deterministic and callers can adopt an id they already persisted — a retry
 * MUST reuse its original messageId or the receiver cannot tell it is a replay.
 */
export function makeEnvelope({
  messageId, kind, payload, userId, sourceDeviceId,
  correlationId = messageId, targetDeviceId = null,
  now = new Date(), ttlMs = DEFAULT_TTL_MS,
}) {
  const createdAt = now.toISOString();
  const envelope = {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    messageId,
    kind,
    correlationId,
    createdAt,
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    sourceDeviceId,
    userId,
    payload,
  };
  if (targetDeviceId !== null) envelope.targetDeviceId = targetDeviceId;
  return parseEnvelope(envelope);
}

/**
 * Validate and return the envelope, or throw. Throwing beats returning null: a caller
 * that ignores a null silently drops a write, and a dropped write in a memory system is
 * indistinguishable from one the user never made.
 */
export function parseEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('envelope must be an object');
  }

  // Unknown keys are rejected rather than ignored. This is the mechanical half of the
  // envelope-is-not-the-letter rule: a stray `summary` or `tags` here is exactly the
  // shape a card field takes on its way into a place it must never reach.
  const extra = Object.keys(value).find((k) => !ALLOWED.includes(k));
  if (extra) throw new Error(`${extra} is not an envelope field`);

  if (value.protocol !== PROTOCOL) throw new Error(`protocol must be "${PROTOCOL}"`);
  if (value.version !== PROTOCOL_VERSION) {
    throw new Error(`unsupported protocol version: ${value.version}`);
  }
  if (!MESSAGE_KINDS.includes(value.kind)) throw new Error(`kind is invalid: ${value.kind}`);

  for (const field of ['messageId', 'correlationId', 'sourceDeviceId', 'userId']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      throw new Error(`${field} is required`);
    }
  }
  if (value.targetDeviceId !== undefined &&
      (typeof value.targetDeviceId !== 'string' || !value.targetDeviceId.trim())) {
    throw new Error('targetDeviceId must be a non-empty string when present');
  }
  if (value.payload === undefined || value.payload === null) {
    throw new Error('payload is required');
  }

  for (const field of ['createdAt', 'expiresAt']) {
    if (!isStrictIso(value[field])) {
      throw new Error(`${field} must be a strict ISO 8601 timestamp (got ${JSON.stringify(value[field])})`);
    }
  }
  if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) {
    throw new Error('expiresAt must be after createdAt');
  }

  return value;
}

/** TTL check kept separate from parse: a stored envelope is valid but may be stale. */
export function isExpired(envelope, nowMs = Date.now()) {
  return nowMs >= Date.parse(envelope.expiresAt);
}
