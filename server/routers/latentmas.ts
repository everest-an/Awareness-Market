/**
 * LatentMAS v2 tRPC Router
 * 
 * Exposes all 4 v2 enhancement features as API endpoints:
 * 1. KV-Cache Compression
 * 2. Dynamic W-Matrix Alignment
 * 3. Anti-Poisoning Verification
 * 4. Semantic Anchor Standardization
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';

// Import v2 features
import {
  createKVCacheCompressor,
  type CompressedKVCache,
  type KVCacheCompressionOptions,
} from '../latentmas/kv-cache-compressor';

import {
  createDynamicWMatrix,
  DynamicWMatrix,
  type AlignmentResult,
} from '../latentmas/dynamic-w-matrix';

import {
  createAntiPoisoningVerifier,
  createChallengeResponse,
  type Challenge,
  type ChallengeResponse,
  type VerificationResult,
} from '../latentmas/anti-poisoning';

import {
  createSemanticAnchorDB,
  type SemanticAnchor,
  type AnchorMatchResult,
  type AlignmentCalibration,
  SEMANTIC_CATEGORIES,
} from '../latentmas/semantic-anchors';

import {
  embeddingService,
  buildLatentMASPackage,
  type EmbeddingModel,
  type LatentMASPackageInput,
} from '../latentmas/embedding-service';

// Initialize global instances
const semanticAnchorDB = createSemanticAnchorDB();

// In-memory storage for challenges and matrices (in production, use database)
const activeChallenges = new Map<string, Challenge>();
const wMatrices = new Map<string, DynamicWMatrix>();

/**
 * LatentMAS v2 Router
 */
export const latentmasRouter = router({
  // ============================================================
  // KV-Cache Compression Endpoints
  // ============================================================

  kvCache: router({
    /**
     * Compress KV-Cache using attention-based selection
     */
    compress: publicProcedure
      .input(
        z.object({
          keys: z.array(z.array(z.number())),
          values: z.array(z.array(z.number())),
          queries: z.array(z.array(z.number())),
          config: z
            .object({
              attentionThreshold: z.number().min(0).max(1).optional(),
              minTokens: z.number().int().positive().optional(),
              maxTokens: z.number().int().positive().optional(),
            })
            .optional() as z.ZodOptional<z.ZodType<Partial<KVCacheCompressionOptions>>>,
        })
      )
      .mutation(async ({ input }) => {
        try {
          const compressor = createKVCacheCompressor(input.config);
          const compressed = compressor.compress(
            input.keys,
            input.values,
            input.queries
          );

          return {
            success: true,
            compressed,
            stats: {
              originalTokens: input.keys.length,
              compressedTokens: compressed.selectedTokens,
              compressionRatio: compressed.compressionRatio,
              cumulativeAttention: compressed.cumulativeAttention,
            },
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `KV-Cache compression failed: ${error}`,
          });
        }
      }),

    /**
     * Decompress KV-Cache back to original size
     */
    decompress: publicProcedure
      .input(
        z.object({
          compressed: z.any(), // CompressedKVCache type
          originalLength: z.number().int().positive(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const compressor = createKVCacheCompressor();
          const { keys, values } = compressor.decompress(
            input.compressed,
            input.originalLength
          );

          return {
            success: true,
            keys,
            values,
            stats: {
              originalLength: input.originalLength,
              decompressedLength: keys.length,
            },
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `KV-Cache decompression failed: ${error}`,
          });
        }
      }),

    /**
     * Estimate bandwidth savings
     */
    estimateBandwidth: publicProcedure
      .input(
        z.object({
          compressed: z.any(), // CompressedKVCache type
          originalLength: z.number().int().positive(),
          vectorDimension: z.number().int().positive(),
        })
      )
      .query(async ({ input }) => {
        try {
          const compressor = createKVCacheCompressor();
          const bandwidth = compressor.estimateBandwidthSavings(
            input.compressed
          );

          return {
            success: true,
            bandwidth,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Bandwidth estimation failed: ${error}`,
          });
        }
      }),
  }),

  // ============================================================
  // Dynamic W-Matrix Alignment Endpoints
  // ============================================================

  wMatrix: router({
    /**
     * Create a new W-Matrix for cross-model alignment
     */
    create: protectedProcedure
      .input(
        z.object({
          sourceModel: z.string(),
          targetModel: z.string(),
          sourceDim: z.number().int().positive(),
          targetDim: z.number().int().positive(),
          activation: z
            .enum(['relu', 'tanh', 'sigmoid', 'gelu'])
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const matrix = createDynamicWMatrix(
            input.sourceModel,
            input.targetModel,
            input.sourceDim,
            input.targetDim
          );

          // Generate unique ID and store
          const matrixId = `${ctx.user.id}-${Date.now()}`;
          wMatrices.set(matrixId, matrix);

          return {
            success: true,
            matrixId,
            metadata: {
              sourceModel: input.sourceModel,
              targetModel: input.targetModel,
              sourceDim: input.sourceDim,
              targetDim: input.targetDim,
              architecture: matrix.getMetadata().architecture,
            },
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `W-Matrix creation failed: ${error}`,
          });
        }
      }),

    /**
     * Align a vector using W-Matrix
     */
    align: publicProcedure
      .input(
        z.object({
          matrixId: z.string().optional(),
          vector: z.array(z.number()),
          sourceModel: z.string().optional(),
          targetModel: z.string().optional(),
          sourceDim: z.number().int().positive().optional(),
          targetDim: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          let matrix: DynamicWMatrix | undefined;

          if (input.matrixId) {
            // Use existing matrix
            matrix = wMatrices.get(input.matrixId);
            if (!matrix) {
              throw new Error(`Matrix ${input.matrixId} not found`);
            }
          } else if (
            input.sourceModel &&
            input.targetModel &&
            input.sourceDim &&
            input.targetDim
          ) {
            // Create temporary matrix
            matrix = createDynamicWMatrix(
              input.sourceModel!,
              input.targetModel!,
              input.sourceDim!,
              input.targetDim!
            );
          } else {
            throw new Error(
              'Either matrixId or (sourceModel, targetModel, sourceDim, targetDim) must be provided'
            );
          }

          if (!matrix) {
            throw new Error('Matrix not found or could not be created');
          }

          const result = matrix.align(input.vector);

          return {
            success: true,
            result,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Vector alignment failed: ${error}`,
          });
        }
      }),

    /**
     * Serialize W-Matrix for storage
     */
    serialize: publicProcedure
      .input(
        z.object({
          matrixId: z.string(),
        })
      )
      .query(async ({ input }) => {
        try {
          const matrix = wMatrices.get(input.matrixId);
          if (!matrix) {
            throw new Error(`Matrix ${input.matrixId} not found`);
          }

          const serialized = matrix.serialize();

          return {
            success: true,
            serialized,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Matrix serialization failed: ${error}`,
          });
        }
      }),

    /**
     * Deserialize and load W-Matrix
     */
    deserialize: protectedProcedure
      .input(
        z.object({
          serialized: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const matrix = DynamicWMatrix.deserialize(input.serialized);

          // Generate unique ID and store
          const matrixId = `${ctx.user.id}-${Date.now()}`;
          wMatrices.set(matrixId, matrix);

          return {
            success: true,
            matrixId,
            metadata: matrix.getMetadata(),
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Matrix deserialization failed: ${error}`,
          });
        }
      }),
  }),

  // ============================================================
  // Anti-Poisoning Verification Endpoints
  // ============================================================

  antiPoisoning: router({
    /**
     * Generate a verification challenge
     */
    generateChallenge: publicProcedure
      .input(
        z.object({
          config: z
            .object({
              fidelityThreshold: z.number().min(0).max(1).optional(),
              anomalyThreshold: z.number().min(0).max(1).optional(),
              challengeSize: z.number().int().positive().optional(),
              timeoutMs: z.number().int().positive().optional(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const verifier = createAntiPoisoningVerifier(input.config);
          const challenge = verifier.generateChallenge();

          // Store challenge
          activeChallenges.set(challenge.id, challenge);

          // Auto-cleanup after timeout
          setTimeout(
            () => {
              activeChallenges.delete(challenge.id);
            },
            input.config?.timeoutMs || 300000
          );

          return {
            success: true,
            challenge: {
              id: challenge.id,
              testPrompts: challenge.testPrompts,
              nonce: challenge.nonce,
              expiresAt: challenge.expiresAt,
            },
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Challenge generation failed: ${error}`,
          });
        }
      }),

    /**
     * Verify a challenge response
     */
    verify: publicProcedure
      .input(
        z.object({
          challengeId: z.string(),
          vectorOutputs: z.array(z.array(z.number())),
          nonce: z.string(),
          config: z
            .object({
              fidelityThreshold: z.number().min(0).max(1).optional(),
              anomalyThreshold: z.number().min(0).max(1).optional(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const verifier = createAntiPoisoningVerifier(input.config);

          // Create response
          const response = createChallengeResponse(
            input.challengeId,
            input.vectorOutputs,
            input.nonce
          );

          // Verify
          const result = verifier.verify(response);

          // Clean up challenge if verification passed
          if (result.passed) {
            activeChallenges.delete(input.challengeId);
          }

          return {
            success: true,
            result,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Verification failed: ${error}`,
          });
        }
      }),

    /**
     * Get challenge details
     */
    getChallenge: publicProcedure
      .input(
        z.object({
          challengeId: z.string(),
        })
      )
      .query(async ({ input }) => {
        const challenge = activeChallenges.get(input.challengeId);

        if (!challenge) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Challenge not found or expired',
          });
        }

        return {
          success: true,
          challenge: {
            id: challenge.id,
            testPrompts: challenge.testPrompts,
            expiresAt: challenge.expiresAt,
          },
        };
      }),
  }),

  // ============================================================
  // Semantic Anchor Standardization Endpoints
  // ============================================================

  semanticAnchors: router({
    /**
     * Get all 1024 golden anchors
     */
    getAll: publicProcedure.query(async () => {
      try {
        const anchors = semanticAnchorDB.getAllAnchors();

        return {
          success: true,
          anchors,
          stats: semanticAnchorDB.getStatistics(),
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get anchors: ${error}`,
        });
      }
    }),

    /**
     * Get anchors by semantic category
     */
    getByCategory: publicProcedure
      .input(
        z.object({
          category: z.enum(SEMANTIC_CATEGORIES as any),
        })
      )
      .query(async ({ input }) => {
        try {
          const anchors = semanticAnchorDB.getAnchorsByCategory(
            input.category
          );

          return {
            success: true,
            category: input.category,
            anchors,
            count: anchors.length,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to get anchors by category: ${error}`,
          });
        }
      }),

    /**
     * Find nearest anchors to a vector
     */
    findNearest: publicProcedure
      .input(
        z.object({
          vector: z.array(z.number()),
          topK: z.number().int().positive().optional().default(10),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const nearest = semanticAnchorDB.findNearestAnchors(
            input.vector,
            input.topK
          );

          return {
            success: true,
            nearest,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to find nearest anchors: ${error}`,
          });
        }
      }),

    /**
     * Calibrate vector alignment quality
     */
    calibrate: publicProcedure
      .input(
        z.object({
          vector: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const calibration = semanticAnchorDB.calibrateAlignment(
            input.vector
          );

          return {
            success: true,
            calibration,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Calibration failed: ${error}`,
          });
        }
      }),

    /**
     * Store anchor vector for future similarity searches
     */
    storeAnchorVector: protectedProcedure
      .input(
        z.object({
          anchorId: z.number().int().min(0).max(1023),
          vector: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        try {
          semanticAnchorDB.storeAnchorVector(input.anchorId, input.vector);

          return {
            success: true,
            anchorId: input.anchorId,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to store anchor vector: ${error}`,
          });
        }
      }),

    /**
     * Get semantic categories
     */
    getCategories: publicProcedure.query(async () => {
      return {
        success: true,
        categories: SEMANTIC_CATEGORIES,
      };
    }),

    /**
     * Get statistics about anchor database
     */
    getStatistics: publicProcedure.query(async () => {
      try {
        const stats = semanticAnchorDB.getStatistics();

        return {
          success: true,
          stats,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get statistics: ${error}`,
        });
      }
    }),
  }),

  // ============================================================
  // Embedding & LatentMAS Package Endpoints
  // ============================================================

  embedding: router({
    /**
     * Generate embedding from text
     * 调用真实的 OpenAI embedding API 或本地生成
     */
    generate: publicProcedure
      .input(
        z.object({
          text: z.string().min(1).max(8192),
          model: z.enum([
            "text-embedding-3-large",
            "text-embedding-3-small",
            "text-embedding-ada-002",
            "local-minilm",
            "local-bge-large",
          ]).optional().default("text-embedding-3-small"),
          dimensions: z.number().int().positive().max(3072).optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await embeddingService.embed({
            text: input.text,
            model: input.model as EmbeddingModel,
            dimensions: input.dimensions,
          });

          return {
            success: true,
            ...result,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Embedding generation failed: ${error}`,
          });
        }
      }),

    /**
     * Batch generate embeddings
     */
    generateBatch: publicProcedure
      .input(
        z.object({
          texts: z.array(z.string().min(1).max(8192)).max(100),
          model: z.enum([
            "text-embedding-3-large",
            "text-embedding-3-small",
            "text-embedding-ada-002",
            "local-minilm",
            "local-bge-large",
          ]).optional().default("text-embedding-3-small"),
          dimensions: z.number().int().positive().max(3072).optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await embeddingService.embedBatch({
            texts: input.texts,
            model: input.model as EmbeddingModel,
            dimensions: input.dimensions,
          });

          return {
            success: true,
            ...result,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Batch embedding generation failed: ${error}`,
          });
        }
      }),
  }),

  /**
   * Build complete LatentMAS Package
   * 完整工作流：文本/向量 → Embedding → W-Matrix 对齐 → 压缩 → 输出可交易的 Package
   */
  buildPackage: publicProcedure
    .input(
      z.object({
        text: z.string().max(8192).optional(),
        vector: z.array(z.number()).optional(),
        sourceModel: z.string(),
        targetModel: z.string(),
        alignmentMethod: z.enum(["orthogonal", "learned", "hybrid"]).optional().default("orthogonal"),
        enableCompression: z.boolean().optional().default(false),
        compressionRatio: z.number().min(0.1).max(1).optional().default(0.65),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // 创建对齐函数
        const alignFunction = async (
          vector: number[],
          sourceModel: string,
          targetModel: string,
          sourceDim: number,
          targetDim: number
        ) => {
          const matrix = createDynamicWMatrix(sourceModel, targetModel, sourceDim, targetDim);
          const result = matrix.align(vector);
          return { success: true, result };
        };

        const packageInput: LatentMASPackageInput = {
          text: input.text,
          vector: input.vector,
          sourceModel: input.sourceModel,
          targetModel: input.targetModel,
          alignmentMethod: input.alignmentMethod,
          enableCompression: input.enableCompression,
          compressionRatio: input.compressionRatio,
        };

        const latentmasPackage = await buildLatentMASPackage(
          packageInput,
          embeddingService,
          alignFunction
        );

        return {
          success: true,
          package: latentmasPackage,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Package build failed: ${error}`,
        });
      }
    }),
});
