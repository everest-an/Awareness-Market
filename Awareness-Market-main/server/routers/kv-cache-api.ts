/**
 * KV-Cache Compression API
 * 
 * Production-grade API endpoints for KV-Cache compression
 * Exposes compression, streaming, and benchmarking capabilities
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import {
  ProductionKVCacheCompressor,
  StreamingKVCacheCompressor,
  benchmarkCompression,
  MODEL_ADAPTERS,
  createProductionCompressor,
} from '../latentmas/kv-cache-compressor-production';

// ============================================================================
// Input Schemas
// ============================================================================

const CompressInputSchema = z.object({
  modelName: z.string(),
  keys: z.array(z.array(z.number())),
  values: z.array(z.array(z.number())),
  queries: z.array(z.array(z.number())),
  options: z.object({
    attentionThreshold: z.number().min(0).max(1).optional(),
    minTokens: z.number().int().positive().optional(),
    maxTokens: z.number().int().positive().optional(),
  }).optional(),
});

const DecompressInputSchema = z.object({
  compressed: z.object({
    entries: z.array(z.object({
      key: z.array(z.number()),
      value: z.array(z.number()),
      tokenIndex: z.number(),
      attentionWeight: z.number(),
    })),
    compressionRatio: z.number(),
    totalTokens: z.number(),
    selectedTokens: z.number(),
    cumulativeAttention: z.number(),
  }),
  originalLength: z.number().int().positive(),
});

const BenchmarkInputSchema = z.object({
  modelName: z.string(),
  numTokens: z.number().int().positive(),
  dimension: z.number().int().positive(),
  iterations: z.number().int().positive().default(10),
});

const ValidateQualityInputSchema = z.object({
  modelName: z.string(),
  compressed: z.object({
    entries: z.array(z.object({
      key: z.array(z.number()),
      value: z.array(z.number()),
      tokenIndex: z.number(),
      attentionWeight: z.number(),
    })),
    compressionRatio: z.number(),
    totalTokens: z.number(),
    selectedTokens: z.number(),
    cumulativeAttention: z.number(),
  }),
});

// ============================================================================
// Router
// ============================================================================

export const kvCacheApiRouter = router({
  /**
   * Compress KV-Cache with metrics
   */
  compress: publicProcedure
    .input(CompressInputSchema)
    .mutation(async ({ input }) => {
      try {
        const compressor = createProductionCompressor(input.modelName, input.options);
        
        const { compressed, metrics } = compressor.compressWithMetrics(
          input.keys,
          input.values,
          input.queries
        );
        
        return {
          success: true,
          compressed,
          metrics,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Compression failed: ${error.message}`,
        });
      }
    }),
  
  /**
   * Decompress KV-Cache
   */
  decompress: publicProcedure
    .input(DecompressInputSchema)
    .mutation(async ({ input }) => {
      try {
        const compressor = new ProductionKVCacheCompressor('gpt-4'); // Model doesn't matter for decompression
        
        const { keys, values } = compressor.decompress(
          input.compressed,
          input.originalLength
        );
        
        return {
          success: true,
          keys,
          values,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Decompression failed: ${error.message}`,
        });
      }
    }),
  
  /**
   * Validate compression quality
   */
  validateQuality: publicProcedure
    .input(ValidateQualityInputSchema)
    .query(async ({ input }) => {
      try {
        const compressor = new ProductionKVCacheCompressor(input.modelName);
        const quality = compressor.validateQuality(input.compressed);
        
        return {
          success: true,
          quality,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Quality validation failed: ${error.message}`,
        });
      }
    }),
  
  /**
   * Run compression benchmark
   */
  benchmark: publicProcedure
    .input(BenchmarkInputSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await benchmarkCompression(
          input.modelName,
          input.numTokens,
          input.dimension,
          input.iterations
        );
        
        return {
          success: true,
          result,
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Benchmark failed: ${error.message}`,
        });
      }
    }),
  
  /**
   * Get supported models and their adapters
   */
  getSupportedModels: publicProcedure
    .query(async () => {
      const models = Object.entries(MODEL_ADAPTERS).map(([name, adapter]) => ({
        name,
        family: adapter.modelFamily,
        attentionType: adapter.attentionType,
        recommendedThreshold: adapter.recommendedThreshold,
        windowSize: adapter.windowSize,
        sparsityPattern: adapter.sparsityPattern,
      }));
      
      return {
        success: true,
        models,
        totalCount: models.length,
      };
    }),
  
  /**
   * Get model adapter details
   */
  getModelAdapter: publicProcedure
    .input(z.object({ modelName: z.string() }))
    .query(async ({ input }) => {
      const compressor = new ProductionKVCacheCompressor(input.modelName);
      const adapter = compressor.getModelAdapter();
      
      return {
        success: true,
        adapter: {
          modelFamily: adapter.modelFamily,
          attentionType: adapter.attentionType,
          recommendedThreshold: adapter.recommendedThreshold,
          windowSize: adapter.windowSize,
          sparsityPattern: adapter.sparsityPattern,
        },
      };
    }),
  
  /**
   * Estimate bandwidth savings without actual compression
   */
  estimateSavings: publicProcedure
    .input(z.object({
      modelName: z.string(),
      numTokens: z.number().int().positive(),
      dimension: z.number().int().positive(),
      attentionThreshold: z.number().min(0).max(1).optional(),
    }))
    .query(async ({ input }) => {
      try {
        const compressor = createProductionCompressor(input.modelName, {
          attentionThreshold: input.attentionThreshold,
        });
        
        // Generate dummy data for estimation
        const keys: number[][] = [];
        const values: number[][] = [];
        const queries: number[][] = [];
        
        for (let i = 0; i < input.numTokens; i++) {
          keys.push(Array.from({ length: input.dimension }, () => Math.random() * 2 - 1));
          values.push(Array.from({ length: input.dimension }, () => Math.random() * 2 - 1));
        }
        
        for (let i = 0; i < 5; i++) {
          queries.push(Array.from({ length: input.dimension }, () => Math.random() * 2 - 1));
        }
        
        const { compressed, metrics } = compressor.compressWithMetrics(keys, values, queries);
        
        return {
          success: true,
          estimate: {
            compressionRatio: metrics.compressionRatio,
            tokenSavings: metrics.tokenSavings,
            bandwidthSavingsBytes: metrics.bandwidthSavingsBytes,
            bandwidthSavingsPercent: metrics.bandwidthSavingsPercent,
            estimatedAttentionCoverage: metrics.cumulativeAttention,
          },
        };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Estimation failed: ${error.message}`,
        });
      }
    }),
  
  /**
   * Get compression statistics for a model
   */
  getCompressionStats: publicProcedure
    .input(z.object({ modelName: z.string() }))
    .query(async ({ input }) => {
      // Run quick benchmark to get stats
      const result = await benchmarkCompression(input.modelName, 100, 128, 3);
      
      return {
        success: true,
        stats: {
          modelName: result.modelName,
          avgCompressionTimeMs: result.compressionTimeMs,
          avgDecompressionTimeMs: result.decompressionTimeMs,
          avgCompressionRatio: result.compressionRatio,
          avgBandwidthSavings: result.bandwidthSavingsPercent,
          avgAttentionCoverage: result.attentionCoverage,
          qualityPassed: result.qualityPassed,
        },
      };
    }),
});
