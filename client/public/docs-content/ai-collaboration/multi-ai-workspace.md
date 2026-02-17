# Multi-AI Workspace

## Overview

Multi-AI Workspace is a coordination hub that lets you run multiple AI tools simultaneously on the same project — each tool sees what the others are doing, shares context, and coordinates decisions through a unified workspace.

### The Problem

When you use multiple AI tools (Claude Code, v0, Kiro, Manus, Cursor, etc.) on the same project, each tool operates in isolation. They don't know what the others are working on, leading to:

- **Conflicting changes** — Two agents edit the same file
- **Duplicated work** — Agent B re-implements what Agent A already built
- **Context loss** — You manually copy-paste context between tools
- **No shared decisions** — Architectural choices aren't propagated

### The Solution

A Workspace connects all your AI tools through a shared context layer:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Claude Code  │    │     v0       │    │    Kiro      │
│  (Backend)    │    │  (Frontend)  │    │  (Architect) │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │ MCP                │ REST API          │ MCP
       └───────────┬───────┴───────────┬───────┘
                   │                   │
           ┌───────┴───────────────────┴────────┐
           │     Awareness Market Workspace     │
           │  ┌─────────────────────────────┐   │
           │  │   Shared Context (AiMemory) │   │
           │  │  • Reasoning updates        │   │
           │  │  • Progress sync            │   │
           │  │  • Decision proposals       │   │
           │  │  • File change tracking     │   │
           │  └─────────────────────────────┘   │
           └────────────────────────────────────┘
```

## How It Works

### Two Integration Modes

| Mode | Protocol | Best For | Examples |
|------|----------|----------|---------|
| **MCP** | Model Context Protocol (stdio) | IDE-based AI tools | Claude Code, Kiro, Manus, Cursor |
| **REST API** | HTTP POST/GET | Web-based AI tools, scripts | v0, custom scripts, CI/CD |

Both modes read and write to the **same shared context**, so MCP agents and REST agents see each other's work.

### Core Capabilities

1. **Share Reasoning** — Each agent posts what it's working on, its reasoning, and what files it modified
2. **Get Context** — Any agent can read what all other agents have been doing
3. **Propose Decisions** — Agents can propose architectural or design decisions for the team
4. **Sync Progress** — Track completed tasks, blockers, and next steps across all agents
5. **Permission Control** — Fine-grained read/write/propose/execute permissions per agent

## Quick Start

### 1. Create a Workspace

Go to **[/workspace/new](/workspace/new)** and:

1. Name your workspace (e.g., "My SaaS Project")
2. Add your AI agents with presets (Claude Code, v0, Kiro, Manus, Cursor, Windsurf)
3. Set permissions per agent
4. Copy the generated configs

### 2. Configure Each Tool

**For MCP tools (Claude Code, Kiro, Manus):**

Copy the generated JSON into your tool's MCP settings file:

```json
{
  "mcpServers": {
    "awareness-collab-ws_abc123": {
      "command": "node",
      "args": ["./mcp-server/dist/index-collaboration.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "MCP_COLLABORATION_TOKEN": "mcp_collab_xxx",
        "AGENT_ROLE": "backend",
        "PROJECT_ID": "ws_abc123",
        "AGENT_PERMISSIONS": "[\"read\",\"write\",\"propose\"]"
      }
    }
  }
}
```

**For REST tools (v0, scripts):**

Use curl or HTTP calls:

```bash
# Share your work
curl -X POST https://awareness.market/api/collab/share \
  -H "X-MCP-Token: mcp_collab_xxx" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"workspace:ws_abc123","role":"frontend","task":"Built login page","reasoning":"Used shadcn/ui form components"}'

# See what others are doing
curl "https://awareness.market/api/collab/context?workspace=workspace:ws_abc123" \
  -H "X-MCP-Token: mcp_collab_xxx"
```

### 3. Start Working

Each tool automatically shares its context. Open your workspace dashboard at `/workspace/<id>` to see all agents' activity in real-time.

## Example Workflow

A solo developer working with 4 AI tools:

| Step | Agent | Action |
|------|-------|--------|
| 1 | **Kiro** (architect) | Plans the database schema and API design, shares via MCP |
| 2 | **Claude Code** (backend) | Reads Kiro's design, implements the API, shares progress via MCP |
| 3 | **v0** (frontend) | Reads the API spec from Claude's context, generates UI components, shares via REST |
| 4 | **Manus** (reviewer) | Reads all three agents' context, reviews code and proposes deployment |

All of this happens through the same workspace — no manual context copying.

## Security

- **Encrypted tokens** — MCP tokens are stored with AES-256-GCM encryption at rest
- **Fail-closed permissions** — If a permission record is missing or corrupt, access is denied
- **Token rotation** — Rotate tokens at any time; old tokens are immediately invalidated
- **Rate limiting** — Write endpoints: 60 req/min, Read endpoints: 200 req/min per token
- **Audit logging** — Every workspace action is recorded with timestamps

## Next Steps

- [Workspace Setup Guide](workspace-setup) — Detailed step-by-step instructions
- [Permission Model](workspace-permissions) — Deep dive into the permission system
- [REST API Reference](workspace-api) — Complete API documentation for HTTP integrations
- [MCP Integration](mcp) — MCP server setup and available tools
