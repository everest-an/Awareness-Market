# Authentication

The Awareness Network API supports multiple authentication methods to accommodate different integration scenarios: server-to-server, browser-based, AI agent, and autonomous on-chain agent.

## Authentication Methods Overview

| Method | Use Case | Token Prefix | Lifetime |
|---|---|---|---|
| **API Key** | SDKs, scripts, server-to-server | `aw_live_` / `aw_test_` | Until revoked |
| **Session Token** | Browser applications, web dashboards | `aws_` | 24 hours (refreshable) |
| **MCP Token** | AI agent integrations via MCP | `awm_` | Configurable (1h--30d) |
| **Agent Auth (ERC-8004)** | Autonomous on-chain agents | Signed message | Per-transaction |

## API Keys

API keys are the most common authentication method. They are long-lived credentials suitable for SDKs, scripts, and backend services.

### Generating an API Key

1. Navigate to [Account Settings > API Keys](https://awareness.market/settings/api-keys).
2. Click **Create API Key**.
3. Name the key (e.g., "production-backend") and select permissions.
4. Copy the key immediately -- it is displayed only once.

### Using API Keys

Pass the API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer aw_live_sk_a1b2c3d4e5f6g7h8" \
  "https://api.awareness.market/v1/vectors.search?input=%7B%22query%22%3A%22reasoning%22%7D"
```

### Key Types

| Prefix | Environment | Description |
|---|---|---|
| `aw_live_` | Production | Full access to marketplace with real transactions. |
| `aw_test_` | Sandbox | Test environment. No real charges. Separate package catalog. |

### Key Permissions

API keys can be scoped with granular permissions:

| Permission | Description |
|---|---|
| `read:packages` | Search and view packages. |
| `write:packages` | Publish packages. |
| `purchase:packages` | Purchase and download packages. |
| `read:account` | View balance and transaction history. |
| `write:account` | Manage account settings. |
| `alignment:execute` | Run W-Matrix alignment operations. |

Example: A read-only integration key with `read:packages` can search and view packages but cannot make purchases.

### Revoking Keys

Revoke a compromised or unused key from [Account Settings > API Keys](https://awareness.market/settings/api-keys). Revocation takes effect immediately; all in-flight requests with the revoked key will fail.

---

## Session-Based Authentication

Session tokens are used by browser-based applications (the Awareness web dashboard, third-party web apps).

### Login Flow

```
POST /v1/auth.login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "..."
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "session_token": "aws_t1u2v3w4x5y6z7...",
      "expires_at": "2026-02-17T10:00:00Z",
      "refresh_token": "awr_a9b8c7d6e5f4..."
    }
  }
}
```

### Using Session Tokens

Pass the session token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer aws_t1u2v3w4x5y6z7..." \
  "https://api.awareness.market/v1/user.profile"
```

### Refreshing Sessions

Session tokens expire after 24 hours. Use the refresh token to obtain a new session:

```
POST /v1/auth.refresh
Content-Type: application/json

{
  "refresh_token": "awr_a9b8c7d6e5f4..."
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "session_token": "aws_new_token...",
      "expires_at": "2026-02-18T10:00:00Z",
      "refresh_token": "awr_new_refresh..."
    }
  }
}
```

### Logout

```
POST /v1/auth.logout
Authorization: Bearer aws_t1u2v3w4x5y6z7...
```

This invalidates both the session token and its associated refresh token.

---

## MCP Tokens

MCP tokens are purpose-built for AI agent integrations through the Model Context Protocol. They carry scoped permissions and can have configurable lifetimes.

### Generating an MCP Token

```
POST /v1/auth.createMcpToken
Authorization: Bearer aw_live_...
Content-Type: application/json

{
  "name": "claude-desktop-agent",
  "permissions": ["read:packages", "purchase:packages"],
  "expires_in": "7d"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "token": "awm_mcp_x1y2z3...",
      "name": "claude-desktop-agent",
      "permissions": ["read:packages", "purchase:packages"],
      "expires_at": "2026-02-23T10:00:00Z"
    }
  }
}
```

### MCP Token Lifetimes

| Value | Duration |
|---|---|
| `"1h"` | 1 hour |
| `"24h"` | 24 hours |
| `"7d"` | 7 days |
| `"30d"` | 30 days |

### Using MCP Tokens

MCP tokens are typically passed to the MCP server via environment variables, but they can also be used directly in the `Authorization` header:

```bash
curl -H "Authorization: Bearer awm_mcp_x1y2z3..." \
  "https://api.awareness.market/v1/vectors.search?input=%7B%22query%22%3A%22reasoning%22%7D"
```

### Spending Limits

MCP tokens support optional spending limits to cap how much an AI agent can spend:

```json
{
  "name": "autonomous-agent",
  "permissions": ["read:packages", "purchase:packages"],
  "expires_in": "24h",
  "spending_limit": {
    "max_per_transaction": 10.00,
    "max_total": 50.00,
    "currency": "USDC"
  }
}
```

---

## Agent Auth (ERC-8004)

For fully autonomous on-chain agents, the Awareness Network supports authentication via **ERC-8004**, a standard for agent identity and authorization on Ethereum-compatible chains.

### How It Works

1. The agent holds a private key associated with an on-chain agent identity (ERC-8004 contract).
2. The agent signs each API request with its private key.
3. The Awareness API verifies the signature against the agent's on-chain identity.
4. Payments are settled on-chain rather than through account balance.

### Request Signing

ERC-8004 requests include three additional headers:

| Header | Description |
|---|---|
| `X-Agent-Address` | The Ethereum address of the agent's ERC-8004 identity contract. |
| `X-Agent-Signature` | EIP-712 typed signature of the request payload. |
| `X-Agent-Timestamp` | ISO 8601 timestamp. Requests older than 5 minutes are rejected. |

### Example

```bash
curl -X POST "https://api.awareness.market/v1/marketplace.purchase" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Address: 0x1234...abcd" \
  -H "X-Agent-Signature: 0xsig..." \
  -H "X-Agent-Timestamp: 2026-02-16T10:00:00Z" \
  -d '{"package_id":"pkg_abc123"}'
```

### EIP-712 Domain

```json
{
  "name": "Awareness Network",
  "version": "1",
  "chainId": 8453,
  "verifyingContract": "0xAwareness..."
}
```

### On-Chain Payment Flow

When an ERC-8004 agent makes a purchase:

1. The API returns a payment intent with an on-chain transaction to execute.
2. The agent signs and submits the transaction.
3. The API monitors the chain for confirmation.
4. Upon confirmation, the download token is issued.

```json
{
  "result": {
    "data": {
      "payment_intent": {
        "chain_id": 8453,
        "contract": "0xAwareness...",
        "method": "purchasePackage(bytes32,uint256)",
        "args": ["0xpkg_hash...", "2500000"],
        "value": "0"
      },
      "confirmation_endpoint": "/v1/marketplace.confirmPayment"
    }
  }
}
```

---

## Security Best Practices

1. **Never expose API keys in client-side code.** Use session tokens or a backend proxy for browser applications.
2. **Use the minimum required permissions.** Scope API keys and MCP tokens to only the permissions the integration needs.
3. **Rotate keys periodically.** Generate new keys and revoke old ones on a regular schedule.
4. **Set spending limits on MCP tokens.** Prevent runaway agent spending with per-transaction and total caps.
5. **Monitor API key usage.** Check the [API Key Activity](https://awareness.market/settings/api-keys) dashboard for unusual patterns.
6. **Use test keys for development.** The `aw_test_` prefix keys operate in a sandbox with no real charges.
