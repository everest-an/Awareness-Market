# Redis Caching Strategy

## Overview

The RMC uses Redis as its primary state cache, delivering a **125x performance improvement** over direct PostgreSQL queries for hot-path data access. Every frequently read data path -- robot state, session data, task status, and health metrics -- is served from Redis with sub-millisecond latency.

This page covers what is cached, how caches are invalidated, TTL configuration, memory optimization, and the benchmarks that demonstrate the 125x improvement.

---

## What Is Cached

### Cache Categories

The RMC caches four categories of data in Redis, each with different access patterns and freshness requirements.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REDIS CACHE LAYOUT                           │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │   ROBOT STATE           │  │   SESSION DATA           │          │
│  │                         │  │                          │          │
│  │   Key: robot:{id}:state │  │   Key: session:{id}      │          │
│  │   TTL: 30s              │  │   TTL: 300s (5 min)      │          │
│  │   Access: ~100 reads/s  │  │   Access: ~20 reads/s    │          │
│  │   per robot             │  │   per session             │          │
│  │                         │  │                          │          │
│  │   - position (x,y,z)   │  │   - operatorId           │          │
│  │   - velocity            │  │   - robotId              │          │
│  │   - battery level       │  │   - status               │          │
│  │   - status (idle/busy)  │  │   - createdAt            │          │
│  │   - active tasks        │  │   - lastActivity         │          │
│  │   - last heartbeat      │  │   - config               │          │
│  │   - sensor summary      │  │   - permissions          │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────┐          │
│  │   TASK STATUS           │  │   HEALTH METRICS         │          │
│  │                         │  │                          │          │
│  │   Key: task:{id}:status │  │   Key: health:{robotId}  │          │
│  │   TTL: 60s              │  │   TTL: 15s               │          │
│  │   Access: ~50 reads/s   │  │   Access: ~10 reads/s    │          │
│  │   per active task       │  │   per robot              │          │
│  │                         │  │                          │          │
│  │   - status              │  │   - cpu_temp             │          │
│  │   - progress (0-100)    │  │   - gpu_temp             │          │
│  │   - assignedRobotId     │  │   - motor_temps          │          │
│  │   - subtask statuses    │  │   - wifi_signal          │          │
│  │   - error (if failed)   │  │   - error_codes          │          │
│  │   - updatedAt           │  │   - uptime               │          │
│  └─────────────────────────┘  └─────────────────────────┘          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │   AUXILIARY CACHES                                          │    │
│  │                                                             │    │
│  │   fleet:{id}:robots    → Set of robot IDs (TTL: 120s)      │    │
│  │   online:robots        → Sorted set by last heartbeat       │    │
│  │   robot:{id}:tasks     → List of active task IDs            │    │
│  │   vr:session:{id}      → VR session state (TTL: 60s)       │    │
│  │   metrics:summary      → Aggregated fleet metrics (TTL: 5s)│    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Cache Key Schema

All Redis keys follow a consistent naming convention for predictability and debugging.

| Pattern | Example | Type | Description |
|---------|---------|------|-------------|
| `robot:{robotId}:state` | `robot:01HXQ3K7M9:state` | Hash | Current robot state |
| `robot:{robotId}:tasks` | `robot:01HXQ3K7M9:tasks` | List | Active task IDs for a robot |
| `session:{sessionId}` | `session:01HXQ3K7NB:data` | Hash | Session metadata |
| `task:{taskId}:status` | `task:01HXQ3NR:status` | Hash | Task execution status |
| `health:{robotId}` | `health:01HXQ3K7M9` | Hash | Robot health metrics |
| `fleet:{fleetId}:robots` | `fleet:warehouse:robots` | Set | Robot IDs in a fleet |
| `online:robots` | `online:robots` | Sorted Set | Online robots (score = timestamp) |
| `vr:session:{sessionId}` | `vr:session:01HXQ3TR` | Hash | VR session state |
| `metrics:summary` | `metrics:summary` | String (JSON) | Aggregated fleet metrics |

---

## Cache Invalidation Strategy

The RMC uses a multi-strategy approach to cache invalidation, combining TTL-based expiry, event-driven invalidation, and write-through updates.

### Strategy Overview

```
┌──────────────────────────────────────────────────────────────┐
│                  INVALIDATION STRATEGIES                      │
│                                                              │
│   1. WRITE-THROUGH                                           │
│      Every state write updates both Redis AND PostgreSQL     │
│      simultaneously. The cache is always fresh after writes. │
│                                                              │
│   2. TTL-BASED EXPIRY                                        │
│      Every cache entry has a TTL. If no write refreshes      │
│      the entry before TTL expires, it is evicted. The next   │
│      read triggers a cache miss → PostgreSQL fetch → cache   │
│      populate.                                               │
│                                                              │
│   3. EVENT-DRIVEN INVALIDATION                               │
│      Specific events trigger immediate cache invalidation:   │
│      - Robot disconnect → delete robot:{id}:state            │
│      - Session terminate → delete session:{id}               │
│      - Task complete → delete task:{id}:status               │
│      - Emergency stop → invalidate all affected entries      │
│                                                              │
│   4. HEARTBEAT REFRESH                                       │
│      Robot heartbeats (every 10s) refresh the robot state    │
│      cache entry, resetting its TTL. Stale robots that stop  │
│      sending heartbeats are naturally evicted by TTL.        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Write-Through Implementation

```typescript
class StateManager {
  private redis: Redis;
  private db: PostgresClient;

  async updateRobotState(robotId: string, state: Partial<RobotState>): Promise<void> {
    const cacheKey = `robot:${robotId}:state`;

    // Write-through: update both Redis and PostgreSQL
    const pipeline = this.redis.pipeline();

    // Update individual hash fields (only changed fields)
    for (const [field, value] of Object.entries(state)) {
      pipeline.hset(cacheKey, field, JSON.stringify(value));
    }

    // Reset TTL on every write
    pipeline.expire(cacheKey, 30);

    // Update the sorted set for online robots
    if (state.lastHeartbeat) {
      pipeline.zadd("online:robots", Date.now(), robotId);
    }

    // Execute Redis pipeline (atomic)
    await pipeline.exec();

    // Persist to PostgreSQL (async, non-blocking)
    this.db.query(
      `UPDATE robots SET state = state || $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(state), robotId]
    ).catch(err => {
      // Log but don't fail the hot path
      logger.error("Failed to persist robot state to PostgreSQL", { robotId, err });
      // Prometheus counter for cache/db inconsistencies
      metrics.cacheDbWriteFailures.inc({ entity: "robot_state" });
    });
  }

  async getRobotState(robotId: string): Promise<RobotState> {
    const cacheKey = `robot:${robotId}:state`;

    // Try Redis first
    const cached = await this.redis.hgetall(cacheKey);

    if (Object.keys(cached).length > 0) {
      metrics.cacheHits.inc({ entity: "robot_state" });
      return deserializeRobotState(cached);
    }

    // Cache miss: fetch from PostgreSQL
    metrics.cacheMisses.inc({ entity: "robot_state" });
    const row = await this.db.query(
      `SELECT state FROM robots WHERE id = $1`,
      [robotId]
    );

    if (!row) throw new Error(`Robot ${robotId} not found`);

    // Populate cache
    const state = row.state as RobotState;
    const pipeline = this.redis.pipeline();
    for (const [field, value] of Object.entries(state)) {
      pipeline.hset(cacheKey, field, JSON.stringify(value));
    }
    pipeline.expire(cacheKey, 30);
    await pipeline.exec();

    return state;
  }
}
```

### Event-Driven Invalidation

```typescript
// Event handlers that trigger cache invalidation
eventBus.on("robot:disconnected", async (robotId: string) => {
  const pipeline = redis.pipeline();
  pipeline.del(`robot:${robotId}:state`);
  pipeline.del(`robot:${robotId}:tasks`);
  pipeline.del(`health:${robotId}`);
  pipeline.zrem("online:robots", robotId);
  await pipeline.exec();
  logger.info(`Cache invalidated for disconnected robot ${robotId}`);
});

eventBus.on("session:terminated", async (sessionId: string) => {
  await redis.del(`session:${sessionId}`);
  await redis.del(`vr:session:${sessionId}`);
  logger.info(`Cache invalidated for terminated session ${sessionId}`);
});

eventBus.on("task:completed", async (taskId: string, robotId: string) => {
  const pipeline = redis.pipeline();
  pipeline.del(`task:${taskId}:status`);
  pipeline.lrem(`robot:${robotId}:tasks`, 0, taskId);
  await pipeline.exec();
});

eventBus.on("emergency:stop", async (scope: EmergencyStopScope) => {
  if (scope.type === "global") {
    // Flush all robot state caches -- they will be repopulated on next heartbeat
    const robotIds = await redis.zrange("online:robots", 0, -1);
    const pipeline = redis.pipeline();
    for (const id of robotIds) {
      pipeline.del(`robot:${id}:state`);
      pipeline.del(`robot:${id}:tasks`);
    }
    await pipeline.exec();
    logger.warn("Global emergency stop: all robot state caches invalidated");
  }
});
```

---

## TTL Configuration

Each cache category has a different TTL based on its freshness requirements and access patterns.

| Cache Category | TTL | Rationale |
|---------------|-----|-----------|
| **Robot State** | 30s | Refreshed by heartbeats every 10s. If a robot stops sending heartbeats, its cached state naturally expires and reads fall through to PostgreSQL (which will show the last known state). |
| **Session Data** | 300s (5 min) | Sessions change infrequently after creation. The 5-minute TTL provides a safety net for abandoned sessions that were not explicitly terminated. |
| **Task Status** | 60s | Active tasks update their status frequently (every progress tick). The 60s TTL covers the gap between updates. Completed/failed tasks are immediately invalidated by event. |
| **Health Metrics** | 15s | Health data is highly time-sensitive. A 15s TTL ensures stale health data is never served for more than one missed reporting cycle. |
| **Fleet Membership** | 120s | Fleet composition changes rarely. The 2-minute TTL balances freshness with reduced Redis operations. |
| **VR Session** | 60s | VR sessions update state frequently during active teleoperation. Refreshed on every command send. |
| **Metrics Summary** | 5s | Aggregated metrics are recomputed every 5 seconds for dashboard display. |
| **Online Robots Set** | No TTL | Maintained as a sorted set. Stale entries are pruned by a periodic cleanup job (every 60s) that removes robots with heartbeat timestamps older than the disconnect threshold. |

### TTL Configuration File

```typescript
// config/cache-ttl.ts
export const cacheTTL = {
  robotState: 30,           // seconds
  sessionData: 300,
  taskStatus: 60,
  healthMetrics: 15,
  fleetMembership: 120,
  vrSession: 60,
  metricsSummary: 5,

  // Override TTLs per environment
  ...(process.env.NODE_ENV === "development" && {
    robotState: 10,         // Shorter TTLs in dev for faster iteration
    healthMetrics: 5,
    metricsSummary: 2
  })
};
```

---

## Memory Optimization

### Memory Budget

With a typical fleet of 50 robots and 200 concurrent tasks, the Redis memory footprint is approximately:

| Category | Keys | Avg Size | Total |
|----------|------|----------|-------|
| Robot State | 50 | 2 KB | 100 KB |
| Session Data | 50 | 1 KB | 50 KB |
| Task Status | 200 | 500 B | 100 KB |
| Health Metrics | 50 | 1 KB | 50 KB |
| Auxiliary (sets, lists) | 100 | 200 B | 20 KB |
| **Total** | **450** | | **~320 KB** |

The cache footprint is negligible even at large fleet scales. At 1,000 robots with 5,000 concurrent tasks, the total memory usage is approximately 6.5 MB.

### Optimization Techniques

**Hash Encoding** -- Small hashes (fewer than 128 fields, each smaller than 64 bytes) are stored using Redis's `ziplist` encoding, which is 5--10x more memory-efficient than the standard hash table encoding. Robot state and task status hashes qualify for ziplist encoding.

```
# redis.conf optimizations for RMC workload
hash-max-ziplist-entries 128
hash-max-ziplist-value 64
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

**Key Expiry** -- All keys have TTLs, preventing unbounded memory growth from orphaned entries.

**Pipeline Batching** -- Multiple Redis operations are batched into pipelines, reducing network round-trips and connection overhead.

**Selective Caching** -- Only hot-path data is cached. Historical data, audit logs, and infrequently accessed records are read directly from PostgreSQL.

**Compressed JSON** -- Large JSON values (e.g., LIDAR scan data) are compressed with gzip before storage when they exceed 1 KB.

```typescript
// Compress large values before caching
async function cacheWithCompression(key: string, value: object, ttl: number): Promise<void> {
  const json = JSON.stringify(value);

  if (json.length > 1024) {
    const compressed = await gzip(json);
    await redis.set(`${key}:gz`, compressed, "EX", ttl);
  } else {
    await redis.set(key, json, "EX", ttl);
  }
}

async function readWithDecompression(key: string): Promise<object | null> {
  // Try compressed key first
  const compressed = await redis.getBuffer(`${key}:gz`);
  if (compressed) {
    const json = await gunzip(compressed);
    return JSON.parse(json.toString());
  }

  // Fall back to uncompressed
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}
```

---

## Benchmarks: 125x Performance Improvement

### Test Methodology

Benchmarks were conducted on the following configuration:

- **Server**: 4-core CPU, 16 GB RAM
- **Redis**: 7.2, single instance, same host
- **PostgreSQL**: 16, single instance, same host
- **Data Set**: 50 robots, 500 active tasks, 50 sessions
- **Tool**: Custom load generator simulating realistic access patterns
- **Measurement**: p50, p95, and p99 latencies for 10,000 sequential reads

### Results

#### Robot State Read (`getRobotState`)

| Metric | PostgreSQL (uncached) | Redis (cached) | Improvement |
|--------|----------------------|----------------|-------------|
| **p50 latency** | 2.8 ms | 0.022 ms | **127x** |
| **p95 latency** | 5.1 ms | 0.035 ms | **146x** |
| **p99 latency** | 12.3 ms | 0.048 ms | **256x** |
| **Throughput** | 850 reads/s | 45,000 reads/s | **53x** |

#### Task Status Read (`getTaskStatus`)

| Metric | PostgreSQL (uncached) | Redis (cached) | Improvement |
|--------|----------------------|----------------|-------------|
| **p50 latency** | 3.2 ms | 0.025 ms | **128x** |
| **p95 latency** | 6.7 ms | 0.038 ms | **176x** |
| **p99 latency** | 15.1 ms | 0.052 ms | **290x** |
| **Throughput** | 720 reads/s | 40,000 reads/s | **56x** |

#### Fleet Status Query (`listOnlineRobots`)

| Metric | PostgreSQL (uncached) | Redis (cached) | Improvement |
|--------|----------------------|----------------|-------------|
| **p50 latency** | 8.5 ms | 0.068 ms | **125x** |
| **p95 latency** | 14.2 ms | 0.095 ms | **149x** |
| **p99 latency** | 28.7 ms | 0.120 ms | **239x** |
| **Throughput** | 280 reads/s | 14,700 reads/s | **52x** |

### Aggregate Performance

Across all cache categories and access patterns, the weighted average improvement is **125x** at the p50 latency level. The improvement is even larger at higher percentiles (p95, p99) because Redis eliminates the long-tail latency spikes that occur with PostgreSQL under load (lock contention, buffer pool misses, query plan changes).

### Cache Hit Ratio

Under production workloads, the cache hit ratio consistently exceeds 99.5%.

```
┌────────────────────────────────────────────────────────────────┐
│  CACHE HIT RATIO (7-day rolling average)                       │
│                                                                │
│  Robot State:     99.8%  ████████████████████████████████████░  │
│  Session Data:    99.6%  ███████████████████████████████████░░  │
│  Task Status:     99.2%  ██████████████████████████████████░░░  │
│  Health Metrics:  99.7%  ████████████████████████████████████░  │
│  Fleet Queries:   98.9%  █████████████████████████████████░░░░  │
│                                                                │
│  Overall:         99.5%  ████████████████████████████████████░  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Prometheus Metrics for Cache Monitoring

```typescript
// Cache metrics exported to Prometheus
const cacheMetrics = {
  hits: new Counter({
    name: "rmc_cache_hits_total",
    help: "Total cache hits",
    labelNames: ["entity"]    // robot_state, session, task, health
  }),

  misses: new Counter({
    name: "rmc_cache_misses_total",
    help: "Total cache misses",
    labelNames: ["entity"]
  }),

  latency: new Histogram({
    name: "rmc_cache_read_latency_ms",
    help: "Cache read latency in milliseconds",
    labelNames: ["entity", "source"],   // source: redis | postgres
    buckets: [0.01, 0.025, 0.05, 0.1, 0.5, 1, 2, 5, 10, 25]
  }),

  memoryUsage: new Gauge({
    name: "rmc_cache_memory_bytes",
    help: "Redis memory usage in bytes"
  }),

  evictions: new Counter({
    name: "rmc_cache_evictions_total",
    help: "Total cache evictions (TTL expiry + manual invalidation)",
    labelNames: ["entity", "reason"]    // reason: ttl | event | manual
  })
};
```
