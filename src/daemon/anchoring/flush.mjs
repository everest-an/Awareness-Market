// F-088 P2 · The broadcast engine: takes pending outbox rows and anchors them on
// chain, in sequence order, self-verifying each commit against the precomputed
// witness values (same discipline as the protocol's fixture script — a successful
// flush IS the cross-implementation check).
//
// Runs in the CLI process only. The private key lives here for the duration of
// one call and nowhere else — never in the daemon, never in config, never logged.

import {
  rpcCall, sendTx, addressFromPrivateKey, toChecksum,
} from './eth-tx.mjs';
import {
  encodeRegisterSpace, encodeCommitTransition,
  encodeHeadCall, encodeSpaceAuthorizationCall,
  decodeHead, decodeSpaceAuthorization,
} from './registry-abi.mjs';

const ZERO_ADDR = '0x' + '00'.repeat(20);
const ZERO_TX = '0x' + '00'.repeat(32); // marks rows found already anchored on chain

/**
 * @param {object} opts
 * @param {string}   opts.rpcUrl
 * @param {number}   opts.chainId
 * @param {string}   opts.registry        registry contract address
 * @param {string}   opts.privKeyHex      controller key (consumed, never stored)
 * @param {string}   opts.controller      expected controller address (from config)
 * @param {string}   opts.spaceId
 * @param {string}   opts.spaceSalt
 * @param {Array}    opts.rows            pending outbox rows, ascending seq
 * @param {Function} opts.onConfirm       async (seq, txHash) → report back to daemon
 * @param {Function} [opts.log]
 */
export async function flushOutbox(opts) {
  const {rpcUrl, chainId, registry, privKeyHex, controller, spaceId, spaceSalt,
    rows, onConfirm, log = () => {}} = opts;

  // 1. Key must be the controller — refuse before any network interaction.
  const sender = addressFromPrivateKey(privKeyHex);
  if (sender.toLowerCase() !== controller.toLowerCase()) {
    throw new Error(`key is for ${sender}, but the Space controller is ${toChecksum(controller)} — refusing`);
  }

  // 2. Chain sanity.
  const rpcChainId = Number(BigInt(await rpcCall(rpcUrl, 'eth_chainId')));
  if (rpcChainId !== Number(chainId)) {
    throw new Error(`RPC is chain ${rpcChainId}, config says ${chainId} — refusing`);
  }

  // 3. Register the Space if the registry does not know it yet. The reference
  //    registry REVERTS (UnknownSpace) for unregistered ids rather than returning
  //    zeros, so a reverted read means "needs registration".
  let auth = null;
  try {
    auth = decodeSpaceAuthorization(
      await rpcCall(rpcUrl, 'eth_call', [{to: registry, data: encodeSpaceAuthorizationCall(spaceId)}, 'latest'])
    );
  } catch (err) {
    if (!/revert/i.test(err.message)) throw err; // real RPC failure, not UnknownSpace
  }
  if (!auth || auth.controller === ZERO_ADDR) {
    log(`registering Space ${spaceId.slice(0, 10)}… (controller = authorizer = ${sender})`);
    await sendPrepared(opts, sender, encodeRegisterSpace(spaceId, sender, sender, spaceSalt));
    log('Space registered');
  } else if (auth.controller.toLowerCase() !== sender.toLowerCase()) {
    throw new Error(`Space is controlled by ${auth.controller}, not this key — refusing`);
  }

  // 4. Commit pending rows in order, skipping any the chain already has
  //    (idempotent resume: the chain head decides where we continue).
  const results = [];
  for (const row of rows) {
    const head = decodeHead(
      await rpcCall(rpcUrl, 'eth_call', [{to: registry, data: encodeHeadCall(spaceId)}, 'latest'])
    );
    if (row.seq <= head.sequence) {
      log(`seq ${row.seq} already on chain (head=${head.sequence}) — reconciling locally`);
      await onConfirm(row.seq, ZERO_TX);
      results.push({seq: row.seq, txHash: ZERO_TX, skipped: true});
      continue;
    }
    if (row.seq !== head.sequence + 1) {
      throw new Error(`outbox seq ${row.seq} does not follow chain head ${head.sequence} — outbox gap?`);
    }
    if (head.sequence > 0 && row.prev_state_root !== head.stateRoot) {
      throw new Error(
        `seq ${row.seq} prevStateRoot ${row.prev_state_root} != chain head root ${head.stateRoot} — local/chain divergence`
      );
    }

    log(`committing seq ${row.seq} (${row.ops_count} ops)…`);
    const {txHash} = await sendPrepared(opts, sender, encodeCommitTransition(row));

    // Self-verify: the chain's new head must equal the precomputed witness values.
    const after = decodeHead(
      await rpcCall(rpcUrl, 'eth_call', [{to: registry, data: encodeHeadCall(spaceId)}, 'latest'])
    );
    if (after.sequence !== row.seq || after.stateRoot !== row.next_state_root) {
      throw new Error(
        `seq ${row.seq} landed but head mismatch: chain (${after.sequence}, ${after.stateRoot}) ` +
        `vs witness (${row.seq}, ${row.next_state_root})`
      );
    }
    await onConfirm(row.seq, txHash);
    log(`  anchored: tx ${txHash} · head root ${after.stateRoot.slice(0, 18)}… ✓`);
    results.push({seq: row.seq, txHash, skipped: false});
  }
  return results;
}

async function sendPrepared({rpcUrl, chainId, registry, privKeyHex}, sender, data) {
  const [nonceHex, gasPriceHex] = await Promise.all([
    rpcCall(rpcUrl, 'eth_getTransactionCount', [sender, 'pending']),
    rpcCall(rpcUrl, 'eth_gasPrice'),
  ]);
  const gasPrice = BigInt(gasPriceHex);
  const gasHex = await rpcCall(rpcUrl, 'eth_estimateGas', [{from: sender, to: registry, data}]);
  const gas = (BigInt(gasHex) * 12n) / 10n; // 20% headroom
  return sendTx(rpcUrl, {
    chainId: BigInt(chainId),
    nonce: BigInt(nonceHex),
    maxPriorityFeePerGas: gasPrice < 1_500_000_000n ? gasPrice : 1_500_000_000n,
    maxFeePerGas: gasPrice * 2n,
    gas,
    to: registry,
    value: 0n,
    data,
  }, privKeyHex);
}
