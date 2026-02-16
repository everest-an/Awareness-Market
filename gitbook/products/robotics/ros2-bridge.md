# ROS2 Bridge

## Overview

The ROS2 Bridge is the communication layer between the web-native RMC and the ROS2 ecosystem. It translates between JSON (used by the tRPC API and internal components) and ROS2 message types (used by robots), manages ROS2 node lifecycle, and provides bidirectional topic subscription and publishing.

The bridge runs as a dedicated ROS2 node (`rmc_bridge`) that connects to the same DDS network as the robots. It subscribes to robot telemetry topics, publishes control commands, and exposes this data through the RMC's internal State Manager.

---

## Bridge Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        RMC PROCESS                                │
│                                                                  │
│   ┌──────────────┐     ┌──────────────────────────────────────┐  │
│   │  tRPC API    │     │          ROS2 BRIDGE                  │  │
│   │              │     │                                      │  │
│   │  JSON in/out │────▶│  ┌──────────────┐  ┌──────────────┐  │  │
│   │              │     │  │  Serializer  │  │ Deserializer │  │  │
│   │              │◀────│  │  JSON → ROS2 │  │ ROS2 → JSON  │  │  │
│   └──────────────┘     │  └──────┬───────┘  └──────┬───────┘  │  │
│                        │         │                  │          │  │
│   ┌──────────────┐     │  ┌──────▼───────┐  ┌──────▼───────┐  │  │
│   │  State       │     │  │  Publisher   │  │  Subscriber  │  │  │
│   │  Manager     │◀───▶│  │  Manager    │  │  Manager     │  │  │
│   │              │     │  │             │  │              │  │  │
│   │  Redis cache │     │  │  /cmd_vel   │  │  /odom       │  │  │
│   │  + Postgres  │     │  │  /joint_cmd │  │  /scan       │  │  │
│   └──────────────┘     │  │  /gripper   │  │  /camera/..  │  │  │
│                        │  └──────┬───────┘  └──────┬───────┘  │  │
│                        │         │                  │          │  │
│                        │  ┌──────▼──────────────────▼───────┐  │  │
│                        │  │       ROS2 Node (rmc_bridge)    │  │  │
│                        │  │       DDS Transport Layer        │  │  │
│                        │  └──────────────┬──────────────────┘  │  │
│                        └─────────────────┼─────────────────────┘  │
└──────────────────────────┼───────────────┼────────────────────────┘
                           │               │
                      DDS multicast    DDS multicast
                      (publish)        (subscribe)
                           │               │
                           ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ROBOT NETWORK (DDS)                          │
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│   │  Unitree Go2 │  │  Spot        │  │  Custom Robot        │   │
│   │  (Adapter    │  │  (Adapter    │  │  (Native ROS2 node)  │   │
│   │   Node)      │  │   Node)      │  │                      │   │
│   └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Topic Subscription and Publishing

### Default Topic Subscriptions

The bridge automatically subscribes to a standard set of topics for each registered robot. Topics follow the namespace convention `/<robot_name>/<topic>`.

| Topic | Message Type | Direction | Rate | Description |
|-------|-------------|-----------|------|-------------|
| `/<robot>/odom` | `nav_msgs/Odometry` | Robot -> RMC | 30 Hz | Robot position and velocity |
| `/<robot>/scan` | `sensor_msgs/LaserScan` | Robot -> RMC | 10 Hz | LIDAR scan data |
| `/<robot>/camera/image_raw` | `sensor_msgs/Image` | Robot -> RMC | 30 Hz | Main camera feed |
| `/<robot>/camera/depth` | `sensor_msgs/Image` | Robot -> RMC | 15 Hz | Depth camera feed |
| `/<robot>/joint_states` | `sensor_msgs/JointState` | Robot -> RMC | 50 Hz | Joint positions and velocities |
| `/<robot>/imu/data` | `sensor_msgs/Imu` | Robot -> RMC | 100 Hz | IMU accelerometer and gyroscope |
| `/<robot>/battery_state` | `sensor_msgs/BatteryState` | Robot -> RMC | 1 Hz | Battery level and status |
| `/<robot>/diagnostics` | `diagnostic_msgs/DiagnosticArray` | Robot -> RMC | 1 Hz | Hardware diagnostics |

### Default Topic Publications

| Topic | Message Type | Direction | Rate | Description |
|-------|-------------|-----------|------|-------------|
| `/<robot>/cmd_vel` | `geometry_msgs/Twist` | RMC -> Robot | 60 Hz | Velocity commands |
| `/<robot>/joint_commands` | `trajectory_msgs/JointTrajectory` | RMC -> Robot | 50 Hz | Joint control commands |
| `/<robot>/gripper/command` | `control_msgs/GripperCommand` | RMC -> Robot | On demand | Gripper open/close |
| `/<robot>/navigate_to` | `geometry_msgs/PoseStamped` | RMC -> Robot | On demand | Navigation goal |
| `/<robot>/emergency_stop` | `std_msgs/Bool` | RMC -> Robot | On demand | Emergency stop trigger |

### Subscribing to a Topic Programmatically

```typescript
// Bridge API: subscribe to a custom topic
bridge.subscribe({
  robotName: "go2-alpha",
  topic: "/go2-alpha/custom_sensor",
  messageType: "sensor_msgs/Temperature",
  qos: {
    reliability: "best_effort",
    durability: "volatile",
    history: { kind: "keep_last", depth: 10 }
  },
  callback: (message) => {
    console.log(`Temperature: ${message.temperature}°C`);
    stateManager.updateRobotTelemetry("go2-alpha", {
      temperature: message.temperature,
      variance: message.variance
    });
  }
});
```

### Publishing to a Topic Programmatically

```typescript
// Bridge API: publish a Twist command
bridge.publish({
  robotName: "go2-alpha",
  topic: "/go2-alpha/cmd_vel",
  messageType: "geometry_msgs/Twist",
  message: {
    linear: { x: 0.5, y: 0.0, z: 0.0 },
    angular: { x: 0.0, y: 0.0, z: 0.3 }
  }
});
```

---

## Supported Message Types

The bridge includes built-in serializers and deserializers for the following ROS2 message types. Each type can be translated bidirectionally between JSON and the ROS2 binary format.

### geometry_msgs/Twist

Used for velocity commands (linear and angular velocity).

```typescript
// JSON representation
interface Twist {
  linear: { x: number; y: number; z: number };
  angular: { x: number; y: number; z: number };
}

// Example
{
  "linear": { "x": 0.5, "y": 0.0, "z": 0.0 },
  "angular": { "x": 0.0, "y": 0.0, "z": 0.3 }
}
```

### sensor_msgs/JointState

Reports joint positions, velocities, and efforts for articulated robots.

```typescript
// JSON representation
interface JointState {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  name: string[];
  position: number[];      // radians
  velocity: number[];      // radians/sec
  effort: number[];        // Nm
}

// Example (Spot arm)
{
  "header": { "stamp": { "sec": 1739664000, "nanosec": 0 }, "frame_id": "base_link" },
  "name": ["shoulder_yaw", "shoulder_pitch", "elbow", "wrist_roll", "wrist_pitch", "gripper"],
  "position": [0.0, -0.785, 1.571, 0.0, 0.0, 0.5],
  "velocity": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  "effort": [0.0, 12.5, 8.3, 0.0, 0.0, 2.1]
}
```

### sensor_msgs/Image

Camera image data. The bridge handles encoding/decoding between raw image formats and compressed formats suitable for WebRTC streaming.

```typescript
// JSON representation (metadata only; pixel data is handled separately)
interface Image {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  height: number;
  width: number;
  encoding: string;         // "rgb8", "bgr8", "mono8", "16UC1" (depth)
  is_bigendian: boolean;
  step: number;             // row length in bytes
  data: Uint8Array;         // pixel data (binary, not included in JSON API)
}

// For the JSON API, images are returned as URLs or base64-encoded thumbnails:
{
  "header": { "stamp": { "sec": 1739664000, "nanosec": 0 }, "frame_id": "camera_link" },
  "height": 720,
  "width": 1280,
  "encoding": "rgb8",
  "url": "wss://rmc.awareness.network/stream/go2-alpha/camera",
  "thumbnail": "data:image/jpeg;base64,/9j/4AAQSkZ..."
}
```

### sensor_msgs/LaserScan

2D LIDAR scan data.

```typescript
// JSON representation
interface LaserScan {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  angle_min: number;         // radians
  angle_max: number;         // radians
  angle_increment: number;   // radians
  time_increment: number;    // seconds between measurements
  scan_time: number;         // seconds for full scan
  range_min: number;         // meters
  range_max: number;         // meters
  ranges: number[];          // distance measurements (meters)
  intensities: number[];     // signal intensity values
}

// Example
{
  "header": { "stamp": { "sec": 1739664000, "nanosec": 0 }, "frame_id": "lidar_link" },
  "angle_min": -3.14159,
  "angle_max": 3.14159,
  "angle_increment": 0.00872,
  "time_increment": 0.0,
  "scan_time": 0.1,
  "range_min": 0.1,
  "range_max": 30.0,
  "ranges": [5.2, 5.1, 5.3, 4.8, "...360 values..."],
  "intensities": [100, 102, 98, 110, "...360 values..."]
}
```

### nav_msgs/Odometry

Robot position and velocity in the world frame.

```typescript
// JSON representation
interface Odometry {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  child_frame_id: string;
  pose: {
    pose: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
    covariance: number[];   // 6x6 covariance matrix (36 values)
  };
  twist: {
    twist: {
      linear: { x: number; y: number; z: number };
      angular: { x: number; y: number; z: number };
    };
    covariance: number[];   // 6x6 covariance matrix (36 values)
  };
}
```

### sensor_msgs/Imu

Inertial measurement unit data (accelerometer, gyroscope, orientation).

```typescript
// JSON representation
interface Imu {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string };
  orientation: { x: number; y: number; z: number; w: number };
  orientation_covariance: number[];       // 3x3 (9 values)
  angular_velocity: { x: number; y: number; z: number };
  angular_velocity_covariance: number[];  // 3x3 (9 values)
  linear_acceleration: { x: number; y: number; z: number };
  linear_acceleration_covariance: number[]; // 3x3 (9 values)
}
```

---

## Custom Message Support

The bridge supports custom ROS2 message types beyond the standard library. Custom messages are defined using a JSON schema that describes the message fields and their types.

### Defining a Custom Message

```typescript
// Register a custom message type with the bridge
bridge.registerMessageType({
  package: "awareness_msgs",
  name: "RobotHealthReport",
  fields: [
    { name: "header", type: "std_msgs/Header" },
    { name: "cpu_temperature", type: "float32" },
    { name: "gpu_temperature", type: "float32" },
    { name: "motor_temperatures", type: "float32[]" },
    { name: "battery_voltage", type: "float32" },
    { name: "battery_current", type: "float32" },
    { name: "wifi_signal_strength", type: "int8" },
    { name: "error_codes", type: "uint16[]" },
    { name: "status_message", type: "string" }
  ]
});

// Now subscribe to a topic using the custom type
bridge.subscribe({
  robotName: "go2-alpha",
  topic: "/go2-alpha/health_report",
  messageType: "awareness_msgs/RobotHealthReport",
  qos: { reliability: "reliable", durability: "transient_local" },
  callback: (msg) => {
    if (msg.cpu_temperature > 85.0) {
      alertManager.trigger("thermal_warning", {
        robot: "go2-alpha",
        temperature: msg.cpu_temperature
      });
    }
  }
});
```

### Custom Message Type Mapping

| ROS2 Type | JSON Type | Notes |
|-----------|----------|-------|
| `bool` | `boolean` | |
| `int8`, `int16`, `int32` | `number` | Integer values |
| `uint8`, `uint16`, `uint32` | `number` | Unsigned integer values |
| `int64`, `uint64` | `string` | Encoded as string to prevent JS precision loss |
| `float32`, `float64` | `number` | IEEE 754 floating point |
| `string` | `string` | UTF-8 encoded |
| `T[]` | `Array<T>` | Variable-length array of type T |
| `T[N]` | `Array<T>` | Fixed-length array (length enforced) |
| `std_msgs/Header` | `object` | `{ stamp: { sec, nanosec }, frame_id }` |
| Nested message | `object` | Recursively translated |

---

## Quality of Service (QoS) Configuration

ROS2 uses DDS quality-of-service profiles to control the reliability and behavior of topic communication. The bridge exposes QoS configuration for each subscription and publication.

### QoS Profiles

```typescript
// Predefined QoS profiles
const QoSProfiles = {
  // For sensor data: high frequency, tolerate drops
  sensorData: {
    reliability: "best_effort",
    durability: "volatile",
    history: { kind: "keep_last", depth: 5 },
    deadline: { sec: 0, nanosec: 100_000_000 },   // 100ms
    liveliness: "automatic"
  },

  // For control commands: guaranteed delivery
  controlCommand: {
    reliability: "reliable",
    durability: "volatile",
    history: { kind: "keep_last", depth: 1 },
    deadline: { sec: 0, nanosec: 50_000_000 },     // 50ms
    liveliness: "automatic"
  },

  // For configuration: guaranteed delivery + persistence
  configuration: {
    reliability: "reliable",
    durability: "transient_local",
    history: { kind: "keep_last", depth: 1 },
    liveliness: "automatic"
  },

  // For camera/video: best effort, latest frame only
  videoStream: {
    reliability: "best_effort",
    durability: "volatile",
    history: { kind: "keep_last", depth: 1 },
    deadline: { sec: 0, nanosec: 33_333_333 },     // 30 fps
    liveliness: "automatic"
  }
};
```

### QoS Parameter Reference

| Parameter | Options | Description |
|-----------|---------|-------------|
| `reliability` | `reliable`, `best_effort` | Whether messages are guaranteed to arrive |
| `durability` | `volatile`, `transient_local` | Whether late-joining subscribers get historical messages |
| `history.kind` | `keep_last`, `keep_all` | How many messages to buffer |
| `history.depth` | number | Buffer size (for `keep_last`) |
| `deadline.sec/nanosec` | number | Maximum time between messages before a missed deadline |
| `liveliness` | `automatic`, `manual_by_topic` | How the system detects if a publisher is alive |

---

## Bridge Configuration

The bridge is configured through environment variables and a YAML configuration file.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ROS_DOMAIN_ID` | `0` | ROS2 domain ID for DDS communication |
| `RMC_BRIDGE_NODE_NAME` | `rmc_bridge` | Name of the ROS2 node |
| `RMC_BRIDGE_NAMESPACE` | `/rmc` | ROS2 namespace for bridge-specific topics |
| `RMC_DDS_IMPLEMENTATION` | `rmw_fastrtps_cpp` | DDS middleware implementation |
| `RMC_BRIDGE_LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARN, ERROR) |

### YAML Configuration File

```yaml
# rmc_bridge_config.yaml

bridge:
  node_name: rmc_bridge
  namespace: /rmc
  domain_id: 0

  # Default QoS for all subscriptions unless overridden
  default_qos:
    reliability: best_effort
    durability: volatile
    history:
      kind: keep_last
      depth: 10

  # Topic mappings per robot type
  robot_types:
    unitree_go2:
      subscriptions:
        - topic: /odom
          type: nav_msgs/Odometry
          qos_profile: sensor_data
        - topic: /scan
          type: sensor_msgs/LaserScan
          qos_profile: sensor_data
        - topic: /camera/image_raw
          type: sensor_msgs/Image
          qos_profile: video_stream
        - topic: /joint_states
          type: sensor_msgs/JointState
          qos_profile: sensor_data
        - topic: /battery_state
          type: sensor_msgs/BatteryState
          qos_profile: configuration
      publications:
        - topic: /cmd_vel
          type: geometry_msgs/Twist
          qos_profile: control_command
        - topic: /navigate_to
          type: geometry_msgs/PoseStamped
          qos_profile: control_command
        - topic: /emergency_stop
          type: std_msgs/Bool
          qos_profile: control_command

    boston_dynamics_spot:
      subscriptions:
        - topic: /odom
          type: nav_msgs/Odometry
          qos_profile: sensor_data
        - topic: /scan
          type: sensor_msgs/LaserScan
          qos_profile: sensor_data
        - topic: /camera/frontleft/image_raw
          type: sensor_msgs/Image
          qos_profile: video_stream
        - topic: /camera/frontright/image_raw
          type: sensor_msgs/Image
          qos_profile: video_stream
        - topic: /joint_states
          type: sensor_msgs/JointState
          qos_profile: sensor_data
        - topic: /arm/joint_states
          type: sensor_msgs/JointState
          qos_profile: sensor_data
      publications:
        - topic: /cmd_vel
          type: geometry_msgs/Twist
          qos_profile: control_command
        - topic: /arm/joint_commands
          type: trajectory_msgs/JointTrajectory
          qos_profile: control_command
        - topic: /gripper/command
          type: control_msgs/GripperCommand
          qos_profile: control_command

  # Network configuration
  network:
    multicast_enabled: true
    discovery_timeout: 10       # seconds
    reconnect_interval: 5       # seconds
    max_reconnect_attempts: 12  # 60 seconds total
```

---

## Adapter Nodes

Robots that do not natively support ROS2 require adapter nodes. An adapter node translates between the robot's proprietary SDK and standard ROS2 interfaces.

### Adapter Architecture

```
┌─────────────────────────────────────────────────────┐
│                  ADAPTER NODE                        │
│                                                     │
│   ┌─────────────┐      ┌─────────────────────────┐ │
│   │  ROS2 Node  │      │  Vendor SDK Client       │ │
│   │             │      │                           │ │
│   │  Publishes: │      │  Unitree SDK /            │ │
│   │  /odom      │◀────▶│  Boston Dynamics API /    │ │
│   │  /scan      │      │  Custom protocol          │ │
│   │  /camera/.. │      │                           │ │
│   │             │      │  Translates proprietary   │ │
│   │  Subscribes:│      │  data ↔ ROS2 messages     │ │
│   │  /cmd_vel   │      │                           │ │
│   │  /navigate  │      │                           │ │
│   └─────────────┘      └─────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The RMC provides reference adapter implementations for Unitree Go2 and Boston Dynamics Spot. Custom adapters can be written in Python or C++ following the adapter interface.

### Writing a Custom Adapter

```python
# custom_robot_adapter.py
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan

class CustomRobotAdapter(Node):
    def __init__(self):
        super().__init__("custom_robot_adapter")

        # Robot SDK client
        self.robot = CustomRobotSDK(
            host=self.get_parameter("robot_host").value,
            port=self.get_parameter("robot_port").value
        )

        # Publishers (robot data -> ROS2)
        self.odom_pub = self.create_publisher(Odometry, "odom", 10)
        self.scan_pub = self.create_publisher(LaserScan, "scan", 10)

        # Subscribers (ROS2 commands -> robot)
        self.cmd_vel_sub = self.create_subscription(
            Twist, "cmd_vel", self.cmd_vel_callback, 10
        )

        # Periodic telemetry polling
        self.create_timer(0.033, self.publish_odometry)      # 30 Hz
        self.create_timer(0.1, self.publish_laser_scan)      # 10 Hz

    def publish_odometry(self):
        """Read robot position from SDK and publish as Odometry."""
        pose = self.robot.get_pose()
        msg = Odometry()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "odom"
        msg.child_frame_id = "base_link"
        msg.pose.pose.position.x = pose.x
        msg.pose.pose.position.y = pose.y
        msg.pose.pose.position.z = pose.z
        self.odom_pub.publish(msg)

    def publish_laser_scan(self):
        """Read LIDAR data from SDK and publish as LaserScan."""
        scan_data = self.robot.get_lidar_scan()
        msg = LaserScan()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.header.frame_id = "lidar_link"
        msg.angle_min = scan_data.angle_min
        msg.angle_max = scan_data.angle_max
        msg.angle_increment = scan_data.angle_increment
        msg.range_min = 0.1
        msg.range_max = 30.0
        msg.ranges = scan_data.ranges
        self.scan_pub.publish(msg)

    def cmd_vel_callback(self, msg: Twist):
        """Receive Twist command and forward to robot SDK."""
        self.robot.set_velocity(
            linear_x=msg.linear.x,
            linear_y=msg.linear.y,
            angular_z=msg.angular.z
        )

def main():
    rclpy.init()
    node = CustomRobotAdapter()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == "__main__":
    main()
```
