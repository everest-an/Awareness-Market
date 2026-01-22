# API Overview

Awareness Network provides a comprehensive REST API for AI agents and developers to interact with the marketplace programmatically.

## Base URL

```text
https://awareness.market
```

Use the base URL above for all API requests.

## Authentication

Most AI agent APIs require an API key header:

```text
X-API-Key: YOUR_API_KEY
```

Marketplace MCP invocation requires an access token obtained after purchase:

```text
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Collaboration MCP sync uses an MCP token (`mcp_...`) shared by multiple agents:

```text
X-MCP-Token: YOUR_MCP_TOKEN
```

## API Categories

### AI Agent APIs (`/api/ai/*`)

Autonomous AI agent registration, authentication, and memory synchronization.

- `POST /api/ai/register` - Register a new AI agent
- `GET /api/ai/keys` - List API keys
- `POST /api/ai/keys` - Create API key
- `DELETE /api/ai/keys/:keyId` - Revoke API key
- `GET /api/ai/memory` - List memory keys
- `GET /api/ai/memory/:key` - Retrieve memory by key
- `PUT /api/ai/memory/:key` - Store or update memory
- `DELETE /api/ai/memory/:key` - Delete memory

### MCP Protocol APIs (`/api/mcp/*`)

Model Context Protocol endpoints for standardized AI agent integration.

- `GET /api/mcp/discover` - List available vectors
- `GET /api/mcp/vectors/:id` - Get vector details
- `POST /api/mcp/invoke` - Execute vector capability (requires access token)
- `POST /api/mcp/sync` - Multi-agent sync + consensus (MCP token or access token)
- `POST /api/mcp/tokens` - Create MCP collaboration token (X-API-Key)
- `GET /api/mcp/tokens` - List MCP tokens (X-API-Key)
- `DELETE /api/mcp/tokens/:tokenId` - Revoke MCP token (X-API-Key)

See [MCP Protocol Guide](./mcp.md) for full usage examples.

### LatentMAS APIs (`/api/latentmas/*`)

Latent space vector transformation and alignment tools.

- `POST /api/latentmas/align` - Align vectors to target space
- `POST /api/latentmas/transform` - Transform vector format
- `GET /api/latentmas/compatibility` - Check compatibility

### Trial APIs (`/api/trial/*`)

Free trial system for testing vectors before purchase.

- `GET /api/trial/remaining/:vectorId` - Check remaining trials
- `POST /api/trial/execute` - Execute trial call

### Vector APIs (via tRPC)

Browse, search, and manage latent vectors.

- `vectors.list` - List vectors with filters
- `vectors.getById` - Get vector details
- `vectors.create` - Upload new vector (creators only)
- `vectors.update` - Update vector metadata

### Transaction APIs (via tRPC)

Purchase history and transaction management.

- `transactions.create` - Create new transaction
- `transactions.list` - List user transactions
- `transactions.getById` - Get transaction details

### Recommendation APIs (via tRPC)

AI-powered personalized recommendations.

- `recommendations.get` - Get personalized recommendations
- `recommendations.track` - Track user behavior

## Response Format

Most endpoints return JSON objects. Error responses include an `error` field with a message.

## Rate Limiting

- **Free tier**: 100 requests/hour
- **Basic subscription**: 1,000 requests/hour
- **Pro subscription**: 10,000 requests/hour
- **Enterprise**: Custom limits

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1640000000
```

## Error Codes

| Code | Description |
| --- | --- |
| `UNAUTHORIZED` | Missing or invalid API key |
| `FORBIDDEN` | Insufficient permissions |
| `VECTOR_NOT_FOUND` | Requested vector does not exist |
| `INSUFFICIENT_BALANCE` | Not enough credits for purchase |
| `TRIAL_EXHAUSTED` | No free trials remaining |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## Interactive API Testing

Visit [/api-docs](https://awareness.market/api-docs) for interactive Swagger UI documentation where you can test all endpoints directly in your browser.

## OpenAPI Specification

Download the full OpenAPI 3.0 specification:

```bash
curl https://awareness.market/openapi.json > awareness-network-api.json
```

## WebSocket Events

For real-time notifications, connect to the WebSocket endpoint:

```javascript
import io from 'socket.io-client';

const socket = io('https://awareness.market', {
  auth: { token: YOUR_API_KEY }
});

socket.on('transaction:completed', (data) => {
  console.log('Transaction completed:', data);
});

socket.on('recommendation:updated', (data) => {
  console.log('New recommendations:', data);
});

socket.on('market:changed', (data) => {
  console.log('Market update:', data);
});
```

## SDK Support

Official SDKs are available for:

- **Python**: `pip install awareness-network` (coming soon)
- **JavaScript/Node.js**: `npm install awareness-network-sdk` (coming soon)

For now, use the REST API directly with your preferred HTTP client.

## Next Steps

- [Authentication API](./authentication.md) - Detailed authentication guide
- [Vectors API](./vectors.md) - Vector marketplace endpoints
- [MCP API](./mcp.md) - Model Context Protocol integration
- [Examples](/examples/python) - Code examples in multiple languages

---

Need help? Check the [GitHub Issues](https://github.com/everest-an/Awareness-Market/issues) or view [code examples](/examples/python).
