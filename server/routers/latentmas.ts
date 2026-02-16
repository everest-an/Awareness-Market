/**
 * LatentMAS v2.1 tRPC Router
 * 
 * Exposes all v2 enhancement features + TRUE LatentMAS paper implementation:
 * 1. KV-Cache Compression
 * 2. Dynamic W-Matrix Alignment
 * 3. Anti-Poisoning Verification
 * 4. Semantic Anchor Standardization
 * 5. TRUE Wa Alignment Operator (Ridge Regression)
 * 6. Latent Rollout Engine (Autoregressive Latent Space Inference)
 * 7. Cross-Agent KV-Cache Transfer
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

// Import TRUE LatentMAS paper implementation
import {
  computeWaOperator,
  executeLatentRollout,
  createEmptyKVCache,
  mergeKVCaches,
  generateSimulatedModelWeights,
  type WaOperator,
  type KVCacheState,
  type LatentRolloutResult,
  type WaOperatorConfig,
} from '../latentmas/wa-alignment-operator';

import {
  latentRolloutEngine,
  type CompiledLatentPackage,
  type AgentState,
} from '../latentmas/latent-rollout-engine';

// Initialize global instances
const semanticAnchorDB = createSemanticAnchorDB();

// Zod schemas for CompressedKVCache type validation
const KVCacheEntrySchema = z.object({
  key: z.array(z.number()),
  value: z.array(z.number()),
  tokenIndex: z.number().int(),
  attentionWeight: z.number(),
});

const CompressedKVCacheSchema = z.object({
  entries: z.array(KVCacheEntrySchema),
  compressionRatio: z.number(),
  totalTokens: z.number().int(),
  selectedTokens: z.number().int(),
  cumulativeAttention: z.number(),
});

// In-memory storage for challenges and matrices (in production, use database)
const activeChallenges = new Map<string, Challenge>();
const wMatrices = new Map<string, DynamicWMatrix>();

// Storage for TRUE LatentMAS Wa operators and agent states
const waOperators = new Map<string, WaOperator>();
const agentStates = new Map<string, AgentState>();
const compiledPackages = new Map<string, CompiledLatentPackage>();

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
          compressed: CompressedKVCacheSchema,
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
          compressed: CompressedKVCacheSchema,
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
          category: z.enum(SEMANTIC_CATEGORIES as unknown as [string, ...string[]]),
        })
      )
      .query(async ({ input }) => {
        try {
          const anchors = semanticAnchorDB.getAnchorsByCategory(
            input.category as any
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

  // ============================================================
  // TRUE LatentMAS Paper Implementation (v2.1)
  // 基于论文规范的真正实现：
  // - Wa 对齐算子（岭回归）
  // - 潜空间滚动（Latent Rollout）
  // - 跨智能体 KV-Cache 传递
  // ============================================================

  trueLatentMAS: router({
    /**
     * 计算 Wa 对齐算子
     * 
     * 论文公式：Wa ≈ (W_out^T × W_out + λI)^(-1) × W_out^T × W_in
     * 
     * 这是 LatentMAS 的核心创新：通过岭回归从模型权重计算对齐矩阵，
     * 将输出空间的隐藏状态映射回输入嵌入空间的有效区域。
     */
    computeWaOperator: publicProcedure
      .input(
        z.object({
          modelName: z.string(),
          ridgeLambda: z.number().min(0.0001).max(1).optional().default(0.01),
          vocabSize: z.number().int().positive().optional().default(32000),
          hiddenDim: z.number().int().positive().optional().default(4096),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const startTime = Date.now();
          
          // 生成模拟权重（实际应从 HuggingFace 模型加载）
          // W_in = model.embed_tokens.weight
          // W_out = model.lm_head.weight
          const { wIn, wOut } = generateSimulatedModelWeights(
            input.vocabSize,
            input.hiddenDim
          );

          // 计算 Wa 算子
          const waOperator = computeWaOperator(
            wIn,
            wOut,
            {
              ridgeLambda: input.ridgeLambda,
              inputDim: input.hiddenDim,
              outputDim: input.hiddenDim,
              enableDriftProtection: true,
              driftThreshold: 0.5,
            },
            input.modelName
          );

          // 缓存 Wa 算子
          const operatorId = `${input.modelName}-${Date.now()}`;
          waOperators.set(operatorId, waOperator);

          return {
            success: true,
            operatorId,
            metadata: waOperator.metadata,
            config: waOperator.config,
            processingTimeMs: Date.now() - startTime,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Wa operator computation failed: ${error}`,
          });
        }
      }),

    /**
     * 文本到潜空间编译
     * 
     * 完整流程：
     * 1. Tokenization
     * 2. 初始 forward 获取 h_0 和 KV-Cache
     * 3. 潜空间滚动（Latent Rollout）
     * 4. 封装为可传递的 Package
     * 
     * 论文核心：e_{t+1} = h_t × Wa 自回归循环
     */
    compileTextToLatent: publicProcedure
      .input(
        z.object({
          text: z.string().min(1).max(8192),
          sourceModel: z.string().optional().default('qwen3-14b'),
          latentSteps: z.number().int().min(0).max(80).optional().default(20),
          enableRealign: z.boolean().optional().default(true),
          ridgeLambda: z.number().min(0.0001).max(1).optional().default(0.01),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const compiledPackage = await latentRolloutEngine.compileTextToLatent(
            input.text,
            {
              latentSteps: input.latentSteps,
              latentSpaceRealign: input.enableRealign,
              sourceModel: input.sourceModel,
              waConfig: {
                ridgeLambda: input.ridgeLambda,
              },
            }
          );

          // 缓存编译结果
          const packageId = `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          compiledPackages.set(packageId, compiledPackage);

          return {
            success: true,
            packageId,
            protocol: compiledPackage.protocol,
            type: compiledPackage.type,
            sourceModel: compiledPackage.sourceModel,
            latentThoughtDim: compiledPackage.latentThought.length,
            quality: compiledPackage.quality,
            waMetadata: compiledPackage.waMetadata,
            metadata: compiledPackage.metadata,
            signature: compiledPackage.signature,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Text-to-latent compilation failed: ${error}`,
          });
        }
      }),

    /**
     * 执行潜空间滚动（Latent Rollout）
     * 
     * 这是 LatentMAS 的核心推理过程：
     * 1. 从初始隐藏状态 h_0 开始
     * 2. 应用 Wa 对齐：e_{t+1} = h_t × Wa
     * 3. 模拟 forward pass 获取新的 h_{t+1}
     * 4. 重复直到达到指定步数
     */
    executeLatentRollout: publicProcedure
      .input(
        z.object({
          initialHiddenState: z.array(z.number()),
          operatorId: z.string().optional(),
          modelName: z.string().optional().default('qwen3-14b'),
          steps: z.number().int().min(1).max(80).optional().default(20),
          enableDriftProtection: z.boolean().optional().default(true),
          driftThreshold: z.number().min(0.1).max(2).optional().default(0.5),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // 获取或创建 Wa 算子
          let waOperator: WaOperator;
          
          if (input.operatorId && waOperators.has(input.operatorId)) {
            waOperator = waOperators.get(input.operatorId)!;
          } else {
            // 创建新的 Wa 算子
            waOperator = await latentRolloutEngine.initializeWaOperator(
              input.modelName,
              {
                enableDriftProtection: input.enableDriftProtection,
                driftThreshold: input.driftThreshold,
              }
            );
          }

          // 执行潜空间滚动
          const rolloutResult = executeLatentRollout(
            input.initialHiddenState,
            waOperator,
            input.steps
          );

          return {
            success: true,
            latentThought: rolloutResult.latentThought,
            steps: rolloutResult.steps,
            driftMetrics: rolloutResult.driftMetrics,
            processingTimeMs: rolloutResult.processingTimeMs,
            intermediateThoughtsCount: rolloutResult.intermediateThoughts.length,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Latent rollout execution failed: ${error}`,
          });
        }
      }),

    /**
     * 跨智能体状态传递
     * 
     * 实现"数字感应"：智能体 B 直接注入智能体 A 的 KV-Cache
     * 
     * 论文描述：后续智能体直接注入前序智能体的 KV 缓存，
     * 仿佛接管了前者的思考大脑
     */
    transferState: publicProcedure
      .input(
        z.object({
          packageId: z.string(),
          targetModel: z.string(),
          ridgeLambda: z.number().min(0.0001).max(1).optional().default(0.01),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // 获取源 Package
          const sourcePackage = compiledPackages.get(input.packageId);
          if (!sourcePackage) {
            throw new Error(`Package ${input.packageId} not found`);
          }

          // 执行跨智能体状态传递
          const transferredPackage = await latentRolloutEngine.transferState(
            sourcePackage,
            input.targetModel,
            { ridgeLambda: input.ridgeLambda }
          );

          // 缓存传递后的 Package
          const newPackageId = `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          compiledPackages.set(newPackageId, transferredPackage);

          return {
            success: true,
            packageId: newPackageId,
            sourceModel: transferredPackage.sourceModel,
            targetModel: transferredPackage.targetModel,
            quality: transferredPackage.quality,
            metadata: transferredPackage.metadata,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `State transfer failed: ${error}`,
          });
        }
      }),

    /**
     * 创建智能体状态
     */
    createAgentState: protectedProcedure
      .input(
        z.object({
          agentId: z.string(),
          modelType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // 初始化 Wa 算子
          const waOperator = await latentRolloutEngine.initializeWaOperator(input.modelType);

          // 创建智能体状态
          const state = latentRolloutEngine.createAgentState(
            input.agentId,
            input.modelType,
            waOperator
          );

          agentStates.set(input.agentId, state);

          return {
            success: true,
            agentId: state.agentId,
            modelType: state.modelType,
            kvCacheSequenceLength: state.kvCache.sequenceLength,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Agent state creation failed: ${error}`,
          });
        }
      }),

    /**
     * 获取智能体状态
     */
    getAgentState: publicProcedure
      .input(
        z.object({
          agentId: z.string(),
        })
      )
      .query(async ({ input }) => {
        const state = agentStates.get(input.agentId);
        if (!state) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Agent ${input.agentId} not found`,
          });
        }

        return {
          success: true,
          agentId: state.agentId,
          modelType: state.modelType,
          currentLatentThoughtDim: state.currentLatentThought.length,
          kvCacheSequenceLength: state.kvCache.sequenceLength,
          inferenceHistoryCount: state.inferenceHistory.length,
        };
      }),

    /**
     * 合并两个智能体的 KV-Cache
     * 
     * 这是实现"数字感应"的关键：
     * 智能体 B 直接注入智能体 A 的 KV-Cache
     */
    mergeAgentKVCaches: publicProcedure
      .input(
        z.object({
          agentIdA: z.string(),
          agentIdB: z.string(),
          useWaAlignment: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const stateA = agentStates.get(input.agentIdA);
          const stateB = agentStates.get(input.agentIdB);

          if (!stateA || !stateB) {
            throw new Error('One or both agents not found');
          }

          // 合并 KV-Cache
          const mergedKVCache = mergeKVCaches(
            stateA.kvCache,
            stateB.kvCache,
            input.useWaAlignment ? stateA.waOperator : undefined
          );

          return {
            success: true,
            mergedSequenceLength: mergedKVCache.sequenceLength,
            sourceASequenceLength: stateA.kvCache.sequenceLength,
            sourceBSequenceLength: stateB.kvCache.sequenceLength,
            numLayers: mergedKVCache.numLayers,
            numHeads: mergedKVCache.numHeads,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `KV-Cache merge failed: ${error}`,
          });
        }
      }),

    /**
     * 获取编译后的 Package 详情
     */
    getCompiledPackage: publicProcedure
      .input(
        z.object({
          packageId: z.string(),
          includeLatentThought: z.boolean().optional().default(false),
          includeIntermediateThoughts: z.boolean().optional().default(false),
        })
      )
      .query(async ({ input }) => {
        const pkg = compiledPackages.get(input.packageId);
        if (!pkg) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Package ${input.packageId} not found`,
          });
        }

        return {
          success: true,
          protocol: pkg.protocol,
          type: pkg.type,
          sourceModel: pkg.sourceModel,
          targetModel: pkg.targetModel,
          inputText: pkg.inputText,
          latentThought: input.includeLatentThought ? pkg.latentThought : undefined,
          latentThoughtDim: pkg.latentThought.length,
          intermediateThoughts: input.includeIntermediateThoughts ? pkg.intermediateThoughts : undefined,
          intermediateThoughtsCount: pkg.intermediateThoughts?.length || 0,
          quality: pkg.quality,
          waMetadata: pkg.waMetadata,
          metadata: pkg.metadata,
          signature: pkg.signature,
        };
      }),

    /**
     * 获取支持的模型列表及其维度配置
     */
    getSupportedModels: publicProcedure.query(async () => {
      return {
        success: true,
        models: [
          { name: 'qwen3-4b', vocabSize: 151936, hiddenDim: 2560, numLayers: 36, numHeads: 20 },
          { name: 'qwen3-8b', vocabSize: 151936, hiddenDim: 4096, numLayers: 36, numHeads: 32 },
          { name: 'qwen3-14b', vocabSize: 151936, hiddenDim: 5120, numLayers: 40, numHeads: 40 },
          { name: 'llama-3-8b', vocabSize: 128256, hiddenDim: 4096, numLayers: 32, numHeads: 32 },
          { name: 'llama-3-70b', vocabSize: 128256, hiddenDim: 8192, numLayers: 80, numHeads: 64 },
          { name: 'gpt-4', vocabSize: 100277, hiddenDim: 8192, numLayers: 96, numHeads: 64 },
          { name: 'claude-3', vocabSize: 100000, hiddenDim: 8192, numLayers: 80, numHeads: 64 },
        ],
        paperReference: 'LatentMAS: Latent Collaboration in Multi-Agent Systems',
        protocolVersion: 'LatentMAS/2.1',
      };
    }),

    /**
     * 获取 LatentMAS 论文规范说明
     */
    getPaperSpec: publicProcedure.query(async () => {
      return {
        success: true,
        spec: {
          waOperator: {
            formula: 'Wa ≈ (W_out^T × W_out + λI)^(-1) × W_out^T × W_in',
            description: '通过岭回归从模型权重计算对齐矩阵，将输出空间的隐藏状态映射回输入嵌入空间的有效区域',
            parameters: {
              W_in: 'model.embed_tokens.weight - 输入嵌入矩阵',
              W_out: 'model.lm_head.weight - 输出头矩阵',
              lambda: '岭回归正则化参数，防止矩阵奇异',
            },
          },
          latentRollout: {
            formula: 'e_{t+1} = h_t × Wa',
            description: '自回归潜空间滚动，将隐藏状态通过 Wa 对齐后作为下一步的输入嵌入',
            steps: '论文建议 0-80 步',
            driftProtection: '防止激活漂移（Activation Drift）',
          },
          kvCacheTransfer: {
            description: '跨智能体 KV-Cache 传递，实现"数字感应"',
            mechanism: '后续智能体直接注入前序智能体的 past_key_values',
          },
          memoryTypes: {
            latentWorkingMemory: 'Transformer 各层的 past_key_values（KV 缓存）',
            latentThoughts: '最后一层的隐藏状态 h_t，代表模型当前的即时思考结果',
          },
        },
      };
    }),
  }),
});
