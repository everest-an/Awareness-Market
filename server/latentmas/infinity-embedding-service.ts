/**
 * Infinity Embedding Service
 *
 * Client for local Infinity embedding server
 * Replaces OpenAI embedding API with self-hosted nomic-embed-text-v1.5
 *
 * Features:
 * - Matryoshka embeddings (variable dimensions: 64-768)
 * - OpenAI-compatible API
 * - 4500 tokens/s on CPU
 * - 92% cost savings vs OpenAI
 */

import axios, { AxiosInstance } from 'axios';

export interface EmbeddingOptions {
  model?: string;
  dimension?: number;
  normalize?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  data: EmbeddingResult[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class InfinityEmbeddingService {
  private client: AxiosInstance;
  private defaultModel: string;
  private defaultDimension: number;

  constructor(
    baseUrl: string = process.env.INFINITY_EMBEDDING_URL || 'http://localhost:7997',
    defaultDimension: number = 512
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30s timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.defaultModel = 'nomic-ai/nomic-embed-text-v1.5';
    this.defaultDimension = defaultDimension;
  }

  /**
   * Health check for Infinity server
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Infinity server health check failed:', error);
      return false;
    }
  }

  /**
   * Generate embeddings for single text
   */
  async embedSingle(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const embeddings = await this.embed([text], options);
    return embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  async embed(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const model = options.model || this.defaultModel;
    const dimension = options.dimension || this.defaultDimension;

    try {
      const response = await this.client.post<EmbeddingResponse>('/embeddings', {
        model,
        input: texts,
        dimensions: dimension,
      });

      // Sort by index to maintain original order
      const sortedData = response.data.data.sort((a, b) => a.index - b.index);

      return sortedData.map(item => item.embedding);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message;
      throw new Error(`Infinity embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Embed package metadata for semantic search
   * Optimized for Vector/Memory/Chain packages
   */
  async embedPackage(
    name: string,
    description: string,
    additionalContext?: string,
    dimension: number = 512
  ): Promise<number[]> {
    // Combine package metadata into searchable text
    const parts = [
      `Package: ${name}`,
      `Description: ${description}`,
    ];

    if (additionalContext) {
      parts.push(`Context: ${additionalContext}`);
    }

    const text = parts.join('\n\n');

    return this.embedSingle(text, { dimension });
  }

  /**
   * Embed search query for package retrieval
   */
  async embedQuery(
    query: string,
    dimension: number = 512
  ): Promise<number[]> {
    // Add prefix to indicate this is a search query
    const queryText = `Search query: ${query}`;

    return this.embedSingle(queryText, { dimension });
  }

  /**
   * Batch embed multiple packages
   * Useful for bulk operations and backfilling
   */
  async embedPackagesBatch(
    packages: Array<{
      name: string;
      description: string;
      context?: string;
    }>,
    dimension: number = 512
  ): Promise<number[][]> {
    const texts = packages.map(pkg => {
      const parts = [
        `Package: ${pkg.name}`,
        `Description: ${pkg.description}`,
      ];

      if (pkg.context) {
        parts.push(`Context: ${pkg.context}`);
      }

      return parts.join('\n\n');
    });

    return this.embed(texts, { dimension });
  }

  /**
   * Get model info
   */
  getModelInfo() {
    return {
      model: this.defaultModel,
      dimension: this.defaultDimension,
      maxTokens: 8192,
      performance: '4500 tokens/s (CPU)',
      cost: '~$0.02/1M tokens (self-hosted)',
    };
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let infinityService: InfinityEmbeddingService | null = null;

export function getInfinityEmbeddingService(
  baseUrl?: string,
  dimension?: number
): InfinityEmbeddingService {
  if (!infinityService) {
    infinityService = new InfinityEmbeddingService(baseUrl, dimension);
  }
  return infinityService;
}

// ============================================================================
// Utility: Dimension presets
// ============================================================================

export const EMBEDDING_DIMENSIONS = {
  VECTOR_PACKAGE: 512,  // General purpose, balanced
  MEMORY_PACKAGE: 256,  // Storage optimized, 67% savings
  CHAIN_PACKAGE: 768,   // Full quality for complex reasoning
  QUERY: 512,           // Default for user queries
} as const;
