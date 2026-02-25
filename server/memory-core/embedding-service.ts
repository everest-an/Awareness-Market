/**
 * Bridge module — re-exports from the canonical latentmas embedding service.
 * The memory-core now uses the same embedding service as the rest of the system.
 */

import { OpenAIEmbeddingService } from '../latentmas/embedding-service';

// Interface that memory-core expects
// NOTE: memory-core/router.ts calls .generate() and .batchGenerate(), so we
// expose those names here alongside the standard embed/embedBatch.
export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
  /** Alias used by memory-core/router.ts */
  generate(text: string): Promise<number[]>;
  /** Alias used by memory-core/router.ts */
  batchGenerate(texts: string[]): Promise<number[][]>;
}

// Adapter that wraps the latentmas OpenAI service into the simpler interface
class EmbeddingServiceAdapter implements EmbeddingService {
  private service: OpenAIEmbeddingService;

  constructor() {
    this.service = new OpenAIEmbeddingService();
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.service.embed({ text, model: 'text-embedding-3-small' });
    return result.vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const result = await this.service.embedBatch({
      texts,
      model: 'text-embedding-3-small',
    });
    return result.embeddings.map(e => e.vector);
  }

  async generate(text: string): Promise<number[]> {
    return this.embed(text);
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    return this.embedBatch(texts);
  }
}

// Mock embedding service for testing
export class MockEmbeddingService implements EmbeddingService {
  async embed(text: string): Promise<number[]> {
    // Generate deterministic fake embedding from text hash
    const hash = Array.from(text).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: 1536 }, (_, i) => Math.sin(hash + i) * 0.1);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  async generate(text: string): Promise<number[]> {
    return this.embed(text);
  }

  async batchGenerate(texts: string[]): Promise<number[][]> {
    return this.embedBatch(texts);
  }
}

export { OpenAIEmbeddingService };

export function createEmbeddingService(): EmbeddingService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'test' || apiKey === 'mock') {
    return new MockEmbeddingService();
  }
  return new EmbeddingServiceAdapter();
}
