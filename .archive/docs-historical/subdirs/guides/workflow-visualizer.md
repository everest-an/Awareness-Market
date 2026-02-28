# Workflow Visualizer - Real-time AI Reasoning & Memory Transfer Visualization

## Overview

The **Workflow Visualizer** is a powerful real-time visualization tool that displays AI reasoning processes, memory transfers, and package processing workflows as they happen. It provides developers and users with deep insights into how AI agents think, how memory is transferred between models, and how packages are processed.

## Features

### 1. Real-time Event Timeline
- **Horizontal timeline** showing events in chronological order
- **Duration visualization** - see how long each step takes
- **Color-coded events** - different colors for different event types:
  - 🔵 **Prompt** (Blue) - LLM prompts and reasoning steps
  - 🟣 **Tool Call** (Purple) - External tool invocations
  - 🟢 **Response** (Green) - LLM responses and results
  - ⚪ **User Input** (Gray) - User questions and inputs

### 2. Detailed Event Inspection
Click any event to view:
- **Overview** - Event summary, status, duration
- **Input** - Complete input data (JSON formatted)
- **Output** - Complete output data (JSON formatted)
- **Metadata** - Event ID, workflow ID, timestamp, model info, token count

### 3. Advanced Filtering
- **Search** - Find specific events by name or content
- **Filter by type** - Show only Prompt, Response, Tool Call, or User Input events
- **Filter by status** - Show only pending, completed, or failed events

### 4. Export for Debugging
- **Export to JSON** - Download complete workflow data for offline analysis
- **Copy to clipboard** - Quickly share event details

### 5. Live Connection Status
- **Real-time indicator** - Shows when connected to live workflow stream
- **WebSocket connection** - Automatic reconnection on disconnect

## Demo Scenarios

The Workflow Visualizer includes three pre-built demo scenarios:

### 1. AI Reasoning Chain
Watch an AI agent solve a complex problem step-by-step:
1. User asks a question
2. AI analyzes the question (Prompt)
3. AI searches for best practices (Tool Call)
4. AI generates recommendations (Response)

### 2. Memory Transfer
See KV-Cache and W-Matrix transformation in action:
1. Load source model KV-Cache
2. Apply W-Matrix transformation
3. Validate transformed cache
4. Transfer to target model

### 3. Package Processing
Track the upload and validation of a Vector Package:
1. Upload package file
2. Validate package structure
3. Extract vector embeddings
4. Store in database

## Integration Points

The Workflow Visualizer can be integrated into any workflow that involves:

### AI Agent Reasoning
```typescript
import { WorkflowManager } from '@/server/workflow-manager';

const workflowId = WorkflowManager.createSession({
  name: 'AI Agent Reasoning',
  type: 'ai_reasoning',
  metadata: { userId: user.id }
});

// Track LLM prompt
WorkflowManager.addEvent(workflowId, {
  type: 'prompt',
  name: 'Analyze Question',
  input: { messages: [...] },
  metadata: { model: 'gpt-4', tokens: 150 }
});

// ... do LLM call ...

// Track LLM response
WorkflowManager.updateEvent(workflowId, eventId, {
  status: 'completed',
  output: { response: '...', reasoning: '...' },
  endTime: Date.now()
});
```

### Memory Transfer
```typescript
const workflowId = WorkflowManager.createSession({
  name: 'Memory Transfer',
  type: 'memory_transfer',
  metadata: { sourceModel: 'llama-3', targetModel: 'gpt-4' }
});

// Track KV-Cache loading
WorkflowManager.addEvent(workflowId, {
  type: 'tool_call',
  name: 'Load KV-Cache',
  input: { cacheId: '...' }
});

// Track W-Matrix transformation
WorkflowManager.addEvent(workflowId, {
  type: 'prompt',
  name: 'Apply W-Matrix',
  input: { matrixId: '...', dimensions: [768, 1024] }
});
```

### Package Processing
```typescript
const workflowId = WorkflowManager.createSession({
  name: 'Package Processing',
  type: 'package_processing',
  metadata: { packageType: 'vector', userId: user.id }
});

// Track upload
WorkflowManager.addEvent(workflowId, {
  type: 'user_input',
  name: 'Upload Package',
  input: { filename: 'vectors.zip', size: 1024000 }
});

// Track validation
WorkflowManager.addEvent(workflowId, {
  type: 'tool_call',
  name: 'Validate Package',
  input: { schema: '...' }
});
```

## Technical Architecture

### Frontend Components

```
WorkflowVisualizer/
├── WorkflowVisualizer.tsx    # Main component with Socket.IO connection
├── EventTimeline.tsx          # Horizontal timeline visualization
├── EventDetailsPanel.tsx      # Tabbed panel for event details
└── FilterControls.tsx         # Search and filter UI
```

### Backend Services

```
server/
├── workflow-manager.ts        # Session and event management
├── workflow-websocket.ts      # Socket.IO server for real-time streaming
└── routers/workflow.ts        # tRPC API for demo scenarios
```

### Data Flow

1. **Backend** creates workflow session via `WorkflowManager.createSession()`
2. **Backend** adds events via `WorkflowManager.addEvent()`
3. **WorkflowWebSocket** broadcasts events to subscribed clients
4. **Frontend** receives events via Socket.IO and updates UI in real-time

### WebSocket Protocol

**Client → Server:**
```typescript
socket.emit('subscribe', workflowId);  // Subscribe to workflow
socket.emit('unsubscribe', workflowId); // Unsubscribe from workflow
```

**Server → Client:**
```typescript
socket.emit('message', {
  type: 'session_start',
  data: { id, name, type, status, startTime, metadata }
});

socket.emit('message', {
  type: 'event',
  data: { id, workflowId, type, name, status, startTime, endTime, input, output, metadata }
});

socket.emit('message', {
  type: 'session_end',
  data: { id, status, endTime }
});
```

## Usage Examples

### Embedding in a Page

```typescript
import { WorkflowVisualizer } from '@/components/WorkflowVisualizer';

function MyPage() {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  
  const startWorkflow = async () => {
    const result = await trpc.workflow.startDemo.mutate({
      scenario: 'ai_reasoning'
    });
    setWorkflowId(result.workflowId);
  };
  
  return (
    <div>
      <button onClick={startWorkflow}>Start Demo</button>
      
      {workflowId && (
        <WorkflowVisualizer
          workflowId={workflowId}
          onClose={() => setWorkflowId(null)}
        />
      )}
    </div>
  );
}
```

### Programmatic Event Tracking

```typescript
import { WorkflowManager } from '@/server/workflow-manager';

// Create session
const workflowId = WorkflowManager.createSession({
  name: 'Custom Workflow',
  type: 'custom',
  metadata: { customField: 'value' }
});

// Add event
const eventId = WorkflowManager.addEvent(workflowId, {
  type: 'prompt',
  name: 'Step 1',
  input: { data: '...' },
  metadata: { step: 1 }
});

// Update event when complete
WorkflowManager.updateEvent(workflowId, eventId, {
  status: 'completed',
  output: { result: '...' },
  endTime: Date.now()
});

// End session
WorkflowManager.endSession(workflowId);
```

## Styling and Customization

### Event Colors

Event types are color-coded in `EventTimeline.tsx`:

```typescript
const eventColors = {
  prompt: 'bg-blue-500',
  response: 'bg-green-500',
  tool_call: 'bg-purple-500',
  user_input: 'bg-gray-500'
};
```

### Timeline Layout

The timeline uses flexbox with automatic spacing:
- Events are positioned based on their start time
- Width is proportional to duration
- Minimum width ensures readability

## Performance Considerations

1. **Event Limit** - Timeline shows up to 1000 events per session
2. **Memory Management** - Old sessions are automatically cleaned up after 1 hour
3. **WebSocket Optimization** - Only subscribed clients receive events
4. **Lazy Rendering** - Event details are only rendered when clicked

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Future Enhancements

- [ ] Zoom and pan controls for timeline
- [ ] Export to video/GIF
- [ ] Collaborative viewing (multiple users watching same workflow)
- [ ] Historical workflow replay
- [ ] Performance metrics dashboard
- [ ] Custom event types and colors
- [ ] Integration with external monitoring tools

## Troubleshooting

### Events not appearing
1. Check WebSocket connection status (should show "Live")
2. Check browser console for connection errors
3. Verify server is running and WebSocket endpoint is accessible

### Slow performance
1. Reduce number of events per session
2. Use filtering to show only relevant events
3. Close visualizer when not needed

### Export not working
1. Check browser allows downloads
2. Verify JSON data is valid
3. Try copying to clipboard instead

## API Reference

### WorkflowManager

```typescript
class WorkflowManager {
  static createSession(config: {
    name: string;
    type: string;
    metadata?: Record<string, any>;
  }): string;
  
  static addEvent(workflowId: string, event: {
    type: 'prompt' | 'response' | 'tool_call' | 'user_input';
    name: string;
    input?: any;
    output?: any;
    metadata?: Record<string, any>;
  }): string;
  
  static updateEvent(workflowId: string, eventId: string, updates: {
    status?: 'pending' | 'completed' | 'failed';
    output?: any;
    error?: string;
    endTime?: number;
  }): void;
  
  static endSession(workflowId: string): void;
  
  static getSession(workflowId: string): WorkflowSession | null;
  
  static getEvents(workflowId: string): WorkflowEvent[];
}
```

### tRPC API

```typescript
// Start demo workflow
trpc.workflow.startDemo.mutate({
  scenario: 'ai_reasoning' | 'memory_transfer' | 'package_processing'
});

// Get workflow session
trpc.workflow.getSession.query({ workflowId: string });

// Get workflow events
trpc.workflow.getEvents.query({ workflowId: string });
```

## License

This feature is part of the Awareness platform and follows the same license terms.

## Support

For issues or questions, please contact the development team or file an issue in the project repository.
