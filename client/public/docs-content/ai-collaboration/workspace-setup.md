# Workspace Setup Guide

This guide walks you through creating a multi-AI workspace and configuring each tool.

## Prerequisites

- An Awareness Market account (sign up at [/auth](/auth))
- At least one AI tool you want to connect (Claude Code, v0, Kiro, Manus, Cursor, Windsurf, or a custom tool)

## Step 1: Create the Workspace

Navigate to **[/workspace/new](/workspace/new)**.

### Name Your Workspace

Choose a descriptive name that identifies the project:

- "E-Commerce Rebuild"
- "Mobile App v2"
- "Data Pipeline Migration"

The name appears in all agent configs and the workspace dashboard.

### (Optional) Add a Description

A short description helps you identify the workspace later when you have multiple workspaces.

## Step 2: Add Agents

Click a **Quick Add** preset to add a pre-configured agent:

| Preset | Default Role | Integration | Description |
|--------|-------------|-------------|-------------|
| **v0** | frontend | REST API | Vercel web-based UI generation |
| **Kiro** | architect | MCP | AWS IDE for architecture & planning |
| **Claude Code** | backend | MCP | Backend development in VSCode |
| **Manus** | reviewer | MCP | Code review & deployment |
| **Cursor** | fullstack | MCP | AI-assisted coding IDE |
| **Windsurf** | fullstack | MCP | Codeium AI IDE |
| **Custom** | custom | REST API | Any custom agent or script |

### Customizing Agents

After adding a preset, you can modify:

- **Name** — Display name for the agent
- **Role** — Must be unique within the workspace. Available roles: `frontend`, `backend`, `fullstack`, `architect`, `reviewer`, `deployer`, `tester`, `custom`
- **Integration** — `MCP (IDE)` for tools that support MCP, `REST API (Web)` for web-based tools or scripts

> **Important:** Each agent must have a unique role. The role is used as the identifier in the shared context system.

### Maximum Agents

Each workspace supports up to **10 agents**. This is sufficient for most workflows — in practice, 3-5 agents cover the common patterns (architect + backend + frontend + reviewer + deployer).

## Step 3: Set Permissions

The permission matrix lets you control what each agent can do:

| Permission | Description | When to Grant |
|-----------|-------------|--------------|
| **Read** | See other agents' shared context | Almost always — this is the core value |
| **Write** | Share its own reasoning/progress | Grant to all active agents |
| **Propose** | Propose shared architectural decisions | Grant to architects and leads |
| **Execute** | Trigger deployment or critical actions | Grant only to trusted deployers |

### Recommended Permission Patterns

**Architect Agent** (Kiro):
- Read, Write, Propose

**Developer Agents** (Claude Code, Cursor):
- Read, Write

**Frontend/UI Agent** (v0):
- Read, Write

**Reviewer/Deployer Agent** (Manus):
- Read, Write, Propose, Execute

## Step 4: Get Configs

After creating the workspace, the system generates configs for each agent. Copy-paste the config into the respective tool's settings.

### MCP Configuration (Claude Code, Kiro, Manus, Cursor)

You'll receive a JSON block to add to your MCP settings file:

**Claude Code (VSCode):**
Add to `~/.config/claude-code/claude_desktop_config.json` or your VSCode MCP settings:

```json
{
  "mcpServers": {
    "awareness-collab-ws_abc123": {
      "command": "node",
      "args": ["./mcp-server/dist/index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_collab_...",
        "AGENT_ROLE": "backend",
        "PROJECT_ID": "ws_abc123",
        "AGENT_PERMISSIONS": "[\"read\",\"write\"]"
      }
    }
  }
}
```

**Kiro:**
Add the same JSON to Kiro's MCP server configuration in its settings panel.

**Manus:**
Manus supports MCP natively — add the config block to your Manus MCP settings.

### REST API Configuration (v0, Custom Scripts)

For web-based tools, you'll receive curl examples:

```bash
# Share your work (POST)
curl -X POST https://awareness.market/api/collab/share \
  -H "X-MCP-Token: mcp_collab_..." \
  -H "Content-Type: application/json" \
  -d '{"workspace":"workspace:ws_abc123","role":"frontend","task":"Built login page","reasoning":"Used shadcn/ui form components"}'

# See what others are doing (GET)
curl "https://awareness.market/api/collab/context?workspace=workspace:ws_abc123" \
  -H "X-MCP-Token: mcp_collab_..."
```

For v0, you can include these API calls in your v0 prompts or system instructions so it automatically shares context after each generation.

## Managing Your Workspace

After creation, visit **[/workspace](/workspace)** to see all your workspaces, or go to `/workspace/<id>` for the detail view.

### Available Actions

- **Pause/Resume** — Temporarily disable the workspace
- **Complete** — Mark the project as done
- **Rotate Token** — Generate a new MCP token (invalidates the old one; all agents need updated configs)
- **Remove Agent** — Remove an agent from the workspace
- **Update Permissions** — Change an agent's permission checkboxes in real-time
- **Delete Workspace** — Permanently remove the workspace, token, and collaboration history
- **View Audit Log** — See all workspace actions with timestamps

### Token Rotation

If a token is compromised or you want periodic rotation:

1. Open the workspace detail page
2. Click **Rotate Token**
3. Confirm in the dialog
4. Copy the new configs and update all agents

The old token is immediately deactivated. Agents using the old token will get 401 errors until updated.

## Troubleshooting

### Agent can't connect
- Verify the MCP token is correct (check for copy-paste errors)
- Ensure the `VITE_APP_URL` points to the correct server
- Check that the token hasn't been rotated since you last copied the config

### Permission denied errors
- The workspace uses a **fail-closed** permission model — if the permission record is missing, access is denied
- Check the agent's permissions in the workspace detail page
- Verify the agent's role matches what's configured

### Rate limit errors
- Write endpoints (share, decision, progress): **60 requests/minute** per token
- Read endpoints (context, status): **200 requests/minute** per token
- If hitting limits, reduce the frequency of context shares

### Token shows as invalid
- Tokens expire after 365 days — create a new workspace or rotate the token
- Check if someone rotated the token via the audit log
