// F-088 P2 · Zero-mock end-to-end: real anvil chain, registry deployed from the
// vendored bytecode BY OUR OWN SIGNER, real outbox rows built by AnchoringManager,
// then flushOutbox() broadcasts and self-verifies against the chain head.
//
// Requires an anvil binary; skipped cleanly when unavailable (CI without foundry).
// Point AWARENESS_ANVIL_BIN at anvil.exe to enable.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Database from 'better-sqlite3';
import {AnchoringManager} from '../src/daemon/anchoring/anchoring.mjs';
import {listPending, getMeta} from '../src/daemon/anchoring/anchor-state.mjs';
import {flushOutbox} from '../src/daemon/anchoring/flush.mjs';
import {rpcCall, sendTx, addressFromPrivateKey} from '../src/daemon/anchoring/eth-tx.mjs';
import {encodeHeadCall, decodeHead} from '../src/daemon/anchoring/registry-abi.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ANVIL = process.env.AWARENESS_ANVIL_BIN || '';
const PORT = 8548;
const RPC = `http://127.0.0.1:${PORT}`;
// anvil dev key #0 — public knowledge, zero value.
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const enabled = ANVIL && fs.existsSync(ANVIL);

test('E2E: build → deploy → flush → chain head matches witness', {skip: !enabled && 'no anvil binary (set AWARENESS_ANVIL_BIN)'}, async () => {
  const anvil = spawn(ANVIL, ['--port', String(PORT), '--silent'], {stdio: 'ignore', windowsHide: true});
  try {
    // wait for RPC
    let up = false;
    for (let i = 0; i < 30 && !up; i++) {
      try { await rpcCall(RPC, 'eth_chainId'); up = true; }
      catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    assert.ok(up, 'anvil did not come up');

    // 1. Deploy the registry from vendored bytecode with our own signer
    //    (contract creation: to = null).
    const {bytecode} = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'erc8350-registry-bytecode.json'), 'utf8'));
    const {receipt} = await sendTx(RPC, {
      chainId: 31337n, nonce: 0n,
      maxPriorityFeePerGas: 1_000_000_000n, maxFeePerGas: 3_000_000_000n,
      gas: 6_000_000n, to: null, value: 0n, data: bytecode,
    }, KEY);
    const registry = receipt.contractAddress;
    assert.ok(registry, 'no contract address in deploy receipt');

    // 2. Real outbox: two builds (add two cards → seq 1; mutate one → seq 2).
    const db = new Database(':memory:');
    db.exec('CREATE TABLE knowledge_cards (id TEXT PRIMARY KEY, category TEXT, title TEXT, summary TEXT, tags TEXT, status TEXT)');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-e2e-'));
    const controller = addressFromPrivateKey(KEY);
    const mgr = new AnchoringManager({indexer: {db}, awarenessDir: dir}, {
      enabled: true, chain_id: 31337, rpc_url: RPC, registry_address: registry,
      controller_address: controller,
    }).ensureInit();

    db.prepare("INSERT INTO knowledge_cards VALUES ('kc_a','decision','alpha','s','[]','open')").run();
    db.prepare("INSERT INTO knowledge_cards VALUES ('kc_b','insight','beta','s','[]','open')").run();
    assert.equal(mgr.buildIfNeeded().seq, 1);
    db.prepare("UPDATE knowledge_cards SET title='alpha v2' WHERE id='kc_a'").run();
    assert.equal(mgr.buildIfNeeded().seq, 2);

    const rows = listPending(db);
    assert.equal(rows.length, 2);

    // 3. Flush — registers the Space and commits both, self-verifying each head.
    const confirmed = [];
    const results = await flushOutbox({
      rpcUrl: RPC, chainId: 31337, registry, privKeyHex: KEY,
      controller, spaceId: getMeta(db, 'space_id'), spaceSalt: getMeta(db, 'space_salt'),
      rows, onConfirm: async (seq, tx) => confirmed.push([seq, tx]),
    });
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => !r.skipped));
    assert.deepEqual(confirmed.map(([s]) => s), [1, 2]);

    // 4. Independent read-back: chain head equals the local accumulator.
    const head = decodeHead(await rpcCall(RPC, 'eth_call', [
      {to: registry, data: encodeHeadCall(getMeta(db, 'space_id'))}, 'latest',
    ]));
    assert.equal(head.sequence, 2);
    assert.equal(head.stateRoot, getMeta(db, 'last_root'));

    // 5. Idempotent re-flush: chain already has both → reconciled as skips.
    const again = await flushOutbox({
      rpcUrl: RPC, chainId: 31337, registry, privKeyHex: KEY,
      controller, spaceId: getMeta(db, 'space_id'), spaceSalt: getMeta(db, 'space_salt'),
      rows, onConfirm: async () => {},
    });
    assert.ok(again.every((r) => r.skipped));
  } finally {
    anvil.kill();
  }
});
