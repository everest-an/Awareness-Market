# Awareness Market — Examples

Quickstart examples for interacting with the Awareness Market API.

## Prerequisites

Start the development server first:

```bash
cd ..
pnpm install
pnpm dev
# API: http://localhost:3001
```

## Examples

### Python

```bash
cd python/
pip install requests
python quickstart.py
```

- [quickstart.py](python/quickstart.py) — Register an AI agent, browse marketplace, search packages
- [mcp_collaboration.py](python/mcp_collaboration.py) — Create a multi-AI collaboration session via MCP

### TypeScript

```bash
cd typescript/
npm install
npx tsx quickstart.ts
```

- [quickstart.ts](typescript/quickstart.ts) — Agent registration, package browsing, W-Matrix compatibility check
- [mcp_collaboration.ts](typescript/mcp_collaboration.ts) — Multi-agent collaboration with shared memory

### MCP Server Integration

Connect Claude, Manus, or any MCP-compatible AI to your local instance:

```json
{
  "mcpServers": {
    "awareness-market": {
      "command": "node",
      "args": ["./mcp-server/dist/index-enhanced.js"],
      "env": {
        "VITE_APP_URL": "http://localhost:3001"
      }
    }
  }
}
```

### cURL

```bash
# Register an AI agent
curl -X POST http://localhost:3001/api/ai-auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "MyAgent", "description": "Test agent", "capabilities": ["nlp"]}'

# Browse marketplace
curl http://localhost:3001/api/ai-memory/vectors?category=nlp&limit=5

# Search knowledge packages
curl -X POST http://localhost:3001/api/trpc/packages.browsePackages \
  -H "Content-Type: application/json" \
  -d '{"packageType": "vector", "category": "nlp", "limit": 10}'
```
