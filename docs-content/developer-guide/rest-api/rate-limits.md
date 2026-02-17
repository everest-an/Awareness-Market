# Rate Limits

The Awareness Network API enforces rate limits to ensure fair usage and platform stability. Limits are applied per API key (or per session/MCP token) and vary by endpoint category.

## Rate Limit Tiers

### Per-Endpoint Limits

| Endpoint Category | Requests per Minute | Burst Allowance | Notes |
|---|---|---|---|
| **Search** (`*.search`) | 120 | 20 | Covers all search endpoints across vectors, memories, and chains. |
| **Read** (`*.getById`, `user.*`) | 300 | 50 | High-frequency reads for detail pages, profiles, and metadata. |
| **Purchase** (`marketplace.purchase`) | 30 | 5 | Throttled to prevent automated buying abuse. |
| **Download** (`*.download`) | 60 | 10 | Bandwidth-sensitive. Large file downloads count as one request. |
| **Publish** (`*.publish`) | 10 | 2 | Rate-limited to allow review queue processing. |
| **Alignment** (`wmatrix.*`) | 20 | 3 | Compute-intensive operations. |
| **Auth** (`auth.*`) | 20 | 5 | Login, refresh, and token creation. |
| **Collaboration** (`collaboration.*`) | 60 | 10 | Workspace and sharing operations. |
| **Robotics** (`robotics.*`) | 60 | 10 | Robotics profile and deployment operations. |

### Account-Level Limits

In addition to per-endpoint limits, there is an account-wide ceiling:

| Plan | Total Requests per Minute | Total Requests per Day |
|---|---|---|
| **Free** | 60 | 5,000 |
| **Developer** | 300 | 50,000 |
| **Pro** | 1,000 | 500,000 |
| **Enterprise** | Custom | Custom |

Account-level limits are the maximum across all endpoints combined. If your account-level limit is lower than the per-endpoint limit, the account-level limit takes precedence.

## Burst Allowance

Each endpoint category has a burst allowance that permits short spikes above the sustained rate. Bursts use a **token bucket** algorithm:

- The bucket fills at the sustained rate (requests per minute / 60 = tokens per second).
- The bucket can hold up to the burst allowance number of tokens.
- Each request consumes one token.
- If the bucket is empty, the request is rate-limited (HTTP 429).

**Example:** The search endpoint allows 120 requests/minute (2 per second) with a burst of 20. You can send 20 requests instantly, then must sustain no more than 2 per second.

## Rate Limit Headers

Every API response includes rate limit headers:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1708084860
X-RateLimit-Bucket: search
```

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window. |
| `X-RateLimit-Remaining` | Requests remaining in the current window. |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets. |
| `X-RateLimit-Bucket` | The rate limit bucket this endpoint belongs to. |

## Handling 429 Responses

When you exceed a rate limit, the API returns HTTP 429 with a `Retry-After` header:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 8
Content-Type: application/json

{
  "error": {
    "message": "Rate limit exceeded. Retry after 8 seconds.",
    "code": "TOO_MANY_REQUESTS",
    "data": {
      "httpStatus": 429,
      "bucket": "search",
      "limit": 120,
      "reset_at": "2026-02-16T10:01:00Z",
      "retry_after": 8
    }
  }
}
```

### Retry Strategy

Implement exponential backoff with jitter:

```python
import time
import random

def request_with_retry(make_request, max_retries=5):
    for attempt in range(max_retries):
        response = make_request()

        if response.status_code != 429:
            return response

        # Use the Retry-After header if available
        retry_after = int(response.headers.get("Retry-After", 1))

        # Add jitter to prevent thundering herd
        jitter = random.uniform(0, retry_after * 0.5)
        wait_time = retry_after + jitter

        print(f"Rate limited. Retrying in {wait_time:.1f}s (attempt {attempt + 1})")
        time.sleep(wait_time)

    raise Exception("Max retries exceeded")
```

```typescript
async function requestWithRetry(
  makeRequest: () => Promise<Response>,
  maxRetries = 5
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await makeRequest();

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
    const jitter = Math.random() * retryAfter * 0.5;
    const waitTime = retryAfter + jitter;

    console.log(`Rate limited. Retrying in ${waitTime.toFixed(1)}s (attempt ${attempt + 1})`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }

  throw new Error('Max retries exceeded');
}
```

{% hint style="info" %}
The official Python and JavaScript SDKs handle rate limit retries automatically with exponential backoff. You only need to implement retry logic if you are calling the REST API directly.
{% endhint %}

## Best Practices

### 1. Use the SDKs

The official SDKs (`awareness-sdk` for Python, `@awareness/sdk` for JavaScript) handle rate limiting automatically, including retry logic, backoff, and header parsing. Use them instead of making raw HTTP requests when possible.

### 2. Cache Search Results

Search results are stable for short periods. Cache results client-side for 30--60 seconds to reduce redundant requests:

```typescript
const cache = new Map<string, { data: any; expiresAt: number }>();

async function cachedSearch(query: string) {
  const key = `search:${query}`;
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const results = await client.vectors.search({ query });
  cache.set(key, { data: results, expiresAt: Date.now() + 30_000 });
  return results;
}
```

### 3. Batch Where Possible

Use the `batch_load()` method in the SDKs instead of downloading packages one at a time. A single batch load counts as one request per package but is more efficient than sequential individual requests.

### 4. Monitor Your Usage

Check your current rate limit status by inspecting the `X-RateLimit-Remaining` header. Proactively slow down when approaching the limit rather than waiting for a 429.

### 5. Use Webhooks for Long-Running Operations

For alignment jobs that may take minutes, use the webhook notification system instead of polling `wmatrix.getJobStatus`:

```
POST /v1/wmatrix.align
{
  "base_weights_url": "...",
  "vector_package_id": "pkg_abc123",
  "webhook_url": "https://your-server.com/webhooks/alignment-complete"
}
```

The webhook delivers a `POST` request to your URL when the job completes, eliminating the need for repeated polling requests.

### 6. Spread Requests Over Time

If you need to process a large batch of operations, spread them evenly over time rather than sending them all at once:

```python
import time

package_ids = [...]  # 200 packages to check

for i, pkg_id in enumerate(package_ids):
    result = client.wmatrix.check_compatibility(
        package_id=pkg_id,
        target_model="llama-3.1-70b"
    )
    process(result)

    # Throttle to stay under 120 req/min = 2 req/sec
    if (i + 1) % 2 == 0:
        time.sleep(1)
```

### 7. Use Separate Keys for Separate Services

If you have multiple services calling the API, use separate API keys for each. Rate limits are per key, so separate keys get separate rate limit buckets.

## Rate Limit Increases

If you need higher rate limits, contact us:

- **Developer and Pro plans** can request temporary rate limit increases for specific time windows (e.g., a product launch).
- **Enterprise plans** include custom rate limits negotiated as part of the contract.

To request an increase, email [api-support@awareness.market](mailto:api-support@awareness.market) with:

1. Your account ID or API key prefix.
2. The endpoint categories you need increased.
3. The desired rate and duration.
4. A brief description of your use case.
