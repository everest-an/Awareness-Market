// F-088 P2 · Calldata encoders / return decoders for the ERC-8350 registry.
// Encodings are pinned by test/anchoring-abi.test.mjs against real calldata from
// the confirmed Sepolia fixture broadcast — not hand-derived expectations.

import {keccakUtf8} from './erc8350.mjs';
import {hexToBytes, bytesToHex} from './eth-tx.mjs';

function selector(signature) {
  return keccakUtf8(signature).slice(0, 10); // 0x + 4 bytes
}

export const SEL_REGISTER_SPACE = selector('registerSpace(bytes32,address,address,bytes32,bytes)');
export const SEL_COMMIT_TRANSITION = selector(
  'commitTransition((bytes32,uint64,bytes32,bytes32,bytes32,bytes32,bytes32),bytes)'
);
export const SEL_HEAD = selector('head(bytes32)');
export const SEL_SPACE_AUTHORIZATION = selector('spaceAuthorization(bytes32)');

function word(hex32) {
  const h = hex32.replace(/^0x/, '');
  if (h.length !== 64) throw new Error(`expected bytes32, got 0x${h}`);
  return h.toLowerCase();
}
function addrWord(addr) {
  const h = addr.replace(/^0x/, '');
  if (h.length !== 40) throw new Error(`expected address, got 0x${h}`);
  return h.toLowerCase().padStart(64, '0');
}
function uintWord(v) {
  return BigInt(v).toString(16).padStart(64, '0');
}

/** registerSpace(spaceId, controller, authorizer, salt, "") — empty signature
 *  (direct-call authorization: msg.sender must be the controller). */
export function encodeRegisterSpace(spaceId, controller, authorizer, salt) {
  return SEL_REGISTER_SPACE +
    word(spaceId) + addrWord(controller) + addrWord(authorizer) + word(salt) +
    uintWord(0xa0) + // offset of dynamic `bytes` (5 head words * 32)
    uintWord(0);     // bytes length 0
}

/** commitTransition(delta, "") — the 7-field static tuple is inlined in the head. */
export function encodeCommitTransition(delta) {
  return SEL_COMMIT_TRANSITION +
    word(delta.space_id ?? delta.spaceId) +
    uintWord(delta.sequence ?? delta.seq) +
    word(delta.prev_state_root ?? delta.prevStateRoot) +
    word(delta.delta_commitment ?? delta.deltaCommitment) +
    word(delta.provenance_commitment ?? delta.provenanceCommitment) +
    word(delta.profile_id ?? delta.profileId) +
    word(delta.locator_commitment ?? delta.locatorCommitment) +
    uintWord(0x100) + // offset of dynamic `bytes` (8 head words * 32)
    uintWord(0);      // bytes length 0
}

export function encodeHeadCall(spaceId) {
  return SEL_HEAD + word(spaceId);
}
export function encodeSpaceAuthorizationCall(spaceId) {
  return SEL_SPACE_AUTHORIZATION + word(spaceId);
}

function splitWords(resultHex) {
  const h = resultHex.replace(/^0x/, '');
  const words = [];
  for (let i = 0; i + 64 <= h.length; i += 64) words.push('0x' + h.slice(i, i + 64));
  return words;
}

/** head(spaceId) → (transitionId, stateRoot, sequence) */
export function decodeHead(resultHex) {
  const [transitionId, stateRoot, seq] = splitWords(resultHex);
  return {transitionId, stateRoot, sequence: Number(BigInt(seq))};
}

/** spaceAuthorization(spaceId) → (controller, authorizer, configNonce) */
export function decodeSpaceAuthorization(resultHex) {
  const [c, a, n] = splitWords(resultHex);
  return {
    controller: '0x' + c.slice(-40),
    authorizer: '0x' + a.slice(-40),
    configNonce: Number(BigInt(n)),
  };
}

export {hexToBytes, bytesToHex};
