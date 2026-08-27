/**
 * L4 E2E: MCP stdio handshake — real CLI subprocess, real JSON-RPC, zero mock.
 *
 * Regression guard for the Windows-only outage introduced by da857de5
 * (2026-03-27) and shipped silently for 5 months through v0.12.2.
 *
 * Root cause: `process.stdin.setEncoding('utf8')` under a `win32` guard made
 * stdin emit Strings instead of Buffers. The MCP SDK's ReadBuffer frames the
 * protocol on Buffers — `readMessage()` calls `this._buffer.subarray(...)`,
 * which a String lacks, so it threw TypeError. The SDK's `processReadBuffer()`
 * swallows that inside `while (true)` *without advancing the buffer*, producing
 * a synchronous infinite loop. Observed damage on a real user's machine:
 *
 *   - `initialize` never answered  → Claude Code stuck on "connecting" forever,
 *     zero tools exposed, daemon never lazily started (ensureDaemon only fires
 *     inside proxyCall), so no index.db / no dashboard / no memory for 3 weeks.
 *   - Event loop frozen            → 107% CPU per process, 227 CPU-hours burned.
 *   - Shutdown paths starved       → stdin EOF / SIGTERM / parentWatch all dead,
 *     so every closed session left an orphan. 4 had accumulated.
 *
 * Why no existing test caught it: `test/mcp-stdio.test.mjs` only unit-tests
 * buildDaemonStartArgs()/ensureDaemon(). Nothing ever ran the CLI as a black box
 * and spoke the actual protocol to it. Unit tests passed on a green CI the whole
 * time — and CI/dev machines are macOS/Linux, where the `win32` guard makes the
 * bug unreachable.
 *
 * This journey therefore asserts USER-VISIBLE protocol outcomes only:
 *   1. `initialize` gets a well-formed response (the protocol is alive at all).
 *   2. `tools/list` returns the real tool set — this is the second request, so
 *      it doubles as proof the event loop was never frozen by request #1.
 *   3. On stdin EOF the process exits promptly (no orphan, no CPU burner).
 *
 * Deliberately platform-agnostic: it must fail on Windows pre-fix and pass
 * everywhere post-fix.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLI = path.join(PKG_ROOT, 'bin', 'cli.cjs');

const HANDSHAKE_TIMEOUT_MS = 20_000;
const EXIT_GRACE_MS = 8_000;

/**
 * Spawn the real CLI in stdio MCP mode and speak real JSON-RPC to it.
 *
 * Runs in an isolated temp dir used as BOTH cwd and home. Overriding
 * USERPROFILE alongside HOME is deliberate: `os.homedir()` reads USERPROFILE on
 * Windows and ignores HOME, so HOME-only isolation silently leaks into the real
 * user profile — the exact defect that polluted a live workspaces.json with 299
 * junk entries. Never isolate with HOME alone.
 */
function startProxy() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-mcp-handshake-'));
  // home and workspace must be DIFFERENT dirs: assertSafeWorkspaceRoot refuses
  // to treat the home directory itself as a workspace.
  const home = path.join(tmp, 'home');
  const workspace = path.join(tmp, 'workspace');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });

  const child = spawn(process.execPath, [CLI, 'mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    cwd: workspace,
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });

  const frames = [];
  const waiters = [];
  let stdoutBuf = '';
  let stderr = '';

  child.stdout.on('data', (d) => {
    stdoutBuf += d.toString('utf8');
    let i;
    while ((i = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, i).trim();
      stdoutBuf = stdoutBuf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      frames.push(msg);
      for (let w = waiters.length - 1; w >= 0; w--) {
        if (waiters[w].match(msg)) waiters.splice(w, 1)[0].resolve(msg);
      }
    }
  });
  child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

  const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);

  const waitFor = (match, label) => {
    const hit = frames.find(match);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(
          `timed out after ${HANDSHAKE_TIMEOUT_MS}ms waiting for ${label}. `
          + `frames=${frames.length} stderr=${JSON.stringify(stderr.slice(-400))}`,
        ));
      }, HANDSHAKE_TIMEOUT_MS);
      waiters.push({ match, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  };

  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort */ }
  };

  return { child, send, waitFor, exited, cleanup, stderrText: () => stderr };
}

describe('MCP stdio handshake (L4, zero mock)', () => {
  it('answers initialize and lists tools, then exits on client disconnect', async () => {
    const proxy = startProxy();
    try {
      // --- 1. initialize must be answered ---------------------------------
      proxy.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'l4-journey', version: '1.0.0' },
        },
      });

      const init = await proxy.waitFor((m) => m.id === 1, 'initialize response');
      assert.ok(init.result, `initialize returned an error: ${JSON.stringify(init.error)}`);
      assert.equal(
        init.result.serverInfo?.name,
        'awareness-local-stdio',
        'initialize must identify the awareness stdio server',
      );

      // --- 2. tools/list must return the real tool set ---------------------
      // Second request on purpose: if request #1 had frozen the event loop
      // (the 5-month Windows outage), this call can never be answered.
      proxy.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
      proxy.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

      const listed = await proxy.waitFor((m) => m.id === 2, 'tools/list response');
      assert.ok(listed.result, `tools/list returned an error: ${JSON.stringify(listed.error)}`);

      const names = (listed.result.tools ?? []).map((t) => t.name);
      assert.ok(names.length > 0, 'tools/list must not be empty — an empty list is what the user saw');
      for (const required of ['awareness_init', 'awareness_recall', 'awareness_record']) {
        assert.ok(names.includes(required), `missing core tool ${required}; got: ${names.join(', ')}`);
      }

      // --- 3. stdin EOF must terminate the process ------------------------
      // A stdio server's stdin IS its lifeline. Failing this assertion means
      // every closed editor session leaks a process.
      proxy.child.stdin.end();

      const outcome = await Promise.race([
        proxy.exited,
        new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), EXIT_GRACE_MS)),
      ]);
      assert.notEqual(
        outcome,
        'TIMEOUT',
        `proxy still alive ${EXIT_GRACE_MS}ms after stdin EOF — this is the orphan-process leak`,
      );
    } finally {
      proxy.cleanup();
    }
  });
});
