// F-088 · Vendored ERC-8350 (Agent Memory State) hashing.
//
// SSOT is the protocol repository (AwareLiquid/ERC-8350, packages/core — renamed from
// ERC-AWAR on 2026-07-29; the npm scope is still @erc-awar/*). This file is a
// deliberate, minimal copy because src/ must never import outside the published package
// (npm-tarball rule; see the 0.9.6 incident in CLAUDE.md).
//
// Two different questions, deliberately answered by two different checks:
//
//   Did OUR math drift?  test/anchoring-golden.test.mjs, offline. Drives
//   test/fixtures/erc8350-vectors-v2.json — a byte-for-byte copy of the protocol's
//   test-vectors/v2.json — through all five chained transitions, their prior-root
//   linkage, the optional-field encodings, and the rejection selectors.
//
//   Did the PROTOCOL's vectors drift?  scripts/check-vector-drift.mjs, networked, and
//   deliberately NOT in `npm test`. A copy cannot notice that its source changed, so
//   that question needs a fetch; fusing it into the offline suite would make a red
//   result ambiguous between "the math is wrong" and "GitHub was slow".
//
// Not covered here, and not by accident: `expected.signingDigest`. It needs the EIP-712
// domain separator, and the daemon has no signing path at all — the private key exists
// only inside the CLI process (D7). The CLI closes that gap from the other side by
// asserting the chain-returned transitionId against the precomputed one.

import {keccak_256} from '@noble/hashes/sha3.js';

// ---------------------------------------------------------------------------
// bytes helpers
function hexToBytes(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error(`odd-length hex: ${hex}`);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToHex(bytes) {
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
function keccakBytes(bytes) { return bytesToHex(keccak_256(bytes)); }
export function keccakUtf8(s) { return keccakBytes(new TextEncoder().encode(s)); }

function word32(hex) {
  const b = hexToBytes(hex);
  if (b.length !== 32) throw new Error(`expected 32 bytes, got ${b.length}`);
  return b;
}
function addressWord(addr) {
  const b = hexToBytes(addr);
  if (b.length !== 20) throw new Error(`expected 20-byte address, got ${b.length}`);
  const w = new Uint8Array(32);
  w.set(b, 12);
  return w;
}
function uint64Word(value) {
  const v = BigInt(value);
  if (v < 0n || v > 0xffffffffffffffffn) throw new Error(`sequence out of uint64: ${value}`);
  const w = new Uint8Array(32);
  let x = v;
  for (let i = 31; i >= 24; i--) { w[i] = Number(x & 0xffn); x >>= 8n; }
  return w;
}

// ---------------------------------------------------------------------------
// Normative type strings and typehashes (must match the ERC-8350 golden vector).
export const EXPERIENCE_DELTA_TYPE =
  'ExperienceDelta(bytes32 spaceId,uint64 sequence,bytes32 prevStateRoot,bytes32 deltaCommitment,bytes32 provenanceCommitment,bytes32 profileId,bytes32 locatorCommitment)';
export const MEMORY_STATE_TYPE = 'MemoryState(bytes32 prevStateRoot,bytes32 transitionId)';
export const MEMORY_SPACE_TYPE = 'MemorySpace(address initialController,bytes32 salt)';

export const EXPERIENCE_DELTA_TYPEHASH = keccakUtf8(EXPERIENCE_DELTA_TYPE);
export const MEMORY_STATE_TYPEHASH = keccakUtf8(MEMORY_STATE_TYPE);
export const MEMORY_SPACE_TYPEHASH = keccakUtf8(MEMORY_SPACE_TYPE);

// Baseline commitment domains (ERC-8350 "Baseline private commitments").
export const DELTA_DOMAIN = keccakUtf8('AgentMemoryState.deltaCommitment.v1');
export const PROVENANCE_DOMAIN = keccakUtf8('AgentMemoryState.provenanceCommitment.v1');
export const LOCATOR_DOMAIN = keccakUtf8('AgentMemoryState.locatorCommitment.v1');

export const ZERO32 = '0x' + '00'.repeat(32);

// ---------------------------------------------------------------------------
export function deriveSpaceId(initialController, salt) {
  return keccakBytes(concat(
    word32(MEMORY_SPACE_TYPEHASH),
    addressWord(initialController),
    word32(salt),
  ));
}

export function computeTransitionId(delta) {
  return keccakBytes(concat(
    word32(EXPERIENCE_DELTA_TYPEHASH),
    word32(delta.spaceId),
    uint64Word(delta.sequence),
    word32(delta.prevStateRoot),
    word32(delta.deltaCommitment),
    word32(delta.provenanceCommitment),
    word32(delta.profileId),
    word32(delta.locatorCommitment),
  ));
}

export function computeNextStateRoot(prevStateRoot, transitionId) {
  return keccakBytes(concat(
    word32(MEMORY_STATE_TYPEHASH),
    word32(prevStateRoot),
    word32(transitionId),
  ));
}

export function computeDeltaCommitment(payloadBytes, saltHex, profileIdHex) {
  return keccakBytes(concat(
    word32(DELTA_DOMAIN),
    word32(profileIdHex),
    word32(saltHex),
    keccak_256(payloadBytes),
  ));
}

export function computeProvenanceCommitment(provenanceBytes, saltHex) {
  return keccakBytes(concat(
    word32(PROVENANCE_DOMAIN),
    word32(saltHex),
    keccak_256(provenanceBytes),
  ));
}

export function computeLocatorCommitment(locatorString, saltHex) {
  if (!locatorString) throw new Error('locator must not be empty');
  return keccakBytes(concat(
    word32(LOCATOR_DOMAIN),
    word32(saltHex),
    keccak_256(new TextEncoder().encode(locatorString)),
  ));
}

// Deterministic JSON (RFC 8785 subset: sorted keys, no whitespace; strings,
// integers, arrays, plain objects only) — the payload serialization contract.
export function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  if (typeof value === 'number' && !Number.isInteger(value)) {
    throw new Error('stableStringify: only integers supported');
  }
  return JSON.stringify(value);
}
