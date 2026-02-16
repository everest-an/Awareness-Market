# Monitoring

## Prometheus Metrics, Grafana Dashboards, and Alerting

The Awareness Network exposes comprehensive metrics via Prometheus and provides pre-built Grafana dashboards for real-time observability. This guide covers the metrics exposed by the application, Grafana dashboard setup, alerting rules, and the key metrics to monitor in production.

---

## Enabling Metrics

Set the following environment variables to enable the Prometheus metrics endpoint:

```bash
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090    # Optional: separate port for metrics (default: same as app)
```

Once enabled, metrics are available at:

```
GET /metrics
```

The endpoint returns metrics in the standard Prometheus exposition format.

---

## Metrics Exposed by the Application

### HTTP Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests received |
| `http_request_duration_seconds` | Histogram | `method`, `path`, `status` | Request duration in seconds |
| `http_request_size_bytes` | Histogram | `method`, `path` | Request body size |
| `http_response_size_bytes` | Histogram | `method`, `path` | Response body size |
| `http_active_connections` | Gauge | -- | Currently active HTTP connections |

### WebSocket Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `ws_connections_total` | Counter | `type` | Total WebSocket connections established |
| `ws_active_connections` | Gauge | `type` | Currently active WebSocket connections |
| `ws_messages_sent_total` | Counter | `type` | Total messages sent over WebSocket |
| `ws_messages_received_total` | Counter | `type` | Total messages received over WebSocket |
| `ws_connection_duration_seconds` | Histogram | `type` | Duration of WebSocket connections |

### Database Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `db_query_total` | Counter | `operation`, `model` | Total database queries executed |
| `db_query_duration_seconds` | Histogram | `operation`, `model` | Query execution time |
| `db_pool_active_connections` | Gauge | -- | Active connections in the pool |
| `db_pool_idle_connections` | Gauge | -- | Idle connections in the pool |
| `db_pool_waiting_requests` | Gauge | -- | Requests waiting for a connection |
| `db_errors_total` | Counter | `operation`, `error_type` | Database errors |

### Redis Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `redis_commands_total` | Counter | `command` | Total Redis commands executed |
| `redis_command_duration_seconds` | Histogram | `command` | Redis command execution time |
| `redis_cache_hits_total` | Counter | -- | Cache hit count |
| `redis_cache_misses_total` | Counter | -- | Cache miss count |
| `redis_connected` | Gauge | -- | Redis connection status (1 = connected) |

### Marketplace Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `marketplace_packages_total` | Gauge | `status` | Total packages by status (listed, sold, removed) |
| `marketplace_transactions_total` | Counter | `type` | Total transactions (purchase, refund, dispute) |
| `marketplace_transaction_amount_total` | Counter | `currency` | Total transaction value |
| `marketplace_package_downloads_total` | Counter | -- | Total package downloads |
| `marketplace_listing_duration_seconds` | Histogram | -- | Time from listing to first sale |

### AI Collaboration Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `collab_sessions_total` | Counter | `status` | Total collaboration sessions by final status |
| `collab_active_sessions` | Gauge | -- | Currently active collaboration sessions |
| `collab_session_duration_seconds` | Histogram | -- | Session duration |
| `collab_thoughts_total` | Counter | `agent`, `category` | Total thoughts shared |
| `collab_actions_total` | Counter | `agent`, `decision` | Total actions (proposed, approved, rejected) |

### System Metrics

| Metric | Type | Labels | Description |
|---|---|---|---|
| `process_cpu_user_seconds_total` | Counter | -- | Total user CPU time |
| `process_cpu_system_seconds_total` | Counter | -- | Total system CPU time |
| `process_resident_memory_bytes` | Gauge | -- | Resident memory usage |
| `process_heap_bytes` | Gauge | -- | V8 heap usage |
| `nodejs_active_handles_total` | Gauge | -- | Active libuv handles |
| `nodejs_active_requests_total` | Gauge | -- | Active libuv requests |
| `nodejs_eventloop_lag_seconds` | Gauge | -- | Event loop lag |

---

## Prometheus Configuration

Add the Awareness Network as a scrape target in your `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'awareness-network'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['localhost:9121']
```

### Docker Compose Addition

Add Prometheus and exporters to your Docker Compose stack:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    restart: unless-stopped

  postgres-exporter:
    image: quay.io/prometheuscommunity/postgres-exporter:latest
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://awareness:password@postgres:5432/awareness_network?sslmode=disable
    restart: unless-stopped

  redis-exporter:
    image: oliver006/redis_exporter:latest
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    restart: unless-stopped

volumes:
  prometheus_data:
```

---

## Grafana Dashboard Setup

### Install Grafana

```bash
# Docker
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -v grafana_data:/var/lib/grafana \
  grafana/grafana:latest
```

### Add Prometheus Data Source

1. Open Grafana at `http://localhost:3000` (default credentials: admin/admin).
2. Navigate to **Configuration > Data Sources > Add data source**.
3. Select **Prometheus**.
4. Set the URL to `http://prometheus:9090` (or `http://localhost:9090` if not using Docker networking).
5. Click **Save & Test**.

### Import the Dashboard

The Awareness Network provides a pre-built Grafana dashboard. Import it from `monitoring/grafana-dashboard.json` or create it manually with the following panels.

### Dashboard Panels

#### Row 1: Overview

| Panel | Visualization | Query |
|---|---|---|
| **Request Rate** | Time series | `rate(http_requests_total[5m])` |
| **Error Rate** | Time series | `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])` |
| **P95 Latency** | Time series | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| **Active Connections** | Stat | `http_active_connections` |

#### Row 2: Collaboration

| Panel | Visualization | Query |
|---|---|---|
| **Active Sessions** | Stat | `collab_active_sessions` |
| **Thoughts/min** | Time series | `rate(collab_thoughts_total[1m]) * 60` |
| **Session Duration** | Histogram | `collab_session_duration_seconds` |
| **Thoughts by Agent** | Pie chart | `sum by (agent) (collab_thoughts_total)` |

#### Row 3: Database

| Panel | Visualization | Query |
|---|---|---|
| **Query Rate** | Time series | `rate(db_query_total[5m])` |
| **Query P95** | Time series | `histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))` |
| **Connection Pool** | Gauge | `db_pool_active_connections / (db_pool_active_connections + db_pool_idle_connections)` |
| **DB Errors** | Time series | `rate(db_errors_total[5m])` |

#### Row 4: Redis

| Panel | Visualization | Query |
|---|---|---|
| **Cache Hit Rate** | Gauge | `redis_cache_hits_total / (redis_cache_hits_total + redis_cache_misses_total)` |
| **Command Rate** | Time series | `rate(redis_commands_total[5m])` |
| **Memory Usage** | Time series | `redis_memory_used_bytes` (from redis-exporter) |
| **Connected** | Stat | `redis_connected` |

#### Row 5: System

| Panel | Visualization | Query |
|---|---|---|
| **CPU Usage** | Time series | `rate(process_cpu_user_seconds_total[5m])` |
| **Memory Usage** | Time series | `process_resident_memory_bytes` |
| **Event Loop Lag** | Time series | `nodejs_eventloop_lag_seconds` |
| **Heap Usage** | Time series | `process_heap_bytes` |

---

## Alerting Rules

Create `monitoring/alert-rules.yml` and load it in Prometheus:

```yaml
groups:
  - name: awareness-network
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High HTTP error rate (> 5%)"
          description: "{{ $value | humanizePercentage }} of requests are returning 5xx errors."

      # High latency
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P95 latency (> 2s)"
          description: "P95 request latency is {{ $value | humanizeDuration }}."

      # Database connection pool exhaustion
      - alert: DatabasePoolExhausted
        expr: db_pool_waiting_requests > 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool has waiting requests"
          description: "{{ $value }} requests are waiting for a database connection."

      # Redis disconnected
      - alert: RedisDisconnected
        expr: redis_connected == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is disconnected"
          description: "The application has lost its connection to Redis."

      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: redis_cache_hits_total / (redis_cache_hits_total + redis_cache_misses_total) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Redis cache hit rate below 80%"
          description: "Cache hit rate is {{ $value | humanizePercentage }}."

      # High memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 / 1024 > 1.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage (> 1.5 GB)"
          description: "Application memory usage is {{ $value | humanize }}GB."

      # Event loop lag
      - alert: EventLoopLag
        expr: nodejs_eventloop_lag_seconds > 0.5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High event loop lag (> 500ms)"
          description: "Node.js event loop lag is {{ $value | humanizeDuration }}."

      # No active collaboration sessions (potential system issue)
      - alert: CollaborationSystemDown
        expr: collab_active_sessions == 0 and rate(collab_sessions_total[1h]) == 0
        for: 30m
        labels:
          severity: info
        annotations:
          summary: "No collaboration sessions in the last 30 minutes"
          description: "This may indicate a system issue or simply low usage."
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
route:
  receiver: 'default'
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
    - match:
        severity: warning
      receiver: 'slack'

receivers:
  - name: 'default'
    email_configs:
      - to: 'ops@awareness.network'
        from: 'alertmanager@awareness.network'
        smarthost: 'smtp.mailgun.org:587'

  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
```

---

## Key Metrics to Watch

These are the most important metrics for day-to-day operations:

| Priority | Metric | Healthy | Investigate | Critical |
|---|---|---|---|---|
| **P0** | Error rate (5xx) | < 0.1% | 0.1 -- 1% | > 1% |
| **P0** | Redis connected | 1 | -- | 0 |
| **P1** | P95 latency | < 500ms | 500ms -- 2s | > 2s |
| **P1** | DB pool waiting | 0 | 1 -- 5 | > 5 |
| **P1** | Event loop lag | < 100ms | 100 -- 500ms | > 500ms |
| **P2** | Cache hit rate | > 90% | 80 -- 90% | < 80% |
| **P2** | Memory usage | < 1 GB | 1 -- 1.5 GB | > 1.5 GB |
| **P2** | Active WS connections | Stable | Rapid growth | Drop to 0 |
| **P3** | Collaboration sessions | Normal baseline | 2x baseline | 0 for 30+ min |
