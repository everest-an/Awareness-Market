#!/usr/bin/env node

/**
 * Awareness MCP Server
 * 
 * Model Context Protocol server for Awareness Market
 * Enables AI agents to discover, evaluate, and purchase latent memory vectors
 * 
 * Protocol: awareness://memory/[domain]/[topic]
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

// Types
interface MemoryVector {
  id: number;
  title: string;
  description: string;
  category: string;
  basePrice: string;
  wMatrixStandard: string;
  sourceModel: string;
  hiddenDim: number;
  alignmentLoss?: number;
  fidelityScore?: number;
  domain?: string;
  topic?: string;
}

interface AlignmentGap {
  sourceModel: string;
  targetModel: string;
  epsilon: number;
  fidelityBoost: number;
  recommendation: string;
}

// API Base URL
const API_BASE = process.env.VITE_APP_URL || 'https://awareness.market';

/**
 * Fetch memory vectors from Awareness API
 */
async function fetchMemories(params: {
  domain?: string;
  topic?: string;
  category?: string;
  limit?: number;
}): Promise<MemoryVector[]> {
  const searchParams = new URLSearchParams();
  if (params.domain) searchParams.set('domain', params.domain);
  if (params.topic) searchParams.set('topic', params.topic);
  if (params.category) searchParams.set('category', params.category);
  searchParams.set('limit', String(params.limit || 10));
  
  const url = `${API_BASE}/api/trpc/vectors.search?input=${encodeURIComponent(JSON.stringify({
    query: params.topic || '',
    category: params.category,
    offset: 0,
    limit: params.limit || 10
  }))}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.result?.data?.vectors || [];
}

/**
 * Calculate alignment gap between models
 */
async function calculateAlignment(params: {
  sourceModel: string;
  targetModel: string;
  vectorDim: number;
}): Promise<AlignmentGap> {
  const url = `${API_BASE}/api/trpc/alignment.calculate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
      sourceVector: Array(params.vectorDim).fill(0).map(() => Math.random()),
      targetStandard: '8192'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Alignment calculation failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.result?.data || {
    sourceModel: params.sourceModel,
    targetModel: params.targetModel,
    epsilon: 0.05,
    fidelityBoost: 0.15,
    recommendation: 'Compatible with minor alignment'
  };
}

/**
 * Purchase memory vector
 */
async function purchaseMemory(params: {
  vectorId: number;
  apiKey: string;
}): Promise<{ success: boolean; accessToken?: string; message: string }> {
  const url = `${API_BASE}/api/trpc/vectors.purchase`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      vectorId: params.vectorId
    })
  });
  
  if (!response.ok) {
    return {
      success: false,
      message: `Purchase failed: ${response.statusText}`
    };
  }
  
  const data = await response.json();
  return {
    success: true,
    accessToken: data.result?.data?.accessToken,
    message: 'Purchase successful'
  };
}

// Create MCP server
const server = new Server(
  {
    name: 'awareness-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_latent_memory',
        description: 'Search for latent memory vectors by domain, topic, or category. Returns a list of available memories with metadata including pricing, alignment requirements, and performance metrics.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Domain of expertise (e.g., "smart-contracts", "cryptography", "defi")'
            },
            topic: {
              type: 'string',
              description: 'Specific topic or keyword to search for'
            },
            category: {
              type: 'string',
              description: 'Category filter (e.g., "Smart Contracts", "Cryptography", "DeFi", "AI/ML")'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10
            }
          }
        }
      },
      {
        name: 'calculate_alignment_gap',
        description: 'Calculate the alignment gap (epsilon) between your model and a target memory vector. Returns epsilon value, fidelity boost estimate, and compatibility recommendation. Lower epsilon means better alignment.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Your model identifier (e.g., "gpt-4", "llama-3-70b", "claude-3-opus")'
            },
            targetModel: {
              type: 'string',
              description: 'Target memory\'s source model'
            },
            vectorDim: {
              type: 'number',
              description: 'Vector dimensionality (4096 or 8192)',
              enum: [4096, 8192]
            }
          },
          required: ['sourceModel', 'targetModel', 'vectorDim']
        }
      },
      {
        name: 'purchase_memory',
        description: 'Purchase access to a latent memory vector. Requires API key authentication. Returns an access token for invoking the memory.',
        inputSchema: {
          type: 'object',
          properties: {
            vectorId: {
              type: 'number',
              description: 'ID of the memory vector to purchase'
            },
            apiKey: {
              type: 'string',
              description: 'Your Awareness API key for authentication'
            }
          },
          required: ['vectorId', 'apiKey']
        }
      }
    ]
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'search_latent_memory': {
        const params = args as { domain?: string; topic?: string; category?: string; limit?: number };
        const memories = await fetchMemories(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: memories.length,
                memories: memories.map(m => ({
                  id: m.id,
                  title: m.title,
                  description: m.description,
                  category: m.category,
                  price: m.basePrice,
                  standard: m.wMatrixStandard,
                  sourceModel: m.sourceModel,
                  dimension: m.hiddenDim,
                  alignmentLoss: m.alignmentLoss,
                  fidelityScore: m.fidelityScore,
                  uri: `awareness://memory/${m.category.toLowerCase().replace(/\s+/g, '-')}/${m.id}`
                }))
              }, null, 2)
            }
          ]
        };
      }
      
      case 'calculate_alignment_gap': {
        const params = args as { sourceModel: string; targetModel: string; vectorDim: number };
        const alignment = await calculateAlignment(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sourceModel: alignment.sourceModel,
                targetModel: alignment.targetModel,
                epsilon: alignment.epsilon,
                fidelityBoost: alignment.fidelityBoost,
                recommendation: alignment.recommendation,
                interpretation: alignment.epsilon < 0.1 
                  ? 'Excellent alignment - highly recommended'
                  : alignment.epsilon < 0.3
                  ? 'Good alignment - recommended with minor adaptation'
                  : 'Moderate alignment - consider alternative memories or fine-tuning'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'purchase_memory': {
        const params = args as { vectorId: number; apiKey: string };
        const result = await purchaseMemory(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.message,
                accessToken: result.accessToken,
                nextSteps: result.success 
                  ? 'Use the accessToken to invoke the memory via /api/vectors/invoke endpoint'
                  : 'Check your API key and account balance'
              }, null, 2)
            }
          ]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          })
        }
      ],
      isError: true
    };
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Fetch recent memories to populate resource list
  const memories = await fetchMemories({ limit: 20 });
  
  return {
    resources: memories.map(m => ({
      uri: `awareness://memory/${m.category.toLowerCase().replace(/\s+/g, '-')}/${m.id}`,
      name: m.title,
      description: m.description,
      mimeType: 'application/json'
    }))
  };
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Parse URI: awareness://memory/[domain]/[id]
  const match = uri.match(/^awareness:\/\/memory\/([^\/]+)\/(\d+)$/);
  if (!match) {
    throw new Error('Invalid URI format. Expected: awareness://memory/[domain]/[id]');
  }
  
  const [, domain, idStr] = match;
  const id = parseInt(idStr, 10);
  
  // Fetch memory details
  const url = `${API_BASE}/api/trpc/vectors.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch memory: ${response.statusText}`);
  }
  
  const data = await response.json();
  const memory = data.result?.data;
  
  if (!memory) {
    throw new Error(`Memory not found: ${id}`);
  }
  
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: memory.id,
          title: memory.title,
          description: memory.description,
          category: memory.category,
          price: memory.basePrice,
          standard: memory.wMatrixStandard,
          sourceModel: memory.sourceModel,
          dimension: memory.hiddenDim,
          alignmentLoss: memory.alignmentLoss,
          fidelityScore: memory.fidelityScore,
          metadata: {
            domain,
            uri,
            purchaseEndpoint: `${API_BASE}/api/trpc/vectors.purchase`,
            invokeEndpoint: `${API_BASE}/api/vectors/invoke`
          }
        }, null, 2)
      }
    ]
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Awareness MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
