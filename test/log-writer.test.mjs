/**
 * The daemon must leave a trace when it fails.
 *
 * `daemon.logFile` was assigned in two places and read in none — the only thing
 * that ever produced a daemon.log was bin/awareness-local.mjs redirecting the
 * child's fd 1/2. That path is skipped by `--foreground`, by the
 * already-running exit, by the lock-wait exit, by workspace switch, and by
 * `mcp`. Since every IDE starts the daemon through `mcp` (which spawns with
 * `stdio: 'ignore'`), all ~274 console.* calls in src/ went to a black hole for
 * exactly the users most likely to need them. A crash produced no file, no
 * message, no exit code: the daemon simply never appeared.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { attachFileLogger, detachFileLogger, currentLogFile } from '../src/daemon/log-writer.mjs';

function tmpLog() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-logwriter-'));
  return { dir, file: path.join(dir, 'daemon.log') };
}

/** The stream is async; give it a tick to flush before reading. */
async function readAfterFlush(file) {
  detachFileLogger();
  await new Promise((r) => setTimeout(r, 120));
  return fs.readFileSync(file, 'utf-8');
}

test('captures console.error — the channel that carried the lost diagnostics', async (t) => {
  const { dir, file } = tmpLog();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  assert.equal(attachFileLogger(file), true);
  console.error('[awareness-local] SQLite indexer unavailable: libstdc++ not found');

  const body = await readAfterFlush(file);
  assert.match(body, /SQLite indexer unavailable/);
  assert.match(body, /\[error\]/);
  assert.match(body, /\d{4}-\d{2}-\d{2}T/, 'entries must be timestamped to be useful post-mortem');
});

test('captures warn and log too', async (t) => {
  const { dir, file } = tmpLog();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  attachFileLogger(file);
  console.warn('a warning');
  console.log('an info line');

  const body = await readAfterFlush(file);
  assert.match(body, /\[warn\] a warning/);
  assert.match(body, /\[log\] an info line/);
});

test('tees rather than replaces — output still reaches stdout', async (t) => {
  const { dir, file } = tmpLog();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // bin/awareness-local.mjs redirects the child's fd 1/2 into daemon.log and
  // relies on stdout still carrying everything. If this module swallowed output
  // instead of teeing it, that path would silently go dark. Asserting at
  // stdout.write is the real contract — asserting on a console.log wrapper
  // would only prove the wrapper was called.
  const seen = [];
  const realWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => {
    seen.push(String(chunk));
    return realWrite(chunk, ...rest);
  };

  attachFileLogger(file);
  console.log('must reach both sinks');
  process.stdout.write = realWrite;

  const body = await readAfterFlush(file);

  assert.ok(seen.some((l) => l.includes('must reach both sinks')), 'stdout must still receive the line');
  assert.match(body, /must reach both sinks/, 'and the file must also receive it');
});

test('restores console on detach', async (t) => {
  const { dir, file } = tmpLog();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const before = console.error;
  attachFileLogger(file);
  assert.notEqual(console.error, before, 'should be wrapped while attached');
  detachFileLogger();
  assert.equal(console.error, before, 'must restore the exact original reference');
});

test('re-attaching re-points at the new file (workspace switch)', async (t) => {
  const { dir, file } = tmpLog();
  const second = path.join(dir, 'other-project.log');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  attachFileLogger(file);
  console.log('goes to project A');
  attachFileLogger(second);
  console.log('goes to project B');

  const bBody = await readAfterFlush(second);
  const aBody = fs.readFileSync(file, 'utf-8');

  assert.match(aBody, /goes to project A/);
  assert.ok(!aBody.includes('goes to project B'), 'post-switch lines must not land in the old project');
  assert.match(bBody, /goes to project B/);
});

test('serialises Errors with their stack, not "[object Object]"', async (t) => {
  const { dir, file } = tmpLog();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  attachFileLogger(file);
  console.error('boom:', new Error('better-sqlite3 NODE_MODULE_VERSION mismatch'));

  const body = await readAfterFlush(file);
  assert.match(body, /NODE_MODULE_VERSION mismatch/);
  assert.ok(!body.includes('[object Object]'), 'an unreadable log is the same as no log');
});

test('never throws on circular or exotic values', async (t) => {
  const { dir, file } = tmpLog();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  attachFileLogger(file);
  const circular = { name: 'loop' };
  circular.self = circular;

  // A logger that can crash the daemon is worse than no logger.
  assert.doesNotThrow(() => console.log('circular:', circular));
  assert.doesNotThrow(() => console.log('undef:', undefined, 'sym:', Symbol('x')));

  await readAfterFlush(file);
});

test('reports failure instead of throwing when the path is unusable', () => {
  // An unwritable target must degrade to "no logging", never take the daemon down.
  const bogus = path.join(os.tmpdir(), 'aw-logwriter-nope', '\0invalid', 'daemon.log');
  let result;
  assert.doesNotThrow(() => { result = attachFileLogger(bogus); });
  assert.equal(result, false);
  assert.equal(currentLogFile(), null);
});
