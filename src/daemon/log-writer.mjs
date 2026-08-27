/**
 * Tee console output to <project>/.awareness/daemon.log.
 *
 * The daemon has ~274 console.* calls and, until now, no log writer at all --
 * `daemon.logFile` was assigned in two places and read in none. The only thing
 * that ever produced a daemon.log was the parent process in
 * bin/awareness-local.mjs redirecting the child's fd 1/2, and that path is
 * skipped by every other way of starting: `--foreground`, the already-running
 * exit, the lock-wait exit, workspace switch, and -- most importantly -- `mcp`.
 *
 * Claude Code and every other IDE start the daemon through `mcp`, which spawns
 * it with `stdio: 'ignore'`. So for the primary way real users run this thing,
 * all 274 messages went nowhere. A crash left no file, no message, no exit
 * code: the daemon simply never appeared and nothing said why.
 *
 * Design notes:
 *  - Tee, do not replace. The original console still writes to stdout/stderr so
 *    the bin/ redirect path keeps behaving exactly as before.
 *  - Never throw. A logger that can break the daemon is worse than no logger,
 *    so every write is guarded and failures disable the tee rather than
 *    propagate.
 *  - Rotate on attach. Unbounded growth on a long-lived daemon is its own
 *    incident; one generation of history is enough to diagnose a crash.
 */

import fs from 'node:fs';
import path from 'node:path';

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB, then rotate to .old
const METHODS = ['log', 'warn', 'error'];

/**
 * The console methods as they were before this module touched anything.
 *
 * Captured once, at module load. Re-reading `console[m]` on each attach would
 * re-wrap whatever is currently installed, so an attach → detach → attach cycle
 * (which workspace switch performs on every switch) accumulates a layer each
 * time and detach can never restore the true original.
 */
const PRISTINE = Object.freeze(
  Object.fromEntries(METHODS.map((m) => [m, console[m]])),
);

let active = null; // { stream, filePath }

function stamp() {
  return new Date().toISOString();
}

/** Best-effort formatting; must never throw on circular or exotic values. */
function format(args) {
  return args.map((a) => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || `${a.name}: ${a.message}`;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

/** Rotate the log if it has grown past the cap. Failures are non-fatal. */
function rotateIfNeeded(filePath) {
  try {
    const st = fs.statSync(filePath);
    if (st.size < MAX_LOG_BYTES) return;
    fs.renameSync(filePath, `${filePath}.old`);
  } catch { /* missing file or busy rename — nothing to rotate */ }
}

/**
 * Start teeing console output into `filePath`.
 * Safe to call repeatedly; a second call re-points at the new file
 * (used by workspace switch, which moves .awareness/ to another project).
 *
 * @param {string} filePath absolute path to daemon.log
 * @returns {boolean} whether the tee is active
 */
export function attachFileLogger(filePath) {
  detachFileLogger();

  let stream;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    rotateIfNeeded(filePath);
    stream = fs.createWriteStream(filePath, { flags: 'a' });
    // A failing stream must not take the process down with it.
    stream.on('error', () => { detachFileLogger(); });
  } catch {
    return false;
  }

  active = { stream, filePath };

  for (const m of METHODS) {
    console[m] = (...args) => {
      PRISTINE[m].apply(console, args);
      if (!active) return;
      try {
        active.stream.write(`${stamp()} [${m}] ${format(args)}\n`);
      } catch { /* logging must never break the caller */ }
    };
  }

  console.log(`[awareness-local] logging to ${filePath}`);
  return true;
}

/** Restore the pristine console methods and close the file. */
export function detachFileLogger() {
  if (!active) return;
  const { stream } = active;
  active = null;
  for (const m of METHODS) console[m] = PRISTINE[m];
  try { stream.end(); } catch { /* already closed */ }
}

/** Absolute path of the log currently being written, or null. */
export function currentLogFile() {
  return active ? active.filePath : null;
}
