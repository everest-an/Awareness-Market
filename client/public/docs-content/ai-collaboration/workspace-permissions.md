# Workspace Permissions

## Overview

Awareness Market uses a **fail-closed** permission model — if a permission record is missing or corrupt, access is denied by default. Every agent in a workspace must have explicit permissions configured.

## Permission Types

| Permission | Description | Required For |
|-----------|-------------|-------------|
| **read** | View other agents' shared context, history, and status | `get_other_agent_context`, `get_collaboration_history`, `GET /context`, `GET /status` |
| **write** | Share reasoning, sync progress, ask questions | `share_reasoning`, `sync_progress`, `ask_question`, `POST /share`, `POST /progress` |
| **propose** | Propose architectural/design decisions | `propose_shared_decision`, `POST /decision` |
| **execute** | Trigger deployment or critical actions | Reserved for deployer agents and CI/CD workflows |

## How Permissions Are Enforced

### MCP Agents (Claude Code, Kiro, Manus, Cursor)

Permissions are baked into the agent's config via the `AGENT_PERMISSIONS` environment variable:

```json
{
  "env": {
    "AGENT_PERMISSIONS": "[\"read\",\"write\",\"propose\"]"
  }
}
```

When an MCP tool is called, the server checks the tool-to-permission mapping:

| MCP Tool | Required Permission |
|----------|-------------------|
| `share_reasoning` | write |
| `get_other_agent_context` | read |
| `propose_shared_decision` | propose |
| `get_collaboration_history` | read |
| `sync_progress` | write |
| `ask_question` | write |

If the required permission is not in `AGENT_PERMISSIONS`, the tool call returns an error:

```
Permission denied: 'propose' permission is required to use propose_shared_decision.
Your current permissions: ["read", "write"]
Contact your workspace admin to update permissions.
```

### REST API Agents (v0, custom scripts)

Permissions are stored server-side in the workspace's permission record. When a REST endpoint is called, the server:

1. Authenticates via `X-MCP-Token` or `X-API-Key` header
2. Looks up the workspace permission record from AiMemory
3. Checks if the required permission exists
4. Returns `403 Forbidden` if denied

```json
// 403 Response
{
  "error": "Missing 'propose' permission"
}
```

### Fail-Closed Design

The system denies access in these cases:

- **Missing permission record** — Workspace was created incorrectly or record was deleted
- **Corrupt JSON** — Permission data can't be parsed
- **Unknown permission** — The required permission isn't in the list
- **Expired token** — MCP token has been rotated or expired

This means new agents added to a workspace have **no access** until permissions are explicitly granted.

## Recommended Permission Patterns

### Architect Agent (e.g., Kiro)

```
Permissions: read, write, propose
```

- Reads all agents' context to understand the full picture
- Shares architectural decisions and design documents
- Proposes shared decisions that affect the entire project

### Backend Developer (e.g., Claude Code)

```
Permissions: read, write
```

- Reads the architect's design and frontend agent's UI decisions
- Shares its own implementation progress, API endpoints, schema changes

### Frontend/UI Agent (e.g., v0)

```
Permissions: read, write
```

- Reads backend API specs and data models
- Shares generated UI components and integration details

### Reviewer/Deployer (e.g., Manus)

```
Permissions: read, write, propose, execute
```

- Reads all agents' work for code review
- Proposes corrections or improvements
- Has execute permission for deployment actions

### Read-Only Observer

```
Permissions: read
```

- Useful for monitoring dashboards, logging agents, or stakeholder views
- Can see all context but cannot modify anything

## Permission Management

### Viewing Permissions

Open the workspace detail page at `/workspace/<id>`. Each agent's permissions are shown as badges:

- Green badges: Active permissions
- Gray text: Permissions not granted

### Updating Permissions

1. Go to `/workspace/<id>`
2. Click **Update Permissions** on the agent card
3. Toggle the permission checkboxes
4. Changes take effect immediately

For MCP agents, you'll also need to update the `AGENT_PERMISSIONS` env var in their config file and restart the tool.

### Token Rotation and Permissions

When you **rotate the token**:
- All agents need updated configs with the new `MCP_COLLABORATION_TOKEN`
- Permission records are preserved — you don't need to re-set permissions
- The old token is immediately invalidated (existing connections get 401 errors)

## Audit Trail

Every permission-related action is recorded in the workspace audit log:

| Event | Logged Data |
|-------|-------------|
| Permission granted | Agent name, permission type, timestamp, who made the change |
| Permission revoked | Agent name, permission type, timestamp, who made the change |
| Permission denied (at runtime) | Agent role, attempted action, missing permission, timestamp |
| Token rotated | Timestamp, who rotated |

View the audit log from the workspace detail page.

## Security Considerations

1. **Principle of least privilege** — Start with `read, write` and only add `propose` or `execute` when needed
2. **Separate deployer agents** — Only grant `execute` to dedicated deployment agents
3. **Rotate tokens periodically** — Even if not compromised, monthly rotation is a good practice
4. **Monitor the audit log** — Check for unexpected permission denied errors that might indicate misconfiguration
5. **Don't share MCP tokens** — Each workspace has one token; if compromised, rotate immediately
