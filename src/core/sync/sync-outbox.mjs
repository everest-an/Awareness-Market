// Batch A · Durable outbox for outbound sync. Side table, no FK, no schema change to
// knowledge_cards — the same shape anchor_outbox already uses, and for the same reason:
// transport bookkeeping must never become a column on a card. (`summary`, `tags` and
// `status` are in the ERC-8350 digest preimage; a sync flag stored beside them is one
// careless JOIN away from changing a hash that Sepolia has already committed to.)
//
// 2026-08-05 revision: three defects fixed (PLAN.md § 必须先做的表模型修正):
//   A) user_id column added — multi-user stats() isolation at SQL layer
//   B) envelope_json replaced with ref_id — outbox no longer stores card content
//   C) daemon REST endpoints bind 127.0.0.1 + validate Origin (in api-handlers.mjs)
//
// messageId is the PRIMARY KEY, so idempotent enqueue is INSERT OR IGNORE rather than a
// read-then-write. That matters under the exact condition this table exists for — a
// retry racing the original — where check-then-insert has a window and a unique index
// does not.
//
// Two clocks, deliberately separate:
//   next_attempt_at  when this row may next be sent
//   expires_at       when it stops mattering at all
// Collapsing them into one loses the distinction between "not yet" and "never again",
// which is the distinction the whole retry policy is built on.

const TERMINAL = new Set(['acked', 'failed', 'expired']);

export function ensureOutboxTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      message_id       TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      kind             TEXT NOT NULL,
      ref_id           TEXT NOT NULL,
      correlation_id   TEXT NOT NULL,
      target_device_id TEXT,
      attempts         INTEGER NOT NULL DEFAULT 0,
      max_attempts     INTEGER NOT NULL DEFAULT 3,
      next_attempt_at  TEXT NOT NULL,
      expires_at       TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      last_error       TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_due
      ON sync_outbox (user_id, status, next_attempt_at);
  `);
}

/**
 * Enqueue a delivery intent. Returns {enqueued:boolean, row}. `enqueued:false` means
 * this messageId was already known — the caller is replaying, which is not an error and
 * must not become a second row.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.messageId
 * @param {string} params.kind
 * @param {string} params.refId       - card id, not content (defect B fix)
 * @param {string} params.correlationId
 * @param {string} [params.targetDeviceId]
 * @param {string} params.expiresAt   - strict ISO 8601
 */
export function enqueue(db, params, {maxAttempts = 3, now = new Date()} = {}) {
  const {userId, messageId, kind, refId, correlationId, targetDeviceId = null, expiresAt} = params;
  const iso = now.toISOString();
  const info = db.prepare(
    `INSERT OR IGNORE INTO sync_outbox
       (message_id, user_id, kind, ref_id, correlation_id, target_device_id,
        attempts, max_attempts, next_attempt_at, expires_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'pending', ?, ?)`,
  ).run(
    messageId, userId, kind, refId, correlationId,
    targetDeviceId, maxAttempts, iso, expiresAt, iso, iso,
  );
  return {enqueued: info.changes === 1, row: get(db, messageId)};
}

export function get(db, messageId) {
  return db.prepare('SELECT * FROM sync_outbox WHERE message_id = ?').get(messageId) ?? null;
}

/**
 * Rows a worker should look at now. Expired rows are deliberately included: something
 * has to notice them and write the terminal state, and if the query hid them they would
 * sit as 'pending' forever — present in the table, invisible to the worker, and
 * counted as in-flight by any status view.
 */
export function listDue(db, userId, {now = new Date(), limit = 50} = {}) {
  return db.prepare(
    `SELECT * FROM sync_outbox
      WHERE user_id = ? AND status = 'pending' AND (next_attempt_at <= ? OR expires_at <= ?)
      ORDER BY next_attempt_at ASC
      LIMIT ?`,
  ).all(userId, now.toISOString(), now.toISOString(), limit);
}

/** Record that an attempt is being made and when the next one becomes due. */
export function recordAttempt(db, messageId, {nextAttemptAtMs, error = null, now = new Date()}) {
  return db.prepare(
    `UPDATE sync_outbox
        SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?, updated_at = ?
      WHERE message_id = ? AND status = 'pending'`,
  ).run(new Date(nextAttemptAtMs).toISOString(), error, now.toISOString(), messageId).changes === 1;
}

/**
 * Move a row to a terminal state. Guarded on status='pending' so a late ACK cannot
 * revive a row that already expired, and two workers cannot both settle one message.
 */
export function markTerminal(db, messageId, status, {error = null, now = new Date()} = {}) {
  if (!TERMINAL.has(status)) throw new Error(`not a terminal status: ${status}`);
  return db.prepare(
    `UPDATE sync_outbox SET status = ?, last_error = ?, updated_at = ?
      WHERE message_id = ? AND status = 'pending'`,
  ).run(status, error, now.toISOString(), messageId).changes === 1;
}

/** Counts by status for one user — what a sync indicator renders from. */
export function stats(db, userId) {
  const out = {pending: 0, acked: 0, failed: 0, expired: 0};
  for (const r of db.prepare(
    'SELECT status, COUNT(*) AS n FROM sync_outbox WHERE user_id = ? GROUP BY status',
  ).all(userId)) {
    out[r.status] = r.n;
  }
  return out;
}

/**
 * Problems grouped by kind — what the sync problems panel renders from.
 * Only failed/expired rows; response must NOT include card content (ref_id, title, etc.).
 */
export function problems(db, userId) {
  return db.prepare(
    `SELECT kind, COUNT(*) AS count,
            (SELECT last_error FROM sync_outbox AS o2
             WHERE o2.user_id = o1.user_id AND o2.kind = o1.kind
               AND o2.status IN ('failed','expired')
             ORDER BY o2.updated_at DESC LIMIT 1) AS last_error,
            MAX(updated_at) AS last_attempt_at
     FROM sync_outbox AS o1
     WHERE user_id = ? AND status IN ('failed', 'expired')
     GROUP BY kind`,
  ).all(userId);
}

/**
 * Drop settled rows past a cutoff. Only terminal rows: a pending row is still owed to
 * the user no matter how old, and deleting it would silently discard a write.
 */
export function pruneSettled(db, userId, {before}) {
  return db.prepare(
    `DELETE FROM sync_outbox
      WHERE user_id = ? AND status IN ('acked','failed','expired') AND updated_at < ?`,
  ).run(userId, before.toISOString()).changes;
}
