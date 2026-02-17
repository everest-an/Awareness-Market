# Claude Desktop Integration

This guide walks through connecting the Awareness MCP Server to **Claude Desktop**, enabling Claude to search the Awareness marketplace, check compatibility, purchase packages, and download artifacts directly within your conversations.

## Prerequisites

- **Claude Desktop** installed ([download here](https://claude.ai/download))
- **Node.js 18+** installed
- The **Awareness MCP Server** installed globally:
  ```bash
  npm install -g @awareness/mcp-server
  ```
- An **Awareness Network API key**

## Step 1: Locate the Claude Desktop Configuration File

Claude Desktop reads MCP server configurations from a JSON file at a platform-specific location:

| Platform | Configuration File Path |
|---|---|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

If the file does not exist, create it.

## Step 2: Add the Awareness MCP Server

Open the configuration file and add the Awareness MCP Server to the `mcpServers` object:

```json
{
  "mcpServers": {
    "awareness-marketplace": {
      "command": "awareness-mcp",
      "args": ["--config", "/path/to/your/mcp.json"],
      "env": {
        "AWARENESS_API_KEY": "aw_live_your_api_key_here"
      }
    }
  }
}
```

### Configuration Fields

| Field | Description |
|---|---|
| `command` | The executable to run. If installed globally, `"awareness-mcp"` is on your PATH. |
| `args` | Command-line arguments. Point `--config` to your `mcp.json` file. |
| `env` | Environment variables passed to the MCP server process. |

### Alternative: Using npx

If you prefer not to install globally, use `npx` to run the server directly:

```json
{
  "mcpServers": {
    "awareness-marketplace": {
      "command": "npx",
      "args": ["-y", "@awareness/mcp-server", "--config", "/path/to/your/mcp.json"],
      "env": {
        "AWARENESS_API_KEY": "aw_live_your_api_key_here"
      }
    }
  }
}
```

### Minimal mcp.json

If you are only using the MCP server with Claude Desktop, a minimal `mcp.json` is sufficient:

```json
{
  "name": "awareness-marketplace",
  "version": "1.0.0",
  "server": {
    "transport": "stdio",
    "apiKey": "${AWARENESS_API_KEY}"
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
    "downloadDir": "~/awareness-downloads",
    "autoConfirmPurchases": false
  }
}
```

## Step 3: Restart Claude Desktop

After saving the configuration file, **restart Claude Desktop** completely:

1. Quit Claude Desktop (not just close the window -- fully exit the application).
2. Reopen Claude Desktop.

Claude will spawn the Awareness MCP Server as a child process on startup.

## Step 4: Verify the Connection

Open a new conversation in Claude Desktop and look for the **MCP tools indicator** in the input area. You should see a hammer icon or a tools badge indicating that MCP tools are available.

You can also verify by asking Claude directly:

> **You:** What Awareness marketplace tools do you have access to?

Claude should respond with a list of the six available tools:

- `search_vector_packages`
- `search_kv_cache_memories`
- `search_chain_packages`
- `purchase_package`
- `download_package`
- `check_model_compatibility`

## Step 5: Test a Search

Try a natural language request:

> **You:** Search the Awareness marketplace for reasoning-boost vector packages compatible with Llama 3.1 70B.

Claude will:

1. Recognize this requires the `search_vector_packages` tool.
2. Call the tool with appropriate parameters.
3. Present the results in a readable format.

## Example Conversations

### Finding and Downloading a Package

> **You:** I need a code generation vector package for Llama 3.1 70B. Find the best rated one under $10 and download it.
>
> **Claude:** Let me search for that.
> *[Calls search_vector_packages with query="code generation", model="llama-3.1-70b", max_price=10, sort_by="rating"]*
>
> I found 6 results. The top rated package is **"code-expert-v3"** by VerifiedDev Labs:
> - Rating: 4.9/5 (8,420 downloads)
> - Price: $4.00 USDC
> - Compatible with: llama-3.1-70b, llama-3.1-70b-instruct
>
> Let me check compatibility with your model first.
> *[Calls check_model_compatibility]*
>
> Compatibility confirmed with a 0.967 alignment score. Shall I purchase and download it?
>
> **You:** Yes, go ahead.
>
> **Claude:** *[Calls purchase_package, then download_package]*
>
> Done! The package has been downloaded to `~/awareness-downloads/code-expert-v3.safetensors` (187.3 MB).

### Comparing Packages

> **You:** Compare the top 3 medical KV-Cache memories for the 8B model. Show me their compatibility scores.
>
> **Claude:** *[Calls search_kv_cache_memories, then check_model_compatibility for each]*
>
> Here is a comparison of the top 3 medical KV-Cache memories:
>
> | Package | Rating | Tokens | Compatibility | Price |
> |---|---|---|---|---|
> | medical-pro-8k | 4.8 | 8192 | 0.951 | $1.50 |
> | clinical-context | 4.6 | 4096 | 0.938 | $0.75 |
> | health-knowledge-base | 4.5 | 8192 | 0.921 | $1.00 |

## Troubleshooting

### Claude Does Not Show MCP Tools

1. **Check the configuration file path.** Ensure you are editing the correct file for your platform.
2. **Validate your JSON.** A syntax error in `claude_desktop_config.json` will prevent MCP servers from loading. Use a JSON validator.
3. **Check the command.** Run `awareness-mcp --version` in your terminal to confirm it is installed and on your PATH.
4. **Restart fully.** Make sure Claude Desktop is fully quit and relaunched, not just the window.

### Tool Calls Fail with Authentication Errors

Verify your API key is correct:

```bash
# Test the key directly
curl -H "Authorization: Bearer aw_live_your_key_here" \
  https://api.awareness.market/v1/health
```

### Tool Calls Time Out

Large searches or downloads may exceed Claude Desktop's default timeout. You can increase the timeout in your `mcp.json`:

```json
{
  "server": {
    "transport": "stdio",
    "apiKey": "${AWARENESS_API_KEY}",
    "timeout": 60000
  }
}
```

### Viewing MCP Server Logs

The MCP server writes logs to stderr when running in stdio mode. To capture logs for debugging:

1. Set `logLevel` to `"debug"` in your `mcp.json`.
2. Check Claude Desktop's developer logs:
   - **macOS:** `~/Library/Logs/Claude/mcp.log`
   - **Windows:** `%APPDATA%\Claude\logs\mcp.log`
   - **Linux:** `~/.config/Claude/logs/mcp.log`

### Downloads Directory Permissions

Ensure the `downloadDir` path exists and is writable by the Claude Desktop process:

```bash
mkdir -p ~/awareness-downloads
```

## Security Considerations

- **API Key Protection.** Your API key is stored in the Claude Desktop configuration file. Ensure this file has appropriate permissions (`chmod 600` on macOS/Linux).
- **Purchase Confirmation.** Keep `autoConfirmPurchases` set to `false` (the default) so that Claude always asks you before spending funds.
- **Disable Unused Tools.** If you only need search functionality, disable `purchase_package` and `download_package` in your `mcp.json`.
