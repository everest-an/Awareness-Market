/**
 * F-085 · stdio MCP proxy anti-zombie lifecycle.
 *
 * Regression guard for the real bug: `awareness-local mcp` proxies had NO exit
 * path on client disconnect, so every closed MCP session (Claude Code / Cursor)
 * left an orphaned node process — on Windows the `cmd /c npx` shim breaks signal
 * propagation, and they accumulated into CPU-burning zombies over days.
 *
 * These spawn the REAL proxy process (no mock) and assert it terminates:
 *   - when the client closes stdin (EOF) — the canonical stdio lifeline
 *   - when it receives SIGTERM
 * A daemon is NOT required: the proxy starts and stays up on its own, which is
 * exactly why it used to linger.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'bin', 'awareness-local.mjs');

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-mcp-life-'));
});

after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

function spawnProxy() {
  // Unused port on purpose — the proxy must start regardless of daemon presence.
  return spawn(process.execPath, [CLI, 'mcp', '--project', tmpDir, '--port', '37851'], {
    cwd: tmpDir,
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
}

/** Resolve with the exit code once the child exits, or reject on timeout. */
function waitForExit(child, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* noop */ }
      reject(new Error(`process did not exit within ${ms}ms (zombie!)`));
    }, ms);
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
  });
}

/** Wait until the proxy has logged that it is connected and ready. */
function waitForReady(child, ms) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('proxy never became ready')), ms);
    child.stderr.on('data', (d) => {
      buf += String(d);
      if (buf.includes('connected and ready') || buf.includes('stdio MCP')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

describe('F-085 · stdio MCP proxy exits on client disconnect (anti-zombie)', () => {
  it('exits shortly after stdin closes (client disconnect)', async () => {
    const child = spawnProxy();
    await waitForReady(child, 10_000);
    // Client closes its end of the pipe → stdin EOF.
    child.stdin.end();
    const { code } = await waitForExit(child, 6_000);
    assert.equal(code, 0, 'should exit cleanly on stdin close');
  });

  it('exits on SIGTERM', async () => {
    const child = spawnProxy();
    await waitForReady(child, 10_000);
    child.kill('SIGTERM');
    const { code, signal } = await waitForExit(child, 6_000);
    // Either a clean exit(0) from our handler or termination by the signal.
    assert.ok(code === 0 || signal === 'SIGTERM', `expected clean exit, got code=${code} signal=${signal}`);
  });
});
