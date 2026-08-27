// F-088 · Pins the vendored ERC-8350 math to the protocol's cross-language conformance
// vectors. If this fails, the vendored copy has drifted from the standard
// (SSOT: AwareLiquid/ERC-8350) and MUST NOT be published.
//
// Drives `fixtures/erc8350-vectors-v2.json`, a byte-for-byte copy of the protocol's
// `test-vectors/v2.json`. v1 checked that one hash was computed correctly. v2 checks
// the state machine: five chained transitions where each delta is only computable from
// the previous one's nextStateRoot, the optional-field encodings, and twelve rejections.
//
// What this file can and cannot pin, stated because the previous version of this
// comment overclaimed:
//   - CAN: typehashes, spaceId derivation, all three commitments per entry,
//     transitionId, nextStateRoot, and prior-root linkage across the chain.
//   - CANNOT: `expected.signingDigest`. That needs the EIP-712 domain separator, and
//     the daemon deliberately has no signing path — the private key only ever exists
//     inside the CLI process (D7). The CLI asserts the chain-returned transitionId
//     against the precomputed one, covering the same ground from the other side.
//   - CANNOT: the rejection *behaviours*. Those are registry state-machine properties;
//     this module is pure hashing. What a pure recomputation can check is that each
//     published selector really is the first four bytes of keccak256(signature) —
//     which is the same limit the protocol's own check-vectors.mjs states for itself.
//
// Copying the vectors in means this test catches drift in OUR math, not drift in the
// PROTOCOL's vectors: a copy cannot notice that its source changed. That second
// question needs the network and is deliberately not fused into this offline suite —
// see scripts/check-vector-drift.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
  EXPERIENCE_DELTA_TYPEHASH, MEMORY_STATE_TYPEHASH, MEMORY_SPACE_TYPEHASH,
  deriveSpaceId, computeTransitionId, computeNextStateRoot,
  computeDeltaCommitment, computeProvenanceCommitment, computeLocatorCommitment,
  keccakUtf8, stableStringify, ZERO32,
} from '../src/daemon/anchoring/erc8350.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const v = JSON.parse(
  readFileSync(path.join(here, 'fixtures', 'erc8350-vectors-v2.json'), 'utf8'),
);

const utf8 = (s) => new TextEncoder().encode(s);

test('typehashes match the protocol vectors', () => {
  assert.equal(EXPERIENCE_DELTA_TYPEHASH, v.typehashes.experienceDelta);
  assert.equal(MEMORY_STATE_TYPEHASH, v.typehashes.memoryState);
  assert.equal(MEMORY_SPACE_TYPEHASH, v.typehashes.memorySpace);
});

test('spaceId derivation matches the protocol vectors', () => {
  assert.equal(deriveSpaceId(v.space.controller, v.space.salt), v.space.spaceId);
});

test('the fixture has the shape the assertions below assume', () => {
  // Guards the guard: if a future copy of the fixture silently lost the chain, every
  // per-entry assertion would vacuously pass and this file would report success while
  // checking nothing.
  assert.ok(Array.isArray(v.chain) && v.chain.length === 5, 'expected 5 chained entries');
  assert.ok(Array.isArray(v.rejections) && v.rejections.length === 12, 'expected 12 rejections');
});

// Each entry is checked in isolation first, then linked to its predecessor, so a
// linkage failure stays distinguishable from a hashing failure.
for (const [index, entry] of v.chain.entries()) {
  const label = `${index + 1}/5 ${entry.label}`;

  test(`commitments match for ${label}`, () => {
    const w = entry.witness;
    const d = entry.delta;

    assert.equal(
      computeDeltaCommitment(utf8(w.payload), w.deltaSalt, d.profileId),
      d.deltaCommitment,
      'deltaCommitment',
    );

    // The optional commitments are what this entry set exists to exercise: absent MUST
    // be the zero word, not the hash of an empty string.
    if (w.provenance === null) {
      assert.equal(d.provenanceCommitment, ZERO32, 'absent provenance is the zero word');
    } else {
      assert.equal(
        computeProvenanceCommitment(utf8(w.provenance), w.provenanceSalt),
        d.provenanceCommitment,
        'provenanceCommitment',
      );
    }

    if (w.locator === null) {
      assert.equal(d.locatorCommitment, ZERO32, 'absent locator is the zero word');
    } else {
      assert.equal(
        computeLocatorCommitment(w.locator, w.locatorSalt),
        d.locatorCommitment,
        'locatorCommitment',
      );
    }
  });

  test(`transitionId and nextStateRoot match for ${label}`, () => {
    const tid = computeTransitionId({...entry.delta, sequence: Number(entry.delta.sequence)});
    assert.equal(tid, entry.expected.transitionId, 'transitionId');
    assert.equal(
      computeNextStateRoot(entry.delta.prevStateRoot, tid),
      entry.expected.nextStateRoot,
      'nextStateRoot',
    );
  });
}

test('the chain actually chains — continuity, not five isolated deltas', () => {
  // The property v1 could not express, and the reason the roadmap's open call for a
  // second implementation was unmeetable from the published artifacts: a lone genesis
  // delta cannot show that sequence N+1 is only computable from sequence N's result.
  let expectedPrev = ZERO32;
  let expectedSequence = 1n;

  for (const entry of v.chain) {
    assert.equal(
      entry.delta.prevStateRoot,
      expectedPrev,
      `${entry.label}: prevStateRoot must be the predecessor's nextStateRoot`,
    );
    assert.equal(
      BigInt(entry.delta.sequence),
      expectedSequence,
      `${entry.label}: sequence must advance by exactly one`,
    );
    assert.equal(
      entry.delta.spaceId,
      v.space.spaceId,
      `${entry.label}: every entry belongs to the same Space`,
    );

    // Recomputed rather than read from `expected` — reading it would only prove the
    // file is internally consistent, which it can be while our math is wrong.
    const tid = computeTransitionId({...entry.delta, sequence: Number(entry.delta.sequence)});
    expectedPrev = computeNextStateRoot(entry.delta.prevStateRoot, tid);
    expectedSequence += 1n;
  }

  assert.equal(
    expectedPrev,
    v.chain[v.chain.length - 1].expected.nextStateRoot,
    'head root after replaying the whole chain',
  );
});

test('every rejection selector is the first four bytes of its signature', () => {
  // The behaviours belong to the registry; the selector↔signature relation is the part
  // a pure recomputation can hold, and it catches a signature being edited without its
  // selector, or the reverse.
  for (const r of v.rejections) {
    assert.equal(
      keccakUtf8(r.signature).slice(0, 10),
      r.selector,
      `${r.name} selector for ${r.signature}`,
    );
  }
});

test('stableStringify is key-order independent and deterministic', () => {
  const a = stableStringify({b: 2, a: [1, 2], c: {y: 'z', x: 'w'}});
  const b = stableStringify({c: {x: 'w', y: 'z'}, a: [1, 2], b: 2});
  assert.equal(a, b);
  assert.equal(a, '{"a":[1,2],"b":2,"c":{"x":"w","y":"z"}}');
});
