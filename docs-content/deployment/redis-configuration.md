# Redis Configuration

## Redis Setup for Caching, Sessions, and Real-Time Messaging

The Awareness Network uses Redis as a high-performance in-memory data store for session management, response caching, real-time pub/sub messaging, and rate limiting. This guide covers installation, production configuration, persistence, and connection pooling.

---

## Installation

### Debian / Ubuntu

```bash
# Add the official Redis repository
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list

# Install Redis 7
sudo apt update
sudo apt install -y redis-server

# Start and enable
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### RHEL / CentOS / Fedora

```bash
sudo dnf install -y redis
sudo systemctl start redis
sudo systemctl enable redis
```

### macOS (Homebrew)

```bash
brew install redis
brew services start redis
```

### Docker

```bash
docker run -d \
  --name awareness-redis \
  -p 6379:6379 \
  -v redisdata:/data \
  redis:7-alpine \
  redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru --appendonly yes
```

### Verify Installation

```bash
redis-cli ping
# Expected output: PONG

redis-cli info server | grep redis_version
# Expected output: redis_version:7.x.x
```

---

## Production Configuration

Edit the Redis configuration file. On Debian/Ubuntu, this is at `/etc/redis/redis.conf`.

### Network and Security

```ini
# Bind to localhost only (use application layer for remote access)
bind 127.0.0.1 -::1

# Default port
port 6379

# Require password authentication
requirepass your_redis_password_here

# Disable dangerous commands in production
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG "AWARENESS_CONFIG"

# Maximum client connections
maxclients 10000

# TCP keepalive (seconds)
tcp-keepalive 300

# Connection timeout (0 = no timeout)
timeout 0
```

### Memory Management

```ini
# Maximum memory allocation
# Set to approximately 25-50% of available RAM, leaving room for the OS and application
maxmemory 512mb

# Eviction policy
# allkeys-lru: When memory is full, evict the least recently used key from ALL keys
# This is the recommended policy for the Awareness Network because:
#   - Session data has natural TTLs and will expire
#   - Cache data is regenerable and safe to evict
#   - It prevents out-of-memory errors gracefully
maxmemory-policy allkeys-lru

# Number of keys to sample when running the eviction algorithm
# Higher values are more accurate but use more CPU
maxmemory-samples 10
```

### Memory Policy Options

| Policy | Description | Use Case |
|---|---|---|
| `allkeys-lru` | Evict least recently used keys from all keys | **Recommended** -- general-purpose caching |
| `volatile-lru` | Evict LRU keys only from keys with TTL set | When you have permanent keys that must not be evicted |
| `allkeys-lfu` | Evict least frequently used keys | When access frequency matters more than recency |
| `volatile-ttl` | Evict keys with shortest TTL first | When TTL values are meaningful |
| `noeviction` | Return errors when memory is full | When data loss is unacceptable (not recommended for cache) |

### Thread Configuration

```ini
# I/O threads for network processing (Redis 7+)
# Set to number of CPU cores minus 1, up to 8
io-threads 4

# Enable threading for read operations as well
io-threads-do-reads yes
```

---

## Persistence Configuration

Redis offers two persistence mechanisms. For the Awareness Network, AOF (Append Only File) is recommended because it provides better durability with acceptable performance.

### AOF (Append Only File)

AOF logs every write operation, allowing Redis to reconstruct the dataset on restart.

```ini
# Enable AOF persistence
appendonly yes

# AOF file location
appendfilename "appendonly.aof"
appenddirname "appendonlydir"

# Sync policy
# everysec: Flush to disk every second (recommended balance of safety and performance)
# always: Flush after every write (safest but slowest)
# no: Let the OS decide (fastest but least safe)
appendfsync everysec

# Rewrite the AOF file when it grows 100% beyond the base size
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### RDB Snapshots (Secondary)

RDB snapshots provide point-in-time backups. Use as a secondary persistence mechanism alongside AOF:

```ini
# Create an RDB snapshot if at least 1 key changed in 3600 seconds
# or 100 keys changed in 300 seconds
# or 10000 keys changed in 60 seconds
save 3600 1
save 300 100
save 60 10000

# RDB file location
dbfilename dump.rdb
dir /var/lib/redis

# Compress RDB files
rdbcompression yes
rdbchecksum yes

# Stop accepting writes if RDB save fails (safety measure)
stop-writes-on-bgsave-error yes
```

### Persistence Comparison

| Feature | AOF | RDB |
|---|---|---|
| **Durability** | High (at most 1 second of data loss with `everysec`) | Lower (data loss since last snapshot) |
| **Performance** | Slightly lower due to continuous writes | Higher (snapshots are periodic) |
| **File size** | Larger (full operation log) | Smaller (compressed binary snapshot) |
| **Restart speed** | Slower (replays all operations) | Faster (loads binary snapshot) |
| **Recommended for** | Primary persistence | Backups and disaster recovery |

---

## How the Awareness Network Uses Redis

### Key Namespaces

All Redis keys use the `awareness:` prefix (configurable via `REDIS_KEY_PREFIX`) to prevent collisions when sharing a Redis instance.

| Namespace | Pattern | TTL | Purpose |
|---|---|---|---|
| **Sessions** | `awareness:session:{sessionId}` | 24 hours | User session data |
| **Cache** | `awareness:cache:{key}` | 1 hour | API response and query caching |
| **Rate Limits** | `awareness:ratelimit:{ip}:{window}` | 15 minutes | Request rate limiting counters |
| **Pub/Sub** | `awareness:pubsub:{channel}` | N/A | Real-time event broadcasting |
| **Collab Sessions** | `awareness:collab:{sessionId}` | 1 hour | AI collaboration session state |
| **Thought Stream** | `awareness:thoughts:{sessionId}` | 1 hour | Ordered list of session thoughts |
| **Agent Registry** | `awareness:agents:{agentId}` | 5 minutes | Agent presence and capabilities cache |
| **Locks** | `awareness:lock:{resource}` | 30 seconds | Distributed locks for concurrency control |

### Pub/Sub Channels

| Channel | Purpose |
|---|---|
| `awareness:events:marketplace` | Marketplace events (new listings, purchases) |
| `awareness:events:sessions` | Collaboration session lifecycle events |
| `awareness:events:agents` | Agent registration and status changes |
| `awareness:thoughts:{sessionId}` | Real-time thought stream for a specific session |

---

## Connection Pooling

The Awareness Network uses `ioredis` for Redis connections with built-in connection pooling and automatic reconnection.

### Application Configuration

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  // Connection pool settings
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },

  // Connection settings
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,

  // Key prefix
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'awareness:',

  // Enable read-only commands on replicas (if using Redis Cluster)
  readOnly: false,

  // Reconnection
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Reconnect on READONLY errors (failover scenario)
    }
    return false;
  },
});

// Health check
redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('close', () => console.warn('Redis connection closed'));
```

### Sentinel Configuration (High Availability)

For production deployments with automatic failover:

```typescript
const redis = new Redis({
  sentinels: [
    { host: 'sentinel-1.internal', port: 26379 },
    { host: 'sentinel-2.internal', port: 26379 },
    { host: 'sentinel-3.internal', port: 26379 },
  ],
  name: 'awareness-master',
  password: process.env.REDIS_PASSWORD,
  sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  keyPrefix: 'awareness:',
});
```

---

## Monitoring Redis

### Key Metrics to Watch

| Metric | Healthy Range | Alert Threshold |
|---|---|---|
| `used_memory` | < 80% of `maxmemory` | > 90% |
| `connected_clients` | < 80% of `maxclients` | > 90% |
| `evicted_keys` | Low, stable | Sudden spike |
| `keyspace_hits / keyspace_misses` | Hit ratio > 90% | Hit ratio < 80% |
| `instantaneous_ops_per_sec` | Stable baseline | > 2x baseline |
| `latest_fork_usec` | < 500ms | > 1000ms |

### Monitoring Commands

```bash
# Real-time stats
redis-cli info stats

# Memory usage
redis-cli info memory

# Connected clients
redis-cli info clients

# Slow log (queries taking longer than 10ms)
redis-cli slowlog get 10

# Key count per database
redis-cli info keyspace

# Monitor all commands in real time (use briefly; high overhead)
redis-cli monitor
```

### Health Check Script

```bash
#!/bin/bash
REDIS_CLI="redis-cli -a your_redis_password"

# Check connectivity
if ! $REDIS_CLI ping | grep -q "PONG"; then
  echo "CRITICAL: Redis is not responding"
  exit 2
fi

# Check memory usage
USED=$(${REDIS_CLI} info memory | grep used_memory_rss_human | cut -d: -f2 | tr -d '[:space:]')
echo "OK: Redis is responding. Memory usage: ${USED}"
exit 0
```
