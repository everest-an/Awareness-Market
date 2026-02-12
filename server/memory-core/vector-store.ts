/**
 * Vector Store Interface (Pluggable Architecture)
 *
 * Abstracts vector database implementation to support multiple backends:
 * - pgvector (Phase A - integrated with PostgreSQL)
 * - ChromaDB (Phase B - standalone vector DB)
 * - Milvus (Phase C - enterprise scale)
 * - Weaviate (Phase C - GraphQL API)
 */

/**
 * Vector data structure for storage
 */
export interface VectorData {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
}

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
  id: string;
  similarity: number; // Cosine similarity [0-1]
  metadata: Record<string, any>;
}

/**
 * Filter options for vector search
 */
export interface VectorSearchFilters {
  [key: string]: string | number | boolean | null;
}

/**
 * Abstract vector store interface
 * All vector database implementations must implement this interface
 */
export interface VectorStore {
  /**
   * Insert a single vector
   */
  insert(data: VectorData): Promise<void>;

  /**
   * Insert multiple vectors (batch operation)
   */
  batchInsert(vectors: VectorData[]): Promise<void>;

  /**
   * Search for similar vectors
   * @param query - Query embedding vector
   * @param limit - Maximum number of results
   * @param filters - Optional metadata filters
   * @returns Array of search results sorted by similarity (descending)
   */
  search(
    query: number[],
    limit: number,
    filters?: VectorSearchFilters
  ): Promise<VectorSearchResult[]>;

  /**
   * Delete a vector by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Update vector metadata (without changing embedding)
   */
  updateMetadata(id: string, metadata: Record<string, any>): Promise<void>;

  /**
   * Health check - verify vector store is operational
   */
  healthCheck(): Promise<boolean>;
}

/**
 * pgvector implementation (Phase A)
 * Uses PostgreSQL with pgvector extension
 */
export class PgVectorStore implements VectorStore {
  private prisma: any; // Prisma client instance

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  async insert(data: VectorData): Promise<void> {
    // Vector is stored directly in memory_entries table
    // This is a placeholder - actual implementation will be in memory router
    throw new Error('Use MemoryRouter.create() instead of direct vector store insert');
  }

  async batchInsert(vectors: VectorData[]): Promise<void> {
    // Batch insert using Prisma
    throw new Error('Use MemoryRouter.batchCreate() instead of direct vector store insert');
  }

  async search(
    query: number[],
    limit: number = 10,
    filters?: VectorSearchFilters
  ): Promise<VectorSearchResult[]> {
    // Use pgvector's <-> operator for cosine distance
    // Note: pgvector returns distance, not similarity
    // Similarity = 1 - distance

    const queryVector = `[${query.join(',')}]`;

    // Raw SQL query for vector similarity search
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT
        id,
        metadata,
        1 - (embedding <-> ${queryVector}::vector) AS similarity
      FROM memory_entries
      WHERE embedding IS NOT NULL
        AND is_latest = true
        ${filters ? this.buildFilterSQL(filters) : ''}
      ORDER BY embedding <-> ${queryVector}::vector
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      id: row.id,
      similarity: parseFloat(row.similarity),
      metadata: row.metadata,
    }));
  }

  async delete(id: string): Promise<void> {
    // Delete is handled by MemoryRouter (may involve archival)
    throw new Error('Use MemoryRouter.delete() instead of direct vector store delete');
  }

  async updateMetadata(id: string, metadata: Record<string, any>): Promise<void> {
    await this.prisma.memoryEntry.update({
      where: { id },
      data: { metadata },
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if pgvector extension is available
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;
      return result.length > 0;
    } catch (error) {
      console.error('[PgVectorStore] Health check failed:', error);
      return false;
    }
  }

  /**
   * Build SQL filter clause from filter object
   */
  private buildFilterSQL(filters: VectorSearchFilters): string {
    const conditions = Object.entries(filters)
      .map(([key, value]) => {
        if (value === null) {
          return `AND metadata->>'${key}' IS NULL`;
        }
        if (typeof value === 'string') {
          return `AND metadata->>'${key}' = '${value}'`;
        }
        if (typeof value === 'number') {
          return `AND (metadata->>'${key}')::numeric = ${value}`;
        }
        if (typeof value === 'boolean') {
          return `AND (metadata->>'${key}')::boolean = ${value}`;
        }
        return '';
      })
      .filter((s) => s.length > 0);

    return conditions.join(' ');
  }
}

/**
 * ChromaDB implementation (Phase B - Placeholder)
 * To be implemented when ChromaDB integration is added
 */
export class ChromaVectorStore implements VectorStore {
  private client: any;

  constructor(config: { host: string; port: number }) {
    // Initialize ChromaDB client
    throw new Error('ChromaDB implementation planned for Phase B');
  }

  async insert(data: VectorData): Promise<void> {
    throw new Error('Not implemented');
  }

  async batchInsert(vectors: VectorData[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async search(
    query: number[],
    limit: number,
    filters?: VectorSearchFilters
  ): Promise<VectorSearchResult[]> {
    throw new Error('Not implemented');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateMetadata(id: string, metadata: Record<string, any>): Promise<void> {
    throw new Error('Not implemented');
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}

/**
 * Factory function to create vector store instance
 * Allows switching between implementations via configuration
 */
export function createVectorStore(
  type: 'pgvector' | 'chroma',
  config: any
): VectorStore {
  switch (type) {
    case 'pgvector':
      return new PgVectorStore(config.prisma);
    case 'chroma':
      return new ChromaVectorStore(config);
    default:
      throw new Error(`Unsupported vector store type: ${type}`);
  }
}
