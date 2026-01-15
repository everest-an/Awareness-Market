#!/usr/bin/env node

/**
 * Enhanced Awareness MCP Server - Three Memory Types Support
 * 
 * Model Context Protocol server for Awareness Market
 * Supports three memory types:
 * 1. KV-Cache (kv_cache) - Direct memory transplant
 * 2. Reasoning Chain (reasoning_chain) - Reasoning process transfer
 * 3. Long-term Memory (long_term_memory) - Interaction memory
 * 
 * Protocol: awareness://memory/[type]/[domain]/[topic]
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
type MemoryType = 'kv_cache' | 'reasoning_chain' | 'long_term_memory';

interface MemoryPackage {
  id: string;
  packageId: string;
  name: string;
  description: string;
  memoryType: MemoryType;
  sourceModel: string;
  targetModel: string;
  
  // W-Matrix metadata
  wMatrix: {
    version: string;
    epsilon: number;
    orthogonalityScore: number;
  };
  
  // KV-Cache metadata (for kv_cache type)
  kvCache?: {
    tokenCount: number;
    compressionRatio: number;
    contextDescription: string;
  };
  
  // Reasoning Chain metadata (for reasoning_chain type)
  reasoningChain?: {
    stepCount: number;
    problemType: string;
    solutionQuality: number;
  };
  
  // Long-term Memory metadata (for long_term_memory type)
  longTermMemory?: {
    conversationCount: number;
    contextRetention: number;
    personalityProfile: string;
  };
  
  // Performance metrics
  metrics: {
    performanceGain: number; // percentage
    qualityScore: number; // 0-100
  };
  
  // Pricing
  price: number;
  currency: string;
  
  // Metadata
  createdAt: string;
  downloads: number;
  rating: number;
  status: string;
}

// API Base URL
const API_BASE = process.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * Search memory packages by type
 */
async function searchMemoriesByType(params: {
  memoryType: MemoryType;
  sourceModel?: string;
  targetModel?: string;
  minQuality?: number;
  limit?: number;
}): Promise<MemoryPackage[]> {
  const url = `${API_BASE}/api/trpc/packages.browsePackages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageType: 'memory',
      memoryType: params.memoryType,
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
      minQuality: params.minQuality || 70,
      limit: params.limit || 10,
      offset: 0,
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.result?.data?.packages || [];
}

/**
 * Get all three memory types for a model pair
 */
async function getAllMemoryTypes(params: {
  sourceModel: string;
  targetModel: string;
}): Promise<{
  kvCache: MemoryPackage[];
  reasoningChain: MemoryPackage[];
  longTermMemory: MemoryPackage[];
}> {
  const [kvCache, reasoningChain, longTermMemory] = await Promise.all([
    searchMemoriesByType({ ...params, memoryType: 'kv_cache', limit: 5 }),
    searchMemoriesByType({ ...params, memoryType: 'reasoning_chain', limit: 5 }),
    searchMemoriesByType({ ...params, memoryType: 'long_term_memory', limit: 5 }),
  ]);
  
  return {
    kvCache,
    reasoningChain,
    longTermMemory,
  };
}

/**
 * Get memory package details
 */
async function getMemoryPackageDetails(params: {
  packageId: string;
}): Promise<MemoryPackage> {
  const url = `${API_BASE}/api/trpc/packages.getPackageDetails`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageType: 'memory',
      packageId: params.packageId,
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get package details: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.result?.data?.package;
}

/**
 * Check model compatibility
 */
async function checkModelCompatibility(params: {
  sourceModel: string;
  targetModel: string;
}): Promise<{
  compatible: boolean;
  epsilon: number;
  recommendation: string;
  availableMemoryTypes: MemoryType[];
}> {
  const url = `${API_BASE}/api/trpc/wMatrixMarketplaceV2.getCompatibleModels`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceModel: params.sourceModel,
    })
  });
  
  if (!response.ok) {
    throw new Error(`Compatibility check failed: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  const compatibleModels = data.result?.data?.compatibleModels || [];
  
  const targetCompatibility = compatibleModels.find(
    (m: any) => m.targetModel === params.targetModel
  );
  
  if (targetCompatibility) {
    // Check which memory types are available
    const memories = await getAllMemoryTypes(params);
    const availableTypes: MemoryType[] = [];
    
    if (memories.kvCache.length > 0) availableTypes.push('kv_cache');
    if (memories.reasoningChain.length > 0) availableTypes.push('reasoning_chain');
    if (memories.longTermMemory.length > 0) availableTypes.push('long_term_memory');
    
    return {
      compatible: true,
      epsilon: targetCompatibility.epsilon,
      recommendation: `Compatible with epsilon ${targetCompatibility.epsilon}. Available memory types: ${availableTypes.join(', ')}`,
      availableMemoryTypes: availableTypes,
    };
  }
  
  return {
    compatible: false,
    epsilon: 1.0,
    recommendation: 'Models are not compatible. No W-Matrix available for this pair.',
    availableMemoryTypes: [],
  };
}

// Create MCP server
const server = new Server(
  {
    name: 'awareness-market-mcp',
    version: '3.0.0',
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
        name: 'search_kv_cache_memories',
        description: 'Search for KV-Cache memory packages (direct memory transplant). These packages contain compressed KV-Cache data that can be directly loaded into target models for immediate context transfer.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier',
              examples: ['gpt-4', 'claude-3-opus', 'llama-3.1-8b']
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier',
              examples: ['gpt-3.5-turbo', 'claude-3-sonnet', 'llama-3.1-70b']
            },
            minQuality: {
              type: 'number',
              description: 'Minimum quality score (0-100)',
              default: 70
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            }
          }
        }
      },
      {
        name: 'search_reasoning_chain_memories',
        description: 'Search for Reasoning Chain memory packages. These packages contain step-by-step reasoning processes that can be transferred to help models solve similar problems.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier'
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier'
            },
            problemType: {
              type: 'string',
              description: 'Type of problem (e.g., "math", "coding", "analysis")',
              examples: ['math', 'coding', 'analysis', 'creative', 'logic']
            },
            minQuality: {
              type: 'number',
              description: 'Minimum quality score (0-100)',
              default: 70
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            }
          }
        }
      },
      {
        name: 'search_long_term_memories',
        description: 'Search for Long-term Memory packages (interaction memory). These packages contain persistent conversation context and user preferences for multi-session interactions.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier'
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier'
            },
            minQuality: {
              type: 'number',
              description: 'Minimum quality score (0-100)',
              default: 70
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            }
          }
        }
      },
      {
        name: 'get_all_memory_types',
        description: 'Get all three memory types (KV-Cache, Reasoning Chain, Long-term Memory) for a model pair. Returns comprehensive memory options available for transfer.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier'
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier'
            }
          },
          required: ['sourceModel', 'targetModel']
        }
      },
      {
        name: 'get_memory_package_details',
        description: 'Get detailed information about a specific memory package. Returns full metadata, performance metrics, and download information.',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'ID of the memory package'
            }
          },
          required: ['packageId']
        }
      },
      {
        name: 'check_model_compatibility',
        description: 'Check if two models are compatible for memory transfer. Returns compatibility status, epsilon value, and available memory types.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Your current model'
            },
            targetModel: {
              type: 'string',
              description: 'Target model you want to transfer memory to'
            }
          },
          required: ['sourceModel', 'targetModel']
        }
      },
      {
        name: 'search_vector_packages',
        description: 'Search for Vector Packages (AI capability trading). These packages contain trained capability vectors that can be transferred between models.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier',
              examples: ['gpt-4', 'claude-3-opus', 'llama-3.1-8b']
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier'
            },
            category: {
              type: 'string',
              description: 'Capability category',
              enum: ['nlp', 'vision', 'audio', 'multimodal', 'other']
            },
            minQuality: {
              type: 'number',
              description: 'Minimum quality score (0-100)',
              default: 70
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            }
          }
        }
      },
      {
        name: 'search_chain_packages',
        description: 'Search for Chain Packages (reasoning chain trading). These packages contain step-by-step reasoning processes for problem solving.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier'
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier'
            },
            problemType: {
              type: 'string',
              description: 'Type of problem',
              examples: ['math-proof', 'code-generation', 'legal-analysis', 'research', 'debugging']
            },
            minQuality: {
              type: 'number',
              description: 'Minimum quality score (0-100)',
              default: 70
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            }
          }
        }
      },
      {
        name: 'purchase_package',
        description: 'Purchase any package type (vector/memory/chain). Returns purchase confirmation and download URL.',
        inputSchema: {
          type: 'object',
          properties: {
            packageType: {
              type: 'string',
              description: 'Type of package',
              enum: ['vector', 'memory', 'chain']
            },
            packageId: {
              type: 'string',
              description: 'ID of the package to purchase'
            },
            apiKey: {
              type: 'string',
              description: 'Your Awareness Market API key for authentication'
            }
          },
          required: ['packageType', 'packageId', 'apiKey']
        }
      },
      {
        name: 'download_package',
        description: 'Download a purchased package. Returns the download URL for the package file.',
        inputSchema: {
          type: 'object',
          properties: {
            packageType: {
              type: 'string',
              description: 'Type of package',
              enum: ['vector', 'memory', 'chain']
            },
            packageId: {
              type: 'string',
              description: 'ID of the package to download'
            },
            apiKey: {
              type: 'string',
              description: 'Your Awareness Market API key for authentication'
            }
          },
          required: ['packageType', 'packageId', 'apiKey']
        }
      },
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
      case 'search_kv_cache_memories': {
        const memories = await searchMemoriesByType({
          memoryType: 'kv_cache',
          sourceModel: args.sourceModel,
          targetModel: args.targetModel,
          minQuality: args.minQuality,
          limit: args.limit,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              memoryType: 'kv_cache',
              count: memories.length,
              packages: memories,
            }, null, 2)
          }]
        };
      }
      
      case 'search_reasoning_chain_memories': {
        const memories = await searchMemoriesByType({
          memoryType: 'reasoning_chain',
          sourceModel: args.sourceModel,
          targetModel: args.targetModel,
          minQuality: args.minQuality,
          limit: args.limit,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              memoryType: 'reasoning_chain',
              count: memories.length,
              packages: memories,
            }, null, 2)
          }]
        };
      }
      
      case 'search_long_term_memories': {
        const memories = await searchMemoriesByType({
          memoryType: 'long_term_memory',
          sourceModel: args.sourceModel,
          targetModel: args.targetModel,
          minQuality: args.minQuality,
          limit: args.limit,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              memoryType: 'long_term_memory',
              count: memories.length,
              packages: memories,
            }, null, 2)
          }]
        };
      }
      
      case 'get_all_memory_types': {
        const allMemories = await getAllMemoryTypes({
          sourceModel: args.sourceModel,
          targetModel: args.targetModel,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sourceModel: args.sourceModel,
              targetModel: args.targetModel,
              memoryTypes: {
                kvCache: {
                  count: allMemories.kvCache.length,
                  packages: allMemories.kvCache,
                },
                reasoningChain: {
                  count: allMemories.reasoningChain.length,
                  packages: allMemories.reasoningChain,
                },
                longTermMemory: {
                  count: allMemories.longTermMemory.length,
                  packages: allMemories.longTermMemory,
                },
              },
            }, null, 2)
          }]
        };
      }
      
      case 'get_memory_package_details': {
        const packageDetails = await getMemoryPackageDetails({
          packageId: args.packageId,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              package: packageDetails,
            }, null, 2)
          }]
        };
      }
      
      case 'check_model_compatibility': {
        const compatibility = await checkModelCompatibility({
          sourceModel: args.sourceModel,
          targetModel: args.targetModel,
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...compatibility,
            }, null, 2)
          }]
        };
      }
      
      case 'search_vector_packages': {
        const url = `${API_BASE}/api/trpc/packages.browsePackages`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageType: 'vector',
            sourceModel: args.sourceModel,
            targetModel: args.targetModel,
            category: args.category,
            minQuality: args.minQuality || 70,
            limit: args.limit || 10,
            offset: 0,
          })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        const packages = data.result?.data?.packages || [];
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              packageType: 'vector',
              count: packages.length,
              packages,
            }, null, 2)
          }]
        };
      }
      
      case 'search_chain_packages': {
        const url = `${API_BASE}/api/trpc/packages.browsePackages`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageType: 'chain',
            sourceModel: args.sourceModel,
            targetModel: args.targetModel,
            problemType: args.problemType,
            minQuality: args.minQuality || 70,
            limit: args.limit || 10,
            offset: 0,
          })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        const packages = data.result?.data?.packages || [];
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              packageType: 'chain',
              count: packages.length,
              packages,
            }, null, 2)
          }]
        };
      }
      
      case 'purchase_package': {
        const url = `${API_BASE}/api/trpc/packages.purchasePackage`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${args.apiKey}`,
          },
          body: JSON.stringify({
            packageType: args.packageType,
            packageId: args.packageId,
          })
        });
        
        if (!response.ok) {
          throw new Error(`Purchase failed: ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Package purchased successfully',
              purchase: data.result?.data,
            }, null, 2)
          }]
        };
      }
      
      case 'download_package': {
        const url = `${API_BASE}/api/trpc/packages.downloadPackage`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${args.apiKey}`,
          },
          body: JSON.stringify({
            packageType: args.packageType,
            packageId: args.packageId,
          })
        });
        
        if (!response.ok) {
          throw new Error(`Download failed: ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Download URL generated',
              downloadUrl: data.result?.data?.packageUrl,
              expiresIn: '24 hours',
            }, null, 2)
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
        }, null, 2)
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Enhanced Awareness MCP Server running with three memory types support');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
