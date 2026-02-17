# Robotics API Reference

## Overview

The RMC exposes a tRPC API with 20+ procedures organized into seven categories: Health, Auth, Robots, Tasks, VR, Memory, and Control. All procedures use JSON for request and response bodies. Input validation is enforced through Zod schemas; invalid requests receive a structured error response.

### Base URL

```
https://rmc.awareness.network/trpc
```

### Authentication

All endpoints except `robotics.health` require authentication. Robot-facing endpoints use MCP tokens passed in the `Authorization` header. Operator-facing endpoints use the Awareness Network session token.

```
Authorization: Bearer <mcp_token or session_token>
```

### Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable error description",
    "details": {
      "field": "robotId",
      "issue": "Robot not found"
    }
  }
}
```

| Error Code | HTTP Status | Description |
|-----------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid input (Zod validation failure) |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `CONFLICT` | 409 | Operation conflicts with current state |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

---

## Health

### `GET /robotics.health`

Returns the health status of the RMC and all connected infrastructure services.

**Authentication**: None required.

**Parameters**: None.

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"healthy" \| "degraded" \| "unhealthy"` | Overall system health |
| `version` | `string` | RMC version number |
| `uptime` | `number` | Server uptime in seconds |
| `timestamp` | `string` | Current server time (ISO 8601) |
| `services` | `object` | Status of each infrastructure service |
| `services.redis` | `string` | Redis connection status |
| `services.postgres` | `string` | PostgreSQL connection status |
| `services.ros2Bridge` | `string` | ROS2 bridge status |
| `services.bullmq` | `string` | BullMQ queue status |
| `metrics` | `object` | Summary metrics |
| `metrics.robotsOnline` | `number` | Currently connected robots |
| `metrics.activeTasks` | `number` | Tasks currently being processed |
| `metrics.activeVRSessions` | `number` | Active VR teleoperation sessions |
| `metrics.cacheHitRatio` | `number` | Redis cache hit ratio (0.0--1.0) |

**Example Request**:

```bash
curl https://rmc.awareness.network/trpc/robotics.health
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "status": "healthy",
      "version": "1.0.0",
      "uptime": 86412,
      "timestamp": "2026-02-16T12:00:00.000Z",
      "services": {
        "redis": "connected",
        "postgres": "connected",
        "ros2Bridge": "active",
        "bullmq": "ready"
      },
      "metrics": {
        "robotsOnline": 5,
        "activeTasks": 12,
        "activeVRSessions": 1,
        "cacheHitRatio": 0.995
      }
    }
  }
}
```

---

## Auth

### `POST /robotics.authenticateRobot`

Registers and authenticates a robot with the RMC. Creates a session and returns connection credentials.

**Authentication**: MCP token (robot-scoped).

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Human-readable robot name (unique within org) |
| `type` | `string` | Yes | Robot type identifier (e.g., `"unitree_go2"`, `"boston_dynamics_spot"`, `"custom_ros2"`) |
| `capabilities` | `string[]` | Yes | List of declared capabilities (e.g., `["locomotion", "camera_streaming", "manipulation"]`) |
| `mcpToken` | `string` | Yes | MCP authentication token |
| `metadata` | `object` | No | Additional robot metadata |
| `metadata.firmwareVersion` | `string` | No | Robot firmware version |
| `metadata.batteryCapacity` | `number` | No | Battery capacity percentage (0--100) |
| `metadata.sensorSuite` | `string[]` | No | Available sensors |
| `metadata.maxSpeed` | `number` | No | Maximum speed in m/s |
| `metadata.operatingRange` | `number` | No | Operating range in meters |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `robotId` | `string` | Unique robot identifier (ULID) |
| `sessionId` | `string` | Active session identifier |
| `expiresAt` | `string` | Session expiration time (ISO 8601) |
| `status` | `string` | Robot status after authentication |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.authenticateRobot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "name": "go2-alpha",
    "type": "unitree_go2",
    "capabilities": ["locomotion", "camera_streaming", "obstacle_avoidance"],
    "mcpToken": "mcp_eyJhbGciOiJSUzI1NiJ9...",
    "metadata": {
      "firmwareVersion": "1.4.2",
      "batteryCapacity": 100,
      "sensorSuite": ["lidar", "stereo_camera", "imu"],
      "maxSpeed": 1.5
    }
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "sessionId": "session_01HXQ3K7NB4ZTPCR8W1A6YHMXS",
      "expiresAt": "2026-02-17T12:00:00.000Z",
      "status": "online"
    }
  }
}
```

---

### `POST /robotics.terminateSession`

Terminates an active robot session. The robot is marked offline and all its active tasks are cancelled.

**Authentication**: MCP token (robot-scoped) or operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | Yes | Session identifier to terminate |
| `reason` | `string` | No | Reason for termination |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `terminated` | `boolean` | Whether the session was successfully terminated |
| `robotId` | `string` | ID of the robot whose session was terminated |
| `cancelledTasks` | `number` | Number of active tasks that were cancelled |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.terminateSession \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "sessionId": "session_01HXQ3K7NB4ZTPCR8W1A6YHMXS",
    "reason": "maintenance_window"
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "terminated": true,
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "cancelledTasks": 2
    }
  }
}
```

---

## Robots

### `GET /robotics.listOnlineRobots`

Returns a list of all currently online robots with their status and metadata.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fleetId` | `string` | No | Filter by fleet ID |
| `status` | `string` | No | Filter by status (`"idle"`, `"busy"`, `"emergency_stopped"`) |
| `type` | `string` | No | Filter by robot type |
| `limit` | `number` | No | Maximum number of results (default: 50, max: 200) |
| `offset` | `number` | No | Pagination offset (default: 0) |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `robots` | `Robot[]` | Array of online robots |
| `robots[].robotId` | `string` | Unique robot identifier |
| `robots[].name` | `string` | Human-readable name |
| `robots[].type` | `string` | Robot type |
| `robots[].status` | `string` | Current status |
| `robots[].battery` | `number` | Battery level (0--100) |
| `robots[].position` | `{x, y, z}` | Current position in meters |
| `robots[].capabilities` | `string[]` | Declared capabilities |
| `robots[].activeTasks` | `number` | Number of active tasks |
| `robots[].lastHeartbeat` | `string` | Last heartbeat timestamp |
| `robots[].sessionId` | `string` | Active session ID |
| `totalOnline` | `number` | Total online robots (before pagination) |
| `totalBusy` | `number` | Total robots currently executing tasks |
| `totalIdle` | `number` | Total idle robots |

**Example Request**:

```bash
curl "https://rmc.awareness.network/trpc/robotics.listOnlineRobots?input=%7B%22status%22%3A%22idle%22%7D" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..."
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "robots": [
        {
          "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
          "name": "go2-alpha",
          "type": "unitree_go2",
          "status": "idle",
          "battery": 87,
          "position": { "x": 5.2, "y": -1.8, "z": 0.0 },
          "capabilities": ["locomotion", "camera_streaming", "obstacle_avoidance"],
          "activeTasks": 0,
          "lastHeartbeat": "2026-02-16T12:00:05.000Z",
          "sessionId": "session_01HXQ3K7NB4ZTPCR8W1A6YHMXS"
        }
      ],
      "totalOnline": 1,
      "totalBusy": 0,
      "totalIdle": 1
    }
  }
}
```

---

### `GET /robotics.getRobotStatus`

Returns detailed status information for a specific robot.

**Authentication**: Operator session token or MCP token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | Yes | Robot identifier |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `robotId` | `string` | Robot identifier |
| `name` | `string` | Human-readable name |
| `type` | `string` | Robot type |
| `status` | `string` | Current status |
| `battery` | `number` | Battery level (0--100) |
| `position` | `{x, y, z}` | Current position |
| `velocity` | `{linear: {x,y,z}, angular: {x,y,z}}` | Current velocity |
| `capabilities` | `string[]` | Declared capabilities |
| `activeTasks` | `Task[]` | Currently assigned tasks |
| `health` | `object` | Hardware health metrics |
| `health.cpuTemperature` | `number` | CPU temperature (Celsius) |
| `health.motorTemperatures` | `number[]` | Motor temperatures |
| `health.wifiSignal` | `number` | Wi-Fi signal strength (dBm) |
| `health.errorCodes` | `number[]` | Active error codes |
| `sessionId` | `string` | Active session ID |
| `lastHeartbeat` | `string` | Last heartbeat timestamp |
| `uptime` | `number` | Robot uptime in seconds |
| `metadata` | `object` | Robot metadata (firmware version, etc.) |

**Example Request**:

```bash
curl "https://rmc.awareness.network/trpc/robotics.getRobotStatus?input=%7B%22robotId%22%3A%22robot_01HXQ3K7M9V2YPFGN8D6RJTW4E%22%7D" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..."
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "name": "go2-alpha",
      "type": "unitree_go2",
      "status": "idle",
      "battery": 87,
      "position": { "x": 5.2, "y": -1.8, "z": 0.0 },
      "velocity": {
        "linear": { "x": 0.0, "y": 0.0, "z": 0.0 },
        "angular": { "x": 0.0, "y": 0.0, "z": 0.0 }
      },
      "capabilities": ["locomotion", "camera_streaming", "obstacle_avoidance"],
      "activeTasks": [],
      "health": {
        "cpuTemperature": 52.3,
        "motorTemperatures": [38.1, 39.4, 37.8, 40.2, 38.9, 39.1, 37.5, 40.0, 38.3, 39.7, 37.2, 40.5],
        "wifiSignal": -42,
        "errorCodes": []
      },
      "sessionId": "session_01HXQ3K7NB4ZTPCR8W1A6YHMXS",
      "lastHeartbeat": "2026-02-16T12:00:05.000Z",
      "uptime": 7200,
      "metadata": {
        "firmwareVersion": "1.4.2",
        "sensorSuite": ["lidar", "stereo_camera", "imu"],
        "maxSpeed": 1.5
      }
    }
  }
}
```

---

## Tasks

### `POST /robotics.createTask`

Creates a new task and enqueues it for execution. The task is assigned to a robot based on the Coordinator's scoring algorithm.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Task type: `"movement"`, `"sensor_reading"`, `"manipulation"`, `"batch"`, `"coordinated_sweep"`, `"formation_move"` |
| `robotId` | `string` | Conditional | Target robot (required for single-robot tasks) |
| `fleetId` | `string` | Conditional | Target fleet (required for multi-robot tasks) |
| `priority` | `string` | No | Priority level: `"critical"`, `"high"`, `"normal"` (default), `"low"` |
| `payload` | `object` | Yes | Task-specific payload (see [Task Queue](task-queue.md) for schemas) |
| `payload.command` | `string` | Yes | Command identifier |
| `timeout` | `number` | No | Task timeout in milliseconds (default: 120000) |
| `retryPolicy` | `object` | No | Custom retry configuration |
| `retryPolicy.maxRetries` | `number` | No | Maximum retry attempts (default: 3) |
| `retryPolicy.backoff` | `string` | No | Backoff strategy: `"exponential"`, `"linear"`, `"fixed"` |
| `retryPolicy.initialDelay` | `number` | No | Initial retry delay in milliseconds |
| `constraints` | `object` | No | Task constraints (for multi-robot tasks) |
| `constraints.requiredCapabilities` | `string[]` | No | Capabilities that assigned robots must have |
| `constraints.minRobots` | `number` | No | Minimum number of robots required |
| `constraints.maxRobots` | `number` | No | Maximum number of robots to assign |
| `constraints.maxDuration` | `number` | No | Maximum task duration in milliseconds |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` | Unique task identifier |
| `status` | `string` | Initial task status (`"queued"`) |
| `robotId` | `string \| null` | Assigned robot (may be null until assignment) |
| `subtasks` | `Subtask[] \| null` | Subtasks (for multi-robot tasks) |
| `createdAt` | `string` | Task creation timestamp |
| `estimatedDuration` | `number` | Estimated duration in milliseconds |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.createTask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "type": "movement",
    "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
    "priority": "normal",
    "payload": {
      "command": "navigate_to",
      "waypoint": { "x": 10.5, "y": -3.2, "z": 0.0 },
      "speed": 0.8,
      "obstacleAvoidance": true
    },
    "timeout": 120000
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "taskId": "task_01HXQ3NRVP8BKMW2F6Y4AZHTC9",
      "status": "queued",
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "subtasks": null,
      "createdAt": "2026-02-16T12:00:00.000Z",
      "estimatedDuration": 45000
    }
  }
}
```

---

### `GET /robotics.listTasks`

Returns a paginated list of tasks, optionally filtered by status, robot, or type.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | No | Filter by assigned robot |
| `fleetId` | `string` | No | Filter by fleet |
| `status` | `string` | No | Filter by status: `"queued"`, `"assigned"`, `"in_progress"`, `"completed"`, `"failed"`, `"cancelled"` |
| `type` | `string` | No | Filter by task type |
| `priority` | `string` | No | Filter by priority level |
| `limit` | `number` | No | Maximum results (default: 50, max: 200) |
| `offset` | `number` | No | Pagination offset (default: 0) |
| `sortBy` | `string` | No | Sort field: `"createdAt"` (default), `"priority"`, `"status"` |
| `sortOrder` | `string` | No | Sort direction: `"asc"`, `"desc"` (default) |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `tasks` | `Task[]` | Array of tasks |
| `tasks[].taskId` | `string` | Task identifier |
| `tasks[].type` | `string` | Task type |
| `tasks[].status` | `string` | Current status |
| `tasks[].priority` | `string` | Priority level |
| `tasks[].robotId` | `string \| null` | Assigned robot |
| `tasks[].progress` | `number` | Progress percentage (0--100) |
| `tasks[].createdAt` | `string` | Creation timestamp |
| `tasks[].updatedAt` | `string` | Last update timestamp |
| `total` | `number` | Total matching tasks (before pagination) |
| `hasMore` | `boolean` | Whether more results exist beyond the current page |

**Example Request**:

```bash
curl "https://rmc.awareness.network/trpc/robotics.listTasks?input=%7B%22status%22%3A%22in_progress%22%2C%22limit%22%3A10%7D" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..."
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "tasks": [
        {
          "taskId": "task_01HXQ3NRVP8BKMW2F6Y4AZHTC9",
          "type": "movement",
          "status": "in_progress",
          "priority": "normal",
          "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
          "progress": 65,
          "createdAt": "2026-02-16T11:55:00.000Z",
          "updatedAt": "2026-02-16T12:00:30.000Z"
        }
      ],
      "total": 1,
      "hasMore": false
    }
  }
}
```

---

### `GET /robotics.getTaskStatus`

Returns detailed status information for a specific task, including subtask status for multi-robot tasks.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | `string` | Yes | Task identifier |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `string` | Task identifier |
| `type` | `string` | Task type |
| `status` | `string` | Current status |
| `priority` | `string` | Priority level |
| `robotId` | `string \| null` | Assigned robot |
| `progress` | `number` | Progress percentage (0--100) |
| `payload` | `object` | Original task payload |
| `result` | `object \| null` | Task result (when completed) |
| `error` | `string \| null` | Error message (when failed) |
| `subtasks` | `Subtask[] \| null` | Subtask details (multi-robot tasks) |
| `attempts` | `number` | Number of execution attempts |
| `createdAt` | `string` | Creation timestamp |
| `startedAt` | `string \| null` | Execution start timestamp |
| `completedAt` | `string \| null` | Completion timestamp |
| `estimatedDuration` | `number` | Estimated duration (ms) |
| `actualDuration` | `number \| null` | Actual duration (ms, when completed) |

**Example Request**:

```bash
curl "https://rmc.awareness.network/trpc/robotics.getTaskStatus?input=%7B%22taskId%22%3A%22task_01HXQ3NRVP8BKMW2F6Y4AZHTC9%22%7D" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..."
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "taskId": "task_01HXQ3NRVP8BKMW2F6Y4AZHTC9",
      "type": "movement",
      "status": "completed",
      "priority": "normal",
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "progress": 100,
      "payload": {
        "command": "navigate_to",
        "waypoint": { "x": 10.5, "y": -3.2, "z": 0.0 },
        "speed": 0.8,
        "obstacleAvoidance": true
      },
      "result": {
        "status": "completed",
        "finalPosition": { "x": 10.48, "y": -3.22, "z": 0.0 }
      },
      "error": null,
      "subtasks": null,
      "attempts": 1,
      "createdAt": "2026-02-16T11:55:00.000Z",
      "startedAt": "2026-02-16T11:55:01.200Z",
      "completedAt": "2026-02-16T12:00:45.800Z",
      "estimatedDuration": 45000,
      "actualDuration": 344600
    }
  }
}
```

---

### `POST /robotics.cancelTask`

Cancels a queued or in-progress task. If the task is currently being executed, the robot receives a stop command.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | `string` | Yes | Task identifier to cancel |
| `reason` | `string` | No | Cancellation reason |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `cancelled` | `boolean` | Whether the task was successfully cancelled |
| `taskId` | `string` | Task identifier |
| `previousStatus` | `string` | Task status before cancellation |
| `robotStopped` | `boolean` | Whether a stop command was sent to the robot |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.cancelTask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "taskId": "task_01HXQ3NRVP8BKMW2F6Y4AZHTC9",
    "reason": "operator_override"
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "cancelled": true,
      "taskId": "task_01HXQ3NRVP8BKMW2F6Y4AZHTC9",
      "previousStatus": "in_progress",
      "robotStopped": true
    }
  }
}
```

---

## VR

### `POST /robotics.createVRSession`

Creates a new VR teleoperation session linking an operator to a specific robot. Returns WebRTC configuration for video streaming and a WebSocket endpoint for control commands.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | Yes | Robot to teleoperate |
| `operatorId` | `string` | Yes | Operator identifier |
| `config` | `object` | No | Session configuration |
| `config.videoQuality` | `string` | No | Video quality: `"low"`, `"medium"`, `"high"` (default) |
| `config.stereo` | `boolean` | No | Enable stereoscopic video (default: false) |
| `config.controlScheme` | `string` | No | Controller mapping: `"standard"` (default), `"advanced"`, `"gesture_only"` |
| `config.hapticFeedback` | `boolean` | No | Enable haptic feedback (default: true) |
| `config.hudEnabled` | `boolean` | No | Enable HUD overlay (default: true) |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | VR session identifier |
| `status` | `string` | Session status (`"connecting"`) |
| `robotId` | `string` | Connected robot |
| `webrtc` | `object` | WebRTC connection details |
| `webrtc.offer` | `RTCSessionDescription` | WebRTC SDP offer |
| `webrtc.iceServers` | `RTCIceServer[]` | ICE/STUN/TURN server configuration |
| `controlEndpoint` | `string` | WebSocket URL for control commands |
| `expiresAt` | `string` | Session expiration time |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.createVRSession \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
    "operatorId": "operator_jane",
    "config": {
      "videoQuality": "high",
      "stereo": false,
      "controlScheme": "standard",
      "hapticFeedback": true,
      "hudEnabled": true
    }
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "sessionId": "vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
      "status": "connecting",
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "webrtc": {
        "offer": {
          "type": "offer",
          "sdp": "v=0\r\no=- 4611731400430049752 2 IN IP4 127.0.0.1\r\n..."
        },
        "iceServers": [
          { "urls": "stun:stun.awareness.network:3478" },
          {
            "urls": "turn:turn.awareness.network:3478",
            "username": "rmc_vr_01HXQ3TR",
            "credential": "temp_credential_..."
          }
        ]
      },
      "controlEndpoint": "wss://rmc.awareness.network/vr/ws/vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
      "expiresAt": "2026-02-16T14:00:00.000Z"
    }
  }
}
```

---

### `POST /robotics.sendVRCommand`

Sends a command through an active VR session. Used for WebRTC signaling (answer, ICE candidates) and out-of-band control commands.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | Yes | VR session identifier |
| `command` | `object` | Yes | Command payload |
| `command.type` | `string` | Yes | Command type: `"webrtc_answer"`, `"ice_candidate"`, `"switch_robot"`, `"toggle_camera"`, `"record_observation"` |
| `command.payload` | `object` | Yes | Command-specific data |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `accepted` | `boolean` | Whether the command was accepted |
| `sessionId` | `string` | VR session identifier |
| `result` | `object \| null` | Command-specific result data |

**Example Request** (WebRTC answer):

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.sendVRCommand \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "sessionId": "vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
    "command": {
      "type": "webrtc_answer",
      "payload": {
        "type": "answer",
        "sdp": "v=0\r\no=- 4611731400430049753 2 IN IP4 127.0.0.1\r\n..."
      }
    }
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "accepted": true,
      "sessionId": "vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
      "result": {
        "webrtcState": "connected",
        "videoStreaming": true
      }
    }
  }
}
```

---

### `GET /robotics.getVRSessionStatus`

Returns the current status of a VR teleoperation session.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | Yes | VR session identifier |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | VR session identifier |
| `status` | `string` | Session status: `"initializing"`, `"connecting"`, `"active"`, `"suspended"`, `"terminated"` |
| `robotId` | `string` | Connected robot |
| `operatorId` | `string` | Operator identifier |
| `videoStatus` | `string` | Video stream status: `"streaming"`, `"buffering"`, `"disconnected"` |
| `controlLoopHz` | `number` | Current control loop frequency |
| `latency` | `object` | Latency metrics |
| `latency.command` | `number` | Command round-trip latency (ms) |
| `latency.video` | `number` | Video stream latency (ms) |
| `duration` | `number` | Session duration in seconds |
| `createdAt` | `string` | Session creation timestamp |

**Example Request**:

```bash
curl "https://rmc.awareness.network/trpc/robotics.getVRSessionStatus?input=%7B%22sessionId%22%3A%22vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT%22%7D" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..."
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "sessionId": "vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
      "status": "active",
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "operatorId": "operator_jane",
      "videoStatus": "streaming",
      "controlLoopHz": 60,
      "latency": {
        "command": 23,
        "video": 45
      },
      "duration": 342,
      "createdAt": "2026-02-16T12:00:00.000Z"
    }
  }
}
```

---

### `POST /robotics.terminateVRSession`

Terminates an active VR session. Sends a safe-stop command to the robot, closes WebRTC and WebSocket connections, and releases the robot.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | Yes | VR session identifier to terminate |
| `reason` | `string` | No | Termination reason |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `terminated` | `boolean` | Whether the session was successfully terminated |
| `sessionId` | `string` | VR session identifier |
| `robotId` | `string` | Released robot identifier |
| `duration` | `number` | Total session duration in seconds |
| `robotStopped` | `boolean` | Whether a stop command was sent to the robot |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.terminateVRSession \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "sessionId": "vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
    "reason": "operator_finished"
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "terminated": true,
      "sessionId": "vr_session_01HXQ3TRVP8BKMW2F6Y4AZHT",
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "duration": 1842,
      "robotStopped": true
    }
  }
}
```

---

## Memory

### `POST /robotics.recordObservation`

Records an observation from a robot's sensors. Observations are stored in the RMC's memory system for later retrieval and analysis. This endpoint is used both by robots (automatic recording) and by operators (manual snapshots via VR or dashboard).

**Authentication**: MCP token or operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | Yes | Robot that made the observation |
| `type` | `string` | Yes | Observation type: `"visual"`, `"audio"`, `"sensor"`, `"event"`, `"annotation"` |
| `data` | `object` | Yes | Observation data |
| `data.description` | `string` | No | Human-readable description |
| `data.sensorData` | `object` | No | Structured sensor readings |
| `data.imageUrl` | `string` | No | URL to captured image |
| `data.tags` | `string[]` | No | Searchable tags |
| `location` | `{x, y, z}` | No | Location where the observation was made |
| `timestamp` | `string` | No | Observation timestamp (defaults to server time) |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `observationId` | `string` | Unique observation identifier |
| `robotId` | `string` | Robot that made the observation |
| `type` | `string` | Observation type |
| `storedAt` | `string` | Storage timestamp |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.recordObservation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
    "type": "visual",
    "data": {
      "description": "Detected obstacle: cardboard box at coordinates (12.3, 5.1)",
      "sensorData": {
        "lidarDistance": 2.3,
        "confidenceScore": 0.94,
        "objectClass": "box"
      },
      "tags": ["obstacle", "box", "warehouse_zone_a"]
    },
    "location": { "x": 12.3, "y": 5.1, "z": 0.0 }
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "observationId": "obs_01HXQ3WRVP8BKMW2F6Y4AZHTD2",
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "type": "visual",
      "storedAt": "2026-02-16T12:05:00.000Z"
    }
  }
}
```

---

### `GET /robotics.retrieveMemories`

Retrieves stored observations/memories, optionally filtered by robot, type, location, time range, or tags.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | No | Filter by robot |
| `type` | `string` | No | Filter by observation type |
| `tags` | `string[]` | No | Filter by tags (any match) |
| `location` | `object` | No | Filter by proximity to a location |
| `location.center` | `{x, y, z}` | No | Center point |
| `location.radius` | `number` | No | Search radius in meters |
| `timeRange` | `object` | No | Filter by time range |
| `timeRange.from` | `string` | No | Start time (ISO 8601) |
| `timeRange.to` | `string` | No | End time (ISO 8601) |
| `limit` | `number` | No | Maximum results (default: 50, max: 200) |
| `offset` | `number` | No | Pagination offset |
| `sortBy` | `string` | No | Sort field: `"timestamp"` (default), `"relevance"` |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `memories` | `Observation[]` | Array of stored observations |
| `memories[].observationId` | `string` | Observation identifier |
| `memories[].robotId` | `string` | Robot that made the observation |
| `memories[].type` | `string` | Observation type |
| `memories[].data` | `object` | Observation data |
| `memories[].location` | `{x, y, z} \| null` | Observation location |
| `memories[].timestamp` | `string` | Observation timestamp |
| `total` | `number` | Total matching observations |
| `hasMore` | `boolean` | Whether more results exist |

**Example Request**:

```bash
curl "https://rmc.awareness.network/trpc/robotics.retrieveMemories?input=%7B%22tags%22%3A%5B%22obstacle%22%5D%2C%22limit%22%3A10%7D" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..."
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "memories": [
        {
          "observationId": "obs_01HXQ3WRVP8BKMW2F6Y4AZHTD2",
          "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
          "type": "visual",
          "data": {
            "description": "Detected obstacle: cardboard box at coordinates (12.3, 5.1)",
            "sensorData": {
              "lidarDistance": 2.3,
              "confidenceScore": 0.94,
              "objectClass": "box"
            },
            "tags": ["obstacle", "box", "warehouse_zone_a"]
          },
          "location": { "x": 12.3, "y": 5.1, "z": 0.0 },
          "timestamp": "2026-02-16T12:05:00.000Z"
        }
      ],
      "total": 1,
      "hasMore": false
    }
  }
}
```

---

## Control

### `POST /robotics.sendCommand`

Sends a direct control command to a robot. Unlike tasks (which are queued and processed asynchronously), commands are forwarded immediately to the robot through the ROS2 bridge.

**Authentication**: Operator session token or MCP token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | Yes | Target robot |
| `command` | `object` | Yes | Command payload |
| `command.type` | `string` | Yes | Command type: `"velocity"`, `"navigate"`, `"joint"`, `"gripper"`, `"custom"` |
| `command.data` | `object` | Yes | Command-specific data |

For `type: "velocity"`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command.data.linear` | `{x, y, z}` | Yes | Linear velocity (m/s) |
| `command.data.angular` | `{x, y, z}` | Yes | Angular velocity (rad/s) |
| `command.data.duration` | `number` | No | Duration in ms (default: continuous until next command) |

For `type: "navigate"`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command.data.waypoint` | `{x, y, z}` | Yes | Target position |
| `command.data.speed` | `number` | No | Movement speed (m/s) |
| `command.data.heading` | `number` | No | Target heading (radians) |

For `type: "gripper"`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command.data.action` | `string` | Yes | `"open"` or `"close"` |
| `command.data.force` | `number` | No | Grip force in Newtons |
| `command.data.width` | `number` | No | Gripper width in meters |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `accepted` | `boolean` | Whether the command was accepted and forwarded |
| `robotId` | `string` | Target robot |
| `commandType` | `string` | Command type |
| `publishedTopic` | `string` | ROS2 topic the command was published to |
| `timestamp` | `string` | Command timestamp |

**Example Request**:

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.sendCommand \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
    "command": {
      "type": "velocity",
      "data": {
        "linear": { "x": 0.5, "y": 0.0, "z": 0.0 },
        "angular": { "x": 0.0, "y": 0.0, "z": 0.3 },
        "duration": 2000
      }
    }
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "accepted": true,
      "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
      "commandType": "velocity",
      "publishedTopic": "/go2-alpha/cmd_vel",
      "timestamp": "2026-02-16T12:10:00.000Z"
    }
  }
}
```

---

### `POST /robotics.emergencyStop`

Immediately halts one or more robots. This is a high-priority command that bypasses the task queue and sends stop commands directly through the ROS2 bridge. All active tasks for the affected robots are cancelled.

**Authentication**: Operator session token.

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `robotId` | `string` | Conditional | Stop a specific robot (one of `robotId`, `fleetId`, or `scope` is required) |
| `fleetId` | `string` | Conditional | Stop all robots in a fleet |
| `scope` | `string` | Conditional | `"global"` to stop all connected robots |
| `reason` | `string` | No | Reason for the emergency stop |

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `stopped` | `boolean` | Whether the stop command was executed |
| `affectedRobots` | `string[]` | List of robot IDs that received the stop command |
| `cancelledTasks` | `number` | Number of active tasks that were cancelled |
| `timestamp` | `string` | Emergency stop timestamp |

**Example Request** (single robot):

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.emergencyStop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "robotId": "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
    "reason": "obstacle_detected"
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "stopped": true,
      "affectedRobots": ["robot_01HXQ3K7M9V2YPFGN8D6RJTW4E"],
      "cancelledTasks": 1,
      "timestamp": "2026-02-16T12:15:00.000Z"
    }
  }
}
```

**Example Request** (global stop):

```bash
curl -X POST https://rmc.awareness.network/trpc/robotics.emergencyStop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer session_eyJhbGciOiJSUzI1NiJ9..." \
  -d '{
    "scope": "global",
    "reason": "safety_protocol_activated"
  }'
```

**Example Response**:

```json
{
  "result": {
    "data": {
      "stopped": true,
      "affectedRobots": [
        "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
        "robot_01HXQ3K8N2W3YPFGN8D6RJTW5F",
        "robot_01HXQ3K9P4X5YPFGN8D6RJTW6G"
      ],
      "cancelledTasks": 7,
      "timestamp": "2026-02-16T12:15:00.000Z"
    }
  }
}
```

---

## Endpoint Summary

| Category | Endpoint | Method | Auth Required | Description |
|----------|----------|--------|--------------|-------------|
| **Health** | `robotics.health` | GET | No | System health status |
| **Auth** | `robotics.authenticateRobot` | POST | MCP Token | Register and authenticate a robot |
| **Auth** | `robotics.terminateSession` | POST | MCP/Session | Terminate a robot session |
| **Robots** | `robotics.listOnlineRobots` | GET | Session | List all online robots |
| **Robots** | `robotics.getRobotStatus` | GET | Session/MCP | Get detailed robot status |
| **Tasks** | `robotics.createTask` | POST | Session | Create and enqueue a task |
| **Tasks** | `robotics.listTasks` | GET | Session | List tasks with filters |
| **Tasks** | `robotics.getTaskStatus` | GET | Session | Get detailed task status |
| **Tasks** | `robotics.cancelTask` | POST | Session | Cancel a task |
| **VR** | `robotics.createVRSession` | POST | Session | Create a VR teleoperation session |
| **VR** | `robotics.sendVRCommand` | POST | Session | Send a VR session command |
| **VR** | `robotics.getVRSessionStatus` | GET | Session | Get VR session status |
| **VR** | `robotics.terminateVRSession` | POST | Session | Terminate a VR session |
| **Memory** | `robotics.recordObservation` | POST | MCP/Session | Record a robot observation |
| **Memory** | `robotics.retrieveMemories` | GET | Session | Retrieve stored observations |
| **Control** | `robotics.sendCommand` | POST | Session/MCP | Send a direct robot command |
| **Control** | `robotics.emergencyStop` | POST | Session | Emergency stop robots |

---

## Rate Limits

| Endpoint Category | Rate Limit | Window | Notes |
|-------------------|-----------|--------|-------|
| Health | Unlimited | N/A | No rate limiting applied |
| Auth | 10 requests | 60 seconds | Per MCP token |
| Robots (read) | 100 requests | 10 seconds | Per operator session |
| Tasks (write) | 50 requests | 10 seconds | Per operator session |
| Tasks (read) | 100 requests | 10 seconds | Per operator session |
| VR (write) | 200 requests | 10 seconds | Higher limit for real-time control |
| Memory (write) | 30 requests | 10 seconds | Per robot |
| Memory (read) | 50 requests | 10 seconds | Per operator session |
| Control (write) | 100 requests | 10 seconds | Per operator session |
| Emergency Stop | Unlimited | N/A | Never rate limited for safety |
