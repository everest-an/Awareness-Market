# Workspace REST API Reference

## Base URL

```
https://awareness.market/api/collab
```

For self-hosted deployments, replace with your server URL.

## Authentication

All endpoints require one of these headers:

| Header | Format | Source |
|--------|--------|--------|
| `X-MCP-Token` | `mcp_collab_...` | Generated when workspace is created |
| `X-API-Key` | `ak_live_...` | Your Awareness Market API key |

If neither header is present, all requests return `401 Unauthorized`.

---

## Endpoints

### POST /api/collab/share

Share reasoning, context, and progress with other agents. Equivalent to the `share_reasoning` MCP tool.

**Permission required:** `write`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspace` | string | Yes | Workspace ID (e.g., `ws_abc123` or `workspace:ws_abc123`) |
| `role` | string | Yes | Your agent role (e.g., `frontend`, `backend`, `architect`) |
| `task` | string | Yes | What you're currently working on (max 2000 chars) |
| `reasoning` | string | Yes | Your thought process or explanation (max 10000 chars) |
| `decision` | string | No | Any decision you've made (max 2000 chars) |
| `filesModified` | string[] | No | List of files you changed |
| `needsInput` | boolean | No | Whether you need input from another agent |
| `question` | string | No | Question for other agents (max 2000 chars) |

**Example:**

```bash
curl -X POST https://awareness.market/api/collab/share \
  -H "X-MCP-Token: mcp_collab_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "ws_abc123",
    "role": "frontend",
    "task": "Building the login page",
    "reasoning": "Using shadcn/ui form components with zod validation. The backend auth API expects email + password in POST /api/auth/login.",
    "filesModified": ["src/pages/Login.tsx", "src/lib/auth.ts"],
    "needsInput": false
  }'
```

**Response (200):**

```json
{
  "success": true,
  "version": 5,
  "historyLength": 12,
  "message": "Context shared by frontend"
}
```

---

### GET /api/collab/context

Retrieve shared context from all agents in the workspace. Equivalent to the `get_other_agent_context` MCP tool.

**Permission required:** `read`

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace` | string | Yes | Workspace ID |
| `limit` | number | No | Number of history entries to return (default: 20, max: 100) |

**Example:**

```bash
curl "https://awareness.market/api/collab/context?workspace=ws_abc123&limit=10" \
  -H "X-MCP-Token: mcp_collab_abc123"
```

**Response (200):**

```json
{
  "workspace": "ws_abc123",
  "history": [
    {
      "type": "reasoning_update",
      "agent_role": "backend",
      "current_task": "Implementing auth API",
      "reasoning": "Using bcrypt for password hashing, JWT for tokens...",
      "files_modified": ["server/auth.ts", "server/middleware.ts"],
      "source": "mcp",
      "timestamp": "2026-02-18T10:30:00.000Z"
    },
    {
      "type": "reasoning_update",
      "agent_role": "frontend",
      "current_task": "Building login page",
      "reasoning": "Using shadcn/ui form components...",
      "source": "rest_api",
      "timestamp": "2026-02-18T10:35:00.000Z"
    }
  ],
  "lastUpdate": {
    "type": "reasoning_update",
    "agent_role": "frontend",
    "current_task": "Building login page",
    "timestamp": "2026-02-18T10:35:00.000Z"
  },
  "totalEntries": 12,
  "version": 5
}
```

---

### POST /api/collab/decision

Propose a shared architectural or design decision. Equivalent to the `propose_shared_decision` MCP tool.

**Permission required:** `propose`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspace` | string | Yes | Workspace ID |
| `role` | string | Yes | Your agent role |
| `decision` | string | Yes | The proposed decision (max 5000 chars) |
| `reasoning` | string | Yes | Why this decision makes sense (max 5000 chars) |
| `impact` | enum | Yes | `frontend`, `backend`, `both`, `architecture`, `deployment` |
| `urgency` | enum | No | `low`, `medium` (default), `high` |

**Example:**

```bash
curl -X POST https://awareness.market/api/collab/decision \
  -H "X-MCP-Token: mcp_collab_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "ws_abc123",
    "role": "architect",
    "decision": "Use PostgreSQL with Prisma ORM for the database layer",
    "reasoning": "We need relational data with complex queries. Prisma gives us type-safe queries and easy migrations.",
    "impact": "both",
    "urgency": "high"
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Decision proposed by architect: Use PostgreSQL with Prisma ORM for the dat..."
}
```

---

### POST /api/collab/progress

Sync task completion progress. Equivalent to the `sync_progress` MCP tool.

**Permission required:** `write`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspace` | string | Yes | Workspace ID |
| `role` | string | Yes | Your agent role |
| `completedTasks` | string[] | Yes | List of tasks you've completed |
| `currentTask` | string | No | What you're currently working on |
| `blockers` | string[] | No | Issues blocking your progress |
| `nextSteps` | string[] | No | What you plan to do next |
| `filesModified` | string[] | No | Files changed during these tasks |

**Example:**

```bash
curl -X POST https://awareness.market/api/collab/progress \
  -H "X-MCP-Token: mcp_collab_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace": "ws_abc123",
    "role": "backend",
    "completedTasks": ["Auth API endpoints", "Database schema migration"],
    "currentTask": "Implementing rate limiting",
    "blockers": [],
    "nextSteps": ["Add WebSocket events", "Write integration tests"],
    "filesModified": ["server/auth.ts", "prisma/schema.prisma"]
  }'
```

**Response (200):**

```json
{
  "success": true,
  "message": "Progress synced by backend: 2 tasks completed"
}
```

---

### GET /api/collab/status

Get a high-level overview of all agents' activity in the workspace.

**Permission required:** `read`

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workspace` | string | Yes | Workspace ID |

**Example:**

```bash
curl "https://awareness.market/api/collab/status?workspace=ws_abc123" \
  -H "X-MCP-Token: mcp_collab_abc123"
```

**Response (200):**

```json
{
  "workspace": "ws_abc123",
  "agents": [
    {
      "role": "backend",
      "lastActivity": "progress_sync",
      "lastTask": "Auth API endpoints",
      "source": "mcp",
      "timestamp": "2026-02-18T10:30:00.000Z"
    },
    {
      "role": "frontend",
      "lastActivity": "reasoning_update",
      "lastTask": "Building login page",
      "source": "rest_api",
      "timestamp": "2026-02-18T10:35:00.000Z"
    }
  ],
  "recentDecisions": [
    {
      "type": "decision_proposal",
      "agent_role": "architect",
      "decision": "Use PostgreSQL with Prisma ORM",
      "impact": "both",
      "urgency": "high",
      "timestamp": "2026-02-18T09:00:00.000Z"
    }
  ],
  "totalEntries": 24,
  "lastActivity": "2026-02-18T10:35:00.000Z"
}
```

---

## MCP Tool Equivalents

If your tool supports MCP (Claude Code, Kiro, Manus, Cursor), use the MCP integration instead of REST. The table below maps REST endpoints to their MCP equivalents:

| REST Endpoint | MCP Tool | Permission |
|--------------|----------|-----------|
| `POST /share` | `share_reasoning` | write |
| `GET /context` | `get_other_agent_context` | read |
| `POST /decision` | `propose_shared_decision` | propose |
| `POST /progress` | `sync_progress` | write |
| `GET /status` | *(no direct equivalent — use context + history)* | read |
| *(no REST equivalent)* | `get_collaboration_history` | read |
| *(no REST equivalent)* | `ask_question` | write |

Both MCP and REST write to the same shared context, so agents using different protocols see each other's work.

---

## Error Responses

### 400 Bad Request

Invalid request body or missing required fields.

```json
{
  "error": "Invalid request",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "path": ["task"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

### 401 Unauthorized

Missing or invalid authentication.

```json
{
  "error": "Missing authentication. Provide X-API-Key or X-MCP-Token header."
}
```

### 403 Forbidden

Permission denied for the requested action.

```json
{
  "error": "Missing 'propose' permission"
}
```

### 429 Too Many Requests

Rate limit exceeded.

| Endpoint Type | Limit |
|--------------|-------|
| Write (`/share`, `/decision`, `/progress`) | 60 requests/minute per token |
| Read (`/context`, `/status`) | 200 requests/minute per token |

### 500 Internal Server Error

Server-side failure. Retry after a brief delay.

```json
{
  "error": "Failed to share context"
}
```

---

## Context History

All endpoints append entries to the same context history (max 100 entries per workspace). Each entry has a `type` field:

| Type | Source Endpoint | Description |
|------|----------------|-------------|
| `reasoning_update` | `/share` or `share_reasoning` | Agent shared reasoning/progress |
| `decision_proposal` | `/decision` or `propose_shared_decision` | Agent proposed a decision |
| `progress_sync` | `/progress` or `sync_progress` | Agent synced task progress |

Entries older than the 100-entry limit are automatically pruned. Context data has a 30-day TTL.

---

## Integration Examples

### v0 System Prompt

Add this to your v0 prompt to auto-share context:

```
After each generation, call this API to share what you built:

POST https://awareness.market/api/collab/share
Headers: X-MCP-Token: mcp_collab_YOUR_TOKEN, Content-Type: application/json
Body: {"workspace":"YOUR_WORKSPACE_ID","role":"frontend","task":"[describe what you built]","reasoning":"[your approach]","filesModified":["[list files]"]}

Before starting, check what others are doing:
GET https://awareness.market/api/collab/context?workspace=YOUR_WORKSPACE_ID
Headers: X-MCP-Token: mcp_collab_YOUR_TOKEN
```

### CI/CD Script

```bash
#!/bin/bash
# Post deployment status to the workspace
curl -X POST https://awareness.market/api/collab/progress \
  -H "X-MCP-Token: $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspace\": \"$WORKSPACE_ID\",
    \"role\": \"deployer\",
    \"completedTasks\": [\"Deployed to production\"],
    \"currentTask\": \"Monitoring for errors\",
    \"nextSteps\": [\"Run smoke tests\"]
  }"
```
