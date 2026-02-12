/**
 * Embedding Service
 *
 * Generates vector embeddings for text content using OpenAI API.
 * Supports both single and batch generation for efficiency.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('EmbeddingService');

/**
 * Embedding Service Interface
 * Allows for different embedding providers (OpenAI, Cohere, local models)
 */
export interface EmbeddingService {
  generate(text: string): Promise<number[]>;
  batchGenerate(texts: string[]): Promise<number[][]>;
  getDimension(): number;
  getModel(): string;
}

/**
 * OpenAI Embedding Service
 * Uses text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private apiKey: string;
  private model: string = 'text-embedding-3-small';
  private dimension: number = 1536;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor(apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for embedding service');
    }
    this.apiKey = apiKey;
    if (model) {
      this.model = model;
      // Update dimension based on model
      if (model === 'text-embedding-3-large') {
        this.dimension = 3072;
      }
    }
  }

  getDimension(): number {
    return this.dimension;
  }

  getModel(): string {
    return this.model;
  }

  async generate(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text.substring(0, 8000), // Limit to 8000 chars (~2000 tokens)
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API: missing embedding data');
      }

      logger.debug(`[OpenAI] Generated embedding for text (${text.length} chars)`);

      return data.data[0].embedding;
    } catch (error: any) {
      logger.error('[OpenAI] Embedding generation failed:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // OpenAI supports batch embeddings (up to ~2048 texts per request)
    const batchSize = 100; // Conservative batch size
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(t => t.substring(0, 8000));

      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
            encoding_format: 'float',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `OpenAI API error (${response.status}): ${errorData.error?.message || response.statusText}`
          );
        }

        const data = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
          throw new Error('Invalid response from OpenAI API: missing data array');
        }

        // Sort by index to ensure correct order
        const embeddings = data.data
          .sort((a: any, b: any) => a.index - b.index)
          .map((item: any) => item.embedding);

        results.push(...embeddings);

        logger.debug(`[OpenAI] Generated batch embeddings (${batch.length} texts)`);
      } catch (error: any) {
        logger.error('[OpenAI] Batch embedding generation failed:', error);
        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
      }
    }

    return results;
  }
}

/**
 * Mock Embedding Service (for testing without API key)
 * Generates random embeddings - DO NOT USE IN PRODUCTION
 */
export class MockEmbeddingService implements EmbeddingService {
  private dimension: number = 1536;

  getDimension(): number {
    return this.dimension;
  }

  getModel(): string {
    return 'mock-embedding';
  }

  async generate(text: string): Promise<number[]> {
    logger.warn('[MockEmbedding] Using mock embeddings - NOT FOR PRODUCTION');

    // Generate deterministic random vector based on text hash
    const hash = this.simpleHash(text);
    const embedding = new Array(this.dimension).fill(0).map((_, i) => {
      const seed = hash + i;
      return Math.sin(seed) * Math.cos(seed * 0.5);
    });

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generate(text)));
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Factory function to create embedding service based on configuration
 */
export function createEmbeddingService(): EmbeddingService {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  if (!apiKey) {
    logger.warn('[EmbeddingService] No OPENAI_API_KEY found, using MockEmbeddingService');
    logger.warn('[EmbeddingService] Set OPENAI_API_KEY in .env for production use');
    return new MockEmbeddingService();
  }

  logger.info(`[EmbeddingService] Using OpenAI model: ${model}`);
  return new OpenAIEmbeddingService(apiKey, model);
}
