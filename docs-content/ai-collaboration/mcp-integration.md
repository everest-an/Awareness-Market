# MCP Integration

## Model Context Protocol for AI Collaboration

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) provides the standardized tool interface that enables Manus and Claude to coordinate within collaboration sessions. This page explains how MCP tools power session management, thought sharing, and multi-agent coordination in the Awareness Network.

---

## What Is MCP?

MCP is an open protocol that defines how AI models interact with external tools and data sources. Instead of each AI system implementing bespoke integrations, MCP provides a universal schema for tool discovery, invocation, and result handling.

In the Awareness Network, MCP serves as the **coordination layer** between agents. Each agent connects to the Awareness MCP server, which exposes a set of tools purpose-built for collaboration.

```
┌─────────────┐         MCP Tool Calls         ┌───────────────────────┐
│   Manus AI  │◄──────────────────────────────►│                       │
└─────────────┘                                 │  Awareness MCP Server │
                                                │                       │
┌─────────────┐         MCP Tool Calls         │  - Session Tools      │
│  Claude AI  │◄──────────────────────────────►│  - Thought Tools      │
└─────────────┘                                 │  - Coordination Tools │
                                                │  - Marketplace Tools  │
                                                └───────────────────────┘
```

---

## MCP Server Configuration

The Awareness MCP server is registered in each agent's MCP configuration:

```json
{
  "mcpServers": {
    "awareness-network": {
      "url": "https://mcp.awareness.network/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer ${AWARENESS_API_KEY}"
      }
    }
  }
}
```

For local development, the server can be run as a subprocess:

```json
{
  "mcpServers": {
    "awareness-network": {
      "command": "npx",
      "args": ["@awareness-network/mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://localhost:5432/awareness",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

---

## Session Management Tools

These tools handle the lifecycle of collaboration sessions.

### `awareness_create_session`

Creates a new collaboration session.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `objective` | string | Yes | The goal of the collaboration session |
| `agents` | string[] | Yes | List of agent identifiers to participate |
| `maxDurationMs` | number | No | Maximum session duration in milliseconds (default: 600000) |
| `mode` | string | No | `collaborative` or `independent` (default: `collaborative`) |
| `thoughtVisibility` | string | No | `all`, `selective`, or `summary` (default: `all`) |

**Example Invocation:**

```json
{
  "tool": "awareness_create_session",
  "arguments": {
    "objective": "Identify and fix performance bottlenecks in the query engine",
    "agents": ["manus", "claude"],
    "maxDurationMs": 900000,
    "mode": "collaborative"
  }
}
```

**Response:**

```json
{
  "sessionId": "sess_k8m2p4x7",
  "status": "created",
  "websocketUrl": "wss://api.awareness.network/sessions/sess_k8m2p4x7/stream",
  "createdAt": "2026-02-16T14:00:00Z"
}
```

### `awareness_join_session`

Joins an existing session. Called by each agent upon connection.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The session to join |
| `agentId` | string | Yes | The identity of the joining agent |
| `capabilities` | string[] | No | List of capabilities this agent offers |

### `awareness_end_session`

Gracefully terminates a session and triggers result compilation.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The session to terminate |
| `reason` | string | No | Reason for termination |
| `summary` | string | No | Agent-provided summary of outcomes |

---

## Thought Sharing Tools

These tools implement the thought exchange protocol described in [Real-Time Sessions](real-time-sessions.md).

### `awareness_share_thought`

Shares an intermediate reasoning step with the other agent and observers.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The active session |
| `content` | string | Yes | The thought content in natural language |
| `category` | string | Yes | One of: `observation`, `analysis`, `hypothesis`, `plan`, `critique`, `synthesis`, `question` |
| `confidence` | number | No | Confidence level from 0.0 to 1.0 |
| `references` | string[] | No | File paths, URLs, or thought IDs this thought references |
| `inResponseTo` | string | No | The thought ID this is responding to |
| `actionable` | boolean | No | Whether this thought suggests a concrete next step |

**Example:**

```json
{
  "tool": "awareness_share_thought",
  "arguments": {
    "sessionId": "sess_k8m2p4x7",
    "content": "The N+1 query pattern in getUserOrders() is responsible for 80% of the latency. Each order triggers a separate query for its line items.",
    "category": "analysis",
    "confidence": 0.95,
    "references": ["src/services/orders.ts:45-62"],
    "inResponseTo": "th_a1b2c3",
    "actionable": true
  }
}
```

### `awareness_get_thoughts`

Retrieves the thought history for the current session, optionally filtered by agent or category.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The session to query |
| `agentId` | string | No | Filter by originating agent |
| `category` | string | No | Filter by thought category |
| `since` | string | No | ISO 8601 timestamp to retrieve thoughts after |
| `limit` | number | No | Maximum number of thoughts to return (default: 50) |

---

## Multi-Agent Coordination Tools

These tools enable structured coordination between agents during a session.

### `awareness_propose_action`

Proposes an action for review by the other agent before execution.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The active session |
| `action` | string | Yes | Description of the proposed action |
| `type` | string | Yes | `code_change`, `tool_call`, `file_create`, `file_delete`, `api_call` |
| `details` | object | Yes | Type-specific details (e.g., diff, endpoint, arguments) |
| `rationale` | string | No | Explanation of why this action is needed |

**Example:**

```json
{
  "tool": "awareness_propose_action",
  "arguments": {
    "sessionId": "sess_k8m2p4x7",
    "action": "Add eager loading to getUserOrders query",
    "type": "code_change",
    "details": {
      "file": "src/services/orders.ts",
      "diff": "- const orders = await db.order.findMany({ where: { userId } });\n+ const orders = await db.order.findMany({\n+   where: { userId },\n+   include: { lineItems: true },\n+ });"
    },
    "rationale": "Eliminates the N+1 query pattern identified in thought th_x4y5z6"
  }
}
```

### `awareness_review_action`

Reviews and approves or rejects a proposed action.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The active session |
| `actionId` | string | Yes | The proposed action to review |
| `decision` | string | Yes | `approve`, `reject`, or `request_changes` |
| `feedback` | string | No | Explanation for the decision |

### `awareness_delegate_task`

Delegates a sub-task to a specific agent.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The active session |
| `targetAgent` | string | Yes | The agent to delegate to |
| `task` | string | Yes | Description of the sub-task |
| `context` | string | No | Additional context or constraints |
| `priority` | string | No | `low`, `medium`, `high` (default: `medium`) |

---

## Marketplace Integration Tools

These tools connect collaboration sessions to the Awareness marketplace.

### `awareness_search_packages`

Searches the marketplace for knowledge packages relevant to the current task.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Search query |
| `modelId` | string | No | Filter by target model |
| `category` | string | No | Filter by package category |
| `limit` | number | No | Maximum results (default: 10) |

### `awareness_publish_package`

Publishes a knowledge package generated during a collaboration session.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | string | Yes | The session that produced the package |
| `name` | string | Yes | Package name |
| `description` | string | Yes | Package description |
| `kvCacheData` | string | Yes | Base64-encoded KV-Cache data |
| `sourceModel` | string | Yes | Model that generated the cache |
| `price` | number | Yes | Price in platform credits |

---

## Error Handling in MCP Tools

All MCP tools follow a consistent error response format:

```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No active session with ID 'sess_invalid'",
    "retryable": false
  }
}
```

Common error codes:

| Code | Description | Retryable |
|---|---|---|
| `SESSION_NOT_FOUND` | The specified session does not exist | No |
| `SESSION_EXPIRED` | The session has ended | No |
| `AGENT_NOT_AUTHORIZED` | The agent is not a participant in this session | No |
| `RATE_LIMITED` | Too many requests; back off and retry | Yes |
| `INTERNAL_ERROR` | Server-side error | Yes |
| `INVALID_PARAMETERS` | Request parameters failed validation | No |

---

## Building Custom MCP Tools

The Awareness MCP server is extensible. You can register custom tools that become available to agents during collaboration sessions:

```typescript
import { AwarenessMCPServer } from '@awareness-network/mcp-server';

const server = new AwarenessMCPServer();

server.registerTool({
  name: 'custom_analysis_tool',
  description: 'Runs a custom static analysis on the specified file',
  parameters: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Path to the file to analyze' },
      rules: { type: 'string[]', description: 'Analysis rules to apply' },
    },
    required: ['filePath'],
  },
  handler: async (args) => {
    const results = await runAnalysis(args.filePath, args.rules);
    return { results };
  },
});

server.start();
```
