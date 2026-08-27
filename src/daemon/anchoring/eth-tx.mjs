// F-088 P2 · Minimal EIP-1559 transaction layer (pure JS, no web3 framework).
// Scope is deliberately tiny: type-2 transactions, JSON-RPC over fetch, receipt
// polling. Enough to broadcast anchor commits; nothing more.

import {keccak_256} from '@noble/hashes/sha3.js';
import {secp256k1} from '@noble/curves/secp256k1.js';

export function hexToBytes(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function bytesToHex(bytes) {
  let s = '0x';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}
function concat(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}
function intToMinimal(v) {
  let x = BigInt(v);
  if (x < 0n) throw new Error('negative int');
  if (x === 0n) return new Uint8Array(0); // RLP canonical zero = empty string
  const bytes = [];
  while (x > 0n) { bytes.unshift(Number(x & 0xffn)); x >>= 8n; }
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// RLP (encode only)
function rlpEncode(item) {
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0] < 0x80) return item;
    return concat(lengthPrefix(item.length, 0x80), item);
  }
  if (Array.isArray(item)) {
    const payload = concat(...item.map(rlpEncode));
    return concat(lengthPrefix(payload.length, 0xc0), payload);
  }
  throw new Error('rlp: unsupported item');
}
function lengthPrefix(len, offset) {
  if (len <= 55) return new Uint8Array([offset + len]);
  const lenBytes = intToMinimal(len);
  return concat(new Uint8Array([offset + 55 + lenBytes.length]), lenBytes);
}

// ---------------------------------------------------------------------------
export function addressFromPrivateKey(privKeyHex) {
  const pub = secp256k1.getPublicKey(hexToBytes(privKeyHex), false); // uncompressed 65B
  const hash = keccak_256(pub.slice(1));
  return toChecksum(bytesToHex(hash.slice(12)));
}

// EIP-55 checksum, so printed addresses compare cleanly with configs.
export function toChecksum(addrHex) {
  const lower = addrHex.toLowerCase().replace(/^0x/, '');
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower))).slice(2);
  let out = '0x';
  for (let i = 0; i < 40; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

/** Sign a type-2 (EIP-1559) transaction; returns the raw 0x02… hex for broadcast. */
export function signEip1559Tx(tx, privKeyHex) {
  const fields = [
    intToMinimal(tx.chainId),
    intToMinimal(tx.nonce),
    intToMinimal(tx.maxPriorityFeePerGas),
    intToMinimal(tx.maxFeePerGas),
    intToMinimal(tx.gas),
    tx.to ? hexToBytes(tx.to) : new Uint8Array(0),
    intToMinimal(tx.value ?? 0n),
    hexToBytes(tx.data ?? '0x'),
    [], // accessList
  ];
  const unsigned = concat(new Uint8Array([0x02]), rlpEncode(fields));
  const digest = keccak_256(unsigned);
  // noble v2 'recovered' layout: [recovery(1) | r(32) | s(32)]
  // prehash:false — the digest is already keccak256; noble v2 would otherwise
  // sha256 it again and the recovered sender would be garbage.
  const sig = secp256k1.sign(digest, hexToBytes(privKeyHex), {format: 'recovered', prehash: false});
  const stripZeros = (b) => { let i = 0; while (i < b.length && b[i] === 0) i++; return b.slice(i); };
  const signed = concat(new Uint8Array([0x02]), rlpEncode([
    ...fields,
    intToMinimal(sig[0]),
    stripZeros(sig.slice(1, 33)),
    stripZeros(sig.slice(33, 65)),
  ]));
  return bytesToHex(signed);
}

// ---------------------------------------------------------------------------
export async function rpcCall(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status} for ${method}`);
  const body = await res.json();
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
  return body.result;
}

export async function waitForReceipt(url, txHash, {timeoutMs = 180000, intervalMs = 3000} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await rpcCall(url, 'eth_getTransactionReceipt', [txHash]);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`receipt timeout for ${txHash}`);
}

/** Sign + broadcast + wait; throws unless the receipt says success. */
export async function sendTx(url, tx, privKeyHex) {
  const raw = signEip1559Tx(tx, privKeyHex);
  const txHash = await rpcCall(url, 'eth_sendRawTransaction', [raw]);
  const receipt = await waitForReceipt(url, txHash);
  if (receipt.status !== '0x1') throw new Error(`tx reverted: ${txHash}`);
  return {txHash, receipt};
}
