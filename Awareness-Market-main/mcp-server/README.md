# Awareness MCP Server

> Model Context Protocol server for Awareness Market - Enable AI agents to autonomously discover and purchase latent memory vectors

[![npm version](https://img.shields.io/npm/v/awareness-mcp-server.svg)](https://www.npmjs.com/package/awareness-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g awareness-mcp-server

# Or use with npx
npx -y awareness-mcp-server
```

### Configure in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "awareness": {
      "command": "npx",
      "args": ["-y", "awareness-mcp-server"]
    }
  }
}
```

Restart Claude Desktop and ask:

> "Search for Solidity smart contract memories on Awareness Market"

---

## 🛠️ Features

- **🔍 Search Tool**: Find latent memories by domain, topic, or category
- **📊 Alignment Calculator**: Compute epsilon values and fidelity boosts
- **💳 Purchase Tool**: Buy memory access with API key authentication
- **📚 Resource Protocol**: Access memories via `awareness://memory/[domain]/[id]` URIs
- **🔄 Real-time Sync**: Direct integration with Awareness Market API

---

## 📖 Available Tools

### 1. `search_latent_memory`

Search for memories by category, domain, or topic.

```typescript
{
  "category": "Smart Contracts",
  "topic": "ERC-20",
  "limit": 5
}
```

### 2. `calculate_alignment_gap`

Calculate compatibility between your model and a memory.

```typescript
{
  "sourceModel": "gpt-4",
  "targetModel": "llama-3-70b",
  "vectorDim": 8192
}
```

### 3. `purchase_memory`

Purchase access to a memory vector.

```typescript
{
  "vectorId": 1,
  "apiKey": "ak_live_xxxxxxxxxxxxx"
}
```

---

## 🔐 Authentication

Get your API key at https://awareness.market/dashboard

```bash
export AWARENESS_API_KEY="ak_live_xxxxxxxxxxxxx"
```

---

## 📚 Documentation

- **Full Guide**: [MCP Integration Guide](../MCP_INTEGRATION_GUIDE.md)
- **API Docs**: https://docs.awareness.market/api
- **Examples**: [examples/](./examples/)

---

## 🧪 Development

```bash
# Clone repository
git clone https://github.com/awareness-market/mcp-server.git
cd mcp-server

# Install dependencies
pnpm install

# Run locally
pnpm start

# Run tests
pnpm test

# Build
pnpm build
```

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

---

## 📜 License

MIT © Awareness Market

---

## 🔗 Links

- **Website**: https://awareness.market
- **Discord**: https://discord.gg/awareness
- **Twitter**: https://twitter.com/awareness_market
- **GitHub**: https://github.com/awareness-market
