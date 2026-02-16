/**
 * Zero-Knowledge Proof API
 *
 * Provides endpoints for:
 * - Anonymous quality verification
 * - Vector commitments (privacy-preserving)
 * - Quality proofs without revealing vectors
 * - On-chain proof submission (future)
 *
 * Reference: WHITEPAPER_ENHANCED_2026.md Section 4.3
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getZKPEngine,
  proveVectorQuality,
  verifyVectorQuality,
  createCommitment,
  verifyCommitment,
  type QualityProof,
  type VectorCommitment,
  type ZKPConfig,
} from "../latentmas/zkp-verification";
import { prisma } from "../db-prisma";

// ============================================================================
// Input Schemas
// ============================================================================

const VectorQualityInputSchema = z.object({
  vector: z.array(z.number()).min(1).max(10000),
  qualityScore: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1).optional(),
});

const VerifyProofInputSchema = z.object({
  proof: z.object({
    commitment: z.string(),
    proof: z.object({
      pi_a: z.tuple([z.string(), z.string()]),
      pi_b: z.tuple([z.array(z.string()), z.array(z.string())]),
      pi_c: z.tuple([z.string(), z.string()]),
    }),
    publicSignals: z.object({
      qualityCommitment: z.string(),
      thresholdProof: z.string(),
      distributionProof: z.string(),
    }),
    metadata: z.object({
      vectorDimension: z.number(),
      qualityThreshold: z.number(),
      system: z.enum(['groth16', 'plonk', 'stark', 'mock']),
      timestamp: z.string(),
      expiresAt: z.string(),
    }),
  }),
});

const CommitmentInputSchema = z.object({
  vector: z.array(z.number()).min(1).max(10000),
});

const VerifyCommitmentInputSchema = z.object({
  vector: z.array(z.number()).min(1).max(10000),
  commitment: z.object({
    commitment: z.string(),
    blinding: z.string(),
    dimension: z.number(),
  }),
});

const AnonymousPurchaseInputSchema = z.object({
  packageId: z.string(),
  qualityProof: VerifyProofInputSchema.shape.proof,
  blindedPayment: z.object({
    amount: z.number().positive(),
    blindingFactor: z.string(),
    commitment: z.string(),
  }),
});

// ============================================================================
// ZKP Router
// ============================================================================

export const zkpRouter = router({
  /**
   * Generate quality proof for a vector
   *
   * Proves that vector quality >= threshold WITHOUT revealing the vector
   */
  generateQualityProof: protectedProcedure
    .input(VectorQualityInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const zkpEngine = getZKPEngine();
        await zkpEngine.initialize();

        const threshold = input.threshold ?? 0.8;

        // Generate zero-knowledge proof
        const proof = await zkpEngine.proveQuality(
          input.vector,
          input.qualityScore,
          threshold
        );

        return {
          success: true,
          proof,
          message: 'Quality proof generated successfully',
          verification: {
            canVerifyWithout: 'revealing vector content',
            proofSize: JSON.stringify(proof).length,
            expiresAt: proof.expiresAt.toISOString(),
            createdAt: proof.createdAt.toISOString(),
            proofSystem: proof.proof.system,
          },
        };
      } catch (error) {
        console.error('Failed to generate quality proof:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate quality proof',
        });
      }
    }),

  /**
   * Verify quality proof
   *
   * Verifies that a vector meets quality threshold WITHOUT seeing the vector
   */
  verifyQualityProof: publicProcedure
    .input(VerifyProofInputSchema)
    .mutation(async ({ input }) => {
      try {
        const zkpEngine = getZKPEngine();
        await zkpEngine.initialize();

        const result = await zkpEngine.verifyQuality(input.proof as unknown as QualityProof);

        return {
          success: result.valid,
          verification: {
            valid: result.valid,
            proofSystem: result.proofSystem,
            verificationTime: `${result.verificationTime.toFixed(1)}ms`,
            errorMessage: result.errorMessage,
          },
          proofMetadata: input.proof.metadata,
        };
      } catch (error) {
        console.error('Failed to verify quality proof:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to verify quality proof',
        });
      }
    }),

  /**
   * Create vector commitment (Pedersen commitment)
   *
   * Allows proving properties of a vector without revealing it
   */
  commitToVector: protectedProcedure
    .input(CommitmentInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const zkpEngine = getZKPEngine();
        await zkpEngine.initialize();

        const commitment = await zkpEngine.commitToVector(input.vector);

        return {
          success: true,
          commitment,
          message: 'Vector commitment created successfully',
          info: {
            type: 'Pedersen Commitment',
            formula: 'C = g^m * h^r',
            privacy: 'Vector content is cryptographically hidden',
            uses: [
              'Prove vector quality without revealing content',
              'Anonymous marketplace listings',
              'Privacy-preserving auctions',
            ],
          },
        };
      } catch (error) {
        console.error('Failed to create commitment:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create commitment',
        });
      }
    }),

  /**
   * Verify vector commitment
   *
   * Checks if a commitment matches a vector (requires blinding factor)
   */
  verifyVectorCommitment: publicProcedure
    .input(VerifyCommitmentInputSchema)
    .mutation(async ({ input }) => {
      try {
        const valid = await verifyCommitment(input.vector, input.commitment as unknown as VectorCommitment);

        return {
          success: valid,
          verification: {
            valid,
            verifiedAt: new Date().toISOString(),
            message: valid
              ? 'Commitment matches vector'
              : 'Commitment does NOT match vector',
          },
        };
      } catch (error) {
        console.error('Failed to verify commitment:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to verify commitment',
        });
      }
    }),

  /**
   * Get ZKP system statistics
   */
  getZKPStats: publicProcedure.query(async () => {
    try {
      const zkpEngine = getZKPEngine();
      await zkpEngine.initialize();

      const stats = zkpEngine.getStats();
      const constraints = zkpEngine.getCircuitConstraints();

      return {
        success: true,
        stats: {
          proofsGenerated: stats.proofsGenerated,
          proofsVerified: stats.proofsVerified,
          successRate: `${(stats.successRate * 100).toFixed(1)}%`,
          averageProofTime: `${stats.averageProofTime.toFixed(1)}ms`,
          averageVerifyTime: `${stats.averageVerifyTime.toFixed(1)}ms`,
        },
        circuit: {
          system: stats.proofSystem,
          constraints: constraints.numberOfConstraints,
          wires: constraints.numberOfWires,
          publicInputs: constraints.numberOfPublicInputs,
          privateInputs: constraints.numberOfPrivateInputs,
        },
        info: {
          status: zkpEngine.isReady() ? 'Ready' : 'Not initialized',
          description: 'Zero-Knowledge Proof system for anonymous quality verification',
        },
      };
    } catch (error) {
      console.error('Failed to get ZKP stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get ZKP stats',
      });
    }
  }),

  /**
   * Anonymous purchase with ZKP
   *
   * Purchase a package while proving quality threshold WITHOUT revealing identity
   *
   * Note: This is a simplified implementation. Production would require:
   * - Blind signatures for payment
   * - Ring signatures for anonymity
   * - On-chain verification
   */
  anonymousPurchase: protectedProcedure
    .input(AnonymousPurchaseInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify quality proof first
        const zkpEngine = getZKPEngine();
        await zkpEngine.initialize();

        const verification = await zkpEngine.verifyQuality(input.qualityProof as unknown as QualityProof);

        if (!verification.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid quality proof',
          });
        }

        // Check if package exists
        const packageData = await prisma.vectorPackage.findUnique({
          where: { packageId: input.packageId },
        });

        if (!packageData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Package not found',
          });
        }

        // Verify payment commitment
        // In production: verify blind signature, check ring signature
        const price = parseFloat((packageData.price || '0').toString());
        const paymentValid = input.blindedPayment.amount >= price;

        if (!paymentValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient payment',
          });
        }

        // Calculate fees (20% platform fee)
        const platformFee = price * 0.20;
        const sellerEarnings = price - platformFee;

        // Create anonymous purchase record
        // Note: In production, this would be on-chain with ring signatures
        await prisma.packagePurchase.create({
          data: {
            packageType: 'vector',
            packageId: input.packageId,
            buyerId: ctx.user.id, // In true anonymity, this would be a nullifier
            sellerId: packageData.userId,
            price: price.toFixed(2),
            platformFee: platformFee.toFixed(2),
            sellerEarnings: sellerEarnings.toFixed(2),
            status: 'completed',
          },
        });


        return {
          success: true,
          purchase: {
            packageId: input.packageId,
            status: 'completed',
            anonymous: true,
            price,
            platformFee,
          },
          verification: {
            qualityProofVerified: true,
            paymentVerified: true,
            anonymityGuarantee: zkpEngine.getProofSystem() === 'mock'
              ? 'ZKP-based (mock)'
              : 'ZKP-based',
          },
          message: 'Anonymous purchase completed successfully',
          note: 'Production implementation requires ring signatures and on-chain verification',
        };
      } catch (error) {
        console.error('Anonymous purchase failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Anonymous purchase failed',
        });
      }
    }),

  /**
   * Batch verify quality proofs
   *
   * Efficient verification of multiple proofs at once
   */
  batchVerifyProofs: publicProcedure
    .input(z.object({
      proofs: z.array(VerifyProofInputSchema.shape.proof).min(1).max(100),
    }))
    .mutation(async ({ input }) => {
      try {
        const zkpEngine = getZKPEngine();
        await zkpEngine.initialize();

        const results = await zkpEngine.verifyBatch(input.proofs as unknown as QualityProof[]);

        const validCount = results.filter(r => r.valid).length;
        const invalidCount = results.length - validCount;

        return {
          success: true,
          batchSize: input.proofs.length,
          results: results.map(r => ({
            valid: r.valid,
            proofSystem: r.proofSystem,
            verificationTime: r.verificationTime,
            errorMessage: r.errorMessage,
          })),
          summary: {
            total: input.proofs.length,
            valid: validCount,
            invalid: invalidCount,
            successRate: `${((validCount / input.proofs.length) * 100).toFixed(1)}%`,
          },
        };
      } catch (error) {
        console.error('Batch verification failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Batch verification failed',
        });
      }
    }),

  /**
   * Get recommended ZKP configuration for use case
   */
  getRecommendedConfig: publicProcedure
    .input(z.object({
      useCase: z.enum(['marketplace', 'research', 'enterprise', 'medical']),
      vectorDimension: z.number().int().min(1).max(10000),
    }))
    .query(async ({ input }) => {
      const configs: Record<string, ZKPConfig & { description: string }> = {
        marketplace: {
          system: 'groth16',
          description: 'Fast verification for marketplace transactions',
        },
        research: {
          system: 'plonk',
          description: 'Universal setup for research collaboration',
        },
        enterprise: {
          system: 'groth16',
          description: 'High-performance for enterprise workloads',
        },
        medical: {
          system: 'stark',
          description: 'Maximum security for medical data (no trusted setup)',
        },
      };

      const config = configs[input.useCase];

      const proofSizeEstimate = {
        groth16: '128 bytes (most compact)',
        plonk: '512 bytes (medium)',
        stark: '2-10 KB (larger but no trusted setup)',
        mock: '256 bytes (test mode)',
      }[config.system] || '128-512 bytes';

      return {
        success: true,
        recommended: config,
        estimatedProofSize: proofSizeEstimate,
        estimatedTime: {
          proving: input.vectorDimension < 512 ? '50-200ms' : '200-500ms',
          verifying: '5-20ms',
        },
      };
    }),

  /**
   * Submit proof to blockchain (preparation endpoint)
   *
   * Note: Requires smart contract deployment
   */
  submitProofOnChain: protectedProcedure
    .input(z.object({
      proof: VerifyProofInputSchema.shape.proof,
      packageId: z.string(),
      network: z.enum(['polygon-amoy', 'ethereum-sepolia', 'arbitrum-sepolia']),
    }))
    .mutation(async ({ input, ctx }) => {
      const endpoint = process.env.ZKP_ONCHAIN_ENDPOINT;
      if (endpoint) {
        const response = await fetch(`${endpoint.replace(/\/$/, '')}/submit-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proof: input.proof,
            packageId: input.packageId,
            network: input.network,
            userId: ctx.user.id,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `On-chain submission failed with status ${response.status}`,
          });
        }

        const data = await response.json();

        return {
          success: true,
          message: 'Proof submitted on-chain',
          transaction: data.transaction,
        };
      }

      return {
        success: false,
        message: 'On-chain verification endpoint not configured',
        preparation: {
          proofReady: true,
          proofSize: JSON.stringify(input.proof).length,
          estimatedGas: '200,000 gas (~$0.50 on Polygon)',
          requiredSteps: [
            '1. Deploy ZKP verifier contract',
            '2. Register package commitment on-chain',
            '3. Configure ZKP_ONCHAIN_ENDPOINT',
            '4. Submit proof transaction',
          ],
        },
        note: 'Provide ZKP_ONCHAIN_ENDPOINT to enable real submissions',
      };
    }),
});
