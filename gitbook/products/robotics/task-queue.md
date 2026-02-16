# Task Queue System

## Overview

The RMC uses BullMQ as its task queue system for processing asynchronous robot operations. Tasks that cannot or should not be executed synchronously within an API request cycle -- multi-step movement sequences, sensor data aggregation, manipulation workflows, and batch fleet commands -- are enqueued in BullMQ for reliable background processing.

BullMQ is backed by Redis, which the RMC already uses for state caching. This shared infrastructure simplifies the deployment topology while providing durable task persistence, priority-based scheduling, configurable retry strategies, and dead letter queues for failed operations.

---

## Task Types

### Movement Tasks

Movement tasks command a robot to navigate to a waypoint, follow a path, or execute a locomotion pattern.

```typescript
interface MovementTask {
  type: "movement";
  subtype: "navigate_to" | "follow_path" | "rotate" | "formation_move";
  robotId: string;
  payload: {
    waypoint?: { x: number; y: number; z: number };
    path?: Array<{ x: number; y: number; z: number }>;
    speed: number;                    // m/s
    obstacleAvoidance: boolean;
    heading?: number;                 // radians (for rotate)
  };
}

// Example: navigate to a waypoint
await trpc.robotics.createTask.mutate({
  type: "movement",
  subtype: "navigate_to",
  robotId: "robot_01HXQ3K7M9V2...",
  priority: "normal",
  payload: {
    waypoint: { x: 15.0, y: 8.5, z: 0.0 },
    speed: 0.8,
    obstacleAvoidance: true
  }
});
```

### Sensor Reading Tasks

Sensor reading tasks collect data from one or more robot sensors and aggregate the results.

```typescript
interface SensorReadingTask {
  type: "sensor_reading";
  subtype: "single_scan" | "multi_scan" | "continuous" | "aggregated";
  robotId: string;
  payload: {
    sensors: Array<"lidar" | "camera" | "imu" | "temperature" | "battery">;
    duration?: number;               // ms (for continuous readings)
    interval?: number;               // ms (sampling interval)
    aggregation?: "average" | "min" | "max" | "latest";
    format?: "raw" | "processed";
  };
}

// Example: take 10 LIDAR scans over 5 seconds and average them
await trpc.robotics.createTask.mutate({
  type: "sensor_reading",
  subtype: "aggregated",
  robotId: "robot_01HXQ3K7M9V2...",
  priority: "low",
  payload: {
    sensors: ["lidar"],
    duration: 5000,
    interval: 500,
    aggregation: "average",
    format: "processed"
  }
});
```

### Manipulation Tasks

Manipulation tasks control robotic arms and grippers for object interaction (available on robots with manipulation capabilities, such as Boston Dynamics Spot with arm).

```typescript
interface ManipulationTask {
  type: "manipulation";
  subtype: "pick" | "place" | "inspect" | "push" | "custom_trajectory";
  robotId: string;
  payload: {
    target?: { x: number; y: number; z: number };   // object position
    gripperAction?: "open" | "close";
    force?: number;                                  // Newtons (gripper)
    trajectory?: Array<{                             // joint trajectory
      positions: number[];
      velocities: number[];
      duration: number;                              // ms
    }>;
    precisionMode?: boolean;                         // slower, more accurate
  };
}

// Example: pick up an object at a specific location
await trpc.robotics.createTask.mutate({
  type: "manipulation",
  subtype: "pick",
  robotId: "robot_01HXQ3K8N2W3...",
  priority: "high",
  payload: {
    target: { x: 2.1, y: 0.8, z: 0.3 },
    gripperAction: "close",
    force: 10.0,
    precisionMode: true
  }
});
```

### Batch Fleet Tasks

Batch tasks apply the same operation to multiple robots in a fleet simultaneously.

```typescript
interface BatchFleetTask {
  type: "batch";
  subtype: "fleet_command" | "fleet_recall" | "fleet_report";
  fleetId: string;
  payload: {
    command: string;
    parameters: Record<string, unknown>;
    robotFilter?: {
      status?: string[];
      capabilities?: string[];
      minBattery?: number;
    };
  };
}

// Example: recall all idle robots to the charging station
await trpc.robotics.createTask.mutate({
  type: "batch",
  subtype: "fleet_recall",
  fleetId: "fleet_warehouse_alpha",
  priority: "normal",
  payload: {
    command: "navigate_to",
    parameters: {
      waypoint: { x: 0, y: 0, z: 0 },    // charging station
      speed: 0.5
    },
    robotFilter: {
      status: ["idle"],
      minBattery: 10              // Only recall robots with > 10% battery
    }
  }
});
```

---

## Queue Configuration

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BULLMQ QUEUE SYSTEM                          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   PRIORITY QUEUES                        │   │
│   │                                                         │   │
│   │   ┌────────────┐  Priority 1 (Critical)                │   │
│   │   │ ██████████ │  Emergency commands, safety overrides  │   │
│   │   └────────────┘                                        │   │
│   │                                                         │   │
│   │   ┌────────────┐  Priority 2 (High)                    │   │
│   │   │ ████████░░ │  VR teleoperation tasks, manipulation │   │
│   │   └────────────┘                                        │   │
│   │                                                         │   │
│   │   ┌────────────┐  Priority 3 (Normal)                  │   │
│   │   │ ██████░░░░ │  Standard movement, fleet commands    │   │
│   │   └────────────┘                                        │   │
│   │                                                         │   │
│   │   ┌────────────┐  Priority 4 (Low)                     │   │
│   │   │ ████░░░░░░ │  Sensor aggregation, reporting        │   │
│   │   └────────────┘                                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    WORKERS                               │   │
│   │                                                         │   │
│   │   Worker 1        Worker 2        Worker 3              │   │
│   │   (movement)      (sensor)        (manipulation)        │   │
│   │                                                         │   │
│   │   Worker 4        Worker 5                              │   │
│   │   (batch)         (general)                             │   │
│   └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                    on failure                                   │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                DEAD LETTER QUEUE                         │   │
│   │                                                         │   │
│   │   Failed tasks that exceeded max retries.               │   │
│   │   Retained for 7 days for debugging and replay.         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Queue Definition

```typescript
import { Queue, Worker, QueueScheduler } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: 1                          // Use DB 1 for queues (DB 0 for cache)
};

// Main task queue
const taskQueue = new Queue("rmc-tasks", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: {
      age: 86400,                // Keep completed tasks for 24 hours
      count: 10000               // Maximum 10,000 completed tasks
    },
    removeOnFail: false          // Keep failed tasks for inspection
  }
});

// Dead letter queue
const dlq = new Queue("rmc-tasks-dlq", {
  connection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false
  }
});
```

### Worker Configuration

```typescript
// Movement task worker
const movementWorker = new Worker(
  "rmc-tasks",
  async (job) => {
    if (job.data.type !== "movement") return;     // Skip non-movement tasks

    const { robotId, payload } = job.data;
    const bridge = getROS2Bridge();

    switch (payload.command) {
      case "navigate_to":
        // Publish navigation goal
        bridge.publish({
          robotName: getRobotName(robotId),
          topic: `/${getRobotName(robotId)}/navigate_to`,
          messageType: "geometry_msgs/PoseStamped",
          message: {
            header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "map" },
            pose: {
              position: payload.waypoint,
              orientation: { x: 0, y: 0, z: 0, w: 1 }
            }
          }
        });

        // Wait for navigation completion (poll robot status)
        await waitForCondition(
          () => isRobotAtWaypoint(robotId, payload.waypoint, 0.5),
          { timeout: job.data.timeout || 120_000, interval: 500 }
        );

        // Update progress
        await job.updateProgress(100);
        return { status: "completed", finalPosition: await getRobotPosition(robotId) };

      case "follow_path":
        const totalWaypoints = payload.path.length;
        for (let i = 0; i < totalWaypoints; i++) {
          bridge.publish({
            robotName: getRobotName(robotId),
            topic: `/${getRobotName(robotId)}/navigate_to`,
            messageType: "geometry_msgs/PoseStamped",
            message: {
              header: { stamp: { sec: 0, nanosec: 0 }, frame_id: "map" },
              pose: {
                position: payload.path[i],
                orientation: { x: 0, y: 0, z: 0, w: 1 }
              }
            }
          });

          await waitForCondition(
            () => isRobotAtWaypoint(robotId, payload.path[i], 0.5),
            { timeout: 60_000, interval: 500 }
          );

          await job.updateProgress(Math.round(((i + 1) / totalWaypoints) * 100));
        }
        return { status: "completed", waypointsReached: totalWaypoints };
    }
  },
  {
    connection,
    concurrency: 10,              // Process up to 10 movement tasks simultaneously
    limiter: {
      max: 50,                    // Maximum 50 tasks per 10 seconds
      duration: 10_000
    }
  }
);
```

---

## Priority Levels

Tasks are processed in priority order. Within the same priority level, tasks are processed in FIFO order.

| Priority | Level | Use Cases | Max Latency |
|----------|-------|-----------|-------------|
| **Critical** | 1 | Emergency stop, safety overrides, collision avoidance | < 100ms |
| **High** | 2 | VR teleoperation commands, active manipulation, time-sensitive navigation | < 500ms |
| **Normal** | 3 | Standard movement, fleet commands, routine tasks | < 5s |
| **Low** | 4 | Sensor aggregation, reporting, non-urgent data collection | < 30s |

### Setting Priority

```typescript
// Create a critical-priority task
await taskQueue.add("emergency_stop", {
  type: "control",
  subtype: "emergency_stop",
  robotId: "robot_01HXQ3K7M9V2...",
  payload: { reason: "obstacle_detected" }
}, {
  priority: 1,
  attempts: 1,         // No retries for emergency stop
  timeout: 5000        // Must complete within 5 seconds
});

// Create a low-priority reporting task
await taskQueue.add("sensor_report", {
  type: "sensor_reading",
  subtype: "aggregated",
  robotId: "robot_01HXQ3K7M9V2...",
  payload: {
    sensors: ["lidar", "camera"],
    aggregation: "latest"
  }
}, {
  priority: 4,
  attempts: 5,         // More retries for non-critical tasks
  timeout: 60000
});
```

---

## Retry Strategies

Different task types use different retry strategies based on their failure modes and idempotency characteristics.

### Retry Configuration

| Task Type | Max Attempts | Backoff | Initial Delay | Max Delay | Notes |
|-----------|-------------|---------|---------------|-----------|-------|
| Movement | 3 | Exponential | 1s | 30s | Robot may need time to recover position |
| Sensor Reading | 5 | Linear | 500ms | 5s | Sensor failures are often transient |
| Manipulation | 2 | Exponential | 2s | 60s | Manipulation failures may require human review |
| Batch Fleet | 3 | Exponential | 5s | 120s | Large-scale operations need longer backoff |
| Emergency | 1 | None | N/A | N/A | Never retry -- immediate execution or fail |

### Custom Retry Logic

```typescript
// Retry strategy with context-aware backoff
const retryStrategies: Record<string, JobsOptions> = {
  movement: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000                 // 1s, 2s, 4s
    }
  },

  sensor_reading: {
    attempts: 5,
    backoff: {
      type: "fixed",
      delay: 500                  // 500ms between each retry
    }
  },

  manipulation: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 2000                 // 2s, 4s
    }
  },

  batch: {
    attempts: 3,
    backoff: {
      type: "custom",             // Custom backoff function
    }
  },

  emergency: {
    attempts: 1                   // No retries
  }
};

// Custom backoff function for batch tasks
// Increases delay based on fleet size (more robots = longer backoff)
function batchBackoff(attemptsMade: number, fleetSize: number): number {
  const baseDelay = 5000;
  const multiplier = Math.min(fleetSize / 10, 5);   // Scale with fleet size, cap at 5x
  return baseDelay * Math.pow(2, attemptsMade - 1) * multiplier;
}
```

### Retry Event Handling

```typescript
// Listen for retry events
movementWorker.on("failed", async (job, err) => {
  if (job && job.attemptsMade < (job.opts.attempts || 3)) {
    logger.warn(`Task ${job.id} failed (attempt ${job.attemptsMade}), will retry`, {
      taskId: job.id,
      type: job.data.type,
      error: err.message,
      nextRetryIn: job.opts.backoff
    });

    metrics.taskRetries.inc({
      type: job.data.type,
      attempt: job.attemptsMade.toString()
    });
  } else if (job) {
    logger.error(`Task ${job.id} permanently failed after ${job.attemptsMade} attempts`, {
      taskId: job.id,
      type: job.data.type,
      error: err.message
    });

    // Move to dead letter queue
    await dlq.add("failed-task", {
      originalJobId: job.id,
      originalData: job.data,
      failedAt: new Date().toISOString(),
      error: err.message,
      attempts: job.attemptsMade
    });

    metrics.taskDeadLettered.inc({ type: job.data.type });
  }
});
```

---

## Dead Letter Queue

Tasks that exceed their maximum retry count are moved to the dead letter queue (DLQ) for manual inspection, debugging, and optional replay.

### DLQ Structure

```typescript
interface DeadLetteredTask {
  originalJobId: string;
  originalData: TaskPayload;
  failedAt: string;               // ISO 8601
  error: string;                  // Last error message
  attempts: number;               // Total attempts made
  failureHistory: Array<{
    attempt: number;
    error: string;
    timestamp: string;
  }>;
}
```

### DLQ Operations

```typescript
// List dead-lettered tasks
const deadTasks = await dlq.getJobs(["completed", "waiting", "active"]);

for (const task of deadTasks) {
  console.log(`DLQ Task: ${task.id}`);
  console.log(`  Original: ${task.data.originalJobId}`);
  console.log(`  Type: ${task.data.originalData.type}`);
  console.log(`  Failed: ${task.data.failedAt}`);
  console.log(`  Error: ${task.data.error}`);
  console.log(`  Attempts: ${task.data.attempts}`);
}

// Replay a dead-lettered task (re-enqueue with fresh retries)
async function replayDeadLetteredTask(dlqJobId: string): Promise<string> {
  const dlqJob = await dlq.getJob(dlqJobId);
  if (!dlqJob) throw new Error(`DLQ job ${dlqJobId} not found`);

  const newJob = await taskQueue.add(
    dlqJob.data.originalData.type,
    dlqJob.data.originalData,
    {
      ...retryStrategies[dlqJob.data.originalData.type],
      jobId: `replay-${dlqJobId}-${Date.now()}`
    }
  );

  // Remove from DLQ after successful re-enqueue
  await dlqJob.remove();

  return newJob.id!;
}

// Purge old DLQ entries (older than 7 days)
async function purgeDLQ(olderThanDays: number = 7): Promise<number> {
  const cutoff = Date.now() - (olderThanDays * 86_400_000);
  const jobs = await dlq.getJobs(["completed", "waiting"]);
  let purged = 0;

  for (const job of jobs) {
    if (new Date(job.data.failedAt).getTime() < cutoff) {
      await job.remove();
      purged++;
    }
  }

  return purged;
}
```

### DLQ Retention Policy

| Retention | Duration | Action |
|-----------|----------|--------|
| Active inspection | 0--24 hours | Tasks are available for immediate replay or debugging |
| Archive | 1--7 days | Tasks remain in DLQ but are flagged as stale |
| Purge | > 7 days | Automatic cleanup removes tasks older than 7 days |

---

## Monitoring Dashboard

### Prometheus Metrics

The task queue exports the following metrics to Prometheus for monitoring and alerting.

```typescript
const queueMetrics = {
  // Task throughput
  tasksCreated: new Counter({
    name: "rmc_tasks_created_total",
    help: "Total tasks created",
    labelNames: ["type", "priority"]
  }),

  tasksCompleted: new Counter({
    name: "rmc_tasks_completed_total",
    help: "Total tasks completed successfully",
    labelNames: ["type"]
  }),

  tasksFailed: new Counter({
    name: "rmc_tasks_failed_total",
    help: "Total tasks failed permanently",
    labelNames: ["type"]
  }),

  // Queue depth
  queueDepth: new Gauge({
    name: "rmc_queue_depth",
    help: "Current number of tasks in queue",
    labelNames: ["state"]           // waiting, active, delayed
  }),

  // Task duration
  taskDuration: new Histogram({
    name: "rmc_task_duration_ms",
    help: "Task execution duration in milliseconds",
    labelNames: ["type"],
    buckets: [100, 500, 1000, 5000, 10000, 30000, 60000, 120000]
  }),

  // Wait time (time from creation to start of execution)
  taskWaitTime: new Histogram({
    name: "rmc_task_wait_time_ms",
    help: "Time from task creation to execution start",
    labelNames: ["type", "priority"],
    buckets: [10, 50, 100, 500, 1000, 5000, 30000]
  }),

  // Retries
  taskRetries: new Counter({
    name: "rmc_task_retries_total",
    help: "Total task retry attempts",
    labelNames: ["type", "attempt"]
  }),

  // DLQ
  dlqDepth: new Gauge({
    name: "rmc_dlq_depth",
    help: "Current number of tasks in dead letter queue"
  }),

  // Worker utilization
  workerUtilization: new Gauge({
    name: "rmc_worker_utilization_ratio",
    help: "Ratio of active workers to total workers (0.0--1.0)",
    labelNames: ["worker_type"]
  })
};
```

### Grafana Dashboard Panels

The following panels are recommended for monitoring the task queue system.

| Panel | Type | Query | Alert Threshold |
|-------|------|-------|----------------|
| Task Throughput | Time series | `rate(rmc_tasks_created_total[5m])` | N/A |
| Queue Depth | Gauge | `rmc_queue_depth{state="waiting"}` | > 100 (warning), > 500 (critical) |
| Task Duration (p95) | Heatmap | `histogram_quantile(0.95, rmc_task_duration_ms)` | > 60s (warning) |
| Failure Rate | Time series | `rate(rmc_tasks_failed_total[5m]) / rate(rmc_tasks_created_total[5m])` | > 5% (warning), > 15% (critical) |
| DLQ Depth | Gauge | `rmc_dlq_depth` | > 0 (info), > 10 (warning), > 50 (critical) |
| Worker Utilization | Gauge | `rmc_worker_utilization_ratio` | > 0.9 (warning -- near capacity) |
| Wait Time (p95) | Time series | `histogram_quantile(0.95, rmc_task_wait_time_ms)` | > 5s (warning) |
| Retry Rate | Time series | `rate(rmc_task_retries_total[5m])` | Increasing trend (warning) |

### Health Check Integration

```typescript
// Queue health check (included in robotics.health response)
async function getQueueHealth(): Promise<QueueHealth> {
  const waiting = await taskQueue.getWaitingCount();
  const active = await taskQueue.getActiveCount();
  const delayed = await taskQueue.getDelayedCount();
  const failed = await taskQueue.getFailedCount();
  const dlqSize = await dlq.getWaitingCount();

  return {
    status: dlqSize > 50 ? "degraded" : waiting > 500 ? "degraded" : "healthy",
    queues: {
      waiting,
      active,
      delayed,
      failed
    },
    dlq: {
      size: dlqSize,
      oldestEntry: await getOldestDLQTimestamp()
    },
    workers: {
      total: 5,
      active: await getActiveWorkerCount(),
      idle: 5 - await getActiveWorkerCount()
    }
  };
}
```
