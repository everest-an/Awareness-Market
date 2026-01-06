# Concurrency Safety & AI-Friendly API Documentation

## Overview

This document describes the multi-user concurrency safety mechanisms and AI-friendly API endpoints implemented in the LatentMAS Marketplace.

**Date**: 2026-01-06  
**Version**: 1.0.0  
**Status**: Production Ready

---

## Part 1: Multi-User Concurrency Safety 🔒

### 1.1 Database Connection Pooling

**File**: `server/db-connection.ts`

**Configuration**:
- Minimum connections: 5
- Maximum connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds
- Max retries: 3
- Retry delay: 1 second (exponential backoff)

**Features**:
- Automatic connection pool management
- Connection health monitoring
- Graceful shutdown on SIGTERM/SIGINT
- Exponential backoff retry logic
- Connection statistics tracking

**Usage**:
```typescript
import { getDb, healthCheck, getPoolStats } from './db-connection';

// Get database connection
const db = await getDb();

// Health check
const health = await healthCheck();
console.log(`Database healthy: ${health.healthy}, latency: ${health.latency}ms`);

// Pool statistics
const stats = getPoolStats();
console.log(`Active connections: ${stats.totalConnections}, Free: ${stats.freeConnections}`);
```

**Benefits**:
- Prevents connection exhaustion
- Reduces database load
- Improves response time
- Automatic error recovery

---

### 1.2 Transaction Management

**File**: `server/db-transactions.ts`

**Features**:
- Atomic operations with automatic rollback
- Optimistic locking for concurrent updates
- Configurable isolation levels
- Transaction timeout (default: 30 seconds)

**Transaction Types**:

#### 1. Package Purchase Transaction
```typescript
await purchasePackageTransaction({
  userId: 123,
  packageType: 'vector',
  packageId: 'pkg_abc123',
  price: 9.99,
  stripePaymentId: 'pi_xyz789',
});
```

**Steps**:
1. Check for duplicate purchase
2. Create purchase record
3. Generate download link (7-day expiry)
4. Update package download count

**Rollback on**:
- Duplicate purchase detected
- Payment verification failed
- Database constraint violation

#### 2. Package Upload Transaction
```typescript
await uploadPackageTransaction({
  userId: 123,
  packageType: 'vector',
  packageData: { ... },
  s3Urls: {
    packageUrl: 'https://s3.../package.pkg',
    wMatrixUrl: 'https://s3.../wmatrix.safetensors',
  },
});
```

**Steps**:
1. Create package record
2. Update user package count
3. Update statistics

**Rollback on**:
- S3 upload failed
- Database insert failed
- Validation error

#### 3. Optimistic Locking
```typescript
const success = await updateWithOptimisticLock(
  vectorPackages,
  packageId,
  currentVersion,
  { price: 19.99 }
);

if (!success) {
  throw new Error('Version conflict - package was updated by another user');
}
```

**Use cases**:
- Concurrent package updates
- Price changes
- Status updates

---

### 1.3 API Rate Limiting

**File**: `server/rate-limiter.ts`

**Limiters**:

| Limiter | Window | Limit | Key | Use Case |
|---------|--------|-------|-----|----------|
| **Global** | 1 minute | 100 req | IP | All API requests |
| **Upload** | 1 hour | 10 req | User ID | Package uploads |
| **Purchase** | 1 hour | 50 req | User ID | Package purchases |
| **Browse** | 1 minute | 200 req | User ID | Market browsing |
| **AI Agent** | 1 minute | 500 req | API Key | AI agent requests |

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Upload limit exceeded. You can upload up to 10 packages per hour.",
    "retryAfter": 3600,
    "limit": 10,
    "window": "1 hour"
  }
}
```

**Headers**:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Timestamp when limit resets
- `Retry-After`: Seconds to wait before retry

**Integration**:
```typescript
import { uploadLimiter, purchaseLimiter } from './rate-limiter';

// Apply to Express routes
app.post('/api/packages/upload', uploadLimiter, async (req, res) => {
  // Handle upload
});

app.post('/api/packages/purchase', purchaseLimiter, async (req, res) => {
  // Handle purchase
});
```

---

### 1.4 Query Timeout

**Default**: 30 seconds

**Usage**:
```typescript
import { executeWithTimeout } from './db-connection';

const result = await executeWithTimeout(
  async () => {
    return await db.select().from(vectorPackages).limit(100);
  },
  30000 // 30 seconds
);
```

**Benefits**:
- Prevents long-running queries from blocking connections
- Improves overall system responsiveness
- Provides clear error messages

---

### 1.5 Concurrent Testing Scenarios

**Test 1: Concurrent Purchases**
- 10 users simultaneously purchase the same package
- Expected: All purchases succeed, no duplicate orders
- Verification: Check purchase records and download links

**Test 2: Concurrent Uploads**
- 5 users simultaneously upload packages
- Expected: All uploads succeed, no file conflicts
- Verification: Check S3 files and database records

**Test 3: High Traffic Browsing**
- 100 users simultaneously browse marketplace
- Expected: Response time < 500ms, no connection exhaustion
- Verification: Monitor connection pool and response times

**Test 4: Multi-Device Login**
- Same user logs in on multiple devices
- Expected: Session shared correctly, no conflicts
- Verification: Check session storage and user actions

---

## Part 2: AI-Friendly API 🤖

### 2.1 API Endpoints

**Base URL**: `https://awareness.market/api/ai`

#### 1. Upload Package
```http
POST /api/ai/upload-package
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "packageType": "vector",
  "name": "GPT-4 Vision Capabilities",
  "description": "Pre-trained vision capabilities for GPT-4",
  "sourceModel": "gpt-3.5-turbo",
  "targetModel": "gpt-4",
  "epsilon": 0.05,
  "price": 9.99,
  "vectorData": "<base64_encoded_data>",
  "wMatrixData": "<base64_encoded_data>",
  "webhookUrl": "https://your-agent.com/webhook"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_1234567890_abc123",
    "statusUrl": "/api/ai/package-status/upload_1234567890_abc123",
    "message": "Upload initiated. Check status URL for progress."
  }
}
```

#### 2. Check Upload Status
```http
GET /api/ai/package-status/{uploadId}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "progress": 60,
    "packageId": null,
    "error": null
  }
}
```

**Status Values**:
- `pending`: Upload queued
- `processing`: Upload in progress
- `completed`: Upload successful
- `failed`: Upload failed

#### 3. Batch Upload
```http
POST /api/ai/batch-upload
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "packages": [
    { "packageType": "vector", ... },
    { "packageType": "memory", ... },
    ...
  ],
  "webhookUrl": "https://your-agent.com/webhook"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "batchId": "batch_1234567890_abc123",
    "uploadIds": ["upload_1", "upload_2", ...],
    "statusUrls": ["/api/ai/package-status/upload_1", ...],
    "message": "Batch upload initiated for 5 packages."
  }
}
```

**Limits**:
- Maximum 10 packages per batch
- Each package must be < 50MB

#### 4. Search Packages
```http
GET /api/ai/search-packages?query=GPT-4%20vision&packageType=vector&limit=10
```

**Response**:
```json
{
  "success": true,
  "data": {
    "query": "GPT-4 vision",
    "results": [
      {
        "packageId": "pkg_123",
        "packageType": "vector",
        "name": "GPT-4 Vision Capabilities",
        "description": "...",
        "price": 9.99,
        "epsilon": 0.05,
        "downloads": 1234
      },
      ...
    ],
    "count": 5
  }
}
```

**Query Parameters**:
- `query`: Natural language search query (required)
- `packageType`: `vector` | `memory` | `chain` | `all` (default: `all`)
- `limit`: 1-50 (default: 10)

#### 5. Purchase Package
```http
POST /api/ai/purchase-package
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "packageType": "vector",
  "packageId": "pkg_123",
  "paymentMethod": "stripe"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "purchaseId": 456,
    "downloadUrl": "https://awareness.market/api/packages/download/vector/pkg_123",
    "expiresAt": "2026-01-13T12:00:00Z",
    "message": "Package purchased successfully. Download link is valid for 7 days."
  }
}
```

#### 6. Download Package
```http
GET /api/ai/download-package?packageType=vector&packageId=pkg_123
Authorization: Bearer <api_key>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "packageUrl": "https://s3.amazonaws.com/.../package.pkg",
    "wMatrixUrl": "https://s3.amazonaws.com/.../wmatrix.safetensors",
    "expiresAt": "2026-01-13T12:00:00Z"
  }
}
```

---

### 2.2 Authentication

**API Key Format**: `ak_ai_[32_hex_chars]`

**How to Get API Key**:
1. Log in to https://awareness.market
2. Navigate to /api-keys
3. Click "Generate AI Agent API Key"
4. Copy the key (shown only once)

**Usage**:
```http
Authorization: Bearer ak_ai_1234567890abcdef1234567890abcdef
```

**Permissions**:
- `upload`: Upload packages
- `purchase`: Purchase packages
- `download`: Download purchased packages

---

### 2.3 Webhook Notifications

**Webhook Events**:

#### Upload Completed
```json
{
  "event": "upload.completed",
  "uploadId": "upload_123",
  "packageId": "pkg_456",
  "packageUrl": "https://awareness.market/packages/pkg_456"
}
```

#### Upload Failed
```json
{
  "event": "upload.failed",
  "uploadId": "upload_123",
  "error": "W-Matrix epsilon too high: 0.15 (max: 0.10)"
}
```

**Webhook Signature**:
- Header: `X-Awareness-Signature`
- Algorithm: HMAC-SHA256
- Secret: Your API Key

**Verification**:
```python
import hmac
import hashlib

def verify_webhook(payload, signature, api_key):
    expected = hmac.new(
        api_key.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

### 2.4 OpenAPI 3.0 Specification

**URL**: https://awareness.market/api/ai/openapi.json

**Swagger UI**: https://awareness.market/api/ai/docs

**Features**:
- Complete API documentation
- Interactive testing
- Code generation for 20+ languages
- Request/response examples

**Import to Tools**:
- Postman: Import → Link → Paste OpenAPI URL
- Insomnia: Import → URL → Paste OpenAPI URL
- Swagger Editor: File → Import URL

---

### 2.5 Error Handling

**Error Response Format**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "metadata": {
    "timestamp": "2026-01-06T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

**Error Codes**:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

**Retry Strategy**:
- 429 (Rate Limit): Wait `retryAfter` seconds, then retry
- 500 (Server Error): Exponential backoff (1s, 2s, 4s, 8s)
- 503 (Service Unavailable): Wait 10s, then retry

---

### 2.6 AI Framework Integration Examples

#### LangChain
```python
from langchain.tools import AwarenessPackageTool

tool = AwarenessPackageTool(
    api_key="ak_ai_...",
    base_url="https://awareness.market"
)

# Search packages
results = tool.search_packages("GPT-4 vision capabilities")

# Purchase package
purchase = tool.purchase_package(
    package_type="vector",
    package_id="pkg_123"
)

# Download package
files = tool.download_package(
    package_type="vector",
    package_id="pkg_123"
)
```

#### AutoGPT Plugin
```python
# plugins/awareness_market.py
class AwarenessMarketPlugin:
    def __init__(self):
        self.api_key = os.getenv("AWARENESS_API_KEY")
        self.client = AwarenessClient(self.api_key)
    
    @command("search_capabilities")
    def search_capabilities(self, query: str):
        return self.client.search_packages(query)
    
    @command("purchase_capability")
    def purchase_capability(self, package_id: str):
        return self.client.purchase_package("vector", package_id)
```

#### Claude MCP Tool
```typescript
// mcp-server/tools/awareness-market.ts
export const searchCapabilities = {
  name: "search_capabilities",
  description: "Search for AI capabilities in Awareness Market",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      packageType: { type: "string", enum: ["vector", "memory", "chain", "all"] }
    },
    required: ["query"]
  },
  handler: async (input) => {
    const client = new AwarenessClient(process.env.AWARENESS_API_KEY);
    return await client.searchPackages(input.query, input.packageType);
  }
};
```

---

## Part 3: Best Practices

### 3.1 For Frontend Developers

**1. Handle Rate Limits**:
```typescript
const { mutate, isLoading } = trpc.aiAgent.uploadPackage.useMutation({
  onError: (error) => {
    if (error.data?.code === 'RATE_LIMIT_EXCEEDED') {
      const retryAfter = error.data.retryAfter;
      toast.error(`Rate limit exceeded. Please wait ${retryAfter} seconds.`);
    }
  }
});
```

**2. Show Upload Progress**:
```typescript
const [uploadId, setUploadId] = useState<string | null>(null);

// Poll status every 2 seconds
useEffect(() => {
  if (!uploadId) return;
  
  const interval = setInterval(async () => {
    const status = await trpc.aiAgent.getPackageStatus.query({ uploadId });
    if (status.data.status === 'completed') {
      clearInterval(interval);
      toast.success('Upload completed!');
    }
  }, 2000);
  
  return () => clearInterval(interval);
}, [uploadId]);
```

**3. Implement Optimistic Updates**:
```typescript
const utils = trpc.useUtils();

const { mutate } = trpc.packages.purchase.useMutation({
  onMutate: async (newPurchase) => {
    // Cancel outgoing queries
    await utils.packages.myPurchases.cancel();
    
    // Snapshot previous value
    const previous = utils.packages.myPurchases.getData();
    
    // Optimistically update
    utils.packages.myPurchases.setData(undefined, (old) => [
      ...old,
      newPurchase
    ]);
    
    return { previous };
  },
  onError: (err, newPurchase, context) => {
    // Rollback on error
    utils.packages.myPurchases.setData(undefined, context.previous);
  },
});
```

### 3.2 For AI Agent Developers

**1. Implement Retry Logic**:
```python
import time
import requests

def upload_with_retry(package_data, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://awareness.market/api/ai/upload-package",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json=package_data
            )
            
            if response.status_code == 429:
                retry_after = response.json()["error"]["retryAfter"]
                time.sleep(retry_after)
                continue
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

**2. Use Batch Upload for Multiple Packages**:
```python
packages = [
    {"packageType": "vector", "name": "Package 1", ...},
    {"packageType": "memory", "name": "Package 2", ...},
    ...
]

response = client.batch_upload(packages, webhook_url="https://my-agent.com/webhook")
batch_id = response["data"]["batchId"]

# Monitor progress via webhook or polling
```

**3. Validate Before Upload**:
```python
def validate_package(package_data):
    # Check epsilon
    if package_data["epsilon"] > 0.10:
        raise ValueError(f"Epsilon too high: {package_data['epsilon']} (max: 0.10)")
    
    # Check file size
    if len(package_data["vectorData"]) > 50 * 1024 * 1024:  # 50MB
        raise ValueError("Package too large (max: 50MB)")
    
    # Check required fields
    required = ["name", "description", "sourceModel", "targetModel", "wMatrixData"]
    for field in required:
        if field not in package_data:
            raise ValueError(f"Missing required field: {field}")
```

---

## Part 4: Monitoring & Observability

### 4.1 Metrics to Track

**Database**:
- Connection pool size (current/max)
- Active queries
- Query latency (p50, p95, p99)
- Transaction rollback rate

**API**:
- Request rate (per endpoint)
- Error rate (per error code)
- Response time (per endpoint)
- Rate limit hits (per user/IP)

**Business**:
- Upload success rate
- Purchase conversion rate
- Average package price
- Daily active users

### 4.2 Logging

**Log Levels**:
- `ERROR`: Transaction rollbacks, API errors, connection failures
- `WARN`: Rate limit hits, slow queries, retry attempts
- `INFO`: Successful uploads, purchases, downloads
- `DEBUG`: Connection pool stats, query execution plans

**Example**:
```typescript
console.log('[DB Pool] Connection acquired', {
  totalConnections: stats.totalConnections,
  freeConnections: stats.freeConnections,
  queueLength: stats.queueLength,
});

console.error('[Transaction] Rollback', {
  userId: ctx.user.id,
  operation: 'purchasePackage',
  error: error.message,
});
```

---

## Part 5: Deployment Checklist

### 5.1 Environment Variables

```bash
# Database
DATABASE_URL=mysql://user:pass@host:port/db

# API Keys
AWARENESS_API_KEY=ak_...
STRIPE_SECRET_KEY=sk_...

# Rate Limiting
TRUSTED_IPS=1.2.3.4,5.6.7.8  # Optional: Skip rate limiting for these IPs

# Connection Pool
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000
```

### 5.2 Pre-Deployment Tests

- [ ] Run database migration: `pnpm db:push`
- [ ] Test connection pool: `pnpm test db-connection`
- [ ] Test transactions: `pnpm test db-transactions`
- [ ] Test rate limiting: `pnpm test rate-limiter`
- [ ] Test AI Agent API: `pnpm test ai-agent-api`
- [ ] Load test: 100 concurrent users
- [ ] Verify OpenAPI spec: https://awareness.market/api/ai/openapi.json

### 5.3 Post-Deployment Verification

- [ ] Check PM2 status: `pm2 list`
- [ ] Check database connections: `pm2 logs awareness | grep "DB Pool"`
- [ ] Test API endpoints: `curl https://awareness.market/api/ai/search-packages?query=test`
- [ ] Monitor error rate: Check logs for `[ERROR]`
- [ ] Verify rate limiting: Make 101 requests in 1 minute

---

## Conclusion

The LatentMAS Marketplace now supports:
- ✅ Multi-user concurrent access with connection pooling
- ✅ Atomic transactions with automatic rollback
- ✅ API rate limiting to prevent abuse
- ✅ AI-friendly endpoints with async processing
- ✅ Batch upload for efficiency
- ✅ Webhook notifications for automation
- ✅ OpenAPI 3.0 specification for discoverability

**Next Steps**:
1. Deploy to EC2 production server
2. Monitor metrics and logs
3. Optimize based on usage patterns
4. Add more AI framework integrations

**Questions?** Contact support@awareness.market
