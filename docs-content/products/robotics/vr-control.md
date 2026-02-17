# VR Control

## Overview

The RMC VR Control system enables operators to teleoperate robots through immersive WebXR sessions. Using a compatible VR headset, operators see live camera feeds from the robot, control movement and actions through controller inputs and gestures, and switch between robots in a fleet without leaving the VR environment.

The system is built on three web standards:
- **WebXR** -- Provides headset tracking, controller input, and rendering
- **WebRTC** -- Delivers low-latency video from robot cameras to the headset
- **WebSocket** -- Transmits control commands from the headset to the RMC

---

## Supported Headsets

| Headset | Manufacturer | Controller Type | Tracking | Tested Version |
|---------|-------------|----------------|----------|---------------|
| **Meta Quest 3** | Meta | Touch Plus | Inside-out 6DoF | v62+ |
| **Meta Quest Pro** | Meta | Touch Pro | Inside-out 6DoF | v62+ |
| **Meta Quest 2** | Meta | Touch | Inside-out 6DoF | v62+ |
| **HTC Vive Pro 2** | HTC | Vive Controllers | Lighthouse 6DoF | v5.3+ |
| **HTC Vive XR Elite** | HTC | Vive Controllers | Inside-out 6DoF | v1.0+ |
| **Valve Index** | Valve | Knuckles | Lighthouse 6DoF | N/A |
| **Pico 4** | ByteDance | Pico Controllers | Inside-out 6DoF | v5.7+ |

All headsets that implement the WebXR Device API with the `immersive-vr` session type are supported. The table above lists headsets that have been tested and validated with the RMC.

> **Note:** Hand tracking (without controllers) is supported on Meta Quest 3 and Quest Pro through the WebXR Hand Tracking API. Other headsets require physical controllers.

---

## Controller Mapping

The RMC maps VR controller inputs to robot commands using a standardized two-handed scheme. The right controller handles movement; the left controller handles actions and system operations.

### Right Controller (Movement)

```
┌─────────────────────────────────────────────────┐
│              RIGHT CONTROLLER                    │
│              (Movement)                          │
│                                                 │
│   Thumbstick                                    │
│   ┌───┐                                        │
│   │ ● │ Push Forward  → Robot moves forward     │
│   │   │ Push Back     → Robot moves backward    │
│   │   │ Push Left     → Robot strafes left      │
│   │   │ Push Right    → Robot strafes right     │
│   └───┘                                        │
│   Thumbstick deflection = speed (0.0 - 1.0)    │
│                                                 │
│   Trigger (index finger)                        │
│   ├── Press          → Boost speed (1.5x)       │
│   └── Hold + Stick   → Precision mode (0.3x)    │
│                                                 │
│   Grip (middle finger)                          │
│   └── Hold           → Rotate robot (yaw)       │
│       + Stick Left   → Rotate counterclockwise  │
│       + Stick Right  → Rotate clockwise          │
│                                                 │
│   A Button                                      │
│   └── Press          → Toggle camera view       │
│       (front → rear → left → right → front)     │
│                                                 │
│   B Button                                      │
│   └── Press          → Reset robot orientation  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Left Controller (Actions)

```
┌─────────────────────────────────────────────────┐
│              LEFT CONTROLLER                     │
│              (Actions & System)                  │
│                                                 │
│   Thumbstick                                    │
│   ┌───┐                                        │
│   │ ● │ Push Up/Down  → Robot arm up/down       │
│   │   │ Push L/R      → Robot arm left/right    │
│   └───┘                                        │
│   (Only active for robots with manipulation)    │
│                                                 │
│   Trigger (index finger)                        │
│   ├── Press          → Gripper close            │
│   └── Release        → Gripper open             │
│                                                 │
│   Grip (middle finger)                          │
│   └── Hold           → Select robot (fleet mode)│
│       + Point at UI  → Choose robot from list   │
│                                                 │
│   X Button                                      │
│   └── Press          → Record observation       │
│       (saves current sensor data + screenshot)   │
│                                                 │
│   Y Button                                      │
│   └── Hold (2s)      → EMERGENCY STOP           │
│       (haptic pulse confirms activation)         │
│                                                 │
│   Menu Button                                   │
│   └── Press          → Toggle HUD overlay       │
│       (battery, status, position, task info)     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Input-to-Command Translation

Controller inputs are sampled at the headset's native refresh rate (typically 72--120 Hz) and translated into ROS2-compatible commands at a fixed 60 Hz output rate.

```typescript
// Internal: controller input to Twist message translation
function mapControllerToTwist(
  rightStick: { x: number; y: number },
  rightTrigger: number,
  rightGrip: boolean
): TwistCommand {
  const speedMultiplier = rightTrigger > 0.5
    ? 1.5     // Boost mode
    : rightTrigger > 0.1
    ? 0.3     // Precision mode
    : 1.0;    // Normal mode

  return {
    linear: {
      x: rightStick.y * MAX_LINEAR_SPEED * speedMultiplier,   // forward/back
      y: rightStick.x * MAX_LINEAR_SPEED * speedMultiplier,   // strafe
      z: 0.0
    },
    angular: {
      x: 0.0,
      y: 0.0,
      z: rightGrip
        ? rightStick.x * MAX_ANGULAR_SPEED * speedMultiplier  // rotation
        : 0.0
    }
  };
}
```

---

## Gesture Recognition

On headsets with hand tracking support (Meta Quest 3, Quest Pro), the RMC recognizes a set of predefined gestures as command inputs.

| Gesture | Hand | Action |
|---------|------|--------|
| **Point** | Right | Aim at waypoint on ground plane, pinch to confirm navigation target |
| **Open Palm** | Right | Stop robot movement (equivalent to releasing all controller inputs) |
| **Pinch** | Left | Gripper close (manipulation-capable robots) |
| **Spread** | Left | Gripper open |
| **Fist** | Left (hold 3s) | Emergency stop |
| **Thumbs Up** | Either | Confirm action / dismiss notification |
| **Wave** | Either | Open/close robot selection panel |

### Gesture Processing Pipeline

```
Hand Tracking Data (25 joints per hand, 30 Hz)
    │
    ▼
┌──────────────────────┐
│   Joint Filtering    │  Low-pass filter to reduce jitter
│   (Butterworth 5Hz)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Pose Recognition   │  Match joint positions against
│   (Template Matching)│  predefined gesture templates
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Temporal Filter    │  Gesture must persist for minimum
│   (Debounce 200ms)   │  duration to prevent false triggers
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Command Emission   │  Translated to same command format
│                      │  as controller inputs
└──────────────────────┘
```

---

## WebRTC Video Streaming

Live camera feeds from robots are streamed to the VR headset through WebRTC, providing low-latency video with automatic quality adaptation.

### Streaming Architecture

```
┌──────────────┐    ROS2 topic     ┌──────────────┐
│    Robot      │ ──────────────── │  ROS2 Bridge  │
│  /camera/     │  sensor_msgs/    │               │
│  image_raw    │  Image           │  Decode &     │
└──────────────┘                   │  transcode    │
                                   └──────┬───────┘
                                          │ H.264/VP9
                                          ▼
                                   ┌──────────────┐
                                   │  WebRTC      │
                                   │  Media       │
                                   │  Server      │
                                   │              │
                                   │  ICE/STUN/   │
                                   │  TURN        │
                                   └──────┬───────┘
                                          │ WebRTC
                                          ▼
                                   ┌──────────────┐
                                   │  VR Headset  │
                                   │              │
                                   │  <video>     │
                                   │  element in  │
                                   │  WebXR scene │
                                   └──────────────┘
```

### Video Configuration

```typescript
const videoConfig = {
  codec: "H.264",                    // H.264 for broadest compatibility
  fallbackCodec: "VP9",              // VP9 for browsers without H.264 HW decode
  resolution: {
    default: { width: 1280, height: 720 },
    min: { width: 640, height: 360 },
    max: { width: 1920, height: 1080 }
  },
  framerate: {
    default: 30,
    min: 15,
    max: 60
  },
  bitrate: {
    default: 3_000_000,             // 3 Mbps
    min: 500_000,                    // 500 Kbps
    max: 8_000_000                   // 8 Mbps
  },
  adaptiveBitrate: true,            // Adjust based on network conditions
  keyframeInterval: 2000            // Force keyframe every 2 seconds
};
```

### Stereo Camera Support

For robots with stereo camera setups, the RMC can deliver stereoscopic video to the VR headset, providing depth perception to the operator.

```typescript
const stereoConfig = {
  enabled: true,
  leftTopic: "/camera/left/image_raw",
  rightTopic: "/camera/right/image_raw",
  interPupillaryDistance: 0.063,     // 63mm default IPD
  convergenceDistance: 2.0,          // meters
  layout: "side-by-side"             // or "top-bottom"
};
```

---

## Session Lifecycle

A VR session represents the active teleoperation connection between an operator's headset and a specific robot.

### Session State Machine

```
                    ┌─────────────────┐
                    │   INITIALIZING  │
                    │                 │
                    │  WebXR session  │
                    │  requested      │
                    └────────┬────────┘
                             │
                    WebXR granted + robot available
                             │
                             ▼
                    ┌─────────────────┐
                    │   CONNECTING    │
                    │                 │
                    │  WebRTC offer/  │
                    │  answer exchange│
                    └────────┬────────┘
                             │
                    WebRTC connected + video flowing
                             │
                             ▼
                    ┌─────────────────┐
            ┌──────│     ACTIVE      │──────┐
            │      │                 │      │
            │      │  Full control   │      │
            │      │  + video stream │      │
            │      └────────┬────────┘      │
            │               │               │
       switch robot    robot disconnects   operator exits
            │               │               │
            ▼               ▼               ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │  SWITCHING   │ │  SUSPENDED   │ │ TERMINATING  │
   │              │ │              │ │              │
   │  Teardown    │ │  Hold state  │ │  Cleanup     │
   │  old robot,  │ │  wait for    │ │  resources   │
   │  connect new │ │  reconnect   │ │              │
   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
          │                │                │
          ▼            timeout (30s)        ▼
   ┌──────────────┐        │         ┌──────────────┐
   │    ACTIVE    │        └────────►│  TERMINATED  │
   │  (new robot) │                  │              │
   └──────────────┘                  └──────────────┘
```

### Creating a VR Session

```typescript
// Step 1: Request VR session from the RMC
const session = await trpc.robotics.createVRSession.mutate({
  robotId: "robot_01HXQ3K7M9V2YPFGN8D6RJTW4E",
  operatorId: "operator_jane",
  config: {
    videoQuality: "high",
    stereo: false,
    controlScheme: "standard",   // "standard" | "advanced" | "gesture_only"
    hapticFeedback: true,
    hudEnabled: true
  }
});

console.log(session);
// {
//   sessionId: "vr_session_01HXQ3TRVP8B...",
//   status: "connecting",
//   robotId: "robot_01HXQ3K7M9V2...",
//   webrtc: {
//     offer: { type: "offer", sdp: "v=0\r\no=- ..." },
//     iceServers: [
//       { urls: "stun:stun.awareness.network:3478" },
//       { urls: "turn:turn.awareness.network:3478", username: "...", credential: "..." }
//     ]
//   },
//   controlEndpoint: "wss://rmc.awareness.network/vr/ws/vr_session_01HXQ3TRVP8B..."
// }

// Step 2: Establish WebRTC connection (client-side)
const pc = new RTCPeerConnection({ iceServers: session.webrtc.iceServers });
await pc.setRemoteDescription(session.webrtc.offer);
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);

// Step 3: Send answer back to RMC
await trpc.robotics.sendVRCommand.mutate({
  sessionId: session.sessionId,
  command: { type: "webrtc_answer", payload: answer }
});

// Step 4: Open WebSocket for control commands
const ws = new WebSocket(session.controlEndpoint);
ws.onopen = () => {
  console.log("VR control channel established");
};
```

### Sending VR Commands

During an active session, control commands are sent at 60 Hz through the WebSocket connection.

```typescript
// WebSocket message format for VR commands
interface VRCommandMessage {
  type: "controller_input";
  timestamp: number;
  data: {
    right: {
      thumbstick: { x: number; y: number };  // -1.0 to 1.0
      trigger: number;                         // 0.0 to 1.0
      grip: boolean;
      buttons: { a: boolean; b: boolean };
    };
    left: {
      thumbstick: { x: number; y: number };
      trigger: number;
      grip: boolean;
      buttons: { x: boolean; y: boolean; menu: boolean };
    };
    head: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
  };
}

// Example: sending input at 60 Hz
function sendControlFrame(session: XRSession, frame: XRFrame) {
  const rightInput = frame.getInput("right");
  const leftInput = frame.getInput("left");
  const headPose = frame.getViewerPose(referenceSpace);

  ws.send(JSON.stringify({
    type: "controller_input",
    timestamp: performance.now(),
    data: {
      right: {
        thumbstick: rightInput.thumbstick,
        trigger: rightInput.trigger,
        grip: rightInput.grip,
        buttons: { a: rightInput.buttons[0], b: rightInput.buttons[1] }
      },
      left: {
        thumbstick: leftInput.thumbstick,
        trigger: leftInput.trigger,
        grip: leftInput.grip,
        buttons: {
          x: leftInput.buttons[0],
          y: leftInput.buttons[1],
          menu: leftInput.buttons[2]
        }
      },
      head: {
        position: headPose.transform.position,
        orientation: headPose.transform.orientation
      }
    }
  }));
}
```

### Terminating a VR Session

```typescript
await trpc.robotics.terminateVRSession.mutate({
  sessionId: "vr_session_01HXQ3TRVP8B..."
});

// The RMC will:
// 1. Send zero-velocity command to the robot (safe stop)
// 2. Close the WebRTC connection
// 3. Close the WebSocket connection
// 4. Release the robot back to "idle" status
// 5. Persist session telemetry to PostgreSQL
```

---

## Latency Requirements

VR teleoperation has strict latency requirements to provide a usable and safe operator experience.

| Metric | Target | Maximum | Impact if Exceeded |
|--------|--------|---------|-------------------|
| **Motion-to-photon** (controller input to video update) | < 100ms | 200ms | Operator nausea, imprecise control |
| **Command latency** (input to robot movement) | < 50ms | 150ms | Robot response feels sluggish |
| **Video latency** (robot camera to headset display) | < 80ms | 200ms | Operator misjudges distances |
| **Control loop rate** | 60 Hz | 30 Hz | Jerky robot movement |
| **Video framerate** | 30 fps | 15 fps | Visual discomfort in VR |

### Latency Monitoring

The RMC continuously measures end-to-end latency and exposes it through Prometheus metrics and the VR HUD overlay.

```typescript
// Prometheus metrics for VR latency
const vrMetrics = {
  // Histogram of command round-trip times
  commandLatency: new Histogram({
    name: "rmc_vr_command_latency_ms",
    help: "VR command round-trip latency in milliseconds",
    buckets: [10, 20, 50, 100, 150, 200, 500]
  }),

  // Histogram of video frame delivery times
  videoLatency: new Histogram({
    name: "rmc_vr_video_latency_ms",
    help: "Camera-to-headset video latency in milliseconds",
    buckets: [20, 40, 80, 120, 200, 500]
  }),

  // Gauge for current control loop rate
  controlLoopRate: new Gauge({
    name: "rmc_vr_control_loop_hz",
    help: "Current VR control loop frequency"
  })
};
```

### Latency Mitigation

When latency exceeds the maximum thresholds, the system applies progressive degradation:

1. **120--150ms**: Reduce video resolution one step (e.g., 1080p to 720p)
2. **150--200ms**: Reduce video framerate to 15 fps and enable motion prediction
3. **200--300ms**: Display latency warning overlay in VR HUD
4. **> 300ms**: Pause robot movement (dead-man switch), display connection warning
5. **> 500ms for 5s**: Auto-suspend session, send zero-velocity to robot
