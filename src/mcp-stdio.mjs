/**
 * mcp-stdio.mjs — Lightweight stdio MCP proxy for Awareness Local.
 *
 * Registers the same 5 tools as the HTTP daemon (awareness_init,
 * awareness_recall, awareness_record, awareness_lookup,
 * awareness_get_agent_prompt) but proxies every call to the local daemon
 * via HTTP JSON-RPC at http://localhost:{port}/mcp.
 *
 * If the daemon is not running it is auto-started before the first call.
 *
 * stdout is reserved for the stdio MCP protocol — all logging goes to stderr.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { assertSafeWorkspaceRoot } from './core/workspace-root.mjs';
import {
  describeKnowledgeCardCategories,
  mcpError,
  LOOKUP_TYPE_VALUES,
  RECORD_ACTION_VALUES,
  RECALL_DETAIL_VALUES,
  RECALL_MODE_VALUES,
  RECALL_SCOPE_VALUES,
} from './daemon/mcp-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Force UTF-8 on Windows so Chinese/CJK text in MCP stdio is not corrupted.
//
// NEVER call process.stdin.setEncoding() here. The MCP SDK's ReadBuffer frames
// the protocol on raw Buffers: readMessage() calls `this._buffer.subarray(...)`,
// which a String does not have. setEncoding('utf8') makes stdin emit Strings,
// so readMessage() throws TypeError — and the SDK's processReadBuffer() swallows
// it inside `while (true)` without advancing the buffer. Result: a synchronous
// infinite loop that pegs a core at 100%, freezes the event loop, and starves
// every shutdown path below (stdin end/close, SIGTERM, parentWatch). Windows MCP
// was silently dead for 5 months this way (da857de5, 2026-03-27).
//
// stdin needs no encoding anyway: the SDK decodes each frame as UTF-8 itself,
// so CJK is safe. Only the outbound streams are set here.
if (process.platform === 'win32') {
  try { process.stdout.setEncoding('utf8'); } catch { /* best-effort */ }
  try { process.stderr.setEncoding('utf8'); } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Logging — always to stderr so stdout stays clean for stdio protocol
// ---------------------------------------------------------------------------

function log(...args) {
  process.stderr.write(`[awareness-stdio] ${args.join(' ')}\n`);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Simple HTTP POST that returns parsed JSON.
 * Uses only node:http to avoid external dependencies.
 */
// Tool calls can legitimately run long (embedding, LLM classify), so this is a
// generous ceiling rather than a latency budget. It exists because a daemon that
// accepts the TCP connection but never answers — event-loop stall, SQLite lock
// contention, a wedged embedder — would otherwise hang the proxy forever: no
// error, no retry, and an MCP client left waiting on a call that never returns.
// checkHealth/getHealthInfo already guard themselves this way (2s).
const DAEMON_POST_TIMEOUT_MS = 120_000;

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(new Error(`Failed to parse daemon response: ${e.message}`));
          }
        });
      },
    );
    req.setTimeout(DAEMON_POST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(
        `Daemon did not respond within ${DAEMON_POST_TIMEOUT_MS / 1000}s (${u.pathname}). `
        + 'It may be stalled mid-switch or blocked on the index; the call was aborted.',
      ));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Quick health check — resolves true if daemon responds, false otherwise.
 */
function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
      // Any response means daemon is up
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function getHealthInfo(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/healthz`, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Daemon lifecycle
// ---------------------------------------------------------------------------

/**
 * Ensure the daemon is running. If not, spawn it and poll /healthz for up
 * to 15 seconds.
 */
export function buildDaemonStartArgs(projectDir) {
  const safeProjectDir = assertSafeWorkspaceRoot(projectDir || process.cwd(), 'stdio workspace');
  const binPath = join(__dirname, '..', 'bin', 'awareness-local.mjs');
  return {
    binPath,
    args: [binPath, 'start', '--project', safeProjectDir],
  };
}

export async function ensureDaemon(port, projectDir) {
  const safeProjectDir = assertSafeWorkspaceRoot(projectDir || process.cwd(), 'stdio workspace');
  const health = await getHealthInfo(port);
  if (health?.mode === 'local') {
    const runningProject = health.project_dir || health.projectDir;
    if (!runningProject || assertSafeWorkspaceRoot(runningProject, 'daemon workspace') === safeProjectDir) {
      return;
    }

    log(`Daemon running for different workspace — switching to ${safeProjectDir}`);
    const switchResponse = await httpPost(`http://127.0.0.1:${port}/api/v1/workspace/switch`, {
      project_dir: safeProjectDir,
    });
    if (switchResponse?.status === 'ok') {
      return;
    }
    if (switchResponse?.error === 'project_switching') {
      await wait(250);
      return ensureDaemon(port, safeProjectDir);
    }
    throw new Error(`Failed to switch daemon workspace to ${safeProjectDir}`);
  }

  // Startup dedup lock: only one process may spawn the daemon at a time.
  // This prevents concurrent ensureDaemon() calls from spawning multiple instances.
  const awarenessDir = join(safeProjectDir, '.awareness');
  fs.mkdirSync(awarenessDir, { recursive: true });
  const lockPath = join(awarenessDir, 'mcp-starting.lock');

  let lockAcquired = false;
  try {
    const lockFd = fs.openSync(lockPath, 'wx');
    fs.writeSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
    lockAcquired = true;
  } catch (e) {
    if (e.code === 'EEXIST') {
      // Someone holds the lock — but they may be dead. Without this check a
      // proxy killed between openSync and the finally-release leaves the file
      // behind forever, and every later ensureDaemon() takes the "another
      // process is starting" branch, waits the full 15s, then throws
      // "Daemon did not become healthy". Manually killing stale proxies (the
      // documented cleanup for the orphan-process bug) is exactly how that
      // happens. bin/awareness-local.mjs already does this for daemon.starting;
      // this lock was the asymmetric one.
      let ownerAlive = false;
      let ownerPid = null;
      try {
        ownerPid = parseInt(fs.readFileSync(lockPath, 'utf-8').trim(), 10);
        if (Number.isInteger(ownerPid) && ownerPid > 0) {
          process.kill(ownerPid, 0);   // throws if the process is gone
          ownerAlive = true;
        }
      } catch { /* unreadable, malformed, or dead owner → treat as stale */ }

      if (!ownerAlive) {
        log(`Removing stale startup lock (owner pid ${ownerPid ?? 'unknown'} is gone)`);
        try {
          fs.unlinkSync(lockPath);
          const lockFd = fs.openSync(lockPath, 'wx');
          fs.writeSync(lockFd, String(process.pid));
          fs.closeSync(lockFd);
          lockAcquired = true;
        } catch { /* lost the race to another proxy — fine, it will spawn */ }
      }
    } else {
      // Unexpected error — fall through to spawn anyway
      log(`Warning: Failed to acquire startup lock: ${e.message}`);
    }
  }

  try {
    if (lockAcquired) {
      // We hold the lock — proceed to spawn the daemon
      log('Daemon not reachable — starting...');
      const { args } = buildDaemonStartArgs(safeProjectDir);
      const child = spawn(process.execPath, args, {
        stdio: 'ignore',
        detached: true,
        // Otherwise Windows flashes a console window when the daemon starts.
        windowsHide: true,
        env: { ...process.env, PORT: String(port) },
      });
      // stdio:'ignore' discards everything the child says, so without these
      // listeners a failed spawn or an instant crash was completely invisible:
      // the caller just waited out the 15s health poll and reported "Daemon did
      // not become healthy", never why. These fire in this process, so they
      // survive the stdio black hole.
      child.on('error', (err) => {
        log(`Failed to spawn daemon: ${err.message} (tried: ${process.execPath} ${args.join(' ')})`);
      });
      child.on('exit', (code, signal) => {
        // A detached daemon that exits promptly has crashed; a healthy one keeps
        // running and never reaches here while we are still waiting.
        if (code !== 0 && code !== null) {
          log(`Daemon exited immediately with code ${code}${signal ? ` (signal ${signal})` : ''} — check .awareness/daemon.log`);
        }
      });
      child.unref();
    } else {
      // Another process is starting — just wait for it to become healthy
      log('Another process is starting the daemon — waiting...');
    }

    // Poll healthz for up to 15 seconds
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkHealth(port)) {
        log('Daemon is ready.');
        return;
      }
    }
    throw new Error(
      `Daemon did not become healthy within 15s (port ${port}). ` +
      `Try running "npx awareness-local start" manually.`,
    );
  } finally {
    // Release lock if we acquired it
    if (lockAcquired) {
      try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC proxy
// ---------------------------------------------------------------------------

let _daemonChecked = false;

/**
 * Proxy a tool call to the daemon via JSON-RPC over HTTP.
 *
 * @param {number} port
 * @param {string} toolName  — MCP tool name (e.g. "awareness_init")
 * @param {object} args      — tool arguments
 * @returns {object} raw MCP result envelope from daemon
 */
async function proxyCall(port, toolName, args, projectDir) {
  const safeProjectDir = assertSafeWorkspaceRoot(projectDir || process.cwd(), 'stdio workspace');
  const requestHeaders = {
    'X-Awareness-Project-Dir': safeProjectDir,
    'X-Awareness-Project-Dir-B64': Buffer.from(safeProjectDir, 'utf8').toString('base64'),
  };

  // Lazy daemon startup — only check once per process
  if (!_daemonChecked) {
    await ensureDaemon(port, safeProjectDir);
    _daemonChecked = true;
  }

  const rpcBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };

  let response;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      response = await httpPost(`http://127.0.0.1:${port}/mcp`, rpcBody, requestHeaders);
    } catch (err) {
      // Daemon may have died — re-align and retry.
      log(`Proxy error, retrying after daemon restart: ${err.message}`);
      _daemonChecked = false;
      await ensureDaemon(port, safeProjectDir);
      _daemonChecked = true;
      continue;
    }

    if (response?.error === 'project_mismatch') {
      log(`Daemon workspace drift detected — re-aligning to ${safeProjectDir}`);
      _daemonChecked = false;
      await ensureDaemon(port, safeProjectDir);
      _daemonChecked = true;
      continue;
    }

    if (response?.error === 'project_switching') {
      _daemonChecked = false;
      await wait(Math.min(250 * (attempt + 1), 1000));
      await ensureDaemon(port, safeProjectDir);
      _daemonChecked = true;
      continue;
    }

    break;
  }

  if (!response) {
    throw new Error(`Daemon RPC failed after repeated retries for ${toolName}`);
  }

  // JSON-RPC error
  if (response.error) {
    throw new Error(
      `Daemon RPC error ${response.error.code}: ${response.error.message}`,
    );
  }

  return response.result;
}

// ---------------------------------------------------------------------------
// Tool registration helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Register tools — schemas match mcp-server.mjs exactly
// ---------------------------------------------------------------------------

function registerTools(server, port, projectDir) {
  // ======================== awareness_init ==================================

  server.tool(
    'awareness_init',
    {
      memory_id: z.string().optional().describe(
        'Memory identifier (ignored in local mode, uses project dir)',
      ),
      source: z.string().optional().describe('Client source identifier'),
      query: z.string().optional().describe('Current user request or task focus for context shaping'),
      days: z.number().optional().default(7).describe(
        'Days of history to load',
      ),
      max_cards: z.number().optional().default(5),
      max_tasks: z.number().optional().default(5),
    },
    async (params) => {
      try {
        return await proxyCall(port, 'awareness_init', params, projectDir);
      } catch (err) {
        return mcpError(`awareness_init failed: ${err.message}`);
      }
    },
  );

  // ======================== awareness_recall ================================

  server.tool(
    'awareness_recall',
    {
      semantic_query: z.string().optional().default('').describe(
        'Natural language search query (required for search)',
      ),
      keyword_query: z.string().optional().default('').describe(
        'Exact keyword match for BM25 full-text search',
      ),
      scope: z.enum(RECALL_SCOPE_VALUES)
        .optional().default('all')
        .describe('Search scope'),
      recall_mode: z.enum(RECALL_MODE_VALUES)
        .optional().default('hybrid')
        .describe('Search mode (hybrid recommended)'),
      limit: z.number().min(1).max(30).optional().default(10)
        .describe('Max results'),
      detail: z.enum(RECALL_DETAIL_VALUES).optional().default('summary')
        .describe(
          'summary = lightweight index (~50-100 tokens each); ' +
          'full = complete content for specified ids',
        ),
      ids: z.array(z.string()).optional().describe(
        'Item IDs to expand when detail=full (from a prior detail=summary call)',
      ),
      agent_role: z.string().optional().default('').describe('Agent role filter'),
      multi_level: z.boolean().optional().describe(
        'Enable broader context retrieval across sessions and time ranges',
      ),
      cluster_expand: z.boolean().optional().describe(
        'Enable topic-based context expansion for deeper exploration',
      ),
      include_installed: z.boolean().optional().default(true).describe(
        'Also search installed market memories',
      ),
      source_exclude: z.array(z.string()).optional().describe(
        'Exclude memories from these source identifiers (e.g. ["mcp"] to hide Claude Code dev memories)',
      ),
    },
    async (params) => {
      try {
        return await proxyCall(port, 'awareness_recall', params, projectDir);
      } catch (err) {
        return mcpError(`awareness_recall failed: ${err.message}`);
      }
    },
  );

  // ======================== awareness_record ================================

  server.tool(
    'awareness_record',
    {
      action: z.enum(RECORD_ACTION_VALUES).describe('Record action type'),
      content: z.string().optional().describe('Memory content (markdown)'),
      title: z.string().optional().describe('Memory title'),
      items: z.array(z.object({
        content: z.string(),
        title: z.string().optional(),
        event_type: z.string().optional(),
        tags: z.array(z.string()).optional(),
        insights: z.any().optional(),
      })).optional().describe('Batch items for remember_batch'),
      insights: z.object({
        knowledge_cards: z.array(z.object({
          title: z.string().describe('Short descriptive title'),
          summary: z.string().optional().describe('Detailed summary (also accepted as "content")'),
          content: z.string().optional().describe('Alias for summary'),
          category: z.string().optional().describe(
            describeKnowledgeCardCategories()
          ),
          tags: z.array(z.string()).optional(),
          confidence: z.number().optional(),
        })).optional(),
        action_items: z.array(z.any()).optional(),
        risks: z.array(z.any()).optional(),
      }).optional().describe('Pre-extracted knowledge cards, tasks, risks'),
      session_id: z.string().optional(),
      agent_role: z.string().optional(),
      event_type: z.string().optional(),
      tags: z.array(z.string()).optional(),
      // Task update fields
      task_id: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional().describe('Client source identifier (e.g. desktop, openclaw-plugin, mcp)'),
    },
    async (params) => {
      try {
        return await proxyCall(port, 'awareness_record', params, projectDir);
      } catch (err) {
        return mcpError(`awareness_record failed: ${err.message}`);
      }
    },
  );

  // ======================== awareness_lookup ================================

  server.tool(
    'awareness_lookup',
    {
      type: z.enum(LOOKUP_TYPE_VALUES).describe(
        'Data type to look up. ' +
        'context = full dump, tasks = open tasks, knowledge = cards, ' +
        'risks = risk items, session_history = past sessions, timeline = events, ' +
        'perception = signals (contradictions, patterns, staleness), ' +
        'skills = learned reusable procedures',
      ),
      limit: z.number().optional().default(10).describe('Max items'),
      status: z.string().optional().describe('Status filter'),
      category: z.string().optional().describe('Category filter (knowledge cards)'),
      priority: z.string().optional().describe('Priority filter (tasks/risks)'),
      session_id: z.string().optional().describe('Session ID (for session_history)'),
      agent_role: z.string().optional().describe('Agent role filter'),
      query: z.string().optional().describe('Keyword filter'),
    },
    async (params) => {
      try {
        return await proxyCall(port, 'awareness_lookup', params, projectDir);
      } catch (err) {
        return mcpError(`awareness_lookup failed: ${err.message}`);
      }
    },
  );

  // ======================== awareness_get_agent_prompt ======================

  server.tool(
    'awareness_get_agent_prompt',
    {
      role: z.string().optional().describe('Agent role to get prompt for'),
    },
    async (params) => {
      try {
        return await proxyCall(port, 'awareness_get_agent_prompt', params, projectDir);
      } catch (err) {
        return mcpError(`awareness_get_agent_prompt failed: ${err.message}`);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the stdio MCP proxy server.
 *
 * @param {object} opts
 * @param {number} [opts.port=37800] — daemon HTTP port to proxy to
 * @param {string} [opts.projectDir] — project directory (unused in proxy,
 *   but accepted for API symmetry with direct-mode startup)
 */
export async function startStdioMcp({ port = 37800, projectDir } = {}) {
  const safeProjectDir = assertSafeWorkspaceRoot(projectDir || process.cwd(), 'stdio workspace');
  log(`Starting stdio MCP proxy (daemon port=${port})`);

  const server = new McpServer({
    name: 'awareness-local-stdio',
    version: '1.0.0',
  });

  registerTools(server, port, safeProjectDir);

  const transport = new StdioServerTransport();

  // --- Lifecycle guard: never outlive the client (F-085 · anti-zombie) --------
  // A stdio MCP server's stdin IS its lifeline. When the MCP client (Claude Code,
  // Cursor, …) disconnects, stdin hits EOF and/or the transport closes. On
  // Windows a `cmd /c npx …` shim orphans this node process and breaks SIGTERM
  // propagation, so WITHOUT an explicit exit the proxy runs forever — every
  // closed session leaves a CPU-burning zombie that accumulates over days.
  // Exit on every disconnect signal we can observe.
  let exiting = false;
  let parentWatch = null;
  const shutdown = (reason) => {
    if (exiting) return;
    exiting = true;
    if (parentWatch) { try { clearInterval(parentWatch); } catch { /* noop */ } }
    log(`stdio MCP shutting down (${reason})`);
    Promise.resolve(server.close?.()).catch(() => {}).finally(() => process.exit(0));
    // Hard backstop if close() hangs.
    setTimeout(() => process.exit(0), 1000).unref();
  };

  transport.onclose = () => shutdown('transport closed');
  process.stdin.on('end', () => shutdown('stdin end'));
  process.stdin.on('close', () => shutdown('stdin close'));
  process.stdin.on('error', () => shutdown('stdin error'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Backstop for the case where stdin never EOFs.
  //
  // The parent-PID poll below only works where our parent IS the client. On
  // Windows it never is: npm installs a `cmd /c` shim, so process.ppid is that
  // cmd.exe — and cmd.exe waits on *us*, meaning it can never die first. The
  // process that actually goes away is the grandparent (claude.exe), which
  // process.ppid cannot see. So on Windows this guard has always been a no-op,
  // despite the comment that used to claim it was the Windows safety net.
  //
  // Rather than walk the ancestor chain (a spawn per poll, and the chain shape
  // differs per client), fall back to inactivity: a stdio server with no client
  // receives nothing on stdin, ever. Every inbound byte refreshes the clock, so
  // an idle-but-attached session is only reaped after a very long silence —
  // long enough that a real session would have to be abandoned to hit it.
  const IDLE_EXIT_MS = 4 * 60 * 60 * 1000; // 4h
  let lastActivityAt = Date.now();
  process.stdin.on('data', () => { lastActivityAt = Date.now(); });

  const parentPid = process.ppid;
  parentWatch = setInterval(() => {
    // POSIX: the parent really is the client, so its death is our signal.
    if (parentPid && parentPid > 1) {
      try {
        process.kill(parentPid, 0);
      } catch {
        shutdown('parent process gone');
        return;
      }
    }
    if (Date.now() - lastActivityAt > IDLE_EXIT_MS) {
      shutdown(`no client activity for ${Math.round(IDLE_EXIT_MS / 3600000)}h`);
    }
  }, 30_000);
  parentWatch.unref();

  await server.connect(transport);

  log('stdio MCP proxy connected and ready.');
  return server;
}

// ---------------------------------------------------------------------------
// CLI entry — run directly with `node src/mcp-stdio.mjs`
// ---------------------------------------------------------------------------

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = parseInt(process.env.AWARENESS_PORT || process.env.PORT || '37800', 10);
  startStdioMcp({ port, projectDir: process.cwd() }).catch((err) => {
    process.stderr.write(`[awareness-stdio] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
