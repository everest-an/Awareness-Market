// F-088 · Side tables for ERC-8350 anchoring. Deliberately separate from
// knowledge_cards (no schema change, no FK) — same pattern as card_embeddings.
// anchor_state  = the last SNAPSHOTTED content hash per card (what the latest
//                 built delta committed to), not the last broadcast one.
// anchor_outbox = locally built, sequence-ordered deltas awaiting broadcast.
// anchor_meta   = space identity + local head (last built seq / root).

export function ensureAnchorTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS anchor_state (
      card_id      TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      built_seq    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS anchor_outbox (
      seq                   INTEGER PRIMARY KEY,
      space_id              TEXT NOT NULL,
      prev_state_root       TEXT NOT NULL,
      delta_commitment      TEXT NOT NULL,
      provenance_commitment TEXT NOT NULL,
      profile_id            TEXT NOT NULL,
      locator_commitment    TEXT NOT NULL,
      transition_id         TEXT NOT NULL,
      next_state_root       TEXT NOT NULL,
      ops_count             INTEGER NOT NULL,
      witness_path          TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'pending',
      tx_hash               TEXT,
      created_at            TEXT NOT NULL,
      anchored_at           TEXT
    );
    CREATE TABLE IF NOT EXISTS anchor_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM anchor_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(db, key, value) {
  db.prepare(
    'INSERT INTO anchor_meta (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

export function getStateMap(db) {
  const map = new Map();
  for (const row of db.prepare('SELECT card_id, content_hash FROM anchor_state').all()) {
    map.set(row.card_id, row.content_hash);
  }
  return map;
}

/** Replace anchor_state with the new snapshot, atomically with outbox insert. */
export function applySnapshot(db, entries, seq) {
  const upsert = db.prepare(
    'INSERT INTO anchor_state (card_id, content_hash, built_seq) VALUES (?, ?, ?) ' +
    'ON CONFLICT(card_id) DO UPDATE SET content_hash = excluded.content_hash, built_seq = excluded.built_seq'
  );
  const keep = new Set();
  for (const e of entries) {
    upsert.run(e.card_id, e.content_hash, seq);
    keep.add(e.card_id);
  }
  const stale = db.prepare('SELECT card_id FROM anchor_state').all()
    .map((r) => r.card_id).filter((id) => !keep.has(id));
  const del = db.prepare('DELETE FROM anchor_state WHERE card_id = ?');
  for (const id of stale) del.run(id);
}

export function insertOutbox(db, row) {
  db.prepare(
    `INSERT INTO anchor_outbox
       (seq, space_id, prev_state_root, delta_commitment, provenance_commitment,
        profile_id, locator_commitment, transition_id, next_state_root,
        ops_count, witness_path, status, created_at)
     VALUES (@seq, @space_id, @prev_state_root, @delta_commitment, @provenance_commitment,
             @profile_id, @locator_commitment, @transition_id, @next_state_root,
             @ops_count, @witness_path, 'pending', @created_at)`
  ).run(row);
}

export function listPending(db) {
  return db.prepare(
    "SELECT * FROM anchor_outbox WHERE status = 'pending' ORDER BY seq ASC"
  ).all();
}

export function countAnchored(db) {
  const row = db.prepare(
    "SELECT COUNT(*) AS n, MAX(tx_hash) AS last FROM anchor_outbox WHERE status = 'anchored'"
  ).get();
  return {count: row?.n ?? 0, lastTxHash: row?.last ?? null};
}

export function confirmSeq(db, seq, txHash) {
  const info = db.prepare(
    "UPDATE anchor_outbox SET status = 'anchored', tx_hash = ?, anchored_at = ? " +
    "WHERE seq = ? AND status = 'pending'"
  ).run(txHash, new Date().toISOString(), seq);
  return info.changes === 1;
}
