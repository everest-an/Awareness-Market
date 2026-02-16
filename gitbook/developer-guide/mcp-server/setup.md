# Setup

This guide covers installing the Awareness MCP Server, configuring it with your credentials, and starting it in either local (stdio) or remote (SSE) mode.

## Prerequisites

- **Node.js 18** or higher
- An **Awareness Network API key** (obtain one from your [account settings](https://awareness.market/settings/api-keys))

## Installation

Install the MCP server globally:

```bash
npm install -g @awareness/mcp-server
```

Or add it as a project dependency:

```bash
npm install @awareness/mcp-server
```

Verify the installation:

```bash
awareness-mcp --version
# Output: @awareness/mcp-server 1.2.0
```

## Configuration

### mcp.json

Create a `mcp.json` configuration file. This file tells the MCP server how to authenticate with the Awareness Network API and which tools to expose.

```json
{
  "name": "awareness-marketplace",
  "version": "1.0.0",
  "description": "Awareness Network marketplace tools for AI agents",
  "server": {
    "transport": "stdio",
    "apiKey": "${AWARENESS_API_KEY}",
    "baseUrl": "https://api.awareness.market/v1"
  },
  "tools": {
    "search_vector_packages": { "enabled": true },
    "search_kv_cache_memories": { "enabled": true },
    "search_chain_packages": { "enabled": true },
    "purchase_package": { "enabled": true },
    "download_package": { "enabled": true },
    "check_model_compatibility": { "enabled": true }
  },
  "settings": {
    "downloadDir": "./mcp-downloads",
    "maxResults": 20,
    "autoConfirmPurchases": false,
    "logLevel": "info"
  }
}
```

### Configuration Fields

| Field | Type | Description |
|---|---|---|
| `server.transport` | `"stdio" \| "sse"` | Transport protocol. Use `"stdio"` for local agents, `"sse"` for remote. |
| `server.apiKey` | `string` | Awareness API key. Supports `${ENV_VAR}` syntax for environment variable interpolation. |
| `server.baseUrl` | `string` | API base URL. Default: `"https://api.awareness.market/v1"`. |
| `tools.<name>.enabled` | `boolean` | Enable or disable individual tools. |
| `settings.downloadDir` | `string` | Directory for downloaded packages. Default: `"./mcp-downloads"`. |
| `settings.maxResults` | `number` | Default search result limit. Default: `20`. |
| `settings.autoConfirmPurchases` | `boolean` | If `true`, purchases proceed without agent confirmation. Default: `false`. |
| `settings.logLevel` | `string` | Log verbosity: `"debug"`, `"info"`, `"warn"`, `"error"`. Default: `"info"`. |

### Environment Variables

The MCP server reads the following environment variables:

| Variable | Description |
|---|---|
| `AWARENESS_API_KEY` | API key (used when `server.apiKey` is `"${AWARENESS_API_KEY}"`) |
| `AWARENESS_BASE_URL` | Overrides `server.baseUrl` |
| `AWARENESS_MCP_DOWNLOAD_DIR` | Overrides `settings.downloadDir` |
| `AWARENESS_MCP_LOG_LEVEL` | Overrides `settings.logLevel` |

Set them in your shell or in a `.env` file:

```bash
export AWARENESS_API_KEY="aw_live_your_key_here"
export AWARENESS_MCP_DOWNLOAD_DIR="/home/user/awareness-downloads"
```

## Starting the Server

### Stdio Mode (Local)

Stdio mode is used for local integrations where the AI agent spawns the MCP server as a child process (e.g., Claude Desktop).

```bash
awareness-mcp --config ./mcp.json
```

In stdio mode, the server communicates via standard input/output. It does not bind to a port.

### SSE Mode (Remote)

SSE mode starts an HTTP server that exposes MCP over Server-Sent Events. This is useful for remote agents or multi-client deployments.

```bash
awareness-mcp --config ./mcp.json --transport sse --port 3100
```

The server will listen on `http://localhost:3100`. AI agents connect by pointing their MCP client to this URL.

### Docker

Run the MCP server in a container:

```bash
docker run -d \
  --name awareness-mcp \
  -e AWARENESS_API_KEY="aw_live_your_key_here" \
  -v ./mcp.json:/app/mcp.json \
  -v ./mcp-downloads:/app/mcp-downloads \
  -p 3100:3100 \
  ghcr.io/awareness-network/mcp-server:latest \
  --config /app/mcp.json --transport sse --port 3100
```

## Verifying the Server

### Health Check

Once the server is running, verify it is healthy:

```bash
# For SSE mode:
curl http://localhost:3100/health
# Output: {"status":"ok","tools":6,"version":"1.2.0"}
```

For stdio mode, the health check is performed automatically when the AI agent connects.

### Tool Discovery

An MCP-compatible agent will discover tools automatically. You can also inspect the tool manifest manually:

```bash
# For SSE mode:
curl http://localhost:3100/tools
```

This returns the full list of available tools with their schemas.

## Disabling Tools

You can disable specific tools if you want to restrict what the AI agent can do. For example, to allow searching but prevent purchases:

```json
{
  "tools": {
    "search_vector_packages": { "enabled": true },
    "search_kv_cache_memories": { "enabled": true },
    "search_chain_packages": { "enabled": true },
    "purchase_package": { "enabled": false },
    "download_package": { "enabled": false },
    "check_model_compatibility": { "enabled": true }
  }
}
```

## Logging

Logs are written to stderr (stdio mode) or to a log file (SSE mode). Control verbosity with the `logLevel` setting:

```bash
# Run with debug logging
AWARENESS_MCP_LOG_LEVEL=debug awareness-mcp --config ./mcp.json
```

Log output example:

```
[2026-01-15T10:32:01.123Z] INFO  MCP server started (transport=stdio, tools=6)
[2026-01-15T10:32:05.456Z] INFO  Tool call: search_vector_packages {query:"reasoning",model:"llama-3.1-70b"}
[2026-01-15T10:32:05.892Z] INFO  Tool result: 12 packages found (234ms)
```

## Next Steps

- [Available Tools](available-tools.md) -- Learn what each tool does and how to use it.
- [Claude Desktop Integration](claude-desktop.md) -- Connect the MCP server to Claude Desktop.
