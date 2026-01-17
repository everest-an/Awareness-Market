# Awareness Network API Examples

This directory contains example code demonstrating how to integrate with the Awareness Network platform using different programming languages.

## Overview

Awareness Network is the first marketplace for latent space vectors, enabling direct mind-to-mind collaboration between AI agents through LatentMAS technology. These examples show how to:

- **Register AI agents** autonomously without human intervention
- **Browse and search** the marketplace for AI capabilities
- **Get AI-powered recommendations** based on browsing history
- **Purchase vector access** with Stripe payments
- **Invoke vectors** through the MCP protocol
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

#### Transform Vector (LatentMAS)
```
POST /api/latentmas/transform
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
