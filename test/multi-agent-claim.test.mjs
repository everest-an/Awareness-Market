/**
 * multi-agent-claim.test.mjs — the atomic claim primitive that lets N agents
 * share one task board without duplicating work.
 *
 * This is the mechanism the multi-agent collaboration pitch rests on: two
 * agents looking at the same `open` task must not both start it. It goes
 * through the real MCP surface (`callMcpTool`) rather than calling
 * `_updateTask` directly, so it also covers the schema/argument plumbing that
 * agents actually depend on — for a long time `expect_status` was implemented
 * in the daemon but absent from the tool schema, which made every agent call
 * take the unconditional path.
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

let daemon;
let tmpDir;
let callMcpTool;

/** MCP results arrive as { content: [{ type, text }] }; unwrap the JSON body. */
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

function readTask(id) {
  return daemon.indexer.db.prepare('SELECT status, agent_role FROM tasks WHERE id = ?').get(id);
}

/** Claim via the MCP tool shape an agent would actually send. */
function claim(id, agentRole) {
  return callMcpTool(daemon, 'awareness_record', {
    task_id: id,
    status: 'claimed',
    expect_status: 'open',
    agent_role: agentRole,
  }).then(parseResult);
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'awareness-claim-'));
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

describe('atomic claim (CAS) via the MCP surface', () => {
  it('lets exactly one of N concurrent claimers win', async () => {
    const N = 8;
    seedTask('task_race_open');

    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => claim('task_race_open', `agent_${i}`))
    );

    const winners = results.filter((r) => r.claimed === true);
    const losers = results.filter((r) => r.status === 'conflict');

    assert.equal(winners.length, 1, `expected exactly 1 winner, got ${winners.length}`);
    assert.equal(losers.length, N - 1, 'every other claimer must be told it lost');

    // A loser must be able to see who holds it, so it can pick different work.
    for (const l of losers) {
      assert.equal(l.claimed, false);
      assert.equal(l.current_status, 'claimed');
      assert.equal(l.current_agent_role, winners[0].agent_role);
    }

    // The persisted row must name the winner — never a loser that raced later.
    const row = readTask('task_race_open');
    assert.equal(row.status, 'claimed');
    assert.equal(row.agent_role, winners[0].agent_role);
  });

  it('refuses to re-claim work that is already claimed', async () => {
    seedTask('task_already_claimed');
    const first = await claim('task_already_claimed', 'agent_a');
    assert.equal(first.claimed, true);

    const second = await claim('task_already_claimed', 'agent_b');
    assert.equal(second.status, 'conflict');
    assert.equal(second.current_agent_role, 'agent_a');
    assert.equal(readTask('task_already_claimed').agent_role, 'agent_a');
  });

  it('releases a claim with a guarded transition (done requires doing)', async () => {
    seedTask('task_release');
    await claim('task_release', 'agent_a');

    // claimed -> doing is the normal step; doing -> done closes it.
    const start = parseResult(
      await callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_release', status: 'doing', expect_status: 'claimed',
      })
    );
    assert.equal(start.new_status, 'doing');

    const finish = parseResult(
      await callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_release', status: 'done', expect_status: 'doing',
      })
    );
    assert.equal(finish.new_status, 'done');
    assert.equal(readTask('task_release').status, 'done');
  });

  it('keeps the unconditional path when expect_status is omitted', async () => {
    // The indexing path relies on this; removing it silently would break FTS sync.
    seedTask('task_unconditional');
    const res = parseResult(
      await callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_unconditional', status: 'blocked',
      })
    );
    assert.equal(res.status, 'ok');
    assert.equal(res.new_status, 'blocked');
    assert.equal(readTask('task_unconditional').status, 'blocked');
  });

  it('reports a task that does not exist instead of inventing one', async () => {
    const res = parseResult(
      await callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_does_not_exist', status: 'claimed', expect_status: 'open',
      })
    );
    assert.match(String(res.error), /not found/i);
  });
});

describe('claim contract is discoverable by agents', () => {
  it('declares expect_status in the awareness_record input schema', async () => {
    const { getToolDefinitions } = await import('../src/daemon/mcp-contract.mjs');
    const record = getToolDefinitions().find((t) => t.name === 'awareness_record');
    assert.ok(record, 'awareness_record must exist');
    const props = record.inputSchema?.properties ?? {};
    assert.ok(props.expect_status, 'expect_status must be declared or agents cannot discover the CAS');
    assert.equal(props.expect_status.type, 'string');
    // The description is the only documentation an agent gets at call time.
    assert.match(props.expect_status.description, /compare-and-swap/i);
    assert.match(props.expect_status.description, /conflict/);
  });
});

describe('visibility scope', () => {
  function setPrivate(id, ownerRole) {
    daemon.indexer.db
      .prepare("UPDATE tasks SET visibility = 'private', agent_role = ? WHERE id = ?")
      .run(ownerRole, id);
  }

  it('hides a private task from callers with no identity', async () => {
    seedTask('task_private_anon');
    setPrivate('task_private_anon', 'agent_a');
    const anon = parseResult(await callMcpTool(daemon, 'awareness_lookup', { type: 'tasks' }));
    assert.ok(!anon.tasks.some((t) => t.id === 'task_private_anon'),
      'without an identity nobody may see a private task');
  });

  it('shows a private task to the agent that owns it', async () => {
    seedTask('task_private_owner');
    setPrivate('task_private_owner', 'agent_a');
    const asOwner = parseResult(await callMcpTool(daemon, 'awareness_lookup', { type: 'tasks', agent_role: 'agent_a' }));
    assert.ok(asOwner.tasks.some((t) => t.id === 'task_private_owner'),
      'the owning agent must still see its own private work');
  });

  it('keeps default (shared) tasks visible to everyone', async () => {
    seedTask('task_shared_default');
    const anon = parseResult(await callMcpTool(daemon, 'awareness_lookup', { type: 'tasks' }));
    assert.ok(anon.tasks.some((t) => t.id === 'task_shared_default'),
      'visibility defaults to shared, so existing behaviour is unchanged');
  });
});

describe('structured handoff', () => {
  it('carries a context pack to whoever picks the task up next', async () => {
    seedTask('task_handoff');
    await claim('task_handoff', 'agent_a');
    await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_handoff', status: 'doing', expect_status: 'claimed',
    });

    const released = parseResult(await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_handoff',
      status: 'open',
      expect_status: 'doing',
      handoff: {
        goal: 'ship session-token auth',
        files: ['src/auth.ts'],
        decisions: ['RS256 chosen for asymmetric verification'],
        open_questions: ['mobile refresh flow'],
      },
    }));
    assert.equal(released.new_status, 'open');

    // The next agent must be able to read the reasoning, not just the title.
    const row = daemon.indexer.db
      .prepare('SELECT handoff FROM tasks WHERE id = ?').get('task_handoff');
    const pack = JSON.parse(row.handoff);
    assert.equal(pack.goal, 'ship session-token auth');
    assert.deepEqual(pack.files, ['src/auth.ts']);
    assert.equal(pack.open_questions.length, 1);
  });

  it('does not attach context when the caller loses the claim race', async () => {
    seedTask('task_handoff_race');
    await claim('task_handoff_race', 'agent_a');
    await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_handoff_race', status: 'doing', expect_status: 'claimed',
    });

    // Both try to release from 'doing'; exactly one wins the CAS.
    const results = await Promise.all([
      callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_handoff_race', status: 'open', expect_status: 'doing',
        handoff: { goal: 'from-agent-b' },
      }).then(parseResult),
      callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_handoff_race', status: 'open', expect_status: 'doing',
        handoff: { goal: 'from-agent-c' },
      }).then(parseResult),
    ]);

    const winners = results.filter((r) => r.new_status === 'open');
    const losers = results.filter((r) => r.status === 'conflict');
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);

    // Exactly one pack may be stored. Both racers wrote to the same column, so a
    // loser that persisted would have clobbered the winner's context.
    const row = daemon.indexer.db
      .prepare('SELECT handoff FROM tasks WHERE id = ?').get('task_handoff_race');
    assert.ok(row.handoff, "the winner's handoff should be stored");
    const stored = JSON.parse(row.handoff);
    assert.ok(
      ['from-agent-b', 'from-agent-c'].includes(stored.goal),
      `stored pack must be one of the two racers', got ${JSON.stringify(stored)}`
    );
  });
});

describe('delivery verification', () => {
  it('lets a second party attest a closed task, and marks it queryable', async () => {
    seedTask('task_delivery');
    await claim('task_delivery', 'builder_agent');
    await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_delivery', status: 'doing', expect_status: 'claimed',
    });
    await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_delivery', status: 'done', expect_status: 'doing',
    });

    // Right after close, nobody has checked it — that is the unverified state.
    let row = daemon.indexer.db
      .prepare('SELECT status, verified_by FROM tasks WHERE id = ?').get('task_delivery');
    assert.equal(row.status, 'done');
    assert.equal(row.verified_by, null, 'a self-declared done must start unverified');

    const res = parseResult(await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_delivery', verified_by: 'reviewer_agent',
    }));
    assert.equal(res.status, 'ok');
    assert.equal(res.verified_by, 'reviewer_agent');
    assert.equal(res.original_status, 'done', 'verification must not move the status');

    row = daemon.indexer.db
      .prepare('SELECT status, verified_by, verified_at FROM tasks WHERE id = ?').get('task_delivery');
    assert.equal(row.status, 'done');
    assert.equal(row.verified_by, 'reviewer_agent');
    assert.ok(row.verified_at, 'verified_at should be stamped');
  });

  it('refuses a second attestation instead of overwriting the first', async () => {
    seedTask('task_double_verify', 'done');
    const first = parseResult(await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_double_verify', verified_by: 'reviewer_a',
    }));
    assert.equal(first.status, 'ok');

    const second = parseResult(await callMcpTool(daemon, 'awareness_record', {
      task_id: 'task_double_verify', verified_by: 'reviewer_b',
    }));
    assert.equal(second.status, 'conflict');
    assert.equal(second.reason, 'already_verified');
    assert.equal(second.verified_by, 'reviewer_a');

    const row = daemon.indexer.db
      .prepare('SELECT verified_by FROM tasks WHERE id = ?').get('task_double_verify');
    assert.equal(row.verified_by, 'reviewer_a', 'the first attestation must stand');
  });
});

describe('lease / TTL reclaim', () => {
  /** Push a task's updated_at into the past, simulating a worker that stopped. */
  function ageTask(id, minutes) {
    const when = new Date(Date.now() - minutes * 60_000).toISOString();
    daemon.indexer.db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(when, id);
  }

  async function runChecks() {
    const { runLifecycleChecks } = await import('../src/core/lifecycle-manager.mjs');
    // Content hints must not match the seeded titles, or auto-resolve would move
    // the task and the assertion would pass for the wrong reason.
    return runLifecycleChecks(daemon.indexer, 'zzz unrelated filler', 'zzz unrelated filler');
  }

  it('reclaims work stranded past the lease, with no env var set (default 60 min)', async () => {
    const saved = process.env.AWARENESS_CLAIM_TTL_MINUTES;
    delete process.env.AWARENESS_CLAIM_TTL_MINUTES;
    try {
      seedTask('task_stranded', 'doing');
      ageTask('task_stranded', 61);

      const res = await runChecks();
      assert.ok(res.reclaimed >= 1, 'a task idle past 60 min should be reclaimed by default');

      const row = readTask('task_stranded');
      assert.equal(row.status, 'open', 'reclaimed work returns to the pool');
      assert.equal(row.agent_role, null, 'the dead worker must not keep ownership');
    } finally {
      if (saved === undefined) delete process.env.AWARENESS_CLAIM_TTL_MINUTES;
      else process.env.AWARENESS_CLAIM_TTL_MINUTES = saved;
    }
  });

  it('leaves a claim that is still within its lease alone', async () => {
    seedTask('task_fresh', 'doing');
    ageTask('task_fresh', 5); // well inside the 60-minute lease

    await runChecks();

    const row = readTask('task_fresh');
    assert.equal(row.status, 'doing', 'a live worker must not lose its task');
  });

  it('can be turned off with AWARENESS_CLAIM_TTL_MINUTES=0', async () => {
    const saved = process.env.AWARENESS_CLAIM_TTL_MINUTES;
    process.env.AWARENESS_CLAIM_TTL_MINUTES = '0';
    try {
      seedTask('task_never_reclaimed', 'doing');
      ageTask('task_never_reclaimed', 10_000);

      await runChecks();

      assert.equal(readTask('task_never_reclaimed').status, 'doing',
        'explicit 0 must keep the old never-reclaim behaviour');
    } finally {
      if (saved === undefined) delete process.env.AWARENESS_CLAIM_TTL_MINUTES;
      else process.env.AWARENESS_CLAIM_TTL_MINUTES = saved;
    }
  });

  it('renewal extends the lease, so a long-running agent keeps its task', async () => {
    seedTask('task_renewed', 'doing');
    ageTask('task_renewed', 59); // one minute short of expiry

    // What a live agent does to stay alive: repeat the guarded transition.
    const renewed = parseResult(
      await callMcpTool(daemon, 'awareness_record', {
        task_id: 'task_renewed', status: 'doing', expect_status: 'doing',
      })
    );
    assert.equal(renewed.new_status, 'doing');

    // Age the *lease clock* again but not past the renewed window is not
    // expressible directly, so assert the mechanism instead: updated_at moved.
    const row = daemon.indexer.db
      .prepare('SELECT updated_at FROM tasks WHERE id = ?')
      .get('task_renewed');
    const ageMinutes = (Date.now() - new Date(row.updated_at).getTime()) / 60_000;
    assert.ok(ageMinutes < 1, `renewal should refresh updated_at (age was ${ageMinutes.toFixed(2)} min)`);

    await runChecks();
    assert.equal(readTask('task_renewed').status, 'doing', 'a renewed claim survives the sweep');
  });
});
