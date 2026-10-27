/**
 * Collaboration console (local daemon) — presence, intervention, dispatch.
 *
 * Covers the two feature commits:
 *   c56bc9e9 — agent presence + pause/freeze + manual dispatch
 *   f7b6ea23 — auto-dispatch scoring (overlap/idle/online/load)
 *
 * Everything runs against a throwaway SQLite index in os.tmpdir(); the daemon
 * is constructed (not started) so the frozen-write gate can be exercised
 * without booting the HTTP server or the memory store.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Indexer } from '../src/core/indexer.mjs';
import { AwarenessLocalDaemon } from '../src/daemon.mjs';
import {
  apiListAgents,
  apiDispatchTask,
  apiAutoDispatchTask,
  apiSetAgentState,
} from '../src/daemon/api-handlers.mjs';

function mockRes() {
  let _status = 200;
  let _body = '';
  return {
    writeHead(status) { _status = status; },
    end(body) { _body = body; return this; },
    get status() { return _status; },
    get json() { return JSON.parse(_body); },
  };
}

function mockReq(payload) {
  const bodyStr = payload === undefined ? '' : JSON.stringify(payload);
  return {
    on(event, handler) {
      if (event === 'data' && bodyStr) handler(Buffer.from(bodyStr));
      if (event === 'end') handler();
    },
    destroy() {},
  };
}

function daemonOf(indexer) { return { indexer }; }

describe('Collaboration console — presence', () => {
  let tmpDir;
  let indexer;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-test-'));
    indexer = new Indexer(path.join(tmpDir, 'index.db'));
  });

  after(() => {
    if (indexer) indexer.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('touchAgentHeartbeat inserts on first call and accumulates on later calls', () => {
    indexer.touchAgentHeartbeat('dev', 'awareness_record');
    let dev = indexer.getAgents().find((a) => a.agent_role === 'dev');
    assert.ok(dev, 'agent should appear after one heartbeat');
    assert.equal(dev.total_actions, 1);
    assert.equal(dev.last_action, 'awareness_record');
    assert.ok(dev.last_seen_at, 'last_seen_at is the presence signal');

    indexer.touchAgentHeartbeat('dev', 'awareness_recall');
    dev = indexer.getAgents().find((a) => a.agent_role === 'dev');
    assert.equal(dev.total_actions, 2);
    assert.equal(dev.last_action, 'awareness_recall');
  });

  it('touchAgentHeartbeat is a no-op without an agent_role', () => {
    const before = indexer.getAgents().length;
    indexer.touchAgentHeartbeat(null, 'awareness_recall');
    assert.equal(indexer.getAgents().length, before);
  });

  it('getAgents merges task-only agents and the unassigned bucket', () => {
    const now = new Date().toISOString();
    indexer.indexTask({
      id: 'task_review', title: 'Review the diff', status: 'open',
      agent_role: 'reviewer', created_at: now, updated_at: now,
      filepath: path.join(tmpDir, 'task-review.md'),
    });
    indexer.indexTask({
      id: 'task_loose', title: 'Unclaimed work', status: 'open',
      created_at: now, updated_at: now,
      filepath: path.join(tmpDir, 'task-loose.md'),
    });

    const agents = indexer.getAgents();
    const reviewer = agents.find((a) => a.agent_role === 'reviewer');
    const unassigned = agents.find((a) => a.agent_role === 'unassigned');
    assert.ok(reviewer, 'task-only agent must still show in the console');
    assert.equal(reviewer.task_count, 1);
    assert.equal(reviewer.total_actions, 0, 'no heartbeat yet means zero actions');
    assert.ok(unassigned, 'tasks without agent_role fall into unassigned');
    assert.equal(unassigned.task_count, 1);
  });

  it('setAgentState validates and persists; unknown agents read as active', () => {
    assert.equal(indexer.setAgentState('dev', 'bogus'), false);
    assert.equal(indexer.setAgentState('dev', 'paused'), true);
    assert.equal(indexer.getAgentState('dev'), 'paused');

    // Creating a row for an agent that never heartbeated must work — the
    // console's state button can target any role shown in the ledger.
    assert.equal(indexer.setAgentState('brand-new-agent', 'frozen'), true);
    assert.equal(indexer.getAgentState('brand-new-agent'), 'frozen');
    assert.equal(indexer.getAgentState('never-seen-at-all'), 'active');
  });
});

describe('Collaboration console — frozen write gate', () => {
  let tmpDir;
  let indexer;
  let daemon;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-frozen-'));
    indexer = new Indexer(path.join(tmpDir, 'index.db'));
    daemon = new AwarenessLocalDaemon({ projectDir: tmpDir, port: 0, background: true });
    daemon.indexer = indexer;
  });

  after(() => {
    if (indexer) indexer.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('frozen agents cannot remember or update tasks', async () => {
    indexer.setAgentState('frozen-agent', 'frozen');

    const remember = await daemon._remember({ content: 'should be rejected', agent_role: 'frozen-agent' });
    assert.equal(remember.error, 'agent_frozen');
    assert.equal(remember.agent_role, 'frozen-agent');

    const update = await daemon._updateTask({ task_id: 'any', status: 'done', agent_role: 'frozen-agent' });
    assert.equal(update.error, 'agent_frozen');
  });

  it('a different agent is not affected by another agent being frozen', async () => {
    indexer.setAgentState('frozen-agent', 'frozen');
    // 'active-agent' is not frozen: the gate must let it through and fail later
    // on the missing task id instead of returning agent_frozen.
    const update = await daemon._updateTask({ task_id: '', status: 'done', agent_role: 'active-agent' });
    assert.notEqual(update.error, 'agent_frozen');
    assert.equal(update.error, 'task_id is required for update_task');
  });
});

describe('Collaboration console — dispatch', () => {
  let tmpDir;
  let indexer;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-dispatch-'));
    indexer = new Indexer(path.join(tmpDir, 'index.db'));
  });

  after(() => {
    if (indexer) indexer.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function addTask(id, title, extra = {}) {
    const now = new Date().toISOString();
    indexer.indexTask({
      id, title, status: 'open', created_at: now, updated_at: now,
      filepath: path.join(tmpDir, `${id}.md`), ...extra,
    });
  }

  function seedAgents() {
    indexer.touchAgentHeartbeat('frontend-dev', 'awareness_recall');
    indexer.touchAgentHeartbeat('backend-dev', 'awareness_recall');
    indexer.setAgentState('frontend-dev', 'active');
    indexer.setAgentState('backend-dev', 'active');
  }

  it('scoreAgentsForTask prefers relevance, then idle/online, then low load', () => {
    seedAgents();
    addTask('load-1', 'Backend migration', { status: 'claimed', agent_role: 'backend-dev' });
    addTask('load-2', 'Backend migration follow-up', { status: 'in_progress', agent_role: 'backend-dev' });

    const scored = indexer.scoreAgentsForTask('frontend layout fix');
    const front = scored.find((s) => s.agent_role === 'frontend-dev');
    const back = scored.find((s) => s.agent_role === 'backend-dev');
    assert.ok(front && back);
    assert.equal(front.overlap, 1, 'role token "frontend" matches the task text');
    assert.equal(front.idle, 1);
    assert.equal(front.online, 1);
    assert.equal(back.load, 2, 'claimed + in_progress both count as active load');
    assert.ok(front.score > back.score, 'idle relevant agent must outrank a loaded one');
    assert.equal(scored[0].agent_role, 'frontend-dev', 'sorted by score desc');
  });

  it('scoreAgentsForTask excludes paused, frozen and unassigned', () => {
    indexer.setAgentState('frontend-dev', 'paused');
    const roles = indexer.scoreAgentsForTask('frontend layout fix').map((s) => s.agent_role);
    assert.ok(!roles.includes('frontend-dev'), 'paused agents must not be routed new work');
    assert.ok(roles.includes('backend-dev'));

    indexer.setAgentState('backend-dev', 'frozen');
    const afterFreeze = indexer.scoreAgentsForTask('backend layout fix').map((s) => s.agent_role);
    assert.ok(!afterFreeze.includes('backend-dev'), 'frozen agents must not be routed new work');
    assert.ok(!afterFreeze.includes('unassigned'));
  });

  it('apiListAgents returns items + total', () => {
    const res = mockRes();
    apiListAgents(daemonOf(indexer), mockReq(), res);
    assert.equal(res.status, 200);
    assert.equal(res.json.total, res.json.items.length);
    assert.ok(res.json.items.length >= 2);
  });

  it('apiDispatchTask claims an open task exactly once (CAS)', async () => {
    indexer.setAgentState('frontend-dev', 'active');
    indexer.setAgentState('backend-dev', 'active');
    addTask('dispatch-1', 'Ship the release note');

    const first = mockRes();
    await apiDispatchTask(daemonOf(indexer), mockReq({ task_id: 'dispatch-1', agent_role: 'frontend-dev' }), first);
    assert.equal(first.status, 200);
    assert.equal(first.json.status, 'ok');
    assert.equal(first.json.new_status, 'claimed');

    const second = mockRes();
    await apiDispatchTask(daemonOf(indexer), mockReq({ task_id: 'dispatch-1', agent_role: 'backend-dev' }), second);
    assert.equal(second.status, 409);
    assert.equal(second.json.status, 'conflict');
    assert.equal(second.json.reason, 'not_open');
    assert.equal(second.json.current_agent_role, 'frontend-dev', 'loser learns who holds the task');
  });

  it('apiDispatchTask refuses paused/frozen targets', async () => {
    indexer.setAgentState('frontend-dev', 'paused');
    addTask('dispatch-2', 'Blocked by pause');

    const res = mockRes();
    await apiDispatchTask(daemonOf(indexer), mockReq({ task_id: 'dispatch-2', agent_role: 'frontend-dev' }), res);
    assert.equal(res.status, 409);
    assert.equal(res.json.status, 'blocked');
    assert.equal(res.json.reason, 'agent_paused');
    indexer.setAgentState('frontend-dev', 'active');
  });

  it('apiAutoDispatchTask picks the best candidate and returns a trace', async () => {
    indexer.setAgentState('frontend-dev', 'active');
    indexer.setAgentState('backend-dev', 'active');
    addTask('auto-1', 'Frontend layout polish');

    const res = mockRes();
    await apiAutoDispatchTask(daemonOf(indexer), mockReq({ task_id: 'auto-1' }), res);
    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'ok');
    assert.equal(res.json.agent_role, 'frontend-dev', 'relevant idle agent should win');
    assert.equal(res.json.new_status, 'claimed');
    assert.ok(res.json.dispatch, 'dispatch trace is returned for the UI');
    assert.equal(typeof res.json.dispatch.score, 'number');
    assert.ok(Array.isArray(res.json.dispatch.candidates));
  });

  it('apiAutoDispatchTask reports no_candidate when every agent is paused/frozen', async () => {
    indexer.setAgentState('frontend-dev', 'frozen');
    indexer.setAgentState('backend-dev', 'paused');
    addTask('auto-2', 'Nobody can take this');

    const res = mockRes();
    await apiAutoDispatchTask(daemonOf(indexer), mockReq({ task_id: 'auto-2' }), res);
    assert.equal(res.status, 409);
    assert.equal(res.json.status, 'no_candidate');
    assert.equal(res.json.reason, 'no_active_agent');
  });

  it('apiSetAgentState rejects invalid states with 400', async () => {
    const res = mockRes();
    await apiSetAgentState(daemonOf(indexer), mockReq({ state: 'exploded' }), res, 'frontend-dev');
    assert.equal(res.status, 400);
    assert.match(res.json.error, /invalid state/);
  });
});
