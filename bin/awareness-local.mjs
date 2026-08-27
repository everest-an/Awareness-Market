#!/usr/bin/env node

/**
 * CLI entry point for Awareness Local daemon.
 *
 * Subcommands:
 *   start   [--project <dir>] [--port <port>] [--foreground]  — start daemon
 *   stop    [--project <dir>]                                 — stop daemon
 *   status  [--project <dir>]                                 — show daemon status + stats
 *   reindex [--project <dir>]                                 — rebuild FTS5 + embedding index
 *   benchmark --dataset <path> [--project <dir>]              — run local recall benchmark
 *
 * Uses process.argv parsing (no dependencies).
 * For `start` without `--foreground`, spawns self as a detached child process.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { assertSafeWorkspaceRoot } from '../src/core/workspace-root.mjs';

// ---------------------------------------------------------------------------
// Argv parsing
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments into { command, flags }.
 * Supports: --flag value, --flag=value, --boolean-flag
 * @param {string[]} argv — typically process.argv.slice(2)
 * @returns {{ command: string, flags: Record<string, string|boolean> }}
 */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        // --key=value
        const key = arg.slice(2, eqIdx);
        flags[key] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  return {
    command: positional[0] || 'start',
    flags,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AWARENESS_DIR = '.awareness';
const PID_FILENAME = 'daemon.pid';
const LOG_FILENAME = 'daemon.log';

/**
 * Resolve the project directory from flags or cwd.
 * @param {Record<string, string|boolean>} flags
 * @returns {string}
 */
function resolveProjectDir(flags) {
  const dir = typeof flags.project === 'string' ? flags.project : process.cwd();
  return path.resolve(dir);
}

/**
 * Resolve the daemon port from --port flag or default.
 * Single-daemon policy: every project uses 37800 unless user forces otherwise.
 * Workspace switching happens via POST /api/v1/workspace/switch, not new ports.
 * @param {Record<string, string|boolean>} flags
 * @returns {number}
 */
function resolvePort(flags, _projectDir) {
  if (typeof flags.port === 'string') {
    const p = parseInt(flags.port, 10);
    if (!isNaN(p) && p > 0 && p < 65536) return p;
  }
  return 37800;
}

/**
 * HTTP GET to localhost — returns response body as string or null on error.
 * @param {number} port
 * @param {string} urlPath
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<{ status: number, body: string }|null>}
 */
function httpGet(port, urlPath, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: '127.0.0.1', port, path: urlPath, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * HTTP POST JSON to localhost.
 * @param {number} port
 * @param {string} urlPath
 * @param {object} body
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<{ status: number, body: string }|null>}
 */
function httpPostJson(port, urlPath, body, timeoutMs = 3000) {
  const payload = Buffer.from(JSON.stringify(body || {}), 'utf-8');
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') });
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

/**
 * Probe a port to see if it already hosts an Awareness local daemon.
 * Returns healthz info on success, or null when the port is free or
 * occupied by something else.
 * @param {number} port
 * @returns {Promise<{ mode: string, pid: number, project_dir: string, version: string }|null>}
 */
async function probeAwarenessDaemon(port) {
  const resp = await httpGet(port, '/healthz', 1500);
  if (!resp || resp.status !== 200) return null;
  try {
    const info = JSON.parse(resp.body);
    if (info && info.mode === 'local' && info.pid) return info;
  } catch { /* not awareness */ }
  return null;
}

/**
 * Read PID from .awareness/daemon.pid.
 * @param {string} projectDir
 * @returns {number|null}
 */
function readPid(projectDir) {
  const pidPath = path.join(projectDir, AWARENESS_DIR, PID_FILENAME);
  try {
    const content = fs.readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Check if a process with the given PID exists.
 * @param {number} pid
 * @returns {boolean}
 */
function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Start the daemon.
 * Without --foreground: spawns a new detached process with --foreground flag.
 * With --foreground: imports and runs the daemon in-process.
 */
async function cmdStart(flags) {
  const projectDir = assertSafeWorkspaceRoot(resolveProjectDir(flags), 'daemon workspace');
  const port = resolvePort(flags, projectDir);
  const foreground = flags.foreground === true;

  // Ensure .awareness directory exists
  const awarenessDir = path.join(projectDir, AWARENESS_DIR);
  fs.mkdirSync(awarenessDir, { recursive: true });

  // Record workspace usage (memoryId/lastUsed/name). Port is no longer
  // allocated per-workspace — every workspace shares the default daemon port.
  //
  // Deliberately NOT called yet. This used to run before the probe below, and
  // saveWorkspaces() is a synchronous writeFileSync+rename — fully durable
  // before it returns. So every `start` that immediately exited (already
  // running, hot-switch, or a failed switch) had still permanently registered
  // the directory. That is how registries reached thousands of entries: one
  // throwaway `start` against a temp dir left a row forever. Register only on
  // the paths where the workspace genuinely becomes active.
  const recordWorkspace = async () => {
    try {
      const { registerWorkspace } = await import('../src/core/config.mjs');
      registerWorkspace(projectDir, { port });
    } catch { /* best-effort */ }
  };

  // Single-daemon policy: if an Awareness daemon already runs on this port,
  // switch its active workspace instead of spawning a duplicate on a new port.
  const existing = await probeAwarenessDaemon(port);
  if (existing) {
    const existingDir = existing.project_dir ? path.resolve(existing.project_dir) : '';
    if (existingDir === path.resolve(projectDir)) {
      // Already serving this project — it is genuinely active, so record it.
      await recordWorkspace();
      console.log(
        `Awareness Local daemon already running (PID ${existing.pid}, port ${port})`
      );
      // The "already running" branch used to end here. Users who ran `start`
      // expecting to be told where the UI is got a dead end instead.
      console.log(`  Dashboard:    http://localhost:${port}/`);
      process.exit(0);
    }
    // Different project on same port → hot-switch.
    const switchRes = await httpPostJson(port, '/api/v1/workspace/switch', {
      project_dir: projectDir,
    });
    if (switchRes && switchRes.status === 200) {
      // The switch succeeded, so this workspace is now the active one.
      await recordWorkspace();
      console.log(
        `Switched daemon workspace to ${projectDir} (PID ${existing.pid}, port ${port})`
      );
      process.exit(0);
    }
    // Switch failed — the daemon is serving someone else and we are exiting
    // with an error. Registering here would leave a row for a workspace that
    // never became active.
    console.error(
      `[awareness-local] Port ${port} is held by another process but workspace switch failed:\n` +
      `  ${switchRes ? `HTTP ${switchRes.status}: ${switchRes.body.slice(0, 200)}` : 'no response'}\n` +
      `  Stop the existing daemon or pass --port <other> to run a second instance.`
    );
    process.exit(1);
  }

  // No daemon on this port — we are about to become it, so this workspace is
  // genuinely active. Register before starting so the entry exists even if the
  // daemon later crashes (the registry is how the UI lists known projects).
  await recordWorkspace();

  if (foreground) {
    // Run in foreground — import daemon and start
    const { AwarenessLocalDaemon } = await import('../src/daemon.mjs');
    const daemon = new AwarenessLocalDaemon({ port, projectDir });
    let shuttingDown = false;

    // Handle termination signals
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log('\n[awareness-local] shutting down...');
      await daemon.stop();
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      process.exitCode = 0;
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await daemon.start();
  } else {
    // Background mode: spawn self with --foreground
    const thisFile = fileURLToPath(import.meta.url);
    const logPath = path.join(awarenessDir, LOG_FILENAME);

    // Startup dedup lock: prevent concurrent cmdStart calls from spawning multiple
    // daemon processes during the startup window (before the daemon has bound its port
    // and the probeAwarenessDaemon check can see it).
    // fs.openSync with 'wx' is atomic on POSIX — exactly one process wins.
    const lockPath = path.join(awarenessDir, 'daemon.starting');
    let lockAcquired = false;
    try {
      const lockFd = fs.openSync(lockPath, 'wx');
      fs.writeSync(lockFd, String(process.pid));
      fs.closeSync(lockFd);
      lockAcquired = true;
    } catch (e) {
      if (e.code === 'EEXIST') {
        // Another cmdStart already holds the lock — check if its spawner is still alive.
        let lockOwnerAlive = false;
        try {
          const lockContent = fs.readFileSync(lockPath, 'utf-8').trim();
          const lockPid = parseInt(lockContent, 10);
          if (!isNaN(lockPid)) {
            try { process.kill(lockPid, 0); lockOwnerAlive = true; } catch { /* gone */ }
          }
        } catch { /* unreadable lock — treat as stale */ }

        if (lockOwnerAlive) {
          // Another process is actively starting the daemon; wait for it rather than spawning.
          console.log('Starting Awareness Local daemon...');
          let waited = false;
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 500));
            const alive = await probeAwarenessDaemon(port);
            if (alive) {
              const newPid = readPid(projectDir);
              console.log(`Awareness Local daemon started (PID ${newPid || alive.pid}, port ${port})`);
              console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
              console.log(`  Dashboard:    http://localhost:${port}/`);
              console.log(`  Log file:     ${logPath}`);
              waited = true;
              break;
            }
            // If lock disappeared the spawner exited — do one final probe then give up waiting.
            if (!fs.existsSync(lockPath)) {
              const alive2 = await probeAwarenessDaemon(port);
              if (alive2) {
                const newPid = readPid(projectDir);
                console.log(`Awareness Local daemon started (PID ${newPid || alive2.pid}, port ${port})`);
                console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
                console.log(`  Dashboard:    http://localhost:${port}/`);
                console.log(`  Log file:     ${logPath}`);
                waited = true;
              }
              break;
            }
          }
          if (waited) process.exit(0);
          // Spawner held the lock but daemon never became healthy — fall through to retry.
        } else {
          // Stale lock (spawner process is gone) — remove it and proceed.
          try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
        }

        // Try to acquire the lock ourselves now.
        try {
          const lockFd = fs.openSync(lockPath, 'wx');
          fs.writeSync(lockFd, String(process.pid));
          fs.closeSync(lockFd);
          lockAcquired = true;
        } catch { /* still contested — proceed without lock */ }
      }
      // Other errors (permissions etc.): proceed without lock.
    }

    const logFd = fs.openSync(logPath, 'a');

    const child = spawn(
      process.execPath,
      [thisFile, 'start', '--foreground', '--project', projectDir, '--port', String(port)],
      {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        cwd: projectDir,
        // Without this Windows flashes a console window on every daemon start.
        // Output already goes to the log file, so nothing becomes less visible.
        windowsHide: true,
        env: { ...process.env },
      }
    );

    child.unref();
    fs.closeSync(logFd);

    // Wait for daemon to become healthy (up to 15 seconds)
    console.log('Starting Awareness Local daemon...');
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const resp = await httpGet(port, '/healthz');
      if (resp && resp.status === 200) {
        healthy = true;
        break;
      }
    }

    // Release startup lock regardless of outcome.
    if (lockAcquired) {
      try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
    }

    if (healthy) {
      const newPid = readPid(projectDir);
      console.log(`Awareness Local daemon started (PID ${newPid || child.pid}, port ${port})`);
      console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`  Dashboard:    http://localhost:${port}/`);
      console.log(`  Log file:     ${logPath}`);

      // Auto-open dashboard only on the very first daemon start across all projects.
      // Use a global flag in ~/.awareness so new workspaces don't keep re-opening the browser.
      const globalAwarenessDir = path.join(os.homedir(), '.awareness');
      const firstRunFlag = path.join(globalAwarenessDir, '.dashboard-opened');
      if (!fs.existsSync(firstRunFlag)) {
        try {
          fs.mkdirSync(globalAwarenessDir, { recursive: true });
          fs.writeFileSync(firstRunFlag, new Date().toISOString());
          const url = `http://localhost:${port}/`;
          const { exec } = await import('node:child_process');
          if (process.platform === 'darwin') exec(`open "${url}"`, { windowsHide: true });
          else if (process.platform === 'linux') exec(`xdg-open "${url}"`, { windowsHide: true });
          else if (process.platform === 'win32') exec(`start "" "${url}"`, { windowsHide: true });
        } catch { /* ignore open failures */ }
      }
    } else {
      console.error('Failed to start daemon. Check log file:');
      console.error(`  ${logPath}`);
      process.exit(1);
    }
  }
}

/**
 * Stop the daemon.
 */
async function cmdStop(flags) {
  const projectDir = resolveProjectDir(flags);
  const pid = readPid(projectDir);

  if (!pid) {
    console.log('Awareness Local daemon is not running (no PID file found)');
    process.exit(0);
  }

  if (!processExists(pid)) {
    // Stale PID file — clean up
    const pidPath = path.join(projectDir, AWARENESS_DIR, PID_FILENAME);
    try { fs.unlinkSync(pidPath); } catch { /* ignore */ }
    console.log('Awareness Local daemon is not running (stale PID file removed)');
    process.exit(0);
  }

  // Send SIGTERM
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    console.error(`Failed to stop daemon (PID ${pid}): ${err.message}`);
    process.exit(1);
  }

  // Wait for process to exit (up to 5 seconds)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (!processExists(pid)) break;
  }

  // Force kill if still alive
  if (processExists(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }

  // Clean PID file
  const pidPath = path.join(projectDir, AWARENESS_DIR, PID_FILENAME);
  try { fs.unlinkSync(pidPath); } catch { /* ignore */ }

  console.log(`Awareness Local daemon stopped (was PID ${pid})`);
}

/**
 * Show daemon status and stats.
 */
async function cmdStatus(flags) {
  const projectDir = resolveProjectDir(flags);
  const port = resolvePort(flags, projectDir);
  const pid = readPid(projectDir);

  if (!pid || !processExists(pid)) {
    console.log('Awareness Local: not running');
    if (pid) {
      // Clean stale PID file
      const pidPath = path.join(projectDir, AWARENESS_DIR, PID_FILENAME);
      try { fs.unlinkSync(pidPath); } catch { /* ignore */ }
    }
    // Exit non-zero: "not running" is not success. This used to exit 0, so any
    // script gating on `awareness-local status` — a health check, a CI step, a
    // wrapper that starts the daemon only if needed — read a dead daemon as a
    // healthy one and carried on.
    process.exit(1);
  }

  // Fetch health info
  const resp = await httpGet(port, '/healthz');
  if (!resp || resp.status !== 200) {
    console.log(`Awareness Local: PID ${pid} exists but HTTP not responding on port ${port}`);
    process.exit(1);
  }

  try {
    const data = JSON.parse(resp.body);
    const uptime = data.uptime || 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m ${uptime % 60}s`;

    console.log(`Awareness Local: running (PID ${pid}, port ${port})`);
    console.log(`  Uptime:          ${uptimeStr}`);
    console.log(`  Project:         ${data.project_dir || projectDir}`);

    // Surface a degraded index prominently. `status` used to print
    // "Memories: 0" for a completely dead index, which reads exactly like a
    // fresh workspace — the single most misleading line in this tool.
    const indexerBroken = data.indexer && data.indexer.ok === false;
    if (indexerBroken) {
      console.log('');
      console.log('  !! INDEX UNAVAILABLE — nothing is being indexed or recalled.');
      console.log(`     Reason: ${data.indexer.reason || 'unknown'}`);
      console.log('     The counts below are meaningless while this is broken.');
      console.log('');
    }

    if (data.stats) {
      const s = data.stats;
      console.log(`  Memories:        ${s.totalMemories || 0}${indexerBroken ? '  (index dead)' : ''}`);
      console.log(`  Knowledge Cards: ${s.totalKnowledge || 0}`);
      console.log(`  Open Tasks:      ${s.totalTasks || 0}`);
      console.log(`  Sessions:        ${s.totalSessions || 0}`);
    }

    // /healthz already reported these; status was discarding them.
    console.log(`  Search Mode:     ${data.search_mode || 'unknown'}`);
    console.log(`  Embeddings:      ${data.embedding?.available ? 'available' : 'unavailable (FTS only)'}`);
    console.log(`  Dashboard:       ${data.ui_url || `http://localhost:${port}/`}`);

    // Check cloud sync status
    const awarenessDir = path.join(projectDir, AWARENESS_DIR);
    const configPath = path.join(awarenessDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.cloud?.enabled) {
          console.log(`  Cloud Sync:      enabled (${config.cloud.api_base || 'awareness.market'})`);
        } else {
          console.log('  Cloud Sync:      not configured');
        }
      } catch {
        console.log('  Cloud Sync:      unknown');
      }
    } else {
      console.log('  Cloud Sync:      not configured');
    }
  } catch {
    console.log(`Awareness Local: running (PID ${pid})`);
    console.log(`  Raw response: ${resp.body}`);
  }
}

/**
 * Print the Web UI URL and open it in the default browser.
 *
 * The daemon has always served a dashboard on its HTTP port, but no idempotent
 * surface ever named it — `start` only mentions it on a *fresh* start, and the
 * first-run auto-open fires exactly once per machine. This command is the
 * always-available answer to "where is the UI?".
 */
async function cmdDashboard(flags) {
  const projectDir = resolveProjectDir(flags);
  const port = resolvePort(flags, projectDir);

  const health = await probeAwarenessDaemon(port);
  if (!health) {
    console.error(`Awareness Local daemon is not running on port ${port}.`);
    console.error('Start it first:');
    console.error('  awareness-local start');
    process.exit(1);
  }

  const url = health.ui_url || `http://localhost:${port}/`;
  console.log(`Awareness Local dashboard: ${url}`);
  if (health.indexer && health.indexer.ok === false) {
    console.log(`  !! index unavailable: ${health.indexer.reason || 'unknown'}`);
  }

  if (flags['no-open'] === true) return;

  try {
    const { exec } = await import('node:child_process');
    if (process.platform === 'darwin') exec(`open "${url}"`, { windowsHide: true });
    else if (process.platform === 'linux') exec(`xdg-open "${url}"`, { windowsHide: true });
    else if (process.platform === 'win32') exec(`start "" "${url}"`, { windowsHide: true });
    else console.log('  (open the URL manually — unsupported platform)');
  } catch {
    console.log('  (could not launch a browser — open the URL manually)');
  }
}

/**
 * Rebuild the FTS5 + embedding index.
 */
async function cmdReindex(flags) {
  const projectDir = resolveProjectDir(flags);
  const port = resolvePort(flags, projectDir);

  // Check if daemon is running — if so, it holds a lock on index.db
  const pid = readPid(projectDir);
  const daemonRunning = pid && processExists(pid);

  if (daemonRunning) {
    console.log('Daemon is running — stopping it first for safe reindex...');
    await cmdStop(flags);
    // Brief pause for SQLite lock release
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('Rebuilding index...');

  const awarenessDir = path.join(projectDir, AWARENESS_DIR);
  const dbPath = path.join(awarenessDir, 'index.db');

  // Remove existing database to force full rebuild
  for (const ext of ['', '-journal', '-wal', '-shm']) {
    const p = dbPath + ext;
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`  Removed: ${path.basename(p)}`);
    }
  }

  // Import and run indexer
  try {
    const { Indexer } = await import('../src/core/indexer.mjs');
    const { MemoryStore } = await import('../src/core/memory-store.mjs');

    const store = new MemoryStore(projectDir);
    const indexer = new Indexer(dbPath);

    const result = await indexer.incrementalIndex(store);
    console.log(`Reindex complete: ${result.indexed} files indexed, ${result.skipped} skipped`);

    indexer.close();
  } catch (err) {
    console.error(`Reindex failed: ${err.message}`);
    process.exit(1);
  }

  // Restart daemon if it was running
  if (daemonRunning) {
    console.log('Restarting daemon...');
    await cmdStart({ ...flags, foreground: undefined });
  }
}

/**
 * Run as a stdio MCP server (for IDE integrations like Claude Code).
 */
async function cmdMcp(flags) {
  const projectDir = assertSafeWorkspaceRoot(resolveProjectDir(flags), 'stdio workspace');
  const port = resolvePort(flags);

  const { startStdioMcp } = await import('../src/mcp-stdio.mjs');
  await startStdioMcp({ port, projectDir });
}

async function cmdBenchmark(flags) {
  const projectDir = resolveProjectDir(flags);
  const datasetPath = typeof flags.dataset === 'string' ? path.resolve(flags.dataset) : null;
  if (!datasetPath || !fs.existsSync(datasetPath)) {
    console.error('Benchmark requires --dataset <jsonl-path>');
    process.exit(1);
  }

  const backendKind = typeof flags.backend === 'string' ? flags.backend : 'builtin';
  const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 5;
  const reportPath = typeof flags.report === 'string' ? path.resolve(flags.report) : null;
  const markdownReportPath = typeof flags['markdown-report'] === 'string'
    ? path.resolve(flags['markdown-report'])
    : (reportPath ? reportPath.replace(/\.json$/i, '.md') : null);

  const { runBenchmarkSuite } = await import('../src/benchmark/benchmark-runner.mjs');
  const { createProjectSearchBenchmarkSystems } = await import('../src/benchmark/systems.mjs');

  const systems = await createProjectSearchBenchmarkSystems({
    projectDir,
    backendKind,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 5,
    reindex: flags.reindex === true,
    qmd: {
      dbPath: process.env.AWARENESS_QMD_DB_PATH,
    },
  });

  const reports = await runBenchmarkSuite({
    systems,
    datasetPath,
    reportPath,
    markdownReportPath,
  });

  if (flags.json === true) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }

  for (const report of reports) {
    console.log(`Benchmark system: ${report.system}`);
    if (report.skipped) {
      console.log(`  Status:            skipped`);
      if (report.status?.reason) {
        console.log(`  Reason:            ${report.status.reason}`);
      }
      continue;
    }
    console.log(`  Total cases:       ${report.summary.totalCases}`);
    console.log(`  Recall@3:          ${report.summary.recallAt3.toFixed(3)}`);
    console.log(`  Recall@5:          ${report.summary.recallAt5.toFixed(3)}`);
    console.log(`  MRR:               ${report.summary.mrr.toFixed(3)}`);
    console.log(`  nDCG@5:            ${report.summary.ndcgAt5.toFixed(3)}`);
    console.log(`  Avg injected toks: ${report.summary.injectedTokensAvg.toFixed(1)}`);
    console.log(`  Answer hit rate:   ${report.summary.answerHitRate.toFixed(3)}`);
  }

  if (reportPath) {
    console.log(`Report written to ${reportPath}`);
  }
  if (markdownReportPath) {
    console.log(`Markdown report written to ${markdownReportPath}`);
  }
}

// ---------------------------------------------------------------------------
// F-088 · anchor — ERC-8350 memory anchoring (status | flush)
// The private key exists only inside this process for the duration of one flush:
// prompted with hidden input, never written to disk, never sent to the daemon.
// ---------------------------------------------------------------------------

async function cmdAnchor(flags) {
  const sub = process.argv.slice(3).find((a) => !a.startsWith('-')) || 'status';
  const projectDir = flags.dir ? String(flags.dir) : process.cwd();
  const {loadLocalConfig} = await import('../src/core/config.mjs');
  const port = flags.port || loadLocalConfig(projectDir)?.daemon?.port || 37800;
  const base = `http://127.0.0.1:${port}/api/v1`;

  const status = await (await fetch(`${base}/anchor/status`)).json();
  if (!status.enabled) {
    console.log('Anchoring is disabled.');
    console.log('Enable it in .awareness/config.json → anchoring.enabled = true');
    console.log('and set anchoring.controller_address, then restart the daemon.');
    return;
  }

  if (sub === 'status') {
    console.log(`Space:        ${status.spaceId || '(created on first build)'}`);
    console.log(`Controller:   ${status.controller || '(not configured)'}`);
    console.log(`Chain:        ${status.chainId} · registry ${status.registry}`);
    console.log(`Local head:   seq ${status.lastBuilt.seq}${status.lastBuilt.root ? ` · root ${status.lastBuilt.root.slice(0, 18)}…` : ''}`);
    console.log(`Anchored:     ${status.anchored.count} transition(s)`);
    console.log(`Pending:      ${status.pending.length}`);
    for (const p of status.pending) {
      console.log(`  seq ${p.seq} · ${p.opsCount} ops · ${p.transitionId.slice(0, 18)}… · ${p.createdAt}`);
    }
    if (status.pending.length) {
      const gas = status.pending.length * status.estGasPerCommit;
      console.log(`Est. gas:     ~${gas.toLocaleString()} (+110k once for Space registration)`);
      console.log(`Run 'awareness-local anchor flush' to broadcast.`);
    }
    return;
  }

  if (sub !== 'flush') {
    console.error(`Unknown anchor subcommand: ${sub} (expected 'status' or 'flush')`);
    process.exit(1);
  }

  if (!status.pending.length) { console.log('Nothing to anchor.'); return; }
  if (!status.controller) { console.error('anchoring.controller_address is not configured.'); process.exit(1); }

  const key = await promptHidden(
    `Anchoring ${status.pending.length} transition(s) to chain ${status.chainId}.\n` +
    `Paste the private key for ${status.controller} (input hidden): `
  );
  const privKeyHex = key.startsWith('0x') ? key : `0x${key}`;

  const {flushOutbox} = await import('../src/daemon/anchoring/flush.mjs');
  const {pending} = await (await fetch(`${base}/anchor/outbox`)).json();
  try {
    const results = await flushOutbox({
      rpcUrl: status.rpcUrl, chainId: status.chainId, registry: status.registry,
      privKeyHex, controller: status.controller,
      spaceId: status.spaceId, spaceSalt: status.spaceSalt,
      rows: pending,
      onConfirm: async (seq, txHash) => {
        await fetch(`${base}/anchor/confirm`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({seq, tx_hash: txHash}),
        });
      },
      log: (m) => console.log(`  ${m}`),
    });
    const sent = results.filter((r) => !r.skipped).length;
    console.log(`Done: ${sent} anchored, ${results.length - sent} reconciled.`);
  } catch (err) {
    console.error(`Flush failed (outbox is intact, re-run to resume): ${err.message}`);
    process.exit(1);
  }
}

/** Hidden-input prompt: echoes '*' per keypress, never the characters. */
function promptHidden(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value.trim());
      } else if (ch === '') { // Ctrl-C
        process.stdout.write('\n');
        process.exit(130);
      } else if (ch === '' || ch === '') { // backspace
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// Command: deals — read/publish on the public Open Deal Board (cloud REST).
// Anonymous by default: no API key needed; publish goes through the guest quota
// (per-IP daily limit + global circuit breaker, enforced server-side).
// ---------------------------------------------------------------------------

const DEFAULT_DEALS_BASE = 'https://awareness.market/api/v1';

function dealsBase(flags) {
  const raw = typeof flags['base-url'] === 'string'
    ? flags['base-url']
    : process.env.AWARENESS_BASE_URL || DEFAULT_DEALS_BASE;
  return raw.replace(/\/+$/, '');
}

function dealsWebBase(baseUrl) {
  // Derive the human-facing site origin from the API base (strip /api/v1).
  return baseUrl.replace(/\/api\/v1\/?$/, '');
}

async function cmdDeals(flags) {
  const sub = process.argv.slice(3).find((a) => !a.startsWith('-')) || 'list';
  const baseUrl = dealsBase(flags);
  const webBase = dealsWebBase(baseUrl);

  if (sub === 'list') {
    const params = new URLSearchParams();
    if (flags.q) params.set('q', String(flags.q));
    if (flags.direction) params.set('direction', String(flags.direction));
    if (flags.category) params.set('category', String(flags.category));
    if (flags.region) params.set('region', String(flags.region));
    const limit = flags.limit ? Math.max(1, Math.min(parseInt(flags.limit, 10) || 20, 50)) : 20;
    params.set('limit', String(limit));

    const res = await fetch(`${baseUrl}/public/deals?${params}`);
    if (!res.ok) {
      console.error(`Error: GET /public/deals failed (${res.status})`);
      process.exit(1);
    }
    const data = await res.json();
    const deals = Array.isArray(data?.deals) ? data.deals : [];

    if (flags.json === true) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const total = data?.total ?? deals.length;
    console.log(`Open Deal Board — ${total} listing(s)`);
    if (deals.length === 0) {
      console.log('No listings match. Publish one with: awareness-local deals publish');
      return;
    }
    console.log('');
    for (const d of deals) {
      const dir = d.direction === 'supply' ? 'SUPPLY ' : 'DEMAND ';
      const meta = [d.category, d.region].filter(Boolean).join(' · ');
      console.log(`[${dir}] ${d.title}${meta ? ` (${meta})` : ''}`);
      if (d.body) {
        const body = String(d.body);
        console.log(`    ${body.slice(0, 160)}${body.length > 160 ? '…' : ''}`);
      }
      console.log(`    ${webBase}/deals/${d.id}`);
      console.log('');
    }
    return;
  }

  if (sub === 'publish') {
    const missing = ['direction', 'category', 'title', 'body'].filter((k) => !flags[k]);
    if (missing.length > 0) {
      console.error(`Error: --${missing.join(' --')} required for publish`);
      console.error('Example: awareness-local deals publish --direction supply --category compute --title "H100 available" --body "40x H100 SXM, Shenzhen, sealed." [--region CN-SZ] [--contact-visibility public|on_request|private]');
      process.exit(1);
    }
    const payload = {
      direction: String(flags.direction),
      category: String(flags.category),
      title: String(flags.title),
      body: String(flags.body),
    };
    if (flags.region) payload.region = String(flags.region);
    if (flags['contact-visibility']) payload.contact_visibility = String(flags['contact-visibility']);

    const res = await fetch(`${baseUrl}/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Error: POST /deals failed (${res.status}) ${text.slice(0, 300)}`);
      process.exit(1);
    }
    const deal = await res.json();
    console.log('Published (anonymous) ✓');
    console.log(`  id:    ${deal.id}`);
    console.log(`  title: ${deal.title}`);
    console.log(`  url:   ${webBase}/deals/${deal.id}`);
    return;
  }

  console.error(`Unknown deals subcommand: ${sub} (use 'list' | 'publish')`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Awareness Local — AI agent memory daemon

Usage:
  awareness-local <command> [options]

Commands:
  start     Start the daemon (default)
  stop      Stop the daemon
  status    Show daemon status and stats
  dashboard Print the Web UI URL and open it in your browser
  reindex   Rebuild the search index
  mcp       Run as stdio MCP server
  anchor    ERC-8350 memory anchoring: 'anchor status' | 'anchor flush' (F-088)
  benchmark Run recall benchmark against a JSONL dataset
  deals     Open Deal Board: 'deals list' | 'deals publish' (anonymous, no API key)

Options:
  --project <dir>      Project directory (default: current directory)
  --port <port>        HTTP port (default: 37800)
  --foreground         Run in foreground (don't detach)
  --no-open            Dashboard: print the URL without launching a browser
  --dataset <path>     Benchmark JSONL dataset path
  --backend <kind>     builtin | qmd | hybrid | all (benchmark only)
  --report <path>      Write benchmark JSON report
  --markdown-report <path>  Write benchmark Markdown report
  --reindex            Rebuild the benchmark target index before running
  --json               Print benchmark report as JSON
  --base-url <url>     Deals API base (default https://awareness.market/api/v1)
  --q <text>           Deals free-text search
  --direction <d>      Deals filter: supply | demand
  --category <c>       Deals filter: compute | colocation | logistics
  --region <r>         Deals filter: region code (SG, HK, CN-SZ...)
  --limit <n>          Deals result limit (1-50, default 20)
  --title <text>       Deals publish: listing title
  --body <text>        Deals publish: listing body
  --contact-visibility Deals publish: public | on_request | private
  --help               Show this help message

Examples:
  npx @awareness.market/local start
  npx @awareness.market/local status
  npx @awareness.market/local dashboard
  npx @awareness.market/local stop
  npx @awareness.market/local reindex --project /path/to/project
  npx @awareness.market/local mcp --project /path/to/project --port 37800
  npx @awareness.market/local benchmark --project /path/to/project --dataset tests/memory-benchmark/datasets/recall_core.jsonl
  npx @awareness.market/local benchmark --project tests/memory-benchmark/projects/core-recall --dataset tests/memory-benchmark/datasets/recall_core.jsonl --backend builtin --reindex
  npx @awareness.market/local benchmark --project tests/memory-benchmark/projects/universal-core --dataset tests/memory-benchmark/datasets/universal_core.jsonl --backend all --reindex --report tests/memory-benchmark/reports/universal_core.json
  npx @awareness.market/local deals list --q H100 --direction supply
  npx @awareness.market/local deals publish --direction supply --category compute --title "H100 available" --body "40x H100 SXM, Shenzhen"
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || command === 'help') {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'start':
      await cmdStart(flags);
      break;
    case 'stop':
      await cmdStop(flags);
      break;
    case 'status':
      await cmdStatus(flags);
      break;
    case 'dashboard':
      await cmdDashboard(flags);
      break;
    case 'reindex':
      await cmdReindex(flags);
      break;
    case 'mcp':
      await cmdMcp(flags);
      break;
    case 'benchmark':
      await cmdBenchmark(flags);
      break;
    case 'deals':
      await cmdDeals(flags);
      break;
    case 'anchor':
      await cmdAnchor(flags);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
