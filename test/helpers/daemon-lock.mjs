/**
 * Mutex for suites that drive the shared daemon on port 37800.
 *
 * `node --test` runs test FILES concurrently. Any suite that calls
 * POST /api/v1/workspace/switch is mutating global daemon state, so two such
 * files running at once interleave: one switches the daemon away while the
 * other is mid-assertion, and the second suite reads a third project's data.
 *
 * That produced a spectacular false alarm — F-055 (cross-workspace isolation)
 * and F-059 failed together and looked exactly like a real data leak, while
 * each suite passed 3/3 in isolation. The daemon was correct the whole time;
 * the tests were fighting over it.
 *
 * These suites also only run at all when a daemon happens to be listening, so
 * the conflict stays invisible until someone runs the full suite with one up —
 * which is precisely when you most want the results to be trustworthy.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOCK_FILE = path.join(os.tmpdir(), 'awareness-daemon-suite.lock');
const STALE_MS = 5 * 60 * 1000;   // a suite that ran this long has died
const POLL_MS = 250;
const ACQUIRE_TIMEOUT_MS = 4 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lockIsStale() {
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf-8');
    const { pid, at } = JSON.parse(raw);
    if (Date.now() - at > STALE_MS) return true;
    // Owner gone (crash, Ctrl-C) → the lock is ours to take.
    try { process.kill(pid, 0); return false; } catch { return true; }
  } catch {
    return true;   // unreadable or malformed → treat as stale
  }
}

/**
 * Block until this process owns the daemon. Returns a release function.
 * Always release in a `finally` / `after()` so a failing assertion cannot
 * strand the next suite.
 */
export async function acquireDaemonLock(label) {
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

  for (;;) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now(), label }));
      fs.closeSync(fd);
      return () => { try { fs.unlinkSync(LOCK_FILE); } catch { /* already gone */ } };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (lockIsStale()) {
        try { fs.unlinkSync(LOCK_FILE); } catch { /* raced with the owner */ }
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `[${label}] timed out waiting for the daemon lock (${LOCK_FILE}). `
          + 'Another daemon-driving suite is holding it, or a stale lock survived. '
          + 'Delete the file if no test is running.',
        );
      }
      await sleep(POLL_MS);
    }
  }
}
