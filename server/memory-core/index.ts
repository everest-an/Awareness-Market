/**
 * Memory Core Module Exports
 *
 * Central export point for all memory system components.
 * Import from here to use the memory infrastructure.
 */

// Core types and schemas
export * from './schema';

// Main router (Control Plane entry point)
export { MemoryRouter } from './router';

// Vector storage abstraction
export type { VectorStore, VectorData, VectorSearchResult, VectorSearchFilters } from './vector-store';
export { PgVectorStore, createVectorStore } from './vector-store';

// Scoring engine
export * from './scoring-engine';

// Version management
export { VersionManager } from './version-manager';

// Embedding service
export type { EmbeddingService } from './embedding-service';
export {
  OpenAIEmbeddingService,
  MockEmbeddingService,
  createEmbeddingService,
} from './embedding-service';

// Phase 2: Conflict Detection & Version Tree
export { ConflictResolver, createConflictResolver } from './conflict-resolver';
export type {
  ConflictStatus,
  ConflictType,
  ConflictWithMemories,
  ListConflictsParams,
  ResolveConflictParams,
} from './conflict-resolver';

export { VersionTreeManager, createVersionTreeManager } from './version-tree';
export type {
  VersionNode,
  VersionHistory,
  VersionDiff,
} from './version-tree';

export {
  SemanticConflictDetector,
  createSemanticConflictDetector,
} from './semantic-conflict-detector';
export type { SemanticConflictDetectorConfig } from './semantic-conflict-detector';

/**
 * Factory function to create a fully configured MemoryRouter instance
 */
import { MemoryRouter } from './router';
import { createVectorStore } from './vector-store';
import { createEmbeddingService } from './embedding-service';

export function createMemoryRouter(prisma: any): MemoryRouter {
  // Create vector store (defaults to pgvector)
  const vectorStore = createVectorStore('pgvector', { prisma });

  // Create embedding service (uses OpenAI or mock)
  const embeddingService = createEmbeddingService();

  // Create router
  return new MemoryRouter(prisma, vectorStore, embeddingService);
}
