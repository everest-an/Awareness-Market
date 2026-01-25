#!/usr/bin/env node

/**
 * Awareness MCP Server - LatentMAS Integration
 * 
 * Model Context Protocol server for Awareness Market
 * Enables AI agents to discover, evaluate, and purchase LatentMAS memory packages
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
interface LatentMASMemoryPackage {
  id: string;
  title: string;
  description: string;
  sourceModel: string;
  targetModel: string;
  
  // W-Matrix metadata
  wMatrix: {
    version: string;
    epsilon: number;
    certificationLevel: string;
    orthogonalityScore: number;
    dimension: number;
  };
  
  // KV-Cache metadata
  kvCache: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
  };
  
  // Performance metrics
  metrics: {
    ttftReduction: number; // percentage
    tokenSavings: number; // percentage
    bandwidthSaving: number; // percentage
    qualityScore: number; // 0-100
  };
  
  // Pricing
  price: string;
  currency: string;
  
  // Metadata
  createdAt: string;
  downloads: number;
  rating: number;
}

interface ModelCompatibility {
  sourceModel: string;
  targetModel: string;
  compatible: boolean;
  epsilon: number;
  recommendation: string;
  bestWMatrix?: {
    id: string;
    version: string;
    epsilon: number;
    certificationLevel: string;
  };
}

// API Base URL
const API_BASE = process.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * Search LatentMAS memory packages
 */
async function searchLatentMASMemories(params: {
  sourceModel?: string;
  targetModel?: string;
  maxEpsilon?: number;
  minQuality?: number;
  limit?: number;
}): Promise<LatentMASMemoryPackage[]> {
  const url = `${API_BASE}/api/trpc/latentmasMarketplace.browsePackages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
      maxEpsilon: params.maxEpsilon || 0.10,
      minQualityScore: params.minQuality || 70,
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
 * Check model compatibility
 */
async function checkModelCompatibility(params: {
  sourceModel: string;
  targetModel: string;
}): Promise<ModelCompatibility> {
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
    return {
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
      compatible: true,
      epsilon: targetCompatibility.epsilon,
      recommendation: `Compatible with ${targetCompatibility.certificationLevel} certification`,
      bestWMatrix: {
        id: targetCompatibility.wMatrixId,
        version: targetCompatibility.version,
        epsilon: targetCompatibility.epsilon,
        certificationLevel: targetCompatibility.certificationLevel,
      }
    };
  }
  
  return {
    sourceModel: params.sourceModel,
    targetModel: params.targetModel,
    compatible: false,
    epsilon: 1.0,
    recommendation: 'No compatible W-Matrix found. Consider training a new one.',
  };
}

/**
 * Get W-Matrix details
 */
async function getWMatrixDetails(params: {
  sourceModel: string;
  targetModel: string;
}): Promise<any> {
  const url = `${API_BASE}/api/trpc/wMatrixMarketplaceV2.getBestMatrix`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceModel: params.sourceModel,
      targetModel: params.targetModel,
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch W-Matrix: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.result?.data;
}

/**
 * Purchase LatentMAS memory package
 */
async function purchaseMemoryPackage(params: {
  packageId: string;
  apiKey: string;
}): Promise<{ success: boolean; downloadUrl?: string; message: string }> {
  const url = `${API_BASE}/api/trpc/latentmasMarketplace.purchasePackage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      packageId: params.packageId
    })
  });
  
  if (!response.ok) {
    return {
      success: false,
      message: `Purchase failed: ${response.statusText}`
    };
  }
  
  const data = await response.json() as any;
  return {
    success: true,
    downloadUrl: data.result?.data?.downloadUrl,
    message: 'Purchase successful'
  };
}

/**
 * Estimate performance improvement
 */
async function estimatePerformance(params: {
  sourceModel: string;
  targetModel: string;
  currentTokens: number;
}): Promise<{
  ttftReduction: number;
  tokenSavings: number;
  bandwidthSaving: number;
  estimatedCost: number;
}> {
  const url = `${API_BASE}/api/trpc/kvCacheApi.estimateSavings`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelName: params.targetModel,
      originalSize: params.currentTokens * 4096 * 4, // Assume 4096 dim, 4 bytes per float
      compressionRatio: 0.90,
    })
  });
  
  if (!response.ok) {
    // Return default estimates
    return {
      ttftReduction: 45,
      tokenSavings: 40,
      bandwidthSaving: 90,
      estimatedCost: 0.001,
    };
  }
  
  const data = await response.json() as any;
  return data.result?.data || {
    ttftReduction: 45,
    tokenSavings: 40,
    bandwidthSaving: 90,
    estimatedCost: 0.001,
  };
}

// Create MCP server
const server = new Server(
  {
    name: 'awareness-latentmas-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Search Vector Packages
 */
async function searchVectorPackages(params: {
  category?: string;
  sourceModel?: string;
  targetModel?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<any[]> {
  const url = `${API_BASE}/api/trpc/packages.browsePackages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        packageType: 'vector',
        category: params.category,
        sourceModel: params.sourceModel,
        targetModel: params.targetModel,
        search: params.search,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        limit: params.limit || 10,
        offset: 0,
        sortBy: 'recent',
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.result?.data?.packages || [];
}

/**
 * Search Memory Packages
 */
async function searchMemoryPackages(params: {
  sourceModel?: string;
  targetModel?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<any[]> {
  const url = `${API_BASE}/api/trpc/packages.browsePackages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        packageType: 'memory',
        sourceModel: params.sourceModel,
        targetModel: params.targetModel,
        search: params.search,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        limit: params.limit || 10,
        offset: 0,
        sortBy: 'recent',
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.result?.data?.packages || [];
}

/**
 * Search Chain Packages
 */
async function searchChainPackages(params: {
  problemType?: string;
  sourceModel?: string;
  targetModel?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<any[]> {
  const url = `${API_BASE}/api/trpc/packages.browsePackages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        packageType: 'chain',
        problemType: params.problemType,
        sourceModel: params.sourceModel,
        targetModel: params.targetModel,
        search: params.search,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        limit: params.limit || 10,
        offset: 0,
        sortBy: 'recent',
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  return data.result?.data?.packages || [];
}

/**
 * Purchase any package type
 */
async function purchasePackage(params: {
  packageType: 'vector' | 'memory' | 'chain';
  packageId: string;
  apiKey: string;
}): Promise<{ success: boolean; downloadUrl?: string; message: string }> {
  const url = `${API_BASE}/api/trpc/packages.purchasePackage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      json: {
        packageType: params.packageType,
        packageId: params.packageId
      }
    })
  });
  
  if (!response.ok) {
    return {
      success: false,
      message: `Purchase failed: ${response.statusText}`
    };
  }
  
  const data = await response.json() as any;
  
  // Get download URL after purchase
  const downloadUrl = `${API_BASE}/api/trpc/packages.downloadPackage`;
  const downloadResponse = await fetch(downloadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      json: {
        packageType: params.packageType,
        packageId: params.packageId
      }
    })
  });
  
  if (downloadResponse.ok) {
    const downloadData = await downloadResponse.json() as any;
    return {
      success: true,
      downloadUrl: downloadData.result?.data?.packageUrl,
      message: 'Purchase successful'
    };
  }
  
  return {
    success: true,
    message: 'Purchase successful (download URL pending)'
  };
}

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ============ Vector Package Tools ============
      {
        name: 'search_vector_packages',
        description: 'Search for Vector Packages (.vectorpkg) containing static AI capabilities and embeddings. Vector packages can be transferred between models using W-Matrix transformation.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filter by category',
              enum: ['nlp', 'vision', 'audio', 'multimodal', 'other']
            },
            sourceModel: {
              type: 'string',
              description: 'Filter by source model (e.g., "gpt-4", "claude-3-opus")'
            },
            targetModel: {
              type: 'string',
              description: 'Filter by target model'
            },
            search: {
              type: 'string',
              description: 'Text search in name and description'
            },
            minPrice: {
              type: 'number',
              description: 'Minimum price filter'
            },
            maxPrice: {
              type: 'number',
              description: 'Maximum price filter'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)',
              default: 10
            }
          }
        }
      },
      // ============ Memory Package Tools ============
      {
        name: 'search_memory_packages',
        description: 'Search for Memory Packages (.memorypkg) containing KV-Cache data for cross-model context transfer using LatentMAS protocol.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Filter by source model (e.g., "gpt-4", "claude-3-opus")'
            },
            targetModel: {
              type: 'string',
              description: 'Filter by target model'
            },
            search: {
              type: 'string',
              description: 'Text search in name and description'
            },
            minPrice: {
              type: 'number',
              description: 'Minimum price filter'
            },
            maxPrice: {
              type: 'number',
              description: 'Maximum price filter'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)',
              default: 10
            }
          }
        }
      },
      // ============ Chain Package Tools ============
      {
        name: 'search_chain_packages',
        description: 'Search for Chain Packages (.chainpkg) containing reasoning chains that capture step-by-step problem-solving processes.',
        inputSchema: {
          type: 'object',
          properties: {
            problemType: {
              type: 'string',
              description: 'Filter by problem type (e.g., "mathematical-proof", "code-generation", "logical-reasoning")'
            },
            sourceModel: {
              type: 'string',
              description: 'Filter by source model'
            },
            targetModel: {
              type: 'string',
              description: 'Filter by target model'
            },
            search: {
              type: 'string',
              description: 'Text search in name and description'
            },
            minPrice: {
              type: 'number',
              description: 'Minimum price filter'
            },
            maxPrice: {
              type: 'number',
              description: 'Maximum price filter'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)',
              default: 10
            }
          }
        }
      },
      // ============ Purchase Tool ============
      {
        name: 'purchase_package',
        description: 'Purchase any package type (vector, memory, or chain). Returns download URL after successful purchase.',
        inputSchema: {
          type: 'object',
          properties: {
            packageType: {
              type: 'string',
              description: 'Type of package to purchase',
              enum: ['vector', 'memory', 'chain']
            },
            packageId: {
              type: 'string',
              description: 'ID of the package to purchase'
            },
            apiKey: {
              type: 'string',
              description: 'Your Awareness API key'
            }
          },
          required: ['packageType', 'packageId', 'apiKey']
        }
      },
      // ============ Legacy LatentMAS Tools ============
      {
        name: 'search_latentmas_memories',
        description: 'Search for LatentMAS memory packages (W-Matrix + KV-Cache) by model pair. Returns packages with performance metrics, pricing, and quality scores. Use this to find pre-trained cross-model memory transformations.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model identifier (e.g., "gpt-3.5-turbo", "llama-3.1-8b")',
              examples: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'llama-3.1-8b']
            },
            targetModel: {
              type: 'string',
              description: 'Target model identifier (e.g., "gpt-4", "claude-3-opus")',
              examples: ['gpt-4', 'claude-3-opus', 'llama-3.1-70b']
            },
            maxEpsilon: {
              type: 'number',
              description: 'Maximum alignment loss (epsilon) to accept (default: 0.10). Lower is better.',
              default: 0.10
            },
            minQuality: {
              type: 'number',
              description: 'Minimum quality score (0-100) to accept (default: 70)',
              default: 70
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
              default: 10
            }
          }
        }
      },
      {
        name: 'check_model_compatibility',
        description: 'Check if two models are compatible for LatentMAS memory transfer. Returns compatibility status, epsilon value, and best available W-Matrix. Use this before purchasing to ensure compatibility.',
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
        name: 'get_wmatrix_details',
        description: 'Get detailed information about a W-Matrix for a specific model pair. Returns training metadata, certification level, orthogonality score, and download URLs.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model'
            },
            targetModel: {
              type: 'string',
              description: 'Target model'
            }
          },
          required: ['sourceModel', 'targetModel']
        }
      },
      {
        name: 'estimate_performance',
        description: 'Estimate performance improvements from using LatentMAS. Returns expected TTFT reduction, token savings, bandwidth savings, and cost estimates.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceModel: {
              type: 'string',
              description: 'Source model'
            },
            targetModel: {
              type: 'string',
              description: 'Target model'
            },
            currentTokens: {
              type: 'number',
              description: 'Current number of tokens in your KV-Cache'
            }
          },
          required: ['sourceModel', 'targetModel', 'currentTokens']
        }
      },
      {
        name: 'purchase_memory_package',
        description: 'Purchase a LatentMAS memory package. Requires API key. Returns download URL for the complete package (W-Matrix + compressed KV-Cache).',
        inputSchema: {
          type: 'object',
          properties: {
            packageId: {
              type: 'string',
              description: 'ID of the memory package to purchase'
            },
            apiKey: {
              type: 'string',
              description: 'Your Awareness API key'
            }
          },
          required: ['packageId', 'apiKey']
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
      // ============ Vector Package Tools ============
      case 'search_vector_packages': {
        const params = args as {
          category?: string;
          sourceModel?: string;
          targetModel?: string;
          search?: string;
          minPrice?: number;
          maxPrice?: number;
          limit?: number;
        };
        
        const packages = await searchVectorPackages(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: packages.length,
                packageType: 'vector',
                packages: packages.map((p: any) => ({
                  id: p.packageId,
                  name: p.name,
                  description: p.description,
                  category: p.category,
                  modelPair: `${p.sourceModel} → ${p.targetModel}`,
                  epsilon: parseFloat(p.epsilon),
                  dimension: p.dimension,
                  price: `$${p.price}`,
                  downloads: p.downloads,
                  createdAt: p.createdAt,
                })),
                recommendation: packages.length > 0
                  ? `Found ${packages.length} vector packages. Best match: ${packages[0].name}`
                  : 'No vector packages found matching your criteria.'
              }, null, 2)
            }
          ]
        };
      }
      
      // ============ Memory Package Tools ============
      case 'search_memory_packages': {
        const params = args as {
          sourceModel?: string;
          targetModel?: string;
          search?: string;
          minPrice?: number;
          maxPrice?: number;
          limit?: number;
        };
        
        const packages = await searchMemoryPackages(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: packages.length,
                packageType: 'memory',
                packages: packages.map((p: any) => ({
                  id: p.packageId,
                  name: p.name,
                  description: p.description,
                  modelPair: `${p.sourceModel} → ${p.targetModel}`,
                  epsilon: parseFloat(p.epsilon),
                  tokenCount: p.tokenCount,
                  compressionRatio: parseFloat(p.compressionRatio),
                  contextDescription: p.contextDescription,
                  price: `$${p.price}`,
                  downloads: p.downloads,
                  createdAt: p.createdAt,
                })),
                recommendation: packages.length > 0
                  ? `Found ${packages.length} memory packages for KV-Cache transfer. Best match: ${packages[0].name}`
                  : 'No memory packages found matching your criteria.'
              }, null, 2)
            }
          ]
        };
      }
      
      // ============ Chain Package Tools ============
      case 'search_chain_packages': {
        const params = args as {
          problemType?: string;
          sourceModel?: string;
          targetModel?: string;
          search?: string;
          minPrice?: number;
          maxPrice?: number;
          limit?: number;
        };
        
        const packages = await searchChainPackages(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: packages.length,
                packageType: 'chain',
                packages: packages.map((p: any) => ({
                  id: p.packageId,
                  name: p.name,
                  description: p.description,
                  problemType: p.problemType,
                  modelPair: `${p.sourceModel} → ${p.targetModel}`,
                  epsilon: parseFloat(p.epsilon),
                  stepCount: p.stepCount,
                  solutionQuality: parseFloat(p.solutionQuality),
                  price: `$${p.price}`,
                  downloads: p.downloads,
                  createdAt: p.createdAt,
                })),
                recommendation: packages.length > 0
                  ? `Found ${packages.length} reasoning chain packages. Best match: ${packages[0].name}`
                  : 'No chain packages found matching your criteria.'
              }, null, 2)
            }
          ]
        };
      }
      
      // ============ Purchase Tool ============
      case 'purchase_package': {
        const params = args as {
          packageType: 'vector' | 'memory' | 'chain';
          packageId: string;
          apiKey: string;
        };
        
        const result = await purchasePackage(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                packageType: params.packageType,
                packageId: params.packageId,
                message: result.message,
                downloadUrl: result.downloadUrl,
                nextSteps: result.success
                  ? [
                      '1. Download the package from the provided URL',
                      '2. Extract the package contents (.vectorpkg/.memorypkg/.chainpkg)',
                      '3. Load the W-Matrix for cross-model transformation',
                      '4. Apply the package data to your target model',
                    ]
                  : ['Check your API key and account balance']
              }, null, 2)
            }
          ]
        };
      }
      
      // ============ Legacy LatentMAS Tools ============
      case 'search_latentmas_memories': {
        const params = args as {
          sourceModel?: string;
          targetModel?: string;
          maxEpsilon?: number;
          minQuality?: number;
          limit?: number;
        };
        
        const memories = await searchLatentMASMemories(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: memories.length,
                packages: memories.map(m => ({
                  id: m.id,
                  title: m.title,
                  description: m.description,
                  modelPair: `${m.sourceModel} → ${m.targetModel}`,
                  epsilon: m.wMatrix.epsilon,
                  certification: m.wMatrix.certificationLevel,
                  qualityScore: m.metrics.qualityScore,
                  performance: {
                    ttftReduction: `${m.metrics.ttftReduction.toFixed(1)}%`,
                    tokenSavings: `${m.metrics.tokenSavings.toFixed(1)}%`,
                    bandwidthSaving: `${m.metrics.bandwidthSaving.toFixed(1)}%`
                  },
                  price: `${m.price} ${m.currency}`,
                  uri: `awareness://latentmas/${m.sourceModel}/${m.targetModel}/${m.id}`
                })),
                recommendation: memories.length > 0
                  ? `Found ${memories.length} compatible packages. Best option: ${memories[0].title} (ε=${memories[0].wMatrix.epsilon.toFixed(4)}, Quality=${memories[0].metrics.qualityScore.toFixed(1)})`
                  : 'No compatible packages found. Consider training a new W-Matrix or adjusting search criteria.'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'check_model_compatibility': {
        const params = args as { sourceModel: string; targetModel: string };
        const compatibility = await checkModelCompatibility(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                compatible: compatibility.compatible,
                sourceModel: compatibility.sourceModel,
                targetModel: compatibility.targetModel,
                epsilon: compatibility.epsilon,
                recommendation: compatibility.recommendation,
                bestWMatrix: compatibility.bestWMatrix,
                interpretation: compatibility.compatible
                  ? compatibility.epsilon < 0.05
                    ? '✓ Excellent compatibility - Gold/Platinum certified'
                    : compatibility.epsilon < 0.10
                    ? '✓ Good compatibility - Silver/Gold certified'
                    : '⚠ Moderate compatibility - Bronze certified'
                  : '✗ No compatible W-Matrix available'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'get_wmatrix_details': {
        const params = args as { sourceModel: string; targetModel: string };
        const wmatrix = await getWMatrixDetails(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wmatrix || { error: 'W-Matrix not found' }, null, 2)
            }
          ]
        };
      }
      
      case 'estimate_performance': {
        const params = args as { sourceModel: string; targetModel: string; currentTokens: number };
        const estimate = await estimatePerformance(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                currentTokens: params.currentTokens,
                estimatedImprovements: {
                  ttftReduction: `${estimate.ttftReduction}% faster first token`,
                  tokenSavings: `${estimate.tokenSavings}% fewer tokens processed`,
                  bandwidthSaving: `${estimate.bandwidthSaving}% bandwidth reduction`
                },
                estimatedCost: `$${estimate.estimatedCost.toFixed(4)} per inference`,
                recommendation: estimate.ttftReduction > 40
                  ? 'Highly recommended - significant performance gains'
                  : estimate.ttftReduction > 20
                  ? 'Recommended - moderate performance gains'
                  : 'Consider if cost savings are priority'
              }, null, 2)
            }
          ]
        };
      }
      
      case 'purchase_memory_package': {
        const params = args as { packageId: string; apiKey: string };
        const result = await purchaseMemoryPackage(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: result.success,
                message: result.message,
                downloadUrl: result.downloadUrl,
                nextSteps: result.success
                  ? [
                      '1. Download the package from the provided URL',
                      '2. Extract W-Matrix and compressed KV-Cache',
                      '3. Load W-Matrix into your inference pipeline',
                      '4. Apply transformation to your KV-Cache',
                      '5. Enjoy reduced TTFT and token consumption!'
                    ]
                  : ['Check your API key and account balance']
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
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            troubleshooting: [
              'Ensure the API server is running',
              'Check your network connection',
              'Verify model names are correct',
              'Confirm API key is valid (if required)'
            ]
          }, null, 2)
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
  // Fetch recent LatentMAS packages
  const packages = await searchLatentMASMemories({ limit: 20 });
  
  return {
    resources: packages.map(p => ({
      uri: `awareness://latentmas/${p.sourceModel}/${p.targetModel}/${p.id}`,
      name: p.title,
      description: `${p.description} | ε=${p.wMatrix.epsilon.toFixed(4)} | Quality=${p.metrics.qualityScore.toFixed(1)}`,
      mimeType: 'application/json'
    }))
  };
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Parse URI: awareness://latentmas/[sourceModel]/[targetModel]/[id]
  const match = uri.match(/^awareness:\/\/latentmas\/([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid URI format. Expected: awareness://latentmas/[sourceModel]/[targetModel]/[id]');
  }
  
  const [, sourceModel, targetModel, packageId] = match;
  
  // Fetch package details
  const url = `${API_BASE}/api/trpc/latentmasMarketplace.getPackageDetails`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch package: ${response.statusText}`);
  }
  
  const data = await response.json() as any;
  const pkg = data.result?.data;
  
  if (!pkg) {
    throw new Error(`Package not found: ${packageId}`);
  }
  
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          ...pkg,
          metadata: {
            uri,
            sourceModel,
            targetModel,
            purchaseEndpoint: `${API_BASE}/api/trpc/latentmasMarketplace.purchasePackage`,
            compatibilityCheckEndpoint: `${API_BASE}/api/trpc/wMatrixMarketplaceV2.checkVersionCompatibility`
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
  console.error('Awareness LatentMAS MCP Server v2.0 running on stdio');
  console.error('Integrated with LatentMAS Marketplace API');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
