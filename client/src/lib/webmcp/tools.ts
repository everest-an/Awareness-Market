/**
 * WebMCP Tools for Awareness Market
 *
 * Defines MCP tools that AI agents can use to interact with Awareness Market
 */

import { MCPAuthManager } from './auth';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any, apiBaseUrl: string, mcpToken: string) => Promise<any>;
}

const authManager = new MCPAuthManager('');

/**
 * Tool 1: search_vectors
 * Search for latent vectors in Awareness Market
 */
const searchVectorsTool: MCPTool = {
  name: 'search_vectors',
  description: `Search for latent vectors in Awareness Market.

Use this tool to find vectors by:
- Natural language query (e.g., "vision transformers for image classification")
- Category (e.g., "computer_vision", "nlp", "audio")
- Minimum rating (0-5 stars)
- Pricing model ("fixed", "pay-per-call", "subscription")

Returns a list of matching vectors with:
- Title, description, category
- Performance metrics (accuracy, latency, etc.)
- Pricing information
- Creator details and ratings`,

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "find vision transformer vectors")',
      },
      category: {
        type: 'string',
        description: 'Filter by category',
        enum: [
          'computer_vision',
          'nlp',
          'audio',
          'video',
          'multimodal',
          'reasoning',
          'code_generation',
          'other',
        ],
      },
      minRating: {
        type: 'number',
        description: 'Minimum average rating (0-5)',
        minimum: 0,
        maximum: 5,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
        maximum: 100,
      },
    },
  },

  handler: async (args, apiBaseUrl, mcpToken) => {
    const response = await fetch(`${apiBaseUrl}/api/mcp/discover`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search vectors: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter results based on args
    let vectors = data.vectors || [];

    if (args.category) {
      vectors = vectors.filter((v: any) => v.category === args.category);
    }

    if (args.minRating) {
      vectors = vectors.filter(
        (v: any) => v.metadata.average_rating >= args.minRating
      );
    }

    if (args.limit) {
      vectors = vectors.slice(0, args.limit);
    }

    return {
      total: vectors.length,
      vectors: vectors.map((v: any) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        category: v.category,
        rating: v.metadata.average_rating,
        total_calls: v.metadata.total_calls,
        pricing: v.pricing,
        performance: v.performance,
      })),
    };
  },
};

/**
 * Tool 2: retrieve_memories_rmc
 * Use RMC hybrid retrieval to find related memories with reasoning paths
 */
const retrieveMemoriesRMCTool: MCPTool = {
  name: 'retrieve_memories_rmc',
  description: `Use RMC (Relational Memory Core) to retrieve memories with reasoning paths.

This tool uses a 3-layer hybrid retrieval system:
1. Vector Search - Find semantically similar memories
2. Graph Expansion - Traverse relationship graph (BFS)
3. Inference Paths - Discover reasoning chains (DFS)

Supported inference path types:
- Causal chains (A causes B causes C)
- Contradiction resolution (A contradicts B, B resolves to C)
- Multi-hop support (A supports B, B supports C)
- Temporal sequences (A before B before C)

Returns:
- Direct matches (vector search results)
- Related context (graph-expanded memories)
- Inference paths with relationship types and strengths`,

  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query text (e.g., "SpaceX Starship development progress")',
      },
      maxDepth: {
        type: 'number',
        description: 'Graph traversal depth (default: 2)',
        default: 2,
        minimum: 1,
        maximum: 5,
      },
      includeInferencePaths: {
        type: 'boolean',
        description: 'Include reasoning paths (default: true)',
        default: true,
      },
      relationTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'CAUSES',
            'CONTRADICTS',
            'SUPPORTS',
            'IMPACTS',
            'TEMPORAL_BEFORE',
            'TEMPORAL_AFTER',
            'DERIVED_FROM',
            'SIMILAR_TO',
            'PART_OF',
          ],
        },
        description: 'Filter by relationship types',
      },
    },
    required: ['query'],
  },

  handler: async (args, apiBaseUrl, mcpToken) => {
    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.hybridRetrieve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: args,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve memories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result?.data?.json || data;
  },
};

/**
 * Tool 3: create_memory
 * Create a new memory entry in the shared memory graph
 */
const createMemoryTool: MCPTool = {
  name: 'create_memory',
  description: `Create a new memory entry in the shared memory graph.

Created memories are:
- Automatically embedded using vector embeddings
- Processed asynchronously for entity extraction and relation building
- Available for RMC hybrid retrieval
- Shared across AI agents (if in shared namespace)

Priority levels:
- "critical": Processed immediately (for time-sensitive info)
- "high": Processed within 1 second
- "normal": Processed within 5 seconds (default)
- "low": Processed within 30 seconds

⚠️ This is a write operation and may require user confirmation.`,

  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Memory content (text)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace (e.g., "shared", "agent_123", "user_456")',
        default: 'shared',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'critical'],
        description: 'Processing priority',
        default: 'normal',
      },
      claim_key: {
        type: 'string',
        description: 'Optional claim key for conflict resolution',
      },
      claim_value: {
        type: 'string',
        description: 'Optional claim value',
      },
    },
    required: ['content'],
  },

  handler: async (args, apiBaseUrl, mcpToken) => {
    // Request user confirmation for write operation
    const confirmed = await authManager.requestUserConfirmation(
      `Allow AI to create memory:\n\n"${args.content.substring(0, 200)}${args.content.length > 200 ? '...' : ''}"\n\nNamespace: ${args.namespace || 'shared'}`
    );

    if (!confirmed) {
      throw new Error('User denied permission to create memory');
    }

    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          org_id: 'default',
          namespace: args.namespace || 'shared',
          content: args.content,
          content_type: 'text/plain',
          confidence: 0.9,
          created_by: 'webmcp_ai_agent',
          priority: args.priority || 'normal',
          claim_key: args.claim_key,
          claim_value: args.claim_value,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create memory: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result?.data?.json || data;
  },
};

/**
 * Tool 4: get_memory_graph
 * Get the relationship graph for a specific memory
 */
const getMemoryGraphTool: MCPTool = {
  name: 'get_memory_graph',
  description: `Get the relationship graph for a specific memory.

Returns:
- Central memory node
- Related memories (connected via relationships)
- Relationship types and strengths
- Entities mentioned in each memory

Useful for:
- Understanding context around a memory
- Exploring knowledge graphs
- Finding related information
- Analyzing reasoning paths`,

  inputSchema: {
    type: 'object',
    properties: {
      memoryId: {
        type: 'string',
        description: 'Memory ID',
      },
      maxDepth: {
        type: 'number',
        description: 'Graph traversal depth (default: 2)',
        default: 2,
        minimum: 1,
        maximum: 5,
      },
    },
    required: ['memoryId'],
  },

  handler: async (args, apiBaseUrl, mcpToken) => {
    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.getMemoryGraph`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: args,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get memory graph: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result?.data?.json || data;
  },
};

/**
 * Tool 5: multi_agent_sync
 * Coordinate multiple AI agents with shared context and consensus building
 */
const multiAgentSyncTool: MCPTool = {
  name: 'multi_agent_sync',
  description: `Coordinate multiple AI agents for collaborative decision-making.

Process:
1. Each agent provides its independent analysis
2. System merges shared context
3. LLM generates consensus summary
4. Returns merged context and action items

Use cases:
- Multi-perspective analysis (financial, technical, ethical)
- Risk assessment from different angles
- Collaborative problem-solving
- Consensus-based decision making

The results can be stored in AI memory for future reference.`,

  inputSchema: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        description: 'Array of agent inputs',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
          },
        },
      },
      shared_context: {
        type: 'object',
        description: 'Context shared across all agents',
      },
      memory_key: {
        type: 'string',
        description: 'Key to store results in AI memory',
      },
      memory_ttl_days: {
        type: 'number',
        description: 'Memory retention period (days)',
        default: 90,
      },
    },
    required: ['agents'],
  },

  handler: async (args, apiBaseUrl, mcpToken) => {
    const response = await fetch(`${apiBaseUrl}/api/mcp/sync`, {
      method: 'POST',
      headers: {
        'X-MCP-Token': mcpToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync agents: ${response.statusText}`);
    }

    return await response.json();
  },
};

/**
 * Export all tools
 */
export const webMCPTools: MCPTool[] = [
  searchVectorsTool,
  retrieveMemoriesRMCTool,
  createMemoryTool,
  getMemoryGraphTool,
  multiAgentSyncTool,
];
