// F-088 · AnchoringManager behavior against an in-memory SQLite database:
// diff correctness, sequence chaining, idempotence, witness emission, and the
// controller-change guard. No daemon, no chain — pure local semantics.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {AnchoringManager} from '../src/daemon/anchoring/anchoring.mjs';
import {confirmSeq, listPending} from '../src/daemon/anchoring/anchor-state.mjs';
import {ZERO32} from '../src/daemon/anchoring/erc8350.mjs';

const CONTROLLER = '0x3d0ab53241A2913D7939ae02f7083169fE7b823B';

function makeEnv() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE knowledge_cards (
    id TEXT PRIMARY KEY, category TEXT, title TEXT, summary TEXT, tags TEXT, status TEXT
  )`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-test-'));
  const daemon = {indexer: {db}, awarenessDir: dir};
  const cfg = {
    enabled: true, chain_id: 11155111, rpc_url: 'http://unused.invalid',
    registry_address: '0x' + '11'.repeat(20), controller_address: CONTROLLER,
  };
  const mgr = new AnchoringManager(daemon, cfg).ensureInit();
  const addCard = (id, title) => db.prepare(
    "INSERT INTO knowledge_cards (id, category, title, summary, tags, status) VALUES (?, 'decision', ?, 'sum', '[]', 'open')"
  ).run(id, title);
  return {db, dir, mgr, addCard};
}

test('first build: two added ops, seq 1, genesis prev root, witness written', () => {
  const {db, mgr, addCard} = makeEnv();
  addCard('kc_1', 'alpha');
  addCard('kc_2', 'beta');

  const r = mgr.buildIfNeeded();
  assert.equal(r.built, true);
  assert.equal(r.seq, 1);
  assert.equal(r.opsCount, 2);

  const [row] = listPending(db);
  assert.equal(row.prev_state_root, ZERO32);
  assert.equal(row.status, 'pending');
  const witness = JSON.parse(fs.readFileSync(row.witness_path, 'utf8'));
  assert.equal(witness.seq, 1);
  assert.match(witness.delta_salt, /^0x[0-9a-f]{64}$/);
  const payload = JSON.parse(witness.payload);
  assert.deepEqual(payload.ops.map((o) => o.op), ['added', 'added']);
});

test('no changes → no build (idempotent)', () => {
  const {mgr, addCard} = makeEnv();
  addCard('kc_1', 'alpha');
  assert.equal(mgr.buildIfNeeded().built, true);
  const again = mgr.buildIfNeeded();
  assert.equal(again.built, false);
  assert.equal(again.reason, 'no changes');
});

test('update + supersede chain seq 2 onto seq 1 next root', () => {
  const {db, mgr, addCard} = makeEnv();
  addCard('kc_1', 'alpha');
  addCard('kc_2', 'beta');
  mgr.buildIfNeeded();
  const seq1 = listPending(db)[0];

  db.prepare("UPDATE knowledge_cards SET title = 'alpha v2' WHERE id = 'kc_1'").run();
  db.prepare("UPDATE knowledge_cards SET status = 'superseded' WHERE id = 'kc_2'").run();

  const r2 = mgr.buildIfNeeded();
  assert.equal(r2.seq, 2);
  assert.equal(r2.opsCount, 2); // one updated + one removed

  const seq2 = listPending(db).find((p) => p.seq === 2);
  assert.equal(seq2.prev_state_root, seq1.next_state_root); // accumulator chains locally
  const ops = JSON.parse(fs.readFileSync(seq2.witness_path, 'utf8'));
  const kinds = JSON.parse(ops.payload).ops.map((o) => o.op).sort();
  assert.deepEqual(kinds, ['removed', 'updated']);
});

test('confirm marks pending as anchored exactly once', () => {
  const {db, mgr, addCard} = makeEnv();
  addCard('kc_1', 'alpha');
  mgr.buildIfNeeded();
  const tx = '0x' + 'ab'.repeat(32);
  assert.equal(confirmSeq(db, 1, tx), true);
  assert.equal(confirmSeq(db, 1, tx), false); // already anchored → no-op
  assert.equal(listPending(db).length, 0);
});

test('changing controller after space creation is refused (new wallet = new Space)', () => {
  const {db, dir, mgr, addCard} = makeEnv();
  addCard('kc_1', 'alpha');
  mgr.buildIfNeeded(); // mints space identity bound to CONTROLLER

  const other = {enabled: true, controller_address: '0x' + '22'.repeat(20)};
  assert.throws(
    () => new AnchoringManager({indexer: {db}, awarenessDir: dir}, other).ensureInit(),
    /new Space/,
  );
});

test('missing controller: build reports why and does nothing', () => {
  const {mgr} = (() => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE knowledge_cards (id TEXT PRIMARY KEY, category TEXT, title TEXT, summary TEXT, tags TEXT, status TEXT)');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-test-'));
    return {mgr: new AnchoringManager({indexer: {db}, awarenessDir: dir}, {enabled: true, controller_address: ''}).ensureInit()};
  })();
  const r = mgr.buildIfNeeded();
  assert.equal(r.built, false);
  assert.match(r.reason, /controller/);
});
