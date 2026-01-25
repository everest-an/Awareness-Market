# Golem Visualizer

3D Vector Space Visualization Tool for Awareness Market.

## Overview

Golem Visualizer is a Three.js-based 3D visualization component for displaying AI memory packages and their relationships in vector space.

## Project Structure

```
golem-visualizer/
├── backend/
│   ├── golem_backend.py       # Python backend for vector search
│   └── requirements.txt       # Python dependencies
├── docs/                      # (empty - docs in root)
├── examples/                  # (empty - see page implementation)
├── README.md                  # This file
└── INTEGRATION_GUIDE.md       # Detailed integration guide

# Main component (recommended location):
client/src/components/visualizer/
├── GolemVisualizer.tsx        # React + Three.js component
└── index.ts                   # Exports

# Page implementation:
client/src/pages/
└── GolemVisualizerPage.tsx    # Full page with controls
```

## Quick Start

### Frontend Usage

```tsx
import { GolemVisualizer } from '@/components/visualizer';

<GolemVisualizer
  data={[
    { id: 'v1', vector: [1, 2, 3], label: 'Vector 1', color: '#4a9eff' },
    { id: 'v2', vector: [4, 5, 6], label: 'Vector 2', color: '#a855f7' },
  ]}
  onPointClick={(point) => console.log(point)}
  height="600px"
  autoRotate={true}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| data | VectorData[] | required | Array of vector data points |
| onPointClick | function | - | Callback when a point is clicked |
| width | string/number | '100%' | Container width |
| height | string/number | '600px' | Container height |
| backgroundColor | string | '#0a0e27' | Scene background color |
| autoRotate | boolean | true | Enable auto-rotation |
| rotateSpeed | number | 0.5 | Auto-rotation speed |
| pointScale | number | 8 | Scale factor for point positions |

### VectorData Interface

```typescript
interface VectorData {
  id: string;
  vector: number[];  // 3D coordinates [x, y, z]
  label?: string;
  color?: string;    // Hex color code
}
```

## Backend (Optional)

The Python backend provides vector similarity search capabilities.

### Setup

```bash
cd golem-visualizer/backend
pip install -r requirements.txt
python golem_backend.py --port 5000
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/query` | POST | Vector similarity search |
| `/api/query/advanced` | POST | Search with category filter |
| `/api/node/<id>` | GET | Get node by index |
| `/api/categories` | GET | List all categories |
| `/api/statistics` | GET | Backend statistics |
| `/api/health` | GET | Health check |

### Query Example

```python
from golem_backend import GolemBackend

backend = GolemBackend(
    model_id="sentence-transformers/all-MiniLM-L6-v2",
    vector_file="vectors.npy",
    json_file="nodes.json"
)

results = backend.query("search query", top_k=10)
print(results['nodes'])
```

## Features

- Real-time 3D rendering with Three.js
- Interactive camera controls (orbit, zoom, pan)
- Point cloud visualization with custom shaders
- Click-to-select interaction
- Pulse animation on selection
- Auto-rotation
- Responsive design
- WebGL hardware acceleration

## Color Categories

| Category | Color |
|----------|-------|
| NLP | #4a9eff |
| Vision | #a855f7 |
| Audio | #10b981 |
| Multimodal | #f59e0b |
| Finance | #10b981 |
| Medical | #ec4899 |
| Code Generation | #8b5cf6 |

## Technical Stack

### Frontend
- React 18 + TypeScript
- Three.js 0.160+
- WebGL + Custom GLSL shaders

### Backend
- Python 3.8+
- Flask + Flask-CORS
- sentence-transformers
- NumPy

## Performance

- Supports 1000+ points with smooth 60 FPS rendering
- WebGL hardware acceleration
- Additive blending for visual effects
- Dynamic buffer updates for animations

## License

MIT License
