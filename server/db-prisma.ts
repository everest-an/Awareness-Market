/**
 * Prisma Client Wrapper
 * Replaces Drizzle ORM with Prisma for commercial production environment
 * 
 * This file provides a centralized Prisma client instance and type exports
 * to replace all Drizzle imports across the codebase.
 */

import { PrismaClient } from '@prisma/client';

// Singleton Prisma Client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export Prisma types for backward compatibility with Drizzle imports
export type {
  User,
  Workflow,
  WorkflowStep,
  OnChainInteraction,
  WMatrixCompatibility,
  WMatrixListing,
  WMatrixIntegrity,
  // Add other model types as needed
} from '@prisma/client';

// Helper function to get database client (replaces Drizzle's db)
export function getDb() {
  return prisma;
}

export default prisma;
