# Robotics Middleware Controller (RMC)

## Overview

The **Robotics Middleware Controller (RMC)** is the Awareness Network's production-ready robotics coordination platform. It provides a unified interface for managing heterogeneous robot fleets, enabling real-time VR teleoperation, and orchestrating complex multi-robot tasks -- all through a single, high-performance API layer.

RMC bridges the gap between modern web infrastructure and the robotics ecosystem. It translates tRPC API calls into ROS2 commands, manages robot state through Redis-backed caching (achieving a **125x performance improvement** over direct database queries), and processes asynchronous operations through BullMQ task queues.

---

## Key Capabilities

### Multi-Robot Coordination
Manage fleets of heterogeneous robots through a centralized coordination engine. Register robots via MCP token authentication, assign tasks across multiple units simultaneously, and monitor fleet-wide status in real time. The coordinator handles task decomposition, assignment optimization, and conflict resolution across your entire fleet.

### VR Teleoperation
Control robots directly from WebXR-compatible headsets. The VR control interface maps controller inputs to robot movement and actions, streams live video from robot cameras via WebRTC, and supports gesture-based interaction. Operators can seamlessly switch between robots in a fleet without leaving the VR session.

### 125x Performance Through Redis Caching
Every frequently accessed data path -- robot state, session data, task status, health metrics -- is backed by an intelligent Redis caching layer. With configurable TTLs and automatic invalidation, the system delivers sub-millisecond reads for state queries that previously required full database round-trips. Benchmarked at **125x faster** than uncached PostgreSQL queries under production workloads.

### ROS2 Bridge
Native ROS2 integration through a bidirectional bridge. Subscribe to and publish on standard ROS2 topics, translate between web-native JSON and ROS2 message types (Twist, JointState, Image, LaserScan), and extend with custom message definitions. The bridge abstracts away the complexity of DDS transport and ROS2 node lifecycle management.

### Async Task Processing
BullMQ-powered task queues handle long-running and resource-intensive operations: multi-step movement sequences, sensor data aggregation, manipulation tasks, and batch fleet commands. Tasks support priority levels, configurable retry strategies, and dead letter queues for failed operations.

### Production Observability
Built-in Prometheus metrics export for every subsystem: API latency histograms, robot connection gauges, task queue depths, cache hit ratios, and ROS2 bridge throughput. Integrate directly with Grafana dashboards or any Prometheus-compatible monitoring stack.

---

## Supported Robots

| Robot | Manufacturer | Connection | Capabilities |
|-------|-------------|------------|-------------|
| **Unitree Go2** | Unitree Robotics | Wi-Fi / Ethernet | Locomotion, camera streaming, obstacle avoidance |
| **Boston Dynamics Spot** | Boston Dynamics | Wi-Fi / Ethernet | Locomotion, arm manipulation, autonomous navigation |
| **Custom ROS2 Robots** | Any | ROS2 DDS | Any capabilities exposed via ROS2 topics/services |

RMC treats every robot as a ROS2 node. Robots that natively support ROS2 connect directly through the bridge. Robots with proprietary SDKs (such as the Unitree Go2 or Spot) use adapter nodes that translate their native protocols into standard ROS2 interfaces.

---

## Production Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API Layer** | tRPC | Type-safe API with 20+ endpoints |
| **State Cache** | Redis | Sub-millisecond robot state reads (125x speedup) |
| **Task Queue** | BullMQ | Async task processing with retries and priorities |
| **Database** | PostgreSQL | Persistent storage for sessions, tasks, and history |
| **Monitoring** | Prometheus | Metrics collection and alerting |
| **Robot Comms** | ROS2 (Humble) | Bidirectional robot communication bridge |
| **VR Interface** | WebXR API | Immersive teleoperation from VR headsets |
| **Video Streaming** | WebRTC | Low-latency camera feeds from robots |

---

## Feature Comparison

The following table compares RMC against common alternatives in the robotics middleware space.

| Feature | RMC | ROS2 Alone | FleetManager Pro | Custom Solution |
|---------|-----|-----------|-------------------|----------------|
| Multi-robot coordination | Full | Manual | Full | Varies |
| VR teleoperation | Native WebXR | Not included | Plugin | Custom build |
| Web API (tRPC) | 20+ endpoints | Not included | REST only | Custom build |
| Redis state caching | 125x speedup | Not included | Basic | Custom build |
| Async task queues | BullMQ with DLQ | Not included | Basic queues | Custom build |
| Prometheus metrics | Built-in | Community pkg | Proprietary | Custom build |
| ROS2 integration | Native bridge | Native | Adapter | Varies |
| Type safety (end-to-end) | Full (tRPC + Zod) | C++ types only | Partial | Varies |
| Heterogeneous fleet support | Yes | Manual config | Limited | Varies |
| Session management | MCP token auth | Not included | OAuth | Custom build |
| Emergency stop | Global + per-robot | Per-node | Global only | Custom build |
| Observation memory | Built-in | Not included | Not included | Custom build |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Redis, PostgreSQL, and ROS2 settings

# Start infrastructure
docker-compose up -d redis postgres prometheus

# Launch the RMC server
pnpm run rmc:start

# Verify health
curl http://localhost:3000/robotics.health
```

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 12345,
  "services": {
    "redis": "connected",
    "postgres": "connected",
    "ros2Bridge": "active",
    "bullmq": "ready"
  }
}
```

---

## Documentation Map

| Page | Description |
|------|-------------|
| [Architecture](architecture.md) | System architecture, data flow, and design decisions |
| [Multi-Robot Coordination](multi-robot-coordination.md) | Fleet management, task assignment, and coordination protocols |
| [VR Control](vr-control.md) | WebXR teleoperation, controller mapping, and video streaming |
| [ROS2 Bridge](ros2-bridge.md) | ROS2 topic bridging, message types, and configuration |
| [Redis Caching](redis-caching.md) | Caching strategy, TTLs, invalidation, and 125x benchmarks |
| [Task Queue](task-queue.md) | BullMQ configuration, priorities, retries, and monitoring |
| [API Reference](api-reference.md) | Complete reference for all 20+ tRPC endpoints |
