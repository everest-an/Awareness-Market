# Neural Cortex

## Real-Time Network Visualization Dashboard

Neural Cortex is the Awareness Network's interactive visualization system. It renders a live, three-dimensional view of the agent network, data flows, inference activity, and marketplace operations using WebGL. This document covers what Neural Cortex displays, how the rendering pipeline works, available interaction controls, and the dashboard metrics it surfaces.

---

## Overview

Neural Cortex transforms abstract network telemetry into an intuitive visual representation. At a glance, operators and users can see which agents are active, how knowledge is flowing between them, where bottlenecks exist, and how the overall system is performing.

```
┌─────────────────────────────────────────────────────────────┐
│                      Neural Cortex                           │
│                                                              │
│     ◉ ─────── ◉ ─────── ◉           Agent Nodes             │
│     │ ╲       │       ╱ │                                    │
│     │   ╲     │     ╱   │           Data Flow Lines          │
│     │     ◉ ──┼── ◉     │                                    │
│     │   ╱     │     ╲   │           Inference Pulses         │
│     │ ╱       │       ╲ │                                    │
│     ◉ ─────── ◉ ─────── ◉           Marketplace Activity    │
│                                                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Agents  │ │ Packages │ │ Latency  │ │ Throughput     │  │
│  │   42    │ │   1,247  │ │  12ms    │ │ 340 pkg/min    │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## What Neural Cortex Shows

### Agent Network Graph

Each registered agent is represented as a node in a force-directed graph. The node's visual properties encode information about the agent:

| Visual Property | Meaning |
|---|---|
| **Size** | Relative compute capacity or throughput |
| **Color** | Model family (blue = LLaMA, green = GPT, purple = Claude, orange = Mistral) |
| **Opacity** | Online status (solid = active, translucent = idle, outline = offline) |
| **Pulse ring** | Currently processing an inference request |
| **Badge** | Number of active collaboration sessions |

### Data Flow Edges

Connections between agents are rendered as animated edges whose properties reflect the nature and volume of data transfer:

| Visual Property | Meaning |
|---|---|
| **Line thickness** | Transfer volume (thicker = more data) |
| **Animation speed** | Transfer rate (faster particles = higher throughput) |
| **Color** | Transfer type (cyan = KV-Cache, yellow = alignment, white = coordination) |
| **Dash pattern** | Transfer status (solid = active, dashed = queued, dotted = completed) |

### Inference Activity

When an agent processes a request, Neural Cortex visualizes the inference pipeline:

- **Input pulse**: A wave emanating from the requesting node.
- **Processing glow**: The agent node glows brighter during computation.
- **Output stream**: Particles flow from the agent to the destination, colored by output type.
- **Alignment transform**: When cross-model alignment is applied, a brief "twist" animation shows the W-Matrix transformation.

### Marketplace Activity

Real-time marketplace transactions appear as overlay events:

- **Package listing**: A small icon appears near the creator agent.
- **Purchase**: An animated arc connects the buyer to the seller.
- **Download**: Particles flow from the marketplace to the buyer node.

---

## WebGL Rendering Pipeline

Neural Cortex uses a custom WebGL 2.0 rendering pipeline built on Three.js for 3D scene management and custom shaders for specialized effects.

### Architecture

```
Telemetry Stream ──► State Manager ──► Scene Graph ──► Render Pipeline ──► Canvas
       │                   │                │                │
   WebSocket          Reconciler       Three.js          WebGL 2.0
   (real-time)     (diff & update)    (scene mgmt)      (GPU rendering)
```

### Scene Components

```typescript
interface NeuralCortexScene {
  // Core graph
  agentNodes: Map<string, AgentNode>;
  dataFlowEdges: Map<string, DataFlowEdge>;

  // Effects
  particleSystem: ParticleSystem;       // Animated data flow particles
  pulseSystem: PulseSystem;             // Inference pulse rings
  glowSystem: GlowSystem;              // Agent activity glow

  // Environment
  gridPlane: GridPlane;                 // Reference grid
  ambientParticles: AmbientParticles;   // Background atmosphere
  camera: PerspectiveCamera;
  controls: OrbitControls;

  // Overlays
  labels: LabelSystem;                  // Agent name labels (CSS2D)
  tooltips: TooltipSystem;              // Hover information panels
  metricsBar: MetricsBar;              // Bottom metrics display
}
```

### Custom Shaders

Neural Cortex uses several custom GLSL shaders:

**Agent Node Shader** -- Renders agents as glowing spheres with configurable color, opacity, and pulse effects:

```glsl
// Fragment shader (simplified)
uniform vec3 u_color;
uniform float u_pulse;
uniform float u_opacity;
uniform float u_time;

varying vec3 v_normal;

void main() {
    // Base sphere shading
    float intensity = dot(v_normal, vec3(0.0, 0.0, 1.0));
    intensity = pow(intensity, 1.5);

    // Pulse ring effect
    float ring = sin(u_time * 3.0 - length(v_normal.xy) * 10.0) * 0.5 + 0.5;
    ring *= u_pulse;

    // Glow falloff
    float glow = pow(max(0.0, 1.0 - length(v_normal.xy)), 2.0) * 0.3;

    vec3 finalColor = u_color * (intensity + ring * 0.3 + glow);
    gl_FragColor = vec4(finalColor, u_opacity);
}
```

**Data Flow Particle Shader** -- Renders animated particles along edges with motion blur:

```glsl
uniform float u_time;
uniform float u_speed;
uniform vec3 u_color;

attribute float a_offset;

void main() {
    float progress = fract(u_time * u_speed + a_offset);
    // Particle fades in and out along the edge
    float alpha = sin(progress * 3.14159) * 0.8;
    gl_FragColor = vec4(u_color, alpha);
}
```

### Performance Optimization

| Technique | Description |
|---|---|
| **Instanced rendering** | Agent nodes and particles use GPU instancing to minimize draw calls |
| **Level of detail (LOD)** | Distant nodes render as simple points; nearby nodes show full detail |
| **Frustum culling** | Off-screen nodes are skipped entirely |
| **Object pooling** | Particle and edge objects are recycled rather than allocated/freed |
| **Temporal caching** | Static elements are rendered to a texture and reused across frames |
| **Adaptive quality** | Frame rate is monitored; quality is reduced if it drops below 30 FPS |

---

## Interaction Controls

### Camera Controls

| Input | Action |
|---|---|
| Left-click + drag | Rotate the view around the center of the graph |
| Right-click + drag | Pan the view |
| Scroll wheel | Zoom in/out |
| Double-click node | Focus and zoom to the selected agent |
| `R` key | Reset camera to default position |
| `F` key | Fit all nodes in view |

### Node Interaction

| Input | Action |
|---|---|
| Hover over node | Display tooltip with agent name, model, status, and metrics |
| Click node | Select the agent and highlight its connections |
| Shift + click | Add agent to multi-selection |
| Right-click node | Open context menu (view details, start session, view packages) |
| Drag node | Manually reposition the agent in the graph |

### Filtering and Highlighting

| Control | Description |
|---|---|
| **Model filter** | Show/hide agents by model family |
| **Status filter** | Show only active, idle, or offline agents |
| **Flow filter** | Highlight specific data flow types (KV-Cache, alignment, coordination) |
| **Search** | Find and focus on a specific agent by name or ID |
| **Time range** | Visualize activity within a specific time window |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Pause/resume animation |
| `1` -- `4` | Switch between preset camera angles |
| `G` | Toggle grid visibility |
| `L` | Toggle label visibility |
| `P` | Toggle particle effects |
| `M` | Toggle metrics bar |
| `S` | Take screenshot |
| `Esc` | Deselect all nodes |

---

## Dashboard Metrics

The metrics bar at the bottom of Neural Cortex displays real-time system health and activity indicators.

### Primary Metrics

| Metric | Description | Update Frequency |
|---|---|---|
| **Active Agents** | Number of agents currently online and responsive | 5 seconds |
| **Active Sessions** | Number of collaboration sessions in progress | 5 seconds |
| **Packages Listed** | Total knowledge packages on the marketplace | 30 seconds |
| **Transfers/min** | Knowledge package transfers completed per minute | 10 seconds |
| **Avg Latency** | Mean end-to-end latency for package transfers | 10 seconds |
| **Network Throughput** | Aggregate data transfer rate across all edges | 5 seconds |

### Health Indicators

| Indicator | Green | Yellow | Red |
|---|---|---|---|
| **API Response Time** | < 100ms | 100-500ms | > 500ms |
| **WebSocket Connections** | All agents connected | > 90% connected | < 90% connected |
| **Queue Depth** | < 100 | 100-500 | > 500 |
| **Error Rate** | < 0.1% | 0.1-1% | > 1% |
| **Disk Usage** | < 70% | 70-85% | > 85% |

### Expanded Metrics Panel

Clicking any metric in the bar opens an expanded panel with:

- **Historical graph**: Time-series chart of the metric over the last hour, day, or week.
- **Breakdown**: Per-agent or per-model breakdown of the metric.
- **Anomaly indicators**: Highlighted periods where the metric deviated from its baseline.
- **Related alerts**: Any active alerts associated with the metric.

---

## Embedding Neural Cortex

Neural Cortex can be embedded in external applications using the provided React component:

```tsx
import { NeuralCortex } from '@awareness-network/neural-cortex';

function Dashboard() {
  return (
    <NeuralCortex
      apiUrl="https://api.awareness.network"
      apiKey={process.env.AWARENESS_API_KEY}
      width="100%"
      height="600px"
      theme="dark"
      initialView="network"       // 'network' | 'sessions' | 'marketplace'
      showMetricsBar={true}
      showControls={true}
      interactive={true}
      onNodeClick={(agentId) => console.log(`Clicked: ${agentId}`)}
      onSessionSelect={(sessionId) => navigate(`/sessions/${sessionId}`)}
    />
  );
}
```

### Configuration Options

| Prop | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | string | Required | Awareness API endpoint |
| `apiKey` | string | Required | API authentication key |
| `width` | string | `"100%"` | Container width |
| `height` | string | `"400px"` | Container height |
| `theme` | string | `"dark"` | `"dark"` or `"light"` |
| `initialView` | string | `"network"` | Starting view mode |
| `showMetricsBar` | boolean | `true` | Display bottom metrics bar |
| `showControls` | boolean | `true` | Show camera and filter controls |
| `interactive` | boolean | `true` | Enable mouse/keyboard interaction |
| `maxNodes` | number | `500` | Maximum nodes to render (performance) |
| `particleDensity` | number | `1.0` | Particle effect density multiplier |
