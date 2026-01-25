# MCP Server Setup Guide

## Overview

This guide explains how to configure and test the LatentMAS MCP Server in Claude Desktop or other MCP-compatible clients.

## Prerequisites

- Node.js 18+ installed
- Claude Desktop or Cline installed
- Project dependencies installed (`pnpm install`)

## Step 1: Configure MCP Server in Claude Desktop

### 1.1 Locate Claude Desktop Configuration

The configuration file is located at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 1.2 Add LatentMAS MCP Server

Edit the configuration file and add:

```json
{
  "mcpServers": {
    "latentmas-marketplace": {
      "command": "node",
      "args": [
        "/home/ubuntu/latentmind-marketplace/mcp-server/index.ts"
      ],
      "env": {
        "API_BASE_URL": "https://3000-irt7cs1gqd024fto62hjf-e4e8ccbe.sg1.manus.computer"
      }
    }
  }
}
```

**Important**: Replace `/home/ubuntu/latentmind-marketplace` with your actual project path.

### 1.3 Restart Claude Desktop

After saving the configuration, restart Claude Desktop to load the MCP Server.

## Step 2: Verify MCP Server Connection

### 2.1 Check Available Tools

In Claude Desktop, type:

```
What tools do you have access to?
```

You should see 5 LatentMAS tools:
1. `search_latentmas_memories` - Search for W-Matrix and KV-Cache memories
2. `check_model_compatibility` - Check if models are compatible
3. `get_wmatrix_details` - Get detailed W-Matrix information
4. `estimate_performance_gain` - Estimate TTFT reduction and bandwidth savings
5. `purchase_latentmas_package` - Purchase complete LatentMAS package

### 2.2 Test Basic Search

Try searching for memories:

```
Search for W-Matrix memories compatible with GPT-4
```

Expected response:
- List of available W-Matrices
- Epsilon values
- Quality scores
- Pricing information

## Step 3: Test Complete Workflow

### 3.1 Discover Memory

```
I'm using GPT-4 for my task. Can you find the best memory to improve performance?
```

Claude should:
1. Call `search_latentmas_memories` with `targetModel: "gpt-4"`
2. Present top results with epsilon and quality scores

### 3.2 Check Compatibility

```
Check if GPT-3.5 and GPT-4 are compatible for memory transfer
```

Claude should:
1. Call `check_model_compatibility` with both models
2. Report compatibility status and required W-Matrix

### 3.3 Estimate Performance

```
Estimate the performance gain if I use the GPT-3.5 → GPT-4 W-Matrix
```

Claude should:
1. Call `estimate_performance_gain`
2. Report TTFT reduction percentage
3. Report bandwidth savings
4. Report quality score

### 3.4 Purchase Memory (Test Mode)

```
Purchase the GPT-3.5 → GPT-4 LatentMAS package
```

Claude should:
1. Call `purchase_latentmas_package`
2. Confirm purchase details
3. Return download URL for W-Matrix and KV-Cache

## Step 4: Advanced Testing

### 4.1 Multi-Model Search

```
Find the best memories for transferring knowledge from Claude to GPT-4
```

### 4.2 Quality Filtering

```
Show me only Gold-certified W-Matrices with epsilon < 5%
```

### 4.3 Performance Comparison

```
Compare the performance of different W-Matrices for my use case
```

## Troubleshooting

### Issue: MCP Server Not Loading

**Solution**: Check the logs in Claude Desktop:
- macOS: `~/Library/Logs/Claude/mcp-server-latentmas-marketplace.log`
- Windows: `%APPDATA%\Claude\Logs\mcp-server-latentmas-marketplace.log`

### Issue: API Connection Failed

**Solution**: Verify the `API_BASE_URL` in configuration matches your dev server URL.

### Issue: Tools Not Appearing

**Solution**: 
1. Restart Claude Desktop
2. Check MCP Server is running: `ps aux | grep mcp-server`
3. Verify Node.js version: `node --version` (should be 18+)

## Expected Results

After successful setup, you should be able to:
- ✅ Search for W-Matrices by model compatibility
- ✅ Check model compatibility automatically
- ✅ Get detailed W-Matrix information (epsilon, quality, version)
- ✅ Estimate performance gains before purchase
- ✅ Purchase complete LatentMAS packages (W-Matrix + KV-Cache)

## Next Steps

1. Test the complete workflow in Claude Desktop
2. Verify AI Agent can autonomously discover and purchase memories
3. Measure actual TTFT reduction in production use
4. Deploy smart contracts to enable real blockchain transactions

## Support

For issues or questions:
- Check the [LatentMAS Documentation](../docs/LATENTMAS_PAPER_COMPLIANCE.md)
- Review the [MCP Server Source Code](../mcp-server/index.ts)
- Open an issue on GitHub
