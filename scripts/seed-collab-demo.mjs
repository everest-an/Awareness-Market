/**
 * Seeds the local daemon with a coherent multi-agent scenario through the real
 * MCP surface, so the task/memory relationships that visualisation needs actually
 * exist as data rather than as drawn-in lines.
 *
 * Usage: node scripts/seed-collab-demo.mjs [--port 37800]
 *
 * What it produces, per task: an open task, a claim by one agent, work plus a
 * handoff carrying a context pack, a claim by a second agent, completion, and an
 * attestation by a third. Every step also records memory under that agent's role,
 * which is what makes "who touched what" answerable later.
 */

const PORT = (() => {
  const i = process.argv.indexOf('--port');
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : 37800;
})();
const BASE = `http://localhost:${PORT}/mcp`;

let id = 1;
async function call(name, args) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name, arguments: args } }),
  });
  const json = await res.json();
  const text = json.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : json;
}

const AGENTS = [
  'cursor:builder',
  'claude-code:builder',
  'codex:reviewer',
  'opencode:integrator',
];

const WORK = [
  { title: 't-201: session-token migration', goal: 'replace JWT with session tokens', files: ['src/auth.ts', 'src/session.ts'], decisions: ['RS256 over HS256 for asymmetric verification'], open: ['mobile refresh flow'] },
  { title: 't-202: rate limit the public API', goal: 'add per-IP token bucket', files: ['src/middleware/limit.ts'], decisions: ['in-memory bucket, upstream limiter later'], open: ['distributed mode'] },
  { title: 't-203: memory retention policy', goal: 'define TTL for stale cards', files: ['src/memory/retention.ts'], decisions: ['decay by access, not by age alone'], open: ['backfill for existing rows'] },
  { title: 't-204: workspace isolation audit', goal: 'prove no cross-project reads', files: ['src/memory/scope.ts'], decisions: ['scope from git remote, not cwd'], open: ['monorepo edge case'] },
  { title: 't-205: handoff context pack', goal: 'structured handover', files: ['src/agents/handoff.ts'], decisions: ['reuse Context Pack v2 shape'], open: ['compression for large packs'] },
  { title: 't-206: lease reclaim', goal: 'return stranded work', files: ['src/agents/lease.ts'], decisions: ['60 min default, opt-out via env'], open: ['renewal cadence guidance'] },
  { title: 't-207: attestation flow', goal: 'second-party sign-off', files: ['src/agents/verify.ts'], decisions: ['first verifier wins, no overwrite'], open: ['who may attest'] },
  { title: 't-208: dispatch scoring', goal: 'explainable agent choice', files: ['src/agents/dispatch.ts'], decisions: ['overlap*2 + idle - load'], open: ['cold start weighting'] },
  { title: 't-209: presence heartbeat', goal: 'idle vs busy', files: ['src/agents/presence.ts'], decisions: ['derive from in-flight count'], open: ['stale presence timeout'] },
  { title: 't-210: cross-IDE memory read', goal: 'same brain from two editors', files: ['src/mcp/server.ts'], decisions: ['single daemon, no per-IDE store'], open: ['concurrent write ordering'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const health = await fetch(`http://localhost:${PORT}/healthz`).then((r) => r.json()).catch(() => null);
  if (!health) {
    console.error(`daemon not reachable on :${PORT}`);
    process.exit(1);
  }
  console.log(`daemon v${health.version} · ${health.stats.totalTasks} tasks before seeding\n`);

  const created = await call('awareness_record', {
    content: `Sprint: ${WORK.length} units of work queued across ${AGENTS.length} agents, each handed off at least once.`,
    insights: {
      action_items: WORK.map((w) => ({ title: w.title, priority: 'high', status: 'open' })),
    },
  });
  console.log('tasks created:', created.status || created.error);

  const board = await call('awareness_lookup', { type: 'tasks', status: 'open' });
  const byTitle = new Map((board.tasks || []).map((t) => [t.title, t]));

  let done = 0;
  for (let i = 0; i < WORK.length; i++) {
    const w = WORK[i];
    const task = byTitle.get(w.title);
    if (!task) { console.log('  skip (not found):', w.title); continue; }

    const first = AGENTS[i % AGENTS.length];
    const second = AGENTS[(i + 1) % AGENTS.length];
    const reviewer = AGENTS[(i + 2) % AGENTS.length];

    const claim = await call('awareness_record', {
      task_id: task.id, status: 'claimed', expect_status: 'open', agent_role: first,
    });
    if (!claim.claimed) { console.log('  claim lost:', w.title); continue; }

    await call('awareness_record', {
      task_id: task.id, status: 'doing', expect_status: 'claimed', agent_role: first,
    });
    await call('awareness_record', {
      content: `${first} started ${w.title}: ${w.goal}. Files: ${w.files.join(', ')}.`,
      agent_role: first,
    });

    await call('awareness_record', {
      task_id: task.id, status: 'open', expect_status: 'doing', agent_role: first,
      handoff: { goal: w.goal, files: w.files, decisions: w.decisions, open_questions: w.open },
    });

    const take = await call('awareness_record', {
      task_id: task.id, status: 'claimed', expect_status: 'open', agent_role: second,
    });
    if (take.claimed) {
      await call('awareness_record', {
        task_id: task.id, status: 'doing', expect_status: 'claimed', agent_role: second,
      });
      await call('awareness_record', {
        content: `${second} picked up ${w.title} from the handoff. Decision: ${w.decisions[0]}.`,
        agent_role: second,
      });
      await call('awareness_record', {
        task_id: task.id, status: 'done', expect_status: 'doing', agent_role: second,
      });
      const v = await call('awareness_record', { task_id: task.id, verified_by: reviewer });
      if (v.status === 'ok') done++;
    }
    await sleep(20);
  }

  const after = await call('awareness_lookup', { type: 'tasks' });
  const counts = {};
  for (const t of after.tasks || []) counts[t.status] = (counts[t.status] || 0) + 1;
  console.log('\nverified:', done, '/', WORK.length);
  console.log('status distribution:', counts);
}

main().catch((e) => { console.error(e); process.exit(1); });
