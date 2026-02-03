#!/usr/bin/env node

/**
 * Awareness MCP Collaboration Server
 *
 * Enables multiple AI agents to collaborate in real-time:
 * - Share reasoning processes
 * - Sync context and decisions
 * - Coordinate frontend/backend development
 *
 * Usage:
 *   node dist/index-collaboration.js
 *
 * Environment Variables:
 *   - VITE_APP_URL: Awareness Market API URL
 *   - MCP_COLLABORATION_TOKEN: Shared token for collaboration
 *   - AGENT_ROLE: 'frontend' or 'backend'
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

// Configuration
const API_BASE = process.env.VITE_APP_URL || 'http://localhost:3000';
const MCP_TOKEN = process.env.MCP_COLLABORATION_TOKEN || '';
const AGENT_ROLE = process.env.AGENT_ROLE || 'unknown';
const PROJECT_ID = process.env.PROJECT_ID || '';
const PROJECT_NAME = process.env.PROJECT_NAME || 'Unknown Project';
const MEMORY_KEY = process.env.MEMORY_KEY || 'project:default:dev';

if (!MCP_TOKEN) {
  console.error('Error: MCP_COLLABORATION_TOKEN not set');
  process.exit(1);
}

// Tool Definitions
const COLLABORATION_TOOLS = [
  {
    name: 'share_reasoning',
    description: 'Share your reasoning process with the other AI agent. Use this frequently to keep the other agent informed of your thoughts, decisions, and progress.',
    inputSchema: {
      type: 'object',
      properties: {
        currentTask: {
          type: 'string',
          description: 'What you are currently working on (e.g., "Creating UserProfile component", "Implementing user API endpoints")'
        },
        reasoning: {
          type: 'string',
          description: 'Your detailed thought process and reasoning. Include: what you\'re doing, why you\'re doing it, what you\'ve considered, and any concerns.'
        },
        decision: {
          type: 'string',
          description: 'Any decision you\'ve made (optional). Be specific about what you decided.'
        },
        needsInput: {
          type: 'boolean',
          description: 'Set to true if you need input or feedback from the other agent'
        },
        question: {
          type: 'string',
          description: 'Specific question for the other agent (if needsInput is true)'
        },
        filesModified: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files you created or modified (optional)'
        }
      },
      required: ['currentTask', 'reasoning']
    }
  },
  {
    name: 'get_other_agent_context',
    description: 'Get the current context and latest reasoning from the other AI agent. Use this before starting a task to understand what the other agent is working on.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent updates to retrieve',
          default: 5
        }
      }
    }
  },
  {
    name: 'propose_shared_decision',
    description: 'Propose a decision that affects both frontend and backend. The other agent should acknowledge or provide feedback on this proposal.',
    inputSchema: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          description: 'The decision being proposed (e.g., "Use separate endpoint for avatar upload")'
        },
        reasoning: {
          type: 'string',
          description: 'Why this decision makes sense'
        },
        impact: {
          type: 'object',
          properties: {
            frontend: {
              type: 'string',
              description: 'How this affects frontend development'
            },
            backend: {
              type: 'string',
              description: 'How this affects backend development'
            }
          },
          required: ['frontend', 'backend']
        },
        alternatives: {
          type: 'string',
          description: 'Other options considered (optional)'
        }
      },
      required: ['decision', 'reasoning', 'impact']
    }
  },
  {
    name: 'get_collaboration_history',
    description: 'Get the full collaboration history and reasoning chain. Useful for reviewing past decisions or catching up after a break.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent steps to retrieve',
          default: 20
        },
        filterBy: {
          type: 'string',
          enum: ['all', 'decisions', 'questions', 'frontend', 'backend'],
          description: 'Filter history by type',
          default: 'all'
        }
      }
    }
  },
  {
    name: 'sync_progress',
    description: 'Sync your current progress, files modified, and next steps. Use this after completing a significant chunk of work.',
    inputSchema: {
      type: 'object',
      properties: {
        completed: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tasks or features you completed'
        },
        filesModified: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files you created or modified'
        },
        nextSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'What you plan to work on next'
        },
        blockers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Any blockers or issues you encountered (optional)'
        },
        needsFromOtherAgent: {
          type: 'string',
          description: 'What you need from the other agent to proceed (optional)'
        }
      },
      required: ['completed', 'filesModified', 'nextSteps']
    }
  },
  {
    name: 'ask_question',
    description: 'Ask a specific question to the other agent and wait for their response. Use this when you need clarification or input.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Your question for the other agent'
        },
        context: {
          type: 'string',
          description: 'Context for the question (why you\'re asking, what you need it for)'
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How urgently you need an answer',
          default: 'medium'
        }
      },
      required: ['question', 'context']
    }
  }
];

// API Functions
async function callMCPApi(endpoint: string, payload: any): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Token': MCP_TOKEN
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('MCP API call failed:', error);
    throw error;
  }
}

async function shareReasoning(params: any): Promise<any> {
  const timestamp = new Date().toISOString();

  const payload = {
    memory_key: MEMORY_KEY,
    memory_ttl_days: 7,
    shared_context: {
      agentRole: AGENT_ROLE,
      task: params.currentTask,
      timestamp,
      filesModified: params.filesModified || []
    },
    agents: [{
      id: AGENT_ROLE === 'frontend' ? 'manus' : 'claude',
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          type: 'reasoning',
          currentTask: params.currentTask,
          reasoning: params.reasoning,
          decision: params.decision,
          needsInput: params.needsInput,
          question: params.question,
          timestamp
        })
      }]
    }]
  };

  const result = await callMCPApi('/api/mcp/sync', payload);

  return {
    status: 'shared',
    timestamp,
    message: 'Your reasoning has been shared with the other agent',
    consensus: result.consensus,
    nextSteps: result.action_items || []
  };
}

async function getOtherAgentContext(params: any): Promise<any> {
  const otherRole = AGENT_ROLE === 'frontend' ? 'backend' : 'frontend';
  const otherAgentId = otherRole === 'frontend' ? 'manus' : 'claude';

  const payload = {
    memory_key: MEMORY_KEY,
    agents: [{
      id: otherAgentId,
      messages: [{
        role: 'user',
        content: 'Get current context and latest updates'
      }]
    }]
  };

  const result = await callMCPApi('/api/mcp/sync', payload);

  return {
    otherAgent: {
      role: otherRole,
      id: otherAgentId,
      latestContext: result.merged_context || {},
      recentUpdates: result.consensus || 'No recent updates'
    },
    message: `Retrieved context from ${otherAgentId} (${otherRole})`
  };
}

async function proposeSharedDecision(params: any): Promise<any> {
  const timestamp = new Date().toISOString();

  const payload = {
    memory_key: MEMORY_KEY,
    shared_context: {
      type: 'decision_proposal',
      agentRole: AGENT_ROLE,
      timestamp
    },
    agents: [{
      id: AGENT_ROLE === 'frontend' ? 'manus' : 'claude',
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          type: 'decision_proposal',
          decision: params.decision,
          reasoning: params.reasoning,
          impact: params.impact,
          alternatives: params.alternatives,
          timestamp,
          proposedBy: AGENT_ROLE
        })
      }]
    }]
  };

  await callMCPApi('/api/mcp/sync', payload);

  return {
    status: 'proposed',
    decision: params.decision,
    timestamp,
    message: 'Decision proposal shared. Waiting for other agent to acknowledge.',
    impact: params.impact
  };
}

async function getCollaborationHistory(params: any): Promise<any> {
  // For now, return mock data structure
  // In production, this would fetch from reasoning chain storage
  return {
    history: [
      {
        timestamp: new Date().toISOString(),
        agentRole: AGENT_ROLE,
        type: 'info',
        message: 'Collaboration history will be available once MCP sync API is fully integrated'
      }
    ],
    filter: params.filterBy || 'all',
    limit: params.limit || 20
  };
}

async function syncProgress(params: any): Promise<any> {
  const timestamp = new Date().toISOString();

  const payload = {
    memory_key: MEMORY_KEY,
    shared_context: {
      type: 'progress_sync',
      agentRole: AGENT_ROLE,
      timestamp,
      completed: params.completed,
      filesModified: params.filesModified,
      nextSteps: params.nextSteps,
      blockers: params.blockers || [],
      needsFromOtherAgent: params.needsFromOtherAgent
    },
    agents: [{
      id: AGENT_ROLE === 'frontend' ? 'manus' : 'claude',
      messages: [{
        role: 'assistant',
        content: JSON.stringify({
          type: 'progress_update',
          completed: params.completed,
          filesModified: params.filesModified,
          nextSteps: params.nextSteps,
          blockers: params.blockers,
          timestamp
        })
      }]
    }]
  };

  await callMCPApi('/api/mcp/sync', payload);

  return {
    status: 'synced',
    timestamp,
    message: 'Progress synced with other agent',
    summary: {
      completed: params.completed.length,
      filesModified: params.filesModified.length,
      nextSteps: params.nextSteps.length,
      blockers: params.blockers?.length || 0
    }
  };
}

async function askQuestion(params: any): Promise<any> {
  const timestamp = new Date().toISOString();

  const payload = {
    memory_key: MEMORY_KEY,
    shared_context: {
      type: 'question',
      agentRole: AGENT_ROLE,
      timestamp,
      urgency: params.urgency || 'medium'
    },
    agents: [{
      id: AGENT_ROLE === 'frontend' ? 'manus' : 'claude',
      messages: [{
        role: 'user',
        content: JSON.stringify({
          type: 'question',
          question: params.question,
          context: params.context,
          urgency: params.urgency,
          askedBy: AGENT_ROLE,
          timestamp
        })
      }]
    }]
  };

  await callMCPApi('/api/mcp/sync', payload);

  return {
    status: 'asked',
    question: params.question,
    timestamp,
    urgency: params.urgency,
    message: 'Question sent to other agent. They will respond in their next update.'
  };
}

// Create MCP Server
const server = new Server(
  {
    name: 'awareness-collaboration',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: COLLABORATION_TOOLS
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case 'share_reasoning':
        result = await shareReasoning(args);
        break;

      case 'get_other_agent_context':
        result = await getOtherAgentContext(args);
        break;

      case 'propose_shared_decision':
        result = await proposeSharedDecision(args);
        break;

      case 'get_collaboration_history':
        result = await getCollaborationHistory(args);
        break;

      case 'sync_progress':
        result = await syncProgress(args);
        break;

      case 'ask_question':
        result = await askQuestion(args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          tool: name,
          message: 'Tool execution failed. Check your MCP token and API connection.'
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const projectInfo = PROJECT_ID ? `Project: ${PROJECT_NAME} (${PROJECT_ID})` : 'No project configured';

  console.error(`
╔═══════════════════════════════════════════════════════════╗
║   Awareness MCP Collaboration Server                      ║
║   ${projectInfo.padEnd(57)}║
║   Agent Role: ${AGENT_ROLE.padEnd(43)}║
║   Memory Key: ${MEMORY_KEY.padEnd(43)}║
║   API: ${API_BASE.padEnd(50)}║
╚═══════════════════════════════════════════════════════════╝

Server is running. Use MCP tools to collaborate with other agents.
Collaboration space: ${MEMORY_KEY}
  `);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
