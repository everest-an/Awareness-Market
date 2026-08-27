/**
 * Deals CLI tests for bin/awareness-local.mjs.
 *
 * Contract:
 *   - `deals list` GETs /public/deals with q/direction/category/region/limit
 *     params and renders a human-readable board.
 *   - `deals list --json` prints the raw API payload.
 *   - `deals publish` POSTs anonymous JSON to /deals — NO Authorization header
 *     (unauthenticated by design, guest quota enforced server-side).
 *   - Missing required publish flags exit non-zero with a usage hint.
 *   - AWARENESS_BASE_URL env overrides the API base.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '../bin/awareness-local.mjs');

/** Spawn the CLI, capture stdout/stderr/exit code. */
function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

/** Minimal mock of the Awareness public deals API. */
function mockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        const ctx = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
          json: body ? JSON.parse(body) : null,
        };
        handler(ctx, res);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}/api/v1` });
    });
  });
}

test('deals list: GET /public/deals with filters and human-readable output', async () => {
  let seen;
  const { server, base } = await mockServer((ctx, res) => {
    seen = ctx;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      total: 2,
      deals: [
        { id: 'd1', direction: 'supply', category: 'compute', region: 'CN-SZ', title: 'H100 available', body: '40x H100 SXM, sealed.' },
        { id: 'd2', direction: 'demand', category: 'logistics', region: 'HK', title: 'Freight partner wanted', body: null },
      ],
    }));
  });
  try {
    const { code, out, err } = await runCli(
      ['deals', 'list', '--q', 'H100', '--direction', 'supply', '--limit', '10'],
      { AWARENESS_BASE_URL: base },
    );
    assert.equal(code, 0, err);
    assert.ok(seen.url.startsWith('/api/v1/public/deals?'), `unexpected url ${seen.url}`);
    assert.ok(seen.url.includes('q=H100'));
    assert.ok(seen.url.includes('direction=supply'));
    assert.ok(seen.url.includes('limit=10'));
    assert.match(out, /\[SUPPLY \] H100 available \(compute · CN-SZ\)/);
    assert.match(out, /\[DEMAND \] Freight partner wanted/);
    assert.match(out, /\/deals\/d1/);
    assert.equal(seen.headers.authorization, undefined);
  } finally {
    server.close();
  }
});

test('deals list --json: prints raw API payload', async () => {
  const { server, base } = await mockServer((ctx, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ total: 1, deals: [{ id: 'd1', direction: 'supply', category: 'compute', title: 'X' }] }));
  });
  try {
    const { code, out } = await runCli(['deals', 'list', '--json'], { AWARENESS_BASE_URL: base });
    assert.equal(code, 0);
    const parsed = JSON.parse(out);
    assert.equal(parsed.total, 1);
  } finally {
    server.close();
  }
});

test('deals publish: anonymous POST /deals without Authorization header', async () => {
  let seen;
  const { server, base } = await mockServer((ctx, res) => {
    seen = ctx;
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 'd9', title: 'H100 available', status: 'published' }));
  });
  try {
    const { code, out, err } = await runCli(
      ['deals', 'publish', '--direction', 'supply', '--category', 'compute', '--title', 'H100 available', '--body', '40x H100', '--region', 'CN-SZ', '--contact-visibility', 'private'],
      { AWARENESS_BASE_URL: base },
    );
    assert.equal(code, 0, err);
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, '/api/v1/deals');
    assert.equal(seen.headers.authorization, undefined, 'publish must be anonymous');
    assert.deepEqual(seen.json, {
      direction: 'supply',
      category: 'compute',
      title: 'H100 available',
      body: '40x H100',
      region: 'CN-SZ',
      contact_visibility: 'private',
    });
    assert.match(out, /Published \(anonymous\)/);
    assert.match(out, /\/deals\/d9/);
  } finally {
    server.close();
  }
});

test('deals publish: missing required flags exit non-zero with hint', async () => {
  const { code, out, err } = await runCli(
    ['deals', 'publish', '--direction', 'supply'],
    { AWARENESS_BASE_URL: 'http://127.0.0.1:1/api/v1' },
  );
  assert.equal(code, 1);
  const combined = out + err;
  assert.match(combined, /--category/);
  assert.match(combined, /required for publish/);
});

test('deals: unknown subcommand exits non-zero', async () => {
  const { code, out, err } = await runCli(['deals', 'frobnicate'], { AWARENESS_BASE_URL: 'http://127.0.0.1:1/api/v1' });
  assert.equal(code, 1);
  assert.match(out + err, /Unknown deals subcommand/);
});
