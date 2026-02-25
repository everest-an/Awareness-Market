# Webhook Adapter Layer — Deployment Guide

## Overview

This release adds a **Webhook Adapter Layer** that decouples external webhook requests from the MCP core agent communication. External systems can now safely trigger workflow actions (propose/execute/stop/sync/tool) via `POST /api/webhooks/inbound` — all requests are validated, queued via BullMQ, and processed asynchronously.

---

## Architecture

```
External System → POST /api/webhooks/inbound
  → Rate Limit (30/min)
  → HMAC-SHA256 Verification
  → Zod Schema Validation
  → BullMQ webhook-inbound queue (async barrier)
  → Worker processes command → MCP/Collaboration Engine
  → BullMQ webhook-outbound queue → Reliable delivery with retry
```

---

## Pre-Deployment Checklist

### 1. Database Migration

Run the migration SQL against your production PostgreSQL database:

```bash
# Option A: Direct SQL execution
psql $DATABASE_URL -f prisma/migrations/10_add_webhook_events.sql

# Option B: Via Prisma (if you have DB access from local)
npx prisma migrate dev --name add-webhook-events
```

This creates:
- `webhook_events` table (audit log for all inbound/outbound webhooks)
- Adds `webhook_url`, `webhook_secret`, `webhook_events` columns to `workflows` table (if not present)

### 2. Prisma Client Regeneration

```bash
npx prisma generate
```

### 3. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | Yes (for BullMQ) | `localhost` | Redis host for webhook queues |
| `REDIS_PORT` | No | `6379` | Redis port |
| `BASE_URL` | No | `http://localhost:5000` | Server base URL (for MCP sync/tool calls) |

**Note**: If `REDIS_HOST` is not set, the webhook adapter gracefully degrades:
- Outbound: falls back to direct HTTP dispatch (no retry/audit)
- Inbound: returns 503 Service Unavailable

### 4. Build & Deploy

```bash
pnpm run build
# Deploy to your hosting platform (Vercel, EC2, etc.)
```

---

## API Reference

### Inbound Webhook Endpoint

```
POST /api/webhooks/inbound
Content-Type: application/json
X-Webhook-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>
```

**Request Body:**
```json
{
  "workflowId": "wf_xxx",
  "action": "propose" | "execute" | "stop" | "sync" | "tool",
  "data": { ... },
  "toolName": "share_reasoning",
  "requestId": "optional-idempotency-key"
}
```

**Actions:**

| Action | Description | Requirements |
|--------|-------------|--------------|
| `propose` | Store proposal in workflow shared memory | Workflow exists |
| `execute` | Trigger workflow execution | Workflow status = `pending` |
| `stop` | Cancel running workflow | Workflow not completed/cancelled |
| `sync` | Call MCP sync endpoint for multi-agent coordination | Workflow exists |
| `tool` | Invoke specific MCP tool (e.g. share_reasoning) | `toolName` required |

**Response:**
```json
// 202 Accepted (async processing)
{
  "success": true,
  "requestId": "uuid",
  "message": "Queued for processing"
}

// 401 (invalid signature)
{ "success": false, "error": { "code": "INVALID_SIGNATURE" } }

// 429 (rate limited)
{ "success": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "retryAfter": 60 } }
```

### Generating HMAC Signature

```javascript
const crypto = require('crypto');

function signWebhook(body, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

// Usage
const body = JSON.stringify({ workflowId: 'wf_xxx', action: 'execute' });
const header = signWebhook(body, 'your-webhook-secret');
// Set as X-Webhook-Signature header
```

---

## Breaking Changes

### Removed: `agentCollaboration.triggerWebhook` tRPC Procedure

The old `triggerWebhook` publicProcedure has been **removed** from the tRPC router. External systems must migrate to the new REST endpoint:

**Before (removed):**
```javascript
// tRPC call — NO LONGER WORKS
trpc.agentCollaboration.triggerWebhook.mutate({
  workflowId: 'wf_xxx',
  webhookSecret: 'secret',
  action: 'execute',
});
```

**After (new):**
```javascript
// REST POST with HMAC signature
const body = JSON.stringify({ workflowId: 'wf_xxx', action: 'execute' });
const signature = signWebhook(body, 'secret');

fetch('https://api.awareness.market/api/webhooks/inbound', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
  },
  body,
});
```

### Changed: Outbound Webhook Delivery

Outbound webhooks (lifecycle events like `workflow.step.completed`) are now delivered via BullMQ queue with:
- **3 retry attempts** with exponential backoff (10s → 30s → 90s)
- **Audit logging** in `webhook_events` table
- **Dead letter queue** for permanently failed deliveries

No changes needed on the receiving end — same HMAC format and headers.

---

## Monitoring

### Webhook Audit Trail

Query the `webhook_events` table to inspect webhook activity:

```sql
-- Recent inbound webhooks
SELECT * FROM webhook_events
WHERE direction = 'inbound'
ORDER BY created_at DESC LIMIT 20;

-- Failed outbound deliveries
SELECT * FROM webhook_events
WHERE direction = 'outbound' AND status IN ('failed', 'dlq')
ORDER BY created_at DESC;

-- Delivery success rate (last 24h)
SELECT
  direction,
  status,
  COUNT(*) as count
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY direction, status;
```

### BullMQ Queue Monitoring

The webhook queues are registered as standard BullMQ workers:
- `webhook-inbound` — 3 concurrency, 10 jobs/sec rate limit
- `webhook-outbound` — 5 concurrency, 20 jobs/sec rate limit

Monitor via BullMQ dashboard or:
```bash
# Check queue sizes (requires Redis CLI)
redis-cli LLEN bull:webhook-inbound:wait
redis-cli LLEN bull:webhook-outbound:wait
redis-cli LLEN bull:webhook-outbound:failed
```

---

## Files Changed

| Action | File |
|--------|------|
| **New** | `server/collaboration/webhook-adapter.ts` |
| **New** | `server/collaboration/webhook-adapter.test.ts` |
| **New** | `server/routes/webhook-inbound.ts` |
| **New** | `server/workers/webhook-inbound-worker.ts` |
| **New** | `server/workers/webhook-outbound-worker.ts` |
| **New** | `prisma/migrations/10_add_webhook_events.sql` |
| **Modified** | `prisma/schema.prisma` |
| **Modified** | `server/collaboration/webhook-dispatcher.ts` |
| **Modified** | `server/routers/agent-collaboration.ts` |
| **Modified** | `server/workers/index.ts` |
| **Modified** | `server/_core/index.ts` |

---

## Rollback Plan

1. Revert the deployment to the previous version
2. The `webhook_events` table can remain (no data loss)
3. Old `triggerWebhook` tRPC endpoint will be restored automatically
4. Outbound webhooks will fall back to fire-and-forget behavior
