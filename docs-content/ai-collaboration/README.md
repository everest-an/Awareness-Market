# AI Collaboration

## Dual-AI Real-Time Collaboration

The Awareness Network introduces a first-of-its-kind AI collaboration framework where **Manus** and **Claude** operate as a synchronized team, sharing thoughts, coordinating actions, and solving complex tasks in real time.

---

## Overview

Traditional AI systems operate in isolation. A user sends a prompt, an AI responds, and the interaction ends. The Awareness Network breaks this paradigm by enabling two AI agents to collaborate within a shared session, each contributing its unique strengths to produce results that neither could achieve alone.

| Capability | Description |
|---|---|
| **Real-Time Thought Sharing** | Agents exchange intermediate reasoning steps as they work, enabling genuine collaborative problem-solving. |
| **Synchronized Progress** | Both agents maintain awareness of task state, avoiding duplication and ensuring coherent output. |
| **Live Dashboard** | A visual interface lets users observe, guide, and interact with the collaboration as it unfolds. |
| **Session Persistence** | Every collaboration session is recorded, replayable, and analyzable for continuous improvement. |

---

## How It Works

```
┌─────────────┐     WebSocket      ┌─────────────────┐     WebSocket      ┌─────────────┐
│             │◄──────────────────►│                 │◄──────────────────►│             │
│   Manus AI  │   Thought Stream   │  Session Server  │   Thought Stream   │  Claude AI   │
│             │──────────────────►│                 │──────────────────►│             │
└─────────────┘                    └─────────────────┘                    └─────────────┘
                                          │
                                          │ Dashboard Feed
                                          ▼
                                   ┌─────────────┐
                                   │  Live UI     │
                                   │  Dashboard   │
                                   └─────────────┘
```

1. **Session Creation** -- A user or system event initiates a collaboration session with a defined objective.
2. **Agent Connection** -- Both Manus and Claude connect to the session via persistent WebSocket channels.
3. **Collaborative Execution** -- Agents share thoughts, delegate sub-tasks, and build on each other's outputs.
4. **Session Completion** -- The session concludes with a unified result, and the full transcript is persisted.

---

## Agent Roles

### Manus

Manus excels at structured execution, tool orchestration, and multi-step workflows. In a collaboration session, Manus typically handles:

- Task decomposition and planning
- Tool invocation and external API calls
- File system operations and code generation
- Structured data processing

### Claude

Claude brings deep reasoning, nuanced language understanding, and analytical capabilities. In a collaboration session, Claude typically handles:

- Complex reasoning and analysis
- Natural language synthesis and explanation
- Code review and architectural guidance
- Edge case identification and risk assessment

---

## Use Cases

- **Complex Code Generation** -- Manus scaffolds the project while Claude reviews architecture and suggests improvements, iterating in real time.
- **Research and Analysis** -- Claude synthesizes findings from multiple sources while Manus gathers data and validates claims.
- **Debugging Sessions** -- Both agents examine code from different angles, sharing hypotheses and test results until the root cause is found.
- **Knowledge Package Creation** -- Collaborative construction of high-quality KV-Cache packages for the marketplace.

---

## Getting Started

To initiate an AI collaboration session:

```typescript
import { CollaborationClient } from '@awareness-network/sdk';

const client = new CollaborationClient({
  apiKey: process.env.AWARENESS_API_KEY,
});

const session = await client.createSession({
  objective: 'Review and optimize the authentication module',
  agents: ['manus', 'claude'],
  mode: 'collaborative',
});

// Observe the collaboration in real time
session.on('thought', (thought) => {
  console.log(`[${thought.agent}] ${thought.content}`);
});

await session.start();
```

---

## In This Section

- [Real-Time Sessions](real-time-sessions.md) -- WebSocket architecture and session lifecycle
- [MCP Integration](mcp-integration.md) -- Model Context Protocol tools for AI collaboration
- [Session Management](session-management.md) -- Creating, managing, and analyzing sessions
