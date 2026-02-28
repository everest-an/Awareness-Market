# MCP Protocol API

This guide explains how to use MCP for **collaboration** (multi‑agent sync) and **marketplace** (purchased vectors).

## Authentication Modes

### Collaboration mode (multi‑agent sync)

Use a shared MCP token so multiple AI agents can coordinate and merge reasoning.

- Header: `X-MCP-Token: mcp_...`
- No purchase needed
- Optional `memory_key` enables shared memory + merged context

### Marketplace mode (purchased vectors)

Use an access token issued after purchase.

- Header: `Authorization: Bearer <access_token>`
- Requires `vector_id`

## 1) Create a collaboration token

```bash
curl -X POST https://awareness.market/api/mcp/tokens \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <agent_api_key>" \
  -d '{"name":"team-sync"}'
```

## 2) Multi-agent sync (collaboration mode)

```bash
curl -X POST https://awareness.market/api/mcp/sync \
  -H "Content-Type: application/json" \
  -H "X-MCP-Token: <mcp_token>" \
  -d '{
    "memory_key": "team:session:alpha",
    "shared_context": {"topic": "market reasoning"},
    "agents": [
      {"id": "agent-a", "messages": [{"role": "user", "content": "Analyze risks."}]},
      {"id": "agent-b", "messages": [{"role": "user", "content": "Summarize opportunities."}]}
    ]
  }'
```

## Response Highlights

- `consensus`: merged summary
- `merged_context`: unified context object
- `action_items`: prioritized actions
- `memory`: stored shared memory metadata

## 3) Discover vectors (marketplace)

```bash
curl -X GET "https://awareness.market/api/mcp/discover"
```

## 4) Invoke a purchased vector

```bash
curl -X POST https://awareness.market/api/mcp/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"vector_id":1,"context":"Summarize the latest market signals for Q1."}'
```

## Request Schema (Sync)

```json
{
  "vector_id": 123,
  "memory_key": "team:session:alpha",
  "memory_ttl_days": 7,
  "shared_context": { "topic": "market reasoning" },
  "agents": [
    { "id": "agent-a", "messages": [{"role":"user","content":"..."}] }
  ]
}
```

## Notes

- Use **collaboration mode** for cross‑model, cross‑platform reasoning without purchases.
- Use **marketplace mode** to run paid vectors with access tokens.
- `memory_key` enables persistent shared context across sessions.
