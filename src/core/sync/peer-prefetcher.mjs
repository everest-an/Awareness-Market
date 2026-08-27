// Batch C · PeerPrefetcher — background prefetch of peer/cloud cards into the
// SAME local database, with `recall()` untouched.
//
// WHY A PREFETCHER, NOT A ROUTER:
//   The earlier QueryRouter design (local → peer → cloud recall path) is
//   defunct. It would have replaced the R@5=95.6% retrieval baseline with a
//   new code path — the exact kind of change that silently shifts ranking
//   weights. Prefetching gets the same network saving (cards are already
//   local when recall asks) with zero risk to retrieval: recall() reads the
//   same SQLite it always did, and the prefetcher only adds rows.
//
// DESIGN:
//   - Reuses createCardPuller + the cloud-sync applyCard bridge (the same
//     insert/update logic the periodic sync uses — one write path, not two).
//   - Runs on its own timer, independent of the periodic fullSync, so a peer
//     that publishes frequently gets its cards local sooner.
//   - Best-effort: prefetch failure never crashes the daemon and never
//     blocks recall.
//
// recall() compatibility is asserted by tests: after a prefetch run, recall
// returns prefetched cards WITHOUT any change to the recall code path.

const LOG_PREFIX = '[PeerPrefetcher]';
const DEFAULT_INTERVAL_MS = 60_000; // 1 min — faster than the 5-min fullSync

/**
 * @param {object} deps
 * @param {object} deps.cloudSync        - CloudSync instance (reuses puller + applyCard)
 * @param {object} deps.indexer          - local Indexer (has .db)
 * @param {object} [deps.logger]
 * @returns {{
 *   start: (intervalMs?: number) => void,
 *   stop: () => Promise<void>,
 *   prefetchOnce: () => Promise<{pulled: number, error?: string}>,
 *   isRunning: () => boolean,
 * }}
 */
export function createPeerPrefetcher({ cloudSync, indexer, logger = console }) {
  if (!cloudSync) throw new Error('createPeerPrefetcher: cloudSync is required');
  if (!indexer) throw new Error('createPeerPrefetcher: indexer is required');

  let timer = null;
  let stopped = false;
  let inflight = null;

  /**
   * One prefetch pass: pull cards changed since the last successful pull and
   * apply them via the SAME applyCard bridge as periodic sync. Uses the
   * cloudSync._cardPuller when available; otherwise no-op.
   */
  async function prefetchOnce() {
    if (stopped || !cloudSync.isEnabled()) return { pulled: 0 };
    const puller = cloudSync._cardPuller;
    if (!puller) return { pulled: 0, error: 'card puller unavailable' };
    try {
      const lastPulledAt = cloudSync.indexer
        ? getLastPullAt(cloudSync.indexer)
        : null;
      const result = await puller.pullCardsSince(lastPulledAt, { limit: 50 });
      if (result.error) {
        // endpoint not available etc — not a crash, just a skipped pass
        return { pulled: 0, error: result.error };
      }
      if (result.pulled > 0) {
        setLastPullAt(cloudSync.indexer, new Date().toISOString());
        logger.log(`${LOG_PREFIX} prefetched ${result.pulled} card(s)`);
      }
      return { pulled: result.pulled };
    } catch (err) {
      // Prefetch is best-effort: never let a network blip surface as a
      // daemon error. Cloud unavailability MUST NOT crash the daemon.
      return { pulled: 0, error: err.message };
    }
  }

  function start(intervalMs = DEFAULT_INTERVAL_MS) {
    if (timer) return;
    stopped = false;
    // Kick off one pass immediately, then on the interval.
    const tick = () => {
      if (stopped) return;
      const p = prefetchOnce().finally(() => { if (inflight === p) inflight = null; });
      inflight = p;
    };
    tick();
    timer = setInterval(tick, intervalMs);
    if (timer.unref) timer.unref(); // never keep the process alive for prefetch
    logger.log(`${LOG_PREFIX} started (interval ${intervalMs}ms)`);
  }

  async function stop() {
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    if (inflight) {
      try { await inflight; } catch { /* best-effort */ }
      inflight = null;
    }
  }

  function isRunning() {
    return !!timer && !stopped;
  }

  return { start, stop, prefetchOnce, isRunning };
}

/** Read the last prefetch cursor from sync_state (same table periodic sync uses). */
function getLastPullAt(indexer) {
  try {
    const row = indexer.db.prepare(
      "SELECT value FROM sync_state WHERE key = 'peer_prefetch_last_pull_at'",
    ).get();
    return row?.value ?? null;
  } catch { return null; }
}

/** Persist the prefetch cursor so restarts continue from where we left off. */
function setLastPullAt(indexer, iso) {
  try {
    indexer.db.prepare(
      `INSERT INTO sync_state (key, value) VALUES ('peer_prefetch_last_pull_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(iso);
  } catch { /* best-effort */ }
}
