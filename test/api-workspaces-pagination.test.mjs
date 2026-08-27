/**
 * P1 fix · `/api/v1/workspaces` pagination + filter
 *
 * Context: OCT-Agent Memory tab was fetching the full workspace map on
 * every page load, which on real users accumulates to 2500+ entries / 450KB.
 * We now support `?limit=` + `?q=` query params, while keeping the legacy
 * map shape when neither is passed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// The apiWorkspaces handler reads the workspace registry via loadWorkspaces().
// AWARENESS_HOME redirects that registry to a sandbox, so this test never goes
// near the real user's file.
//
// It used to. The previous version said "we can't easily redirect HOME, so we
// write into the real file" and then overwrote it wholesale, relying on a
// `finally` to put it back — meaning a crash, a Ctrl-C or a power cut destroyed
// the user's workspace registry. It also leaked entries: one real machine ended
// up with 299 junk entries out of 308. Setting HOME alone would not have helped,
// because os.homedir() reads USERPROFILE on Windows and ignores HOME.
//
// IMPORTANT: the workspace keys must be REAL directories that exist on this
// machine — apiWorkspaces filters entries with fs.existsSync(). The original
// test used Unix `/tmp/p1-*` keys, which do not exist on Windows
// (path.resolve('/tmp/x') → 'C:\tmp\x' but no such dir), so every entry was
// filtered and all four tests failed on Windows while passing on Linux CI.
// We create one real temp dir and derive all keys from it.

const sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-home-'));
process.env.AWARENESS_HOME = sandboxHome;

const wsFile = path.join(sandboxHome, '.awareness', 'workspaces.json');
const wsTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-workspaces-'));

// Pre-create every key directory the tests reference: apiWorkspaces filters
// entries through fs.existsSync(), so a key without a real directory is
// silently dropped (this is what broke the original /tmp/p1-* keys on
// Windows). Creating them up front keeps the assertions deterministic.
for (const name of ['p1-ws-a', 'p1-ws-b', 'p1-alpha', 'p1-beta', 'p1-gamma']) {
  fs.mkdirSync(path.join(wsTestDir, name), { recursive: true });
}
for (let i = 0; i < 10; i++) fs.mkdirSync(path.join(wsTestDir, `p1-page-${i}`), { recursive: true });
for (let i = 0; i < 5; i++) fs.mkdirSync(path.join(wsTestDir, `p1-cap-${i}`), { recursive: true });

// Kept as no-ops so the existing call sites still read naturally: with the
// registry sandboxed there is nothing to back up or restore, and pretending
// otherwise would re-introduce the "restore the user's file" mindset.
function backupWorkspaces() { return null; }
function restoreWorkspaces() { /* sandboxed — nothing to restore */ }

class MockRes {
  constructor() {
    this.status = null;
    this.headers = null;
    this.body = null;
  }
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  end(body) { this.body = body; return this; }
}

test('P1 · apiWorkspaces returns legacy map shape when no query params', async () => {
  const { apiWorkspaces } = await import('../src/daemon/api-handlers.mjs');
  const snapshot = backupWorkspaces();
  try {
    fs.mkdirSync(path.dirname(wsFile), { recursive: true });
    fs.writeFileSync(wsFile, JSON.stringify({
      [path.join(wsTestDir, 'p1-ws-a')]: { memoryId: 'a', port: 37801, name: 'A', lastUsed: '2026-04-19T00:00:00Z' },
      [path.join(wsTestDir, 'p1-ws-b')]: { memoryId: 'b', port: 37802, name: 'B', lastUsed: '2026-04-18T00:00:00Z' },
    }));
    const res = new MockRes();
    await apiWorkspaces(res, new URL('http://localhost/api/v1/workspaces'));
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body);
    // Legacy map shape: keys are paths
    assert.ok(parsed[path.join(wsTestDir, 'p1-ws-a')], 'expected legacy map keyed by path');
    assert.ok(parsed[path.join(wsTestDir, 'p1-ws-b')]);
    assert.equal(parsed[path.join(wsTestDir, 'p1-ws-a')].name, 'A');
  } finally {
    restoreWorkspaces(snapshot);
  }
});

test('P1 · apiWorkspaces with ?limit= returns paginated array sorted by lastUsed desc', async () => {
  const { apiWorkspaces } = await import('../src/daemon/api-handlers.mjs');
  const snapshot = backupWorkspaces();
  try {
    const entries = {};
    for (let i = 0; i < 10; i++) {
      entries[path.join(wsTestDir, `p1-page-${i}`)] = {
        memoryId: `m${i}`, port: 37800 + i, name: `W${i}`,
        lastUsed: `2026-04-${10 + i}T00:00:00Z`,
      };
    }
    fs.writeFileSync(wsFile, JSON.stringify(entries));

    const res = new MockRes();
    await apiWorkspaces(res, new URL('http://localhost/api/v1/workspaces?limit=3'));
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.workspaces.length, 3, 'should return 3 most-recent');
    assert.equal(parsed.total, 10, 'total should reflect full filtered count');
    // lastUsed desc → 2026-04-19 first (i=9)
    assert.equal(parsed.workspaces[0].path, path.join(wsTestDir, 'p1-page-9'));
    assert.equal(parsed.workspaces[0].name, 'W9');
    // Entries include path flattened in
    assert.equal(typeof parsed.workspaces[0].memoryId, 'string');
  } finally {
    restoreWorkspaces(snapshot);
  }
});

test('P1 · apiWorkspaces with ?q= filters by path substring', async () => {
  const { apiWorkspaces } = await import('../src/daemon/api-handlers.mjs');
  const snapshot = backupWorkspaces();
  try {
    fs.writeFileSync(wsFile, JSON.stringify({
      [path.join(wsTestDir, 'p1-alpha')]: { memoryId: 'a', port: 37801, lastUsed: '2026-04-19T00:00:00Z' },
      [path.join(wsTestDir, 'p1-beta')]:  { memoryId: 'b', port: 37802, lastUsed: '2026-04-18T00:00:00Z' },
      [path.join(wsTestDir, 'p1-gamma')]: { memoryId: 'c', port: 37803, lastUsed: '2026-04-17T00:00:00Z' },
    }));

    const res = new MockRes();
    await apiWorkspaces(res, new URL('http://localhost/api/v1/workspaces?q=beta'));
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.workspaces.length, 1);
    assert.equal(parsed.workspaces[0].path, path.join(wsTestDir, 'p1-beta'));
    assert.equal(parsed.total, 1);
  } finally {
    restoreWorkspaces(snapshot);
  }
});

test('P1 · apiWorkspaces caps limit at 500 to prevent DoS', async () => {
  const { apiWorkspaces } = await import('../src/daemon/api-handlers.mjs');
  const snapshot = backupWorkspaces();
  try {
    const entries = {};
    for (let i = 0; i < 5; i++) entries[path.join(wsTestDir, `p1-cap-${i}`)] = { lastUsed: `2026-04-${10 + i}T00:00:00Z` };
    fs.writeFileSync(wsFile, JSON.stringify(entries));
    const res = new MockRes();
    await apiWorkspaces(res, new URL('http://localhost/api/v1/workspaces?limit=999999'));
    const parsed = JSON.parse(res.body);
    // With 5 total and cap 500 → return all 5
    assert.equal(parsed.workspaces.length, 5);
    assert.equal(parsed.total, 5);
  } finally {
    restoreWorkspaces(snapshot);
  }
});
