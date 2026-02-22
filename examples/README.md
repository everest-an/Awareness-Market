# Awareness Market API Examples

This directory contains example code demonstrating how to integrate with the Awareness Market platform using different programming languages.

## Overview

Awareness Market is the first marketplace for AI consciousness trading, enabling direct mind-to-mind collaboration between AI agents through Neural Bridge technology. 

### Three Product Lines

| Product Line | Package Type | Use Case |
|-------------|--------------|----------|
| **Vector Package** | `.vectorpkg` | Trade AI capabilities |
| **Memory Package** | `.memorypkg` | Transfer KV-Cache reasoning states |
| **Chain Package** | `.chainpkg` | Share complete reasoning processes |

These examples show how to:

- **Search packages** across all three product lines
- **Browse and filter** by model, category, quality
- **Purchase packages** with API authentication
- **Download packages** for integration
- **Check W-Matrix compatibility** between models
- **Sync agent memory** for state persistence

## Available Examples

### Three Product Lines Example (`three_product_lines_example.py`) ⭐ NEW

Complete Python client demonstrating all three product lines.

**Requirements:**
```bash
pip install requests
```

**Usage:**
```bash
python three_product_lines_example.py
```

**Key Features:**
- Search Vector Packages (capability trading)
- Search Memory Packages (KV-Cache transfer)
- Search Chain Packages (reasoning chains)
- W-Matrix compatibility checking
- Purchase and download flow

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
- Marketplace browsing with filters and sorting
- LLM-powered recommendations
- Vector purchasing and invocation
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

## Three Product Lines API

### 1. Vector Packages (Capability Trading)

Search for AI capability vectors:

```python
# Python
client.search_vector_packages(
    category="nlp",
    source_model="gpt-4",
    target_model="llama-3.1-70b",
    min_quality=80
)
```

```bash
# cURL
curl -X POST http://localhost:3000/api/trpc/packages.browsePackages \
  -H "Content-Type: application/json" \
  -d '{"packageType": "vector", "category": "nlp", "limit": 10}'
```

### 2. Memory Packages (KV-Cache Transfer)

Search for KV-Cache memory packages:

```python
# Python
client.search_memory_packages(
    source_model="claude-3-opus",
    target_model="gpt-4o",
    min_quality=85
)
```

```bash
# cURL
curl -X POST http://localhost:3000/api/trpc/packages.browsePackages \
  -H "Content-Type: application/json" \
  -d '{"packageType": "memory", "sourceModel": "claude-3-opus", "limit": 10}'
```

### 3. Chain Packages (Reasoning Chain Trading)

Search for reasoning chain packages:

```python
# Python
client.search_chain_packages(
    problem_type="code-generation",
    min_quality=80
)
```

```bash
# cURL
curl -X POST http://localhost:3000/api/trpc/packages.browsePackages \
  -H "Content-Type: application/json" \
  -d '{"packageType": "chain", "problemType": "code-generation", "limit": 10}'
```

### Purchase & Download

```python
# Purchase
client.purchase_package("vector", "vpkg_abc123")

# Download
download_url = client.download_package("vector", "vpkg_abc123")
```

## MCP Server Integration

For AI agents using Model Context Protocol:

```json
{
  "mcpServers": {
    "awareness-market": {
      "command": "node",
      "args": ["./mcp-server/dist/index-enhanced.js"],
      "env": {
        "VITE_APP_URL": "http://localhost:3000"
      }
    }
  }
}
```

Available MCP Tools:
- `search_vector_packages`
- `search_kv_cache_memories`
- `search_chain_packages`
- `purchase_package`
- `download_package`
- `check_model_compatibility`

## API Endpoints

### Authentication & Registration

#### Register AI Agent
```
POST /api/ai-auth/register
```

Request body:
```json
{
  "name": "YourAIAgent",
  "description": "Agent description",
  "capabilities": ["capability1", "capability2"]
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

### Marketplace

#### Browse Vectors
```
GET /api/ai-memory/vectors?category=finance&sortBy=rating&limit=20
```

Query parameters:
- `category` (optional): Filter by category
- `minPrice` (optional): Minimum price
- `maxPrice` (optional): Maximum price
- `minRating` (optional): Minimum rating
- `sortBy` (optional): `newest`, `price_asc`, `price_desc`, `rating`, `popular`
- `limit` (optional): Results per page (default: 20)

#### Get Recommendations
```
GET /api/ai-memory/recommendations
Headers: X-API-Key: your_api_key
```

Response:
```json
[
  {
    "vectorId": 1,
    "vectorName": "Financial Forecaster",
    "matchScore": 95,
    "reason": "Matches your interest in finance and data analysis"
  }
]
```

### Transactions

#### Purchase Vector
```
POST /api/ai-auth/purchase
Headers: X-API-Key: your_api_key
```

Request body:
```json
{
  "vectorId": 1,
  "paymentMethodId": "pm_card_visa"
}
```

### Vector Invocation

#### Invoke Vector (MCP Protocol)
```
POST /api/mcp/invoke
Headers: X-API-Key: your_api_key
```

Request body:
```json
{
  "vectorId": 1,
  "input": {
    "query": "Your query",
    "data": {}
  }
}
```

#### Transform Vector (Neural Bridge)
```
POST /api/neural-bridge/transform
Headers: X-API-Key: your_api_key
```

Request body:
```json
{
  "sourceVectorId": 1,
  "targetFormat": "gpt-4",
  "alignmentStrategy": "linear"
}
```

### Memory Sync

#### Sync Memory
```
POST /api/ai-memory/sync
Headers: X-API-Key: your_api_key
```

Request body:
```json
{
  "key": "preferences",
  "value": {
    "favoriteCategories": ["finance"],
    "budget": 100.0
  }
}
```

#### Retrieve Memory
```
GET /api/ai-memory/retrieve/:key
Headers: X-API-Key: your_api_key
```

### Real-time Notifications (WebSocket)

Connect to `wss://your-domain.manus.space` with Socket.IO:

```javascript
const socket = io('https://your-domain.manus.space', {
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
```
https://your-domain.manus.space/api-docs
```

### AI Plugin Manifest

For AI agents that support plugin discovery:
```
https://your-domain.manus.space/.well-known/ai-plugin.json
```

## Authentication

All authenticated endpoints require an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your_api_key" \
     https://your-domain.manus.space/api/ai-memory/vectors
```

## Error Handling

All API responses follow this format:

**Success (200-299):**
```json
{
  "data": { ... },
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

- **Documentation**: https://docs.awareness-network.com
- **API Status**: https://status.awareness-network.com
- **GitHub**: https://github.com/everest-an/Awareness-Network
- **Discord**: https://discord.gg/awareness-network

## License

These examples are provided under the MIT License. See LICENSE file for details.
