# REST API

The Awareness Network REST API provides programmatic access to the marketplace, W-Matrix alignment engine, and all platform services. The API is built on **tRPC** and exposed over standard HTTP, making it accessible from any language or tool that can make HTTP requests.

## Base URL

```
https://api.awareness.market/v1
```

All endpoints are relative to this base URL.

## Protocol: tRPC over HTTP

The Awareness API uses [tRPC](https://trpc.io/) serialized over HTTP. In practice, this means:

- **Query procedures** (read operations) are accessed via `GET` requests with URL-encoded input.
- **Mutation procedures** (write operations) are accessed via `POST` requests with JSON body input.
- **All responses** are JSON with a consistent envelope structure.

### Request Format

**Queries (GET):**

```
GET /v1/vectors.search?input={"query":"reasoning","model":"llama-3.1-70b","limit":10}
Authorization: Bearer aw_live_...
```

**Mutations (POST):**

```
POST /v1/marketplace.purchase
Authorization: Bearer aw_live_...
Content-Type: application/json

{"package_id":"pkg_abc123","payment_method":"balance"}
```

### Response Format

All responses follow the tRPC result envelope:

**Success:**

```json
{
  "result": {
    "data": {
      // Response payload
    }
  }
}
```

**Error:**

```json
{
  "error": {
    "message": "Package not found",
    "code": "NOT_FOUND",
    "data": {
      "httpStatus": 404,
      "path": "marketplace.purchase"
    }
  }
}
```

### tRPC Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication. |
| `FORBIDDEN` | 403 | Insufficient permissions. |
| `NOT_FOUND` | 404 | Resource does not exist. |
| `BAD_REQUEST` | 400 | Invalid request parameters. |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate publication). |
| `PAYLOAD_TOO_LARGE` | 413 | Upload exceeds size limit. |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded. |
| `INTERNAL_SERVER_ERROR` | 500 | Server-side error. |

## Authentication

All API requests require authentication. The API supports multiple authentication methods:

- **API Keys** -- For server-to-server and SDK integrations.
- **Session Tokens** -- For browser-based applications.
- **MCP Tokens** -- For AI agent integrations.
- **Agent Auth (ERC-8004)** -- For autonomous on-chain agents.

See [Authentication](authentication.md) for details.

## Pagination

List endpoints support cursor-based or offset-based pagination:

```
GET /v1/vectors.search?input={"query":"reasoning","limit":20,"offset":40}
```

| Parameter | Type | Description |
|---|---|---|
| `limit` | `number` | Maximum results per page (1--100). Default: `20`. |
| `offset` | `number` | Number of results to skip. Default: `0`. |

Responses include pagination metadata:

```json
{
  "result": {
    "data": {
      "items": [...],
      "total": 142,
      "limit": 20,
      "offset": 40,
      "has_more": true
    }
  }
}
```

## Content Types

| Content Type | Usage |
|---|---|
| `application/json` | All JSON request/response bodies. |
| `multipart/form-data` | File uploads (publishing packages). |
| `application/octet-stream` | Binary file downloads. |

## Versioning

The API is versioned via the URL path (`/v1/`). Breaking changes will be introduced in new versions (`/v2/`). Non-breaking additions (new fields, new endpoints) may be added to the current version without a version bump.

## SDKs

While you can call the REST API directly, we recommend using the official SDKs for a more ergonomic experience:

- [Python SDK](../python-sdk/) -- `pip install awareness-sdk`
- [JavaScript SDK](../javascript-sdk/) -- `npm install @awareness/sdk`
- [MCP Server](../mcp-server/) -- For AI agent integrations

## Next Steps

- [Authentication](authentication.md) -- Configure your authentication method.
- [Endpoints](endpoints.md) -- Full endpoint reference grouped by domain.
- [Rate Limits](rate-limits.md) -- Understand rate limiting and best practices.
