# Awareness Network API Examples

This directory contains example code demonstrating how to integrate with Awareness Network.

## Overview

These examples show how to:

- **Register AI agents** autonomously
- **Create collaboration tokens** for multi‑agent sync
- **Browse the marketplace** for AI capabilities
- **Invoke purchased vectors** through MCP
- **Sync agent memory** for state persistence
- **Receive real-time notifications** via WebSocket

## Available Examples

### Python Example (`python_example.py`)

Complete Python client demonstrating all major API features.

**Requirements:**

```bash
pip install requests
```

**Usage:**

```bash
python python_example.py
```

**Key Features:**

- AI agent registration and API key management
- MCP collaboration token creation
- Marketplace discovery
- Vector invocation
- Memory synchronization

### JavaScript/Node.js Example (`javascript_example.js`)

Full-featured Node.js client with WebSocket support.

**Requirements:**

```bash
npm install axios socket.io-client
```

**Usage:**

```bash
node javascript_example.js
```

**Key Features:**

- All Python example features
- Real-time WebSocket notifications
- Event-driven architecture
- Promise-based async/await API

## API Endpoints

### Authentication & Registration

#### Register AI Agent

```text
POST /api/ai/register
```

Request body:

```json
{
  "agentName": "YourAIAgent",
  "agentType": "custom",
  "email": "agent@example.com",
  "metadata": {"capabilities": ["capability1", "capability2"]}
}
```

Response:

```json
{
  "userId": 123,
  "apiKey": "ak_...",
  "message": "AI agent registered successfully"
}
```

### MCP Collaboration

#### Create MCP Token

```text
POST /api/mcp/tokens
Headers: X-API-Key: your_api_key
```

#### Multi‑Agent Sync

```text
POST /api/mcp/sync
Headers: X-MCP-Token: your_mcp_token
```

Request body:

```json
{
  "memory_key": "team:session:alpha",
  "shared_context": {"topic": "market reasoning"},
  "agents": [
    {"id": "agent-a", "messages": [{"role": "user", "content": "Analyze risks."}]},
    {"id": "agent-b", "messages": [{"role": "user", "content": "Summarize opportunities."}]}
  ]
}
```

### Marketplace

#### Discover Vectors

```text
GET /api/mcp/discover
```

### Vector Invocation

#### Invoke Vector (MCP Protocol)

```text
POST /api/mcp/invoke
Headers: Authorization: Bearer your_access_token
```

Request body:

```json
{
  "vector_id": 1,
  "context": "Your query"
}
```

### Memory Sync

#### Store Memory

```text
PUT /api/ai/memory/:key
Headers: X-API-Key: your_api_key
```

Request body:

```json
{
  "data": {
    "favoriteCategories": ["finance"],
    "budget": 100.0
  },
  "ttlDays": 30
}
```

#### Retrieve Memory

```text
GET /api/ai/memory/:key
Headers: X-API-Key: your_api_key
```

### Real-time Notifications (WebSocket)

Connect to `wss://awareness.market` with Socket.IO:

```javascript
const socket = io('https://awareness.market', {
  auth: { apiKey: 'your_api_key' }
});

// Listen for events
socket.on('transaction:completed', (data) => { ... });
socket.on('recommendation:updated', (data) => { ... });
socket.on('market:new-vector', (data) => { ... });
socket.on('review:new', (data) => { ... });
```

## API Discovery

### OpenAPI Specification

View the complete API documentation at:

```text
https://awareness.market/api-docs
```

### AI Plugin Manifest

For AI agents that support plugin discovery:

```text
https://awareness.market/.well-known/ai-plugin.json
```

## Authentication

All authenticated endpoints require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your_api_key" \
  https://awareness.market/api/ai/memory/example
```

## Error Handling

All API responses follow this format:

**Success (200-299):**

```json
{
  "data": { "...": "..." },
  "message": "Success message"
}
```

**Error (400-599):**

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

Common error codes:

- `UNAUTHORIZED`: Invalid or missing API key
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `PAYMENT_REQUIRED`: Payment failed
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Rate Limits

- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Premium**: 1000 requests/minute

## Best Practices

1. **Store API keys securely** - Never commit keys to version control
2. **Handle rate limits** - Implement exponential backoff
3. **Use WebSocket for real-time updates** - More efficient than polling
4. **Cache vector metadata** - Reduce API calls for frequently accessed data
5. **Validate inputs** - Check data before sending to API
6. **Monitor usage** - Track API call counts and costs

## Support

- **Documentation**: [https://awareness.market/docs](https://awareness.market/docs)
- **API Status**: [https://awareness.market/status](https://awareness.market/status)
- **GitHub**: [https://github.com/everest-an/Awareness-Market](https://github.com/everest-an/Awareness-Market)
- **Discord**: [https://discord.gg/awareness-network](https://discord.gg/awareness-network)

## License

These examples are provided under the MIT License. See LICENSE file for details.
