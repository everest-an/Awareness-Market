/**
 * Memory NFT API
 *
 * tRPC endpoints for Memory NFT marketplace
 * Uses Prisma Client for PostgreSQL
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { logger } from '../utils/logger';
import type { Prisma } from '@prisma/client';

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
      const where: Prisma.MemoryNFTWhereInput = {};

      if (input.memoryType) {
        where.memoryType = input.memoryType;
      }
      if (input.certification) {
        where.certification = input.certification;
      }

      let orderBy: Prisma.MemoryNFTOrderByWithRelationInput = { mintedAt: 'desc' };
      if (input.sortBy === 'price') {
        orderBy = { price: 'desc' };
      } else if (input.sortBy === 'quality') {
        orderBy = { epsilon: 'asc' }; // Lower epsilon = better quality
      } else if (input.sortBy === 'popular') {
        orderBy = { downloads: 'desc' };
      }

      const records = await prisma.memoryNFT.findMany({
        where,
        orderBy,
        take: input.limit,
        skip: input.offset,
      });

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
      const record = await prisma.memoryNFT.findUnique({
        where: { id: input.nftId },
      });

      if (!record) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Memory NFT not found' });
      }

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
        downloads: record.downloads,
        royaltyPercent: record.royaltyPercent,
        totalRoyaltiesPaid: record.totalRoyaltiesPaid,
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
      const { buildFamilyTree } = await import('../db-provenance.js');

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
      const record = await prisma.memoryNFT.findUnique({
        where: { id: input.nftId },
      });

      if (!record) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Memory NFT not found' });
      }

      await prisma.memoryNFT.update({
        where: { id: input.nftId },
        data: {
          downloads: { increment: 1 },
        },
      });

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
      const count = await prisma.memoryNFT.count();

      const avgResult = await prisma.memoryNFT.aggregate({
        _avg: {
          downloads: true,
        },
      });

      // Calculate average epsilon manually since it's stored as string
      const records = await prisma.memoryNFT.findMany({
        select: { epsilon: true },
        where: { epsilon: { not: null } },
      });

      let avgEpsilon = 0;
      if (records.length > 0) {
        const sum = records.reduce((acc, r) => acc + (r.epsilon ? parseFloat(r.epsilon) : 0), 0);
        avgEpsilon = sum / records.length;
      }

      return {
        totalMemories: count,
        totalSales: 0,
        totalVolume: '0',
        avgEpsilon: avgEpsilon.toFixed(2),
      };
    }),
});
