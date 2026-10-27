/**
 * task-handoff-validation.test.mjs — malformed handoffs must be rejected.
 *
 * `handoff` is persisted as JSON and parsed by every reader (task board,
 * plugin, cloud sync). A free-form string used to be written verbatim, which
 * lets one client corrupt the column for everyone; the daemon validates the
 * payload before the CAS write.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let daemon;
let tmpDir;
let callMcpTool;

function parseResult(result) {
  assert.ok(result?.content?.[0]?.text, 'MCP result should carry a text payload');
  return JSON.parse(result.content[0].text);
}

function seedTask(id, status = 'open') {
  const now = new Date().toISOString();
  daemon.indexer.db
    .prepare(
      `INSERT OR REPLACE INTO tasks
         (id, title, description, status, priority, created_at, updated_at, filepath)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, `task ${id}`, '', status, 'medium', now, now,
      path.join(tmpDir, '.awareness', 'tasks', status, `${id}.md`));
}

function updateTask(args) {
  return callMcpTool(daemon, 'awareness_record', args).then(parseResult);
}

function readHandoff(id) {
  const row = daemon.indexer.db.prepare('SELECT handoff FROM tasks WHERE id = ?').get(id);
  return row?.handoff ?? null;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-handoff-'));
  fs.mkdirSync(path.join(tmpDir, '.awareness', 'tasks', 'open'), { recursive: true });

  const { AwarenessLocalDaemon } = await import('../src/daemon.mjs');
  const { MemoryStore } = await import('../src/core/memory-store.mjs');
  const { Indexer } = await import('../src/core/indexer.mjs');
  ({ callMcpTool } = await import('../src/daemon/tool-bridge.mjs'));

  daemon = new AwarenessLocalDaemon({ projectDir: tmpDir, port: 0, background: true });
  daemon.memoryStore = new MemoryStore(tmpDir);
  daemon.indexer = new Indexer(path.join(tmpDir, '.awareness', 'index.db'));
  daemon.cloudSync = { isEnabled: () => false };
});

after(() => {
  try { daemon?.indexer?.close?.(); } catch { /* best-effort */ }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

describe('handoff payload validation', () => {
  it('rejects a malformed JSON string and leaves the column untouched', async () => {
    seedTask('task_bad_handoff');
    const res = await updateTask({
      task_id: 'task_bad_handoff', status: 'claimed', expect_status: 'open',
      agent_role: 'agent_a', handoff: 'not-json',
    });
    assert.match(String(res.error || ''), /valid JSON/);
    assert.equal(readHandoff('task_bad_handoff'), null);
  });

  it('rejects a non-object JSON payload', async () => {
    seedTask('task_array_handoff');
    const res = await updateTask({
      task_id: 'task_array_handoff', status: 'claimed', expect_status: 'open',
      agent_role: 'agent_a', handoff: JSON.stringify([1, 2, 3]),
    });
    assert.match(String(res.error || ''), /JSON object/);
    assert.equal(readHandoff('task_array_handoff'), null);
  });

  it('stores a structured handoff as JSON', async () => {
    seedTask('task_good_handoff');
    const handoff = { goal: 'finish', files: ['a.ts'], decisions: ['d1'], open_questions: [] };
    const res = await updateTask({
      task_id: 'task_good_handoff', status: 'claimed', expect_status: 'open',
      agent_role: 'agent_a', handoff,
    });
    assert.equal(res.status, 'ok');
    assert.deepEqual(JSON.parse(readHandoff('task_good_handoff')), handoff);
  });
});
