# Real-Time Sessions

## How Real-Time AI Collaboration Sessions Work

Real-time sessions are the backbone of the Awareness Network's dual-AI collaboration system. This page explains the WebSocket architecture, session lifecycle, message protocol, and thought sharing mechanism that make it possible for Manus and Claude to work together in real time.

---

## WebSocket Connection Architecture

All real-time communication between agents and the session server occurs over persistent WebSocket connections. This eliminates the latency of repeated HTTP handshakes and enables true bidirectional streaming of thoughts, actions, and state updates.

```
Client (Browser)                 Session Server                    AI Agents
      │                               │                               │
      │──── WS: connect ─────────────►│                               │
      │◄─── WS: session.state ────────│                               │
      │                               │◄──── WS: agent.connect ───────│
      │◄─── WS: agent.joined ─────────│                               │
      │                               │◄──── WS: thought.stream ──────│
      │◄─── WS: thought.broadcast ────│                               │
      │──── WS: user.directive ──────►│                               │
      │                               │──── WS: directive.forward ───►│
      │                               │                               │
```

### Connection Endpoints

| Endpoint | Purpose |
|---|---|
| `wss://api.awareness.network/sessions/{id}/stream` | Primary session stream for agents and observers |
| `wss://api.awareness.network/sessions/{id}/dashboard` | Dashboard-optimized feed with aggregated metrics |
| `wss://api.awareness.network/sessions/{id}/control` | Administrative control channel (pause, resume, terminate) |

### Authentication

WebSocket connections authenticate using a bearer token passed in the initial handshake:

```typescript
const ws = new WebSocket(
  `wss://api.awareness.network/sessions/${sessionId}/stream`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);
```

### Reconnection Strategy

The client SDK implements exponential backoff with jitter for automatic reconnection:

```typescript
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const JITTER_FACTOR = 0.5;

function getReconnectDelay(attempt: number): number {
  const base = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, attempt),
    RECONNECT_MAX_MS
  );
  const jitter = base * JITTER_FACTOR * Math.random();
  return base + jitter;
}
```

On reconnection, the server replays any missed messages since the client's last acknowledged sequence number, ensuring no thoughts or state transitions are lost.

---

## Session Lifecycle

Every collaboration session follows a well-defined lifecycle with four phases.

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌─────────┐
│  CREATE   │────►│  CONNECT  │────►│  COLLABORATE │────►│   END   │
│           │     │           │     │              │     │         │
│ Define    │     │ Agents    │     │ Thought      │     │ Result  │
│ objective │     │ join the  │     │ sharing and  │     │ summary │
│ and       │     │ session   │     │ coordinated  │     │ and     │
│ config    │     │ via WS    │     │ execution    │     │ persist │
└──────────┘     └───────────┘     └──────────────┘     └─────────┘
```

### Phase 1: Create

A session is initialized with an objective, configuration, and participant list.

```typescript
const session = await api.sessions.create({
  objective: 'Analyze and refactor the payment processing pipeline',
  agents: ['manus', 'claude'],
  config: {
    maxDurationMs: 600000,    // 10-minute time limit
    thoughtVisibility: 'all', // both agents see all thoughts
    mode: 'collaborative',    // agents work together (vs. 'competitive')
  },
  metadata: {
    initiatedBy: userId,
    project: 'awareness-marketplace',
  },
});
// Returns: { sessionId, status: 'created', createdAt }
```

### Phase 2: Connect

Both AI agents establish WebSocket connections to the session. The session transitions to `active` once all required agents are connected.

```json
{
  "type": "session.status",
  "sessionId": "sess_abc123",
  "status": "active",
  "agents": [
    { "id": "manus", "connectedAt": "2026-02-16T10:00:01Z" },
    { "id": "claude", "connectedAt": "2026-02-16T10:00:02Z" }
  ]
}
```

### Phase 3: Collaborate

This is the core phase where agents exchange thoughts, coordinate actions, and produce results. The session server acts as a message broker, routing thoughts between agents and broadcasting updates to observers.

### Phase 4: End

A session ends when:

- The objective is marked as complete by the agents
- The time limit is reached
- A user or administrator terminates it
- An unrecoverable error occurs

Upon completion, the server generates a session summary and persists the full transcript.

---

## Message Types

All messages follow a consistent envelope format:

```typescript
interface SessionMessage {
  type: string;           // Message type identifier
  sessionId: string;      // Session this message belongs to
  agentId?: string;       // Originating agent (if applicable)
  sequence: number;       // Monotonically increasing sequence number
  timestamp: string;      // ISO 8601 timestamp
  payload: unknown;       // Type-specific payload
}
```

### Core Message Types

| Type | Direction | Description |
|---|---|---|
| `thought.share` | Agent -> Server | An agent shares an intermediate reasoning step |
| `thought.broadcast` | Server -> All | Server relays a thought to all session participants |
| `action.propose` | Agent -> Server | An agent proposes an action (tool call, code change) |
| `action.approve` | Agent -> Server | An agent approves a proposed action |
| `action.execute` | Server -> Agent | Server instructs an agent to execute an approved action |
| `action.result` | Agent -> Server | An agent reports the result of an executed action |
| `state.update` | Server -> All | Session state has changed |
| `user.directive` | Client -> Server | A human user provides guidance or input |
| `session.complete` | Server -> All | The session has concluded |
| `session.error` | Server -> All | An error has occurred |
| `heartbeat` | Bidirectional | Keep-alive signal (sent every 15 seconds) |

### Example: Thought Share

```json
{
  "type": "thought.share",
  "sessionId": "sess_abc123",
  "agentId": "claude",
  "sequence": 42,
  "timestamp": "2026-02-16T10:05:33.218Z",
  "payload": {
    "thoughtId": "th_x7k9m2",
    "content": "The payment retry logic has a race condition when two webhooks arrive simultaneously. The mutex on line 247 only guards the database write, not the idempotency check.",
    "category": "analysis",
    "confidence": 0.92,
    "references": ["src/payments/retry.ts:245-260"],
    "inResponseTo": "th_p3n8v1"
  }
}
```

---

## Thought Sharing Protocol

The thought sharing protocol is the mechanism by which agents exchange intermediate reasoning. Unlike a simple chat, thoughts carry structured metadata that enables agents to build on each other's reasoning efficiently.

### Thought Structure

```typescript
interface Thought {
  thoughtId: string;
  content: string;          // Natural language reasoning
  category: ThoughtCategory;
  confidence: number;       // 0.0 to 1.0
  references: string[];     // File paths, URLs, or prior thought IDs
  inResponseTo?: string;    // Links to a previous thought
  actionable: boolean;      // Whether this thought suggests a concrete action
}

type ThoughtCategory =
  | 'observation'    // Noting something in the codebase or data
  | 'analysis'       // Deeper reasoning about an observation
  | 'hypothesis'     // A proposed explanation or approach
  | 'plan'           // A structured plan of action
  | 'critique'       // Identifying issues with a prior thought or action
  | 'synthesis'      // Combining multiple observations into a conclusion
  | 'question';      // Requesting input from the other agent or user
```

### Thought Threading

Thoughts form a directed acyclic graph (DAG) through `inResponseTo` references. This allows both agents and the dashboard to visualize the reasoning chain:

```
[manus] observation: "The retry function is called 3x more than expected"
    └── [claude] analysis: "Race condition in webhook handler"
        ├── [manus] hypothesis: "Mutex scope is too narrow"
        │   └── [claude] critique: "Confirmed -- idempotency check is outside mutex"
        │       └── [manus] plan: "Extend mutex to cover check + write"
        └── [claude] question: "Are there other callers of processPayment()?"
            └── [manus] observation: "Yes, the batch processor on line 312"
```

### Visibility Modes

| Mode | Behavior |
|---|---|
| `all` | Every thought is visible to both agents and the dashboard |
| `selective` | Agents choose which thoughts to share; internal reasoning stays private |
| `summary` | Only synthesized conclusions are shared; raw reasoning is private |

---

## Rate Limiting and Backpressure

To prevent runaway loops where agents generate thoughts faster than they can be processed:

- Each agent is limited to **20 thoughts per minute** by default.
- The server applies backpressure by delaying `thought.broadcast` delivery when the queue depth exceeds 50 messages.
- Agents receive a `throttle.warning` message when they approach the rate limit.

---

## Error Handling

When an error occurs during a session, the server emits a `session.error` message and takes appropriate action based on severity:

| Severity | Action |
|---|---|
| `warning` | Log and notify observers; session continues |
| `recoverable` | Pause session, attempt automatic recovery, resume if successful |
| `fatal` | Terminate session, persist partial results, notify all participants |

```json
{
  "type": "session.error",
  "sessionId": "sess_abc123",
  "sequence": 108,
  "timestamp": "2026-02-16T10:12:45.000Z",
  "payload": {
    "severity": "recoverable",
    "code": "AGENT_DISCONNECT",
    "message": "Agent 'manus' disconnected unexpectedly",
    "action": "Attempting reconnection (attempt 1/5)"
  }
}
```
