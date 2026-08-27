// F-088 · ERC-8350 anchoring manager (pull-based snapshot diff → local outbox).
//
// Design contract (docs/features/f-088-erc8350-anchoring/PLAN.md):
// - Reads knowledge_cards ONLY; never touches any write path (covers all four
//   mutation paths — submit-insights, extractor, cloud pull, evolution — for free).
// - The chain is never a hard dependency: everything here is local. Broadcasting
//   is a separate concern owned by the CLI, which is the only place a key exists.
// - Fail-soft: any error disables anchoring for the session and warns; memory
//   features are unaffected.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  deriveSpaceId, computeTransitionId, computeNextStateRoot,
  computeDeltaCommitment, keccakUtf8, stableStringify, ZERO32,
} from './erc8350.mjs';
import {
  ensureAnchorTables, getMeta, setMeta, getStateMap, applySnapshot,
  insertOutbox, listPending, countAnchored,
} from './anchor-state.mjs';

// Digest profile: one delta summarizes a batch of card mutations. Unsalted and
// public by design (profile ids are documented as effectively public).
export const CARD_DIGEST_PROFILE_ID = keccakUtf8(
  'https://awareness.market/profiles/memory/card-digest/v1'
);

const META_SALT = 'space_salt';
const META_SPACE = 'space_id';
const META_CONTROLLER = 'controller';
const META_LAST_SEQ = 'last_seq';
const META_LAST_ROOT = 'last_root';

export class AnchoringManager {
  constructor(daemon, cfg) {
    this.daemon = daemon;
    this.cfg = cfg || {};
    this.db = null;
    this.witnessDir = path.join(daemon.awarenessDir, 'witness');
  }

  ensureInit() {
    const db = this.daemon.indexer?.db;
    if (!db) throw new Error('indexer db unavailable (NoopIndexer?) — anchoring disabled');
    this.db = db;
    ensureAnchorTables(db);
    fs.mkdirSync(this.witnessDir, {recursive: true});

    const controller = (this.cfg.controller_address || '').trim();
    if (controller && !/^0x[0-9a-fA-F]{40}$/.test(controller)) {
      throw new Error(`invalid anchoring.controller_address: ${controller}`);
    }
    // Space identity is created once and persisted; a configured controller that
    // differs from the persisted one is an error (a new wallet means a new Space —
    // protocol migration semantics, never a silent rebind).
    const saved = getMeta(db, META_CONTROLLER);
    if (saved && controller && saved.toLowerCase() !== controller.toLowerCase()) {
      throw new Error(
        `controller changed (${saved} -> ${controller}); a new wallet requires a new Space. ` +
        'Clear anchoring state deliberately if this is intended.'
      );
    }
    return this;
  }

  _cardHash(row) {
    const basis = [row.id, row.category ?? '', row.title ?? '', row.summary ?? '',
      row.tags ?? '', row.status ?? ''].join('');
    return crypto.createHash('sha256').update(basis, 'utf8').digest('hex');
  }

  _snapshot() {
    const rows = this.db.prepare(
      "SELECT id, category, title, summary, tags, status FROM knowledge_cards " +
      "WHERE status IS NULL OR status != 'superseded'"
    ).all();
    return rows.map((r) => ({card_id: r.id, content_hash: this._cardHash(r)}));
  }

  _diff(stateMap, snapshot) {
    const ops = [];
    const seen = new Set();
    for (const e of snapshot) {
      seen.add(e.card_id);
      const prev = stateMap.get(e.card_id);
      if (prev === undefined) ops.push({card: e.card_id, hash: e.content_hash, op: 'added'});
      else if (prev !== e.content_hash) ops.push({card: e.card_id, hash: e.content_hash, op: 'updated'});
    }
    for (const [cardId] of stateMap) {
      if (!seen.has(cardId)) ops.push({card: cardId, op: 'removed'});
    }
    ops.sort((a, b) => (a.card < b.card ? -1 : a.card > b.card ? 1 : 0));
    return ops;
  }

  _spaceIdentity() {
    const controller = (this.cfg.controller_address || '').trim();
    if (!controller) return null;
    let salt = getMeta(this.db, META_SALT);
    let spaceId = getMeta(this.db, META_SPACE);
    if (!salt) {
      // Stable, path-independent workspace identity: minted once, persisted forever.
      salt = keccakUtf8('awareness-workspace:' + crypto.randomUUID());
      spaceId = deriveSpaceId(controller, salt);
      setMeta(this.db, META_SALT, salt);
      setMeta(this.db, META_SPACE, spaceId);
      setMeta(this.db, META_CONTROLLER, controller);
    }
    return {controller, salt, spaceId};
  }

  /** Build one delta from the current diff, if any. Local only — no chain. */
  buildIfNeeded() {
    const identity = this._spaceIdentity();
    if (!identity) return {built: false, reason: 'controller_address not configured'};

    const ops = this._diff(getStateMap(this.db), this._snapshot());
    if (ops.length === 0) return {built: false, reason: 'no changes'};

    const seq = Number(getMeta(this.db, META_LAST_SEQ) || 0) + 1;
    const prevRoot = getMeta(this.db, META_LAST_ROOT) || ZERO32;

    const payloadObj = {v: 1, standard: 'ERC-8350', space: identity.spaceId, seq, ops};
    const payloadJson = stableStringify(payloadObj);
    const payloadBytes = new TextEncoder().encode(payloadJson);
    // Production salts: random and kept only in the private witness file.
    const deltaSalt = '0x' + crypto.randomBytes(32).toString('hex');
    const deltaCommitment = computeDeltaCommitment(payloadBytes, deltaSalt, CARD_DIGEST_PROFILE_ID);

    const delta = {
      spaceId: identity.spaceId,
      sequence: seq,
      prevStateRoot: prevRoot,
      deltaCommitment,
      provenanceCommitment: ZERO32,
      profileId: CARD_DIGEST_PROFILE_ID,
      locatorCommitment: ZERO32,
    };
    const transitionId = computeTransitionId(delta);
    const nextRoot = computeNextStateRoot(prevRoot, transitionId);

    const witnessPath = path.join(this.witnessDir, `${seq}.json`);
    fs.writeFileSync(witnessPath, JSON.stringify({
      _warning: 'PRIVATE WITNESS — never share or commit. Required to open the on-chain commitment.',
      seq, payload: payloadJson, delta_salt: deltaSalt, delta, transitionId, nextStateRoot: nextRoot,
      space: identity,
    }, null, 2));

    const txn = this.db.transaction(() => {
      insertOutbox(this.db, {
        seq,
        space_id: delta.spaceId,
        prev_state_root: delta.prevStateRoot,
        delta_commitment: delta.deltaCommitment,
        provenance_commitment: delta.provenanceCommitment,
        profile_id: delta.profileId,
        locator_commitment: delta.locatorCommitment,
        transition_id: transitionId,
        next_state_root: nextRoot,
        ops_count: ops.length,
        witness_path: witnessPath,
        created_at: new Date().toISOString(),
      });
      applySnapshot(this.db, this._snapshot(), seq);
      setMeta(this.db, META_LAST_SEQ, seq);
      setMeta(this.db, META_LAST_ROOT, nextRoot);
    });
    txn();

    return {built: true, seq, transitionId, opsCount: ops.length};
  }

  status() {
    const build = this.buildIfNeeded(); // cheap; makes status always current
    const pending = listPending(this.db).map((r) => ({
      seq: r.seq, transitionId: r.transition_id, opsCount: r.ops_count,
      createdAt: r.created_at, witnessPath: r.witness_path,
    }));
    return {
      enabled: true,
      chainId: this.cfg.chain_id,
      registry: this.cfg.registry_address,
      rpcUrl: this.cfg.rpc_url,
      controller: this.cfg.controller_address || null,
      spaceId: getMeta(this.db, META_SPACE),
      spaceSalt: getMeta(this.db, META_SALT),
      lastBuilt: {seq: Number(getMeta(this.db, META_LAST_SEQ) || 0), root: getMeta(this.db, META_LAST_ROOT)},
      lastBuildResult: build,
      pending,
      anchored: countAnchored(this.db),
      estGasPerCommit: 110000,
    };
  }

  outbox() { return listPending(this.db); }
}
