# MCP Server

The Awareness MCP Server exposes the Awareness Network marketplace as a set of tools that AI agents can invoke through the **Model Context Protocol (MCP)**.

## What Is MCP?

The Model Context Protocol is an open standard for connecting AI models to external data sources and tools. Instead of requiring the AI to generate raw API calls, MCP provides a structured interface where:

1. **The MCP server** declares a set of tools (functions with typed parameters and descriptions).
2. **The AI agent** (Claude, GPT, or any MCP-compatible model) discovers available tools at runtime.
3. **The agent calls tools** by name with structured arguments when it determines a tool is relevant to the user's request.
4. **The MCP server executes** the tool and returns structured results to the agent.

This allows AI assistants to interact with the Awareness marketplace -- searching for packages, checking compatibility, making purchases, and downloading artifacts -- without the user needing to write code or use the web interface.

## Why Use the MCP Server?

| Use Case | Description |
|---|---|
| **Conversational marketplace access** | Ask Claude to find a reasoning-boost vector package for your model, and it searches the marketplace on your behalf. |
| **Automated pipelines** | AI agents in CI/CD or orchestration systems can discover and acquire the packages they need autonomously. |
| **Multi-step workflows** | An agent can search, compare compatibility scores, purchase the best match, and download -- all within a single conversation. |
| **Robotics and embodied AI** | Autonomous agents acquire chain packages and KV-Cache memories to adapt their behavior in real time. |

## Architecture

```
User / AI Agent (Claude Desktop, API, etc.)
          |
          |  Model Context Protocol (stdio / SSE)
          v
+------------------------+
|  Awareness MCP Server  |
+------------------------+
  |        |         |
  v        v         v
Vectors  Memories  Chains    <-- Tool groups
  |        |         |
  v        v         v
+------------------------+
|  Awareness REST API    |
+------------------------+
```

The MCP server is a lightweight Node.js process that:

- Connects to AI agents via **stdio** (for local integrations like Claude Desktop) or **SSE** (for remote/server deployments).
- Translates MCP tool calls into authenticated REST API requests against the Awareness Network backend.
- Returns structured results that the AI agent can reason about and present to the user.

## Supported AI Agents

The Awareness MCP Server works with any MCP-compatible agent, including:

- **Claude Desktop** -- Native MCP support via the desktop application settings.
- **Claude API** -- MCP tool use through the Anthropic API.
- **Open-source agents** -- Any agent framework implementing the MCP client specification.

## Available Tools

The MCP server exposes six tools:

| Tool | Description |
|---|---|
| `search_vector_packages` | Search for vector packages by query, model, and filters. |
| `search_kv_cache_memories` | Search for KV-Cache memory packages. |
| `search_chain_packages` | Search for chain packages and workflows. |
| `purchase_package` | Purchase a package from the marketplace. |
| `download_package` | Download a purchased package to a local path. |
| `check_model_compatibility` | Check if a package is compatible with a target model. |

See [Available Tools](available-tools.md) for full parameter and response documentation.

## Next Steps

- [Setup](setup.md) -- Install and configure the MCP server.
- [Available Tools](available-tools.md) -- Detailed reference for each tool.
- [Claude Desktop Integration](claude-desktop.md) -- Step-by-step guide for connecting to Claude Desktop.
