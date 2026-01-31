/**
 * Memory NFT API
 * 
 * tRPC endpoints for Memory NFT marketplace
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import { assertDatabaseAvailable } from '../utils/error-handling';
import { memoryNFTs } from '../../drizzle/schema-memory-nft';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('MemoryNFT:API');

// ============================================================================
// Input Schemas
// ============================================================================

const browseMemoriesSchema = z.object({
  sortBy: z.enum(['recent', 'price', 'quality', 'popular']).default('recent'),
  memoryType: z.enum(['kv-cache', 'w-matrix', 'reasoning-chain']).optional(),
  certification: z.enum(['platinum', 'gold', 'silver', 'bronze']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const getDetailSchema = z.object({
  nftId: z.string(),
});

const getProvenanceSchema = z.object({
  memoryId: z.string(),
});

const purchaseSchema = z.object({
  nftId: z.string(),
});

// ============================================================================
// Memory NFT Router
// ============================================================================

export const memoryNFTRouter = router({
  /**
   * Browse memory marketplace
   */
  browse: publicProcedure
    .input(browseMemoriesSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);

      const conditions: SQL[] = [];
      if (input.memoryType) conditions.push(eq(memoryNFTs.memoryType, input.memoryType));
      if (input.certification) conditions.push(eq(memoryNFTs.certification, input.certification));

      let orderByClause: SQL = desc(memoryNFTs.mintedAt);
      if (input.sortBy === 'price') {
        orderByClause = desc(sql`CAST(${memoryNFTs.price} AS DECIMAL(18,2))`);
      } else if (input.sortBy === 'quality') {
        orderByClause = desc(sql`CAST(${memoryNFTs.epsilon} AS DECIMAL(18,6))`);
      } else if (input.sortBy === 'popular') {
        orderByClause = desc(memoryNFTs.downloads);
      }

      const records = await db
        .select()
        .from(memoryNFTs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(orderByClause)
        .limit(input.limit)
        .offset(input.offset);

      return records.map((record) => ({
        id: record.id,
        name: record.name,
        description: record.description,
        contractAddress: record.contractAddress,
        tokenId: record.tokenId,
        owner: record.owner,
        tbaAddress: record.tbaAddress,
        memoryType: record.memoryType,
        epsilon: record.epsilon,
        certification: record.certification,
        qualityGrade: record.qualityGrade,
        price: record.price,
        hasProvenance: Boolean(record.parentNftId),
        hasTBA: Boolean(record.tbaAddress),
        certified: Boolean(record.certification),
        mintedAt: record.mintedAt,
      }));
    }),

  /**
   * Get memory NFT details
   */
  getDetail: publicProcedure
    .input(getDetailSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);

      const records = await db
        .select()
        .from(memoryNFTs)
        .where(eq(memoryNFTs.id, input.nftId))
        .limit(1);

      if (!records.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Memory NFT not found' });
      }

      const record = records[0];
      return {
        id: record.id,
        name: record.name,
        description: record.description,
        contractAddress: record.contractAddress,
        tokenId: record.tokenId,
        owner: record.owner,
        tbaAddress: record.tbaAddress,
        memoryType: record.memoryType,
        epsilon: record.epsilon,
        certification: record.certification,
        qualityGrade: record.qualityGrade,
        price: record.price,
        assetUrl: record.assetUrl,
        metadataUrl: record.metadataUrl,
        mintedAt: record.mintedAt,
        updatedAt: record.updatedAt,
      };
    }),

  /**
   * Get memory provenance (family tree)
   */
  getProvenance: publicProcedure
    .input(getProvenanceSchema)
    .query(async ({ input }) => {
      // Build family tree from database
      const { buildFamilyTree } = await import('../db-provenance');

      try {
        const familyTree = await buildFamilyTree(input.memoryId);

        if (!familyTree) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory NFT not found or has no provenance data',
          });
        }

        return familyTree;
      } catch (error) {
        logger.error('[getProvenance] Failed to build family tree:', { error });

        // If error is already a TRPCError, rethrow it
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve memory provenance',
        });
      }
    }),

  /**
   * Purchase memory NFT
   */
  purchase: protectedProcedure
    .input(purchaseSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      assertDatabaseAvailable(db);

      const records = await db
        .select()
        .from(memoryNFTs)
        .where(eq(memoryNFTs.id, input.nftId))
        .limit(1);

      if (!records.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Memory NFT not found' });
      }

      await db
        .update(memoryNFTs)
        .set({
          downloads: sql`${memoryNFTs.downloads} + 1`,
        })
        .where(eq(memoryNFTs.id, input.nftId));

      return {
        success: true,
        transactionHash: `mem_${ctx.user.id}_${Date.now()}`,
        nftId: input.nftId,
      };
    }),

  /**
   * Get marketplace statistics
   */
  getStats: publicProcedure
    .query(async () => {
      const db = await getDb();
      assertDatabaseAvailable(db);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(memoryNFTs);

      const [{ avgEpsilon }] = await db
        .select({ avgEpsilon: sql<number>`avg(CAST(${memoryNFTs.epsilon} AS DECIMAL(18,6)))` })
        .from(memoryNFTs);

      return {
        totalMemories: Number(count || 0),
        totalSales: 0,
        totalVolume: '0',
        avgEpsilon: avgEpsilon ? avgEpsilon.toFixed(2) : '0.00',
      };
    }),
});
