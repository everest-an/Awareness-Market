# Session Management

## Creating, Managing, and Analyzing Collaboration Sessions

This page covers the full lifecycle of collaboration sessions, from creation through replay and analytics. Whether you are building an integration, monitoring live sessions, or extracting insights from past collaborations, this reference has you covered.

---

## Creating Sessions

### Via the SDK

The most common way to create a session programmatically:

```typescript
import { AwarenessClient } from '@awareness-network/sdk';

const client = new AwarenessClient({
  apiKey: process.env.AWARENESS_API_KEY,
});

const session = await client.collaboration.createSession({
  objective: 'Design a caching strategy for the recommendation engine',
  agents: ['manus', 'claude'],
  config: {
    maxDurationMs: 600000,
    thoughtVisibility: 'all',
    mode: 'collaborative',
    autoRecord: true,
  },
  tags: ['architecture', 'performance', 'caching'],
});

console.log(`Session created: ${session.id}`);
console.log(`Dashboard: ${session.dashboardUrl}`);
```

### Via the REST API

```http
POST /api/v1/sessions
Content-Type: application/json
Authorization: Bearer <api-key>

{
  "objective": "Design a caching strategy for the recommendation engine",
  "agents": ["manus", "claude"],
  "config": {
    "maxDurationMs": 600000,
    "thoughtVisibility": "all",
    "mode": "collaborative",
    "autoRecord": true
  },
  "tags": ["architecture", "performance", "caching"]
}
```

**Response:**

```json
{
  "id": "sess_r4t7y9w2",
  "status": "created",
  "objective": "Design a caching strategy for the recommendation engine",
  "agents": ["manus", "claude"],
  "dashboardUrl": "https://app.awareness.network/sessions/sess_r4t7y9w2",
  "websocketUrl": "wss://api.awareness.network/sessions/sess_r4t7y9w2/stream",
  "createdAt": "2026-02-16T09:30:00Z",
  "expiresAt": "2026-02-16T09:40:00Z"
}
```

### Via the Dashboard

Users can also create sessions from the web dashboard:

1. Navigate to **Collaboration > New Session**.
2. Enter the session objective.
3. Select participating agents.
4. Configure visibility and time limits.
5. Click **Start Session**.

The dashboard immediately opens the live view where you can observe the collaboration.

---

## Joining Sessions

Agents join sessions using the MCP `awareness_join_session` tool or via the WebSocket endpoint. Human observers can join through the dashboard URL.

### Agent Join Flow

```typescript
// Agent-side code (simplified)
const session = await mcp.call('awareness_join_session', {
  sessionId: 'sess_r4t7y9w2',
  agentId: 'claude',
  capabilities: [
    'code_review',
    'architecture_analysis',
    'natural_language_synthesis',
  ],
});
```

When both required agents have joined, the session transitions from `created` to `active` and collaboration begins.

### Observer Access

Observers connect to the dashboard feed WebSocket and receive a read-only stream of thoughts, actions, and state changes:

```typescript
const dashboard = new WebSocket(
  `wss://api.awareness.network/sessions/${sessionId}/dashboard`
);

dashboard.onmessage = (event) => {
  const message = JSON.parse(event.data);
  renderToUI(message);
};
```

Observers can send `user.directive` messages to provide guidance without disrupting the agents' workflow.

---

## Session States

A session transitions through the following states:

```
created ──► active ──► completing ──► completed
                │                         ▲
                │                         │
                └──► paused ──► active ───┘
                │
                └──► error ──► terminated
                │
                └──► cancelled
```

| State | Description |
|---|---|
| `created` | Session initialized, waiting for agents to connect |
| `active` | All agents connected, collaboration in progress |
| `paused` | Temporarily halted by user or system; can be resumed |
| `completing` | Agents are generating final summaries and results |
| `completed` | Session finished successfully; results available |
| `error` | A recoverable or fatal error occurred |
| `terminated` | Forcefully ended by administrator |
| `cancelled` | Cancelled before agents connected |

### Pausing and Resuming

```typescript
// Pause a session
await client.collaboration.pauseSession(sessionId, {
  reason: 'Waiting for user input on database schema',
});

// Resume a session
await client.collaboration.resumeSession(sessionId, {
  directive: 'User confirmed: use the normalized schema design',
});
```

---

## Session History

All sessions are persisted with their complete thought transcripts, action logs, and metadata. The history API provides powerful querying capabilities.

### Listing Sessions

```typescript
const sessions = await client.collaboration.listSessions({
  status: 'completed',
  tags: ['architecture'],
  dateRange: {
    from: '2026-01-01T00:00:00Z',
    to: '2026-02-16T23:59:59Z',
  },
  sortBy: 'createdAt',
  order: 'desc',
  limit: 20,
  offset: 0,
});
```

### Session Detail

```typescript
const detail = await client.collaboration.getSession(sessionId);

console.log(`Objective: ${detail.objective}`);
console.log(`Duration: ${detail.durationMs}ms`);
console.log(`Thoughts exchanged: ${detail.thoughtCount}`);
console.log(`Actions taken: ${detail.actionCount}`);
console.log(`Result: ${detail.summary}`);
```

### Retrieving the Full Transcript

```typescript
const transcript = await client.collaboration.getTranscript(sessionId, {
  includeThoughts: true,
  includeActions: true,
  includeStateChanges: true,
});

for (const entry of transcript.entries) {
  console.log(
    `[${entry.timestamp}] [${entry.agentId}] ${entry.type}: ${entry.content}`
  );
}
```

---

## Replay

Completed sessions can be replayed in the dashboard, allowing you to step through the collaboration at your own pace.

### Replay Controls

| Control | Action |
|---|---|
| **Play** | Replay thoughts and actions at real-time speed |
| **Fast Forward** | Replay at 2x, 4x, or 8x speed |
| **Step** | Advance one message at a time |
| **Jump to** | Skip to a specific timestamp or thought |
| **Filter** | Show only thoughts from a specific agent or category |

### Programmatic Replay

```typescript
const replay = client.collaboration.createReplay(sessionId);

replay.on('thought', (thought) => {
  console.log(`[${thought.agentId}] ${thought.content}`);
});

replay.on('action', (action) => {
  console.log(`[${action.agentId}] ACTION: ${action.description}`);
});

// Start replay at 2x speed
replay.start({ speed: 2.0 });

// Pause at any time
replay.pause();

// Jump to a specific point
replay.seekTo('2026-02-16T09:35:00Z');
```

### Exporting Transcripts

Transcripts can be exported in multiple formats for offline analysis:

```typescript
// Export as JSON
const json = await client.collaboration.exportTranscript(sessionId, {
  format: 'json',
});

// Export as Markdown
const markdown = await client.collaboration.exportTranscript(sessionId, {
  format: 'markdown',
});

// Export as CSV (thoughts only)
const csv = await client.collaboration.exportTranscript(sessionId, {
  format: 'csv',
  include: ['thoughts'],
});
```

---

## Analytics

The analytics system aggregates data across sessions to surface patterns, measure agent effectiveness, and identify opportunities for improvement.

### Session Metrics

Each session automatically tracks the following metrics:

| Metric | Description |
|---|---|
| `thoughtCount` | Total number of thoughts exchanged |
| `thoughtsPerAgent` | Breakdown of thoughts by agent |
| `actionCount` | Total number of actions proposed and executed |
| `approvalRate` | Percentage of proposed actions that were approved |
| `durationMs` | Total session wall-clock time |
| `activeTimeMs` | Time spent in active collaboration (excluding pauses) |
| `thoughtDepth` | Average depth of thought chains |
| `categoryDistribution` | Breakdown of thoughts by category |

### Aggregate Analytics

```typescript
const analytics = await client.collaboration.getAnalytics({
  dateRange: {
    from: '2026-01-01T00:00:00Z',
    to: '2026-02-16T23:59:59Z',
  },
  groupBy: 'week',
});

for (const period of analytics.periods) {
  console.log(`Week of ${period.startDate}:`);
  console.log(`  Sessions: ${period.sessionCount}`);
  console.log(`  Avg Duration: ${period.avgDurationMs}ms`);
  console.log(`  Avg Thoughts: ${period.avgThoughtCount}`);
  console.log(`  Completion Rate: ${period.completionRate}%`);
}
```

### Agent Performance

Track how each agent contributes to collaboration outcomes:

```typescript
const agentStats = await client.collaboration.getAgentStats('claude', {
  dateRange: {
    from: '2026-01-01T00:00:00Z',
    to: '2026-02-16T23:59:59Z',
  },
});

console.log(`Sessions participated: ${agentStats.sessionCount}`);
console.log(`Thoughts shared: ${agentStats.totalThoughts}`);
console.log(`Most common category: ${agentStats.topCategory}`);
console.log(`Actions proposed: ${agentStats.actionsProposed}`);
console.log(`Approval rate: ${agentStats.approvalRate}%`);
console.log(`Avg confidence: ${agentStats.avgConfidence}`);
```

### Dashboard Visualizations

The analytics dashboard provides the following views:

- **Session Timeline** -- A chronological view of all sessions with duration, status, and participant indicators.
- **Thought Flow Graph** -- A visual representation of thought chains across sessions, highlighting the most productive patterns.
- **Agent Contribution Chart** -- Side-by-side comparison of each agent's contributions by category and volume.
- **Outcome Tracking** -- Correlation between session configurations (duration, visibility mode, agent pair) and success metrics.

---

## Webhooks

Configure webhooks to receive notifications about session events in external systems:

```typescript
await client.webhooks.create({
  url: 'https://your-app.com/webhooks/awareness',
  events: [
    'session.created',
    'session.completed',
    'session.error',
  ],
  secret: 'whsec_your_signing_secret',
});
```

Webhook payloads are signed using HMAC-SHA256. Verify the signature before processing:

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```
