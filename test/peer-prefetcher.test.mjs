// W4 · PeerPrefetcher — background prefetch into the SAME local DB, recall()
// untouched. The prefetcher is a prefetcher, not a router: it only ADDS rows
// the way periodic sync does; the recall code path is asserted unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPeerPrefetcher } from '../src/core/sync/peer-prefetcher.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// --- fake cloudSync: puller returns cards, applyCard writes to a fake indexer ---

function makeHarness({ failPull = false } = {}) {
  const db = { state: new Map() };
  const indexer = {
    db: {
      prepare(sql) {
        const keyMatch = sql.match(/'([^']+)'/);
        return {
          get: () => ({ value: db.state.get(keyMatch?.[1]) ?? null }),
          run: (...args) => {
            const key = keyMatch?.[1];
            const value = args[0];
            if (key) db.state.set(key, value);
            return { changes: 1 };
          },
        };
      },
    },
  };

  const applied = [];
  const cloudSync = {
    _cardPuller: {
      async pullCardsSince() {
        if (failPull) throw new Error('network down');
        return { pulled: 2, cards: [{ id: 'pc_1' }, { id: 'pc_2' }] };
      },
    },
    isEnabled: () => true,
    indexer,
    _applyPulledCard: async (card) => { applied.push(card.id); return 'inserted'; },
  };

  // Wire applyCard the way cloud-sync does (puller calls it per card)
  cloudSync._cardPuller.pullCardsSince = async () => {
    if (failPull) throw new Error('network down');
    for (const c of [{ id: 'pc_1' }, { id: 'pc_2' }]) {
      await cloudSync._applyPulledCard(c);
    }
    return { pulled: 2, cards: [{ id: 'pc_1' }, { id: 'pc_2' }] };
  };

  return { prefetcher: createPeerPrefetcher({ cloudSync, indexer, logger: { log: () => {} } }), applied, cloudSync };
}

test('prefetchOnce applies cards through the same applyCard bridge', async () => {
  const { prefetcher, applied } = makeHarness();
  const result = await prefetcher.prefetchOnce();
  assert.equal(result.pulled, 2);
  assert.deepEqual(applied.sort(), ['pc_1', 'pc_2'],
    'prefetched cards must go through the SAME write path as periodic sync');
});

test('prefetch cursor persists after a successful pass', async () => {
  const { prefetcher, cloudSync } = makeHarness();
  await prefetcher.prefetchOnce();
  const cursor = cloudSync.indexer.db.prepare(
    "SELECT value FROM sync_state WHERE key = 'peer_prefetch_last_pull_at'",
  ).get();
  assert.ok(cursor?.value, 'cursor must be stored after a successful pass');
});

test('prefetch failure is swallowed — no throw, no crash', async () => {
  const { prefetcher } = makeHarness({ failPull: true });
  const result = await prefetcher.prefetchOnce();
  assert.equal(result.pulled, 0);
  assert.ok(result.error, 'error surfaced in result, not thrown');
});

test('start/stop lifecycle: start kicks an immediate pass, stop clears the timer', async () => {
  const { prefetcher } = makeHarness();
  prefetcher.start(10_000);
  assert.equal(prefetcher.isRunning(), true);
  await prefetcher.stop();
  assert.equal(prefetcher.isRunning(), false);
});

test('disabled cloud sync → prefetch no-ops safely', async () => {
  const { prefetcher, cloudSync } = makeHarness();
  cloudSync.isEnabled = () => false;
  const result = await prefetcher.prefetchOnce();
  assert.equal(result.pulled, 0);
});

test('recall code path is untouched — prefetcher adds rows, never queries', async () => {
  // The red line: recall() must not change. This test asserts the prefetcher
  // module does NOT import or call any recall/search function — it only writes.
  // Comments may mention recall() as rationale; strip comment lines first.
  const src = readSource().split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  assert.ok(!src.includes('recall('), 'prefetcher must not call recall');
  assert.ok(!src.includes('searchKnowledge'), 'prefetcher must not touch search');
  assert.ok(src.includes('pullCardsSince'), 'prefetcher uses the pull pipeline');
  // The bridge is exercised behaviorally (first test). The prefetcher's only
  // card-writing surface is the cloudSync applyCard bridge — it must never
  // write knowledge_cards directly (sync_state cursor writes are fine).
  assert.ok(!src.includes('INSERT INTO knowledge_cards'),
    'prefetcher must not write cards directly');
  assert.ok(!src.includes('UPDATE knowledge_cards'),
    'prefetcher must not write cards directly');
});

function readSource() {
  return readFileSync(path.join(HERE, '..', 'src', 'core', 'sync', 'peer-prefetcher.mjs'), 'utf8');
}