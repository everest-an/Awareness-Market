# Neural Cortex Visualizer - Technical Specification

## Overview

The Neural Cortex Visualizer is a 3D visualization component that displays the LatentMAS multi-agent inference process. It visualizes how multiple AI agents collaborate, share knowledge, and transfer reasoning across model boundaries in real-time.

## Core Concepts

### Node Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    VISUALIZATION HIERARCHY                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ● Agent Nodes (Large, 8-12px)                              │
│    - Represent individual AI models (GPT-4, Claude, etc.)   │
│    - Unique color per agent                                 │
│    - Pulsing glow indicates active inference                │
│                                                             │
│  ◉ Dataset Nodes (Medium, 4-6px)                            │
│    - Represent knowledge packages being processed           │
│    - Clustered around parent Agent Node                     │
│    - Color inherited from agent with variation              │
│                                                             │
│  · Detail Nodes (Small, 1-2px)                              │
│    - Represent individual data points/tokens                │
│    - Form clouds around Dataset Nodes                       │
│    - Brightness indicates activation level                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Visualization

```
┌──────────┐    ════════════>    ┌──────────┐
│  GPT-4   │    Flow Particles   │  Claude  │
│  Agent   │    (W-Matrix)       │  Agent   │
└──────────┘    <════════════    └──────────┘
     │                                │
     │ KV-Cache                       │ Reasoning
     │ Transfer                       │ Chain
     ▼                                ▼
┌──────────┐                    ┌──────────┐
│ Dataset  │                    │ Dataset  │
│  Node    │                    │  Node    │
└──────────┘                    └──────────┘
     │                                │
     ▼                                ▼
  · · · ·                          · · · ·
  Detail                           Detail
  Nodes                            Nodes
```

## Data Structures

### AgentNode
```typescript
interface AgentNode {
  id: string;                    // Unique identifier (e.g., "gpt-4-turbo")
  name: string;                  // Display name
  model: string;                 // Model family
  position: [number, number, number];  // 3D coordinates
  color: string;                 // Hex color
  activity: number;              // 0-1, current inference activity
  status: 'idle' | 'thinking' | 'transferring' | 'receiving';
  datasets: DatasetNode[];       // Child dataset nodes
  connections: Connection[];     // Links to other agents
}
```

### DatasetNode
```typescript
interface DatasetNode {
  id: string;                    // Package ID from LatentMAS
  name: string;                  // Package name
  type: 'vector' | 'memory' | 'chain';
  parentAgent: string;           // Parent agent ID
  position: [number, number, number];  // Relative to parent
  activation: number;            // 0-1, processing intensity
  tokenCount: number;            // Number of detail nodes
  details: DetailNode[];         // Child detail nodes
  timestamp: Date;               // Last activity time
}
```

### DetailNode
```typescript
interface DetailNode {
  id: string;
  parentDataset: string;
  position: [number, number, number];  // Relative to parent dataset
  activation: number;            // 0-1, brightness
  size: number;                  // 1-2px base
}
```

### Connection (Thought Transfer)
```typescript
interface Connection {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  type: 'w-matrix' | 'kv-cache' | 'reasoning-chain';
  strength: number;              // 0-1, line opacity
  flowDirection: 'forward' | 'backward' | 'bidirectional';
  flowParticles: FlowParticle[];
  epsilon: number;               // Information loss metric
  bandwidth: number;             // Transfer rate
}
```

### FlowParticle
```typescript
interface FlowParticle {
  position: number;              // 0-1, progress along connection
  speed: number;                 // Movement speed
  size: number;                  // Particle size
  color: string;                 // Inherited from source/target
}
```

## Visual Design

### Color Scheme

| Agent Type | Primary Color | Hex Code |
|------------|---------------|----------|
| GPT Family | Purple | #a855f7 |
| Claude Family | Magenta | #c026d3 |
| Llama Family | Orange | #f97316 |
| Gemini Family | Blue | #3b82f6 |
| Mistral Family | Cyan | #06b6d4 |
| Custom Agents | Green | #22c55e |

### Brightness Levels

| State | Brightness | Description |
|-------|------------|-------------|
| Active Inference | 100% | Currently processing |
| Transferring | 80% + pulse | Sending/receiving data |
| Idle | 30% | No current activity |
| Inactive | 8% | Very dim, background |

### Size Scale

| Node Type | Base Size | Active Size |
|-----------|-----------|-------------|
| Agent | 10px | 14px (pulsing) |
| Dataset | 5px | 7px |
| Detail | 1.5px | 2px |
| Flow Particle | 3px | 4px |

## Animation Specifications

### Agent Pulse
- Frequency: 0.5-2Hz based on activity
- Amplitude: ±20% size variation
- Glow radius: 2x node size

### Flow Particles
- Speed: 0.2-0.8 units/second
- Count: 3-10 per connection based on bandwidth
- Trail length: 5-10% of connection length

### Dataset Orbit
- Datasets slowly orbit parent agent
- Speed: 0.1 rad/second
- Radius: 15-25 units from agent center

### Detail Cloud
- Brownian motion within dataset boundary
- Speed: 0.05 units/second
- Boundary: 8-12 units from dataset center

## Interaction Design

### Mouse Interactions

| Action | Target | Result |
|--------|--------|--------|
| Hover | Agent | Show agent info tooltip |
| Hover | Dataset | Show package details |
| Hover | Connection | Show transfer metrics |
| Click | Agent | Select, zoom to agent |
| Click | Dataset | Show full package info panel |
| Click | Connection | Show transfer history |
| Drag | Canvas | Rotate view |
| Scroll | Canvas | Zoom in/out |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F | Toggle fullscreen |
| R | Reset camera position |
| Space | Pause/resume animation |
| 1-9 | Focus on agent by index |
| Esc | Deselect / exit fullscreen |

## API Integration

### Real-time Data Sources

```typescript
// Fetch active agents
GET /api/inference/agents
Response: AgentNode[]

// Fetch agent datasets
GET /api/inference/agents/:id/datasets
Response: DatasetNode[]

// Fetch active connections
GET /api/inference/connections
Response: Connection[]

// WebSocket for real-time updates
WS /api/inference/stream
Events: 
  - agent:activity
  - transfer:start
  - transfer:complete
  - dataset:activate
```

### Demo Mode Data

When not authenticated, display simulated data:
- 6-8 agent nodes
- 3-5 datasets per agent
- 50-100 detail nodes per dataset
- 10-15 active connections
- Simulated flow particles

## Performance Requirements

| Metric | Target |
|--------|--------|
| Frame Rate | 60 FPS |
| Max Nodes | 10,000 |
| Max Connections | 100 |
| Max Flow Particles | 500 |
| Initial Load | < 2 seconds |
| Memory Usage | < 200MB |

## Component Props

```typescript
interface NeuralCortexVisualizerProps {
  // Data
  agents?: AgentNode[];
  connections?: Connection[];
  
  // Display
  showLabels?: boolean;
  showConnections?: boolean;
  showFlowParticles?: boolean;
  showDetailNodes?: boolean;
  
  // Interaction
  selectedAgent?: string | null;
  onAgentSelect?: (agent: AgentNode | null) => void;
  onDatasetClick?: (dataset: DatasetNode) => void;
  onConnectionClick?: (connection: Connection) => void;
  
  // Styling
  backgroundColor?: string;
  className?: string;
  
  // Animation
  animationSpeed?: number;  // 0-2, default 1
  pauseAnimation?: boolean;
}
```

## File Structure

```
client/src/
├── components/
│   ├── NeuralCortexVisualizer.tsx    # Main 3D component
│   ├── AgentInfoPanel.tsx            # Agent detail panel
│   ├── DatasetInfoPanel.tsx          # Dataset detail panel
│   └── ConnectionTooltip.tsx         # Transfer info tooltip
├── pages/
│   └── NeuralCortex.tsx              # Page wrapper
└── hooks/
    └── useInferenceStream.ts         # WebSocket hook

server/
├── inference-api.ts                  # REST endpoints
├── inference-tracker.ts              # Activity tracking
└── inference-websocket.ts            # Real-time stream

shared/
└── inference-types.ts                # Shared type definitions
```

## Implementation Phases

### Phase 1: Core Visualization
- [ ] Agent nodes with basic rendering
- [ ] Static connections between agents
- [ ] Basic camera controls
- [ ] Demo data generation

### Phase 2: Hierarchy
- [ ] Dataset nodes clustered around agents
- [ ] Detail node clouds
- [ ] Size/brightness differentiation

### Phase 3: Animation
- [ ] Agent pulse animation
- [ ] Flow particles on connections
- [ ] Dataset orbit motion
- [ ] Detail node Brownian motion

### Phase 4: Interaction
- [ ] Hover tooltips
- [ ] Click selection
- [ ] Info panels
- [ ] Keyboard shortcuts

### Phase 5: Real-time Data
- [ ] API integration
- [ ] WebSocket streaming
- [ ] Live activity updates
- [ ] Performance optimization

## Dependencies

- three.js: 3D rendering
- @react-three/fiber: React integration (optional)
- OrbitControls: Camera manipulation
- WebSocket: Real-time updates

## Testing

- Unit tests for data transformations
- Visual regression tests for rendering
- Performance benchmarks
- Accessibility audit (keyboard navigation)
