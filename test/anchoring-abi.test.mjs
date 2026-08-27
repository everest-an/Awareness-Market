// F-088 P2 · Pins the ABI encoders to REAL calldata captured from the confirmed
// Sepolia fixture broadcast (four txs live on chain). If these fail, the encoder
// would produce transactions the registry rejects — do not ship.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
  encodeRegisterSpace, encodeCommitTransition, encodeHeadCall,
  decodeHead, decodeSpaceAuthorization,
} from '../src/daemon/anchoring/registry-abi.mjs';
import {addressFromPrivateKey, signEip1559Tx, toChecksum} from '../src/daemon/anchoring/eth-tx.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const g = JSON.parse(readFileSync(path.join(here, 'fixtures', 'erc8350-calldata-golden.json'), 'utf8'));

test('registerSpace calldata matches the real Sepolia broadcast byte-for-byte', () => {
  const {spaceId, controller, salt} = g.inputs;
  assert.equal(
    encodeRegisterSpace(spaceId, controller, controller, salt).toLowerCase(),
    g.registerSpace.toLowerCase(),
  );
});

test('commitTransition calldata matches the real Sepolia broadcast byte-for-byte', () => {
  assert.equal(
    encodeCommitTransition(g.inputs.delta1).toLowerCase(),
    g.commitTransition_seq1.toLowerCase(),
  );
});

test('head call selector + decoders round shapes', () => {
  const call = encodeHeadCall(g.inputs.spaceId);
  assert.equal(call.length, 10 + 64);
  const decoded = decodeHead('0x' + '11'.repeat(32) + '22'.repeat(32) + '00'.repeat(31) + '04');
  assert.equal(decoded.sequence, 4);
  assert.equal(decoded.transitionId, '0x' + '11'.repeat(32));
  const auth = decodeSpaceAuthorization('0x' + '00'.repeat(12) + 'ab'.repeat(20) + '00'.repeat(12) + 'cd'.repeat(20) + '00'.repeat(31) + '02');
  assert.equal(auth.controller, '0x' + 'ab'.repeat(20));
  assert.equal(auth.configNonce, 2);
});

test('address derivation matches known anvil dev account', () => {
  // anvil default key #0 — public knowledge, zero value.
  const addr = addressFromPrivateKey('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  assert.equal(addr, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  assert.equal(toChecksum(addr.toLowerCase()), addr); // EIP-55 self-consistent
});

test('EIP-1559 signing is deterministic-shaped and type-2 prefixed', () => {
  const raw = signEip1559Tx({
    chainId: 31337n, nonce: 0n, maxPriorityFeePerGas: 1n, maxFeePerGas: 2n,
    gas: 21000n, to: '0x' + '11'.repeat(20), value: 0n, data: '0x',
  }, '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  assert.match(raw, /^0x02/);
  const again = signEip1559Tx({
    chainId: 31337n, nonce: 0n, maxPriorityFeePerGas: 1n, maxFeePerGas: 2n,
    gas: 21000n, to: '0x' + '11'.repeat(20), value: 0n, data: '0x',
  }, '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  assert.equal(raw, again); // RFC6979 deterministic nonce
});
