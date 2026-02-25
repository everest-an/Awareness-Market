import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "../db-prisma";

export const alignmentRouter = router({
  calculate: publicProcedure
    .input(z.object({
      vectorData: z.array(z.number()),
      wMatrixVersion: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { alignmentService } = await import('../alignment/alignment-service');
      const result = await alignmentService.computeAlignment(
        JSON.stringify(input.vectorData),
        input.wMatrixVersion
      );

      try {
        await prisma.$executeRaw`
          INSERT INTO alignment_calculations (vector_id, w_matrix_version, epsilon_value, fidelity_boost_estimate, computation_time_ms, computed_at)
          VALUES (0, ${input.wMatrixVersion}, ${result.epsilon.toString()}, ${result.improvementPct.toString()}, ${result.computationTimeMs}, ${new Date()})
        `;
      } catch {
        // Ignore if table doesn't exist
      }

      return result;
    }),

  trainMatrix: adminProcedure
    .input(z.object({
      sourceVectors: z.array(z.array(z.number())),
      targetVectors: z.array(z.array(z.number())),
      standardDim: z.enum(['4096', '8192']),
      version: z.string(),
      sourceModels: z.array(z.string()),
      useLora: z.boolean().default(true),
      loraRank: z.number().default(64),
    }))
    .mutation(async ({ input, ctx }) => {
      const { workflowManager } = await import('../workflow-manager');
      const { alignmentService } = await import('../alignment/alignment-service');

      const session = workflowManager.createSession({
        userId: ctx.user.id,
        type: 'w_matrix_training',
        title: `Train W-Matrix ${input.version}`,
        description: `Training W-Matrix from ${input.sourceVectors.length} anchor pairs`,
        tags: ['w-matrix', 'training', input.standardDim],
      });
      const workflowId = session.id;

      try {
        const prepareEvent = workflowManager.addEvent(workflowId, {
          type: 'tool_call',
          title: 'Prepare Training Data',
          input: {
            sourceVectorsCount: input.sourceVectors.length,
            targetVectorsCount: input.targetVectors.length,
            standardDim: input.standardDim,
            sourceModels: input.sourceModels,
          },
        });

        workflowManager.updateEvent(workflowId, prepareEvent.id, {
          status: 'completed',
          output: {
            anchorPairs: input.sourceVectors.length,
            useLora: input.useLora,
            loraRank: input.loraRank,
          },
        });

        const trainEvent = workflowManager.addEvent(workflowId, {
          type: 'tool_call',
          title: 'Train W-Matrix Model',
          input: {
            standardDim: input.standardDim,
            method: input.useLora ? 'LoRA' : 'Full',
          },
        });

        const result = await alignmentService.trainWMatrix(
          input.sourceVectors,
          input.targetVectors,
          parseInt(input.standardDim) as 4096 | 8192,
          { useLora: input.useLora, loraRank: input.loraRank }
        );

        let serializedMatrix = result.serializedMatrix;
        let orthogonalityScore: number | null = null;

        try {
          const parsed = JSON.parse(result.serializedMatrix);
          if (parsed?.w_matrix && Array.isArray(parsed.w_matrix)) {
            const { procrustesOrthogonalize, computeOrthogonalityScore } = await import('../latentmas/svd-orthogonalization');
            const orthogonalized = procrustesOrthogonalize(parsed.w_matrix);
            orthogonalityScore = computeOrthogonalityScore(orthogonalized);

            parsed.w_matrix = orthogonalized;
            parsed.metadata = {
              ...(parsed.metadata || {}),
              orthogonality_score: orthogonalityScore,
              orthogonalized_at: new Date().toISOString(),
            };

            serializedMatrix = JSON.stringify(parsed);
          }
        } catch (error) {
          console.warn('Failed to apply Procrustes orthogonalization to trained W-Matrix', { error });
        }

        workflowManager.updateEvent(workflowId, trainEvent.id, {
          status: 'completed',
          output: {
            epsilon: result.metrics.epsilon,
            fidelityScore: result.metrics.fidelityScore,
            trainingTimeMs: result.metrics.computationTimeMs,
            orthogonalityScore: orthogonalityScore ?? undefined,
          },
        });

        const saveEvent = workflowManager.addEvent(workflowId, {
          type: 'tool_call',
          title: 'Save W-Matrix to Database',
          input: { version: input.version },
        });

        try {
          await prisma.$executeRaw`
            INSERT INTO w_matrix_versions (version, standard_dim, matrix_data, matrix_format, source_models, alignment_pairs_count, avg_reconstruction_error, is_active, created_at)
            VALUES (${input.version}, ${parseInt(input.standardDim)}, ${serializedMatrix}, 'numpy', ${JSON.stringify(input.sourceModels)}, ${input.sourceVectors.length}, ${result.metrics.epsilon.toString()}, true, ${new Date()})
          `;
        } catch {
          // Ignore if table doesn't exist
        }

        workflowManager.updateEvent(workflowId, saveEvent.id, {
          status: 'completed',
          output: { version: input.version, saved: true },
        });

        workflowManager.completeSession(workflowId, 'completed');

        return result;
      } catch (error) {
        workflowManager.addEvent(workflowId, {
          type: 'tool_call',
          title: 'Training Failed',
          input: { error: (error as Error).message },
        });
        workflowManager.completeSession(workflowId, 'failed');
        throw error;
      }
    }),

  listVersions: publicProcedure.query(async () => {
    const versions = await prisma.$queryRaw<Array<{
      id: number;
      version: string;
      standard_dim: number;
      matrix_format: string;
      source_models: string;
      alignment_pairs_count: number;
      avg_reconstruction_error: string;
      is_active: boolean;
      created_at: Date;
    }>>`
      SELECT * FROM w_matrix_versions
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    return versions;
  }),

  getVersion: publicProcedure
    .input(z.object({ version: z.string() }))
    .query(async ({ input }) => {
      const versions = await prisma.$queryRaw<Array<{
        id: number;
        version: string;
        standard_dim: number;
        matrix_data: string;
        matrix_format: string;
        source_models: string;
        alignment_pairs_count: number;
        avg_reconstruction_error: string;
        is_active: boolean;
        created_at: Date;
      }>>`
        SELECT * FROM w_matrix_versions
        WHERE version = ${input.version}
        LIMIT 1
      `;

      if (versions.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'W-matrix version not found' });
      }

      return versions[0];
    }),

  transform: publicProcedure
    .input(z.object({
      vectorData: z.array(z.number()),
      wMatrixVersion: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { alignmentService } = await import('../alignment/alignment-service');
      const transformed = await alignmentService.transformVector(
        input.vectorData,
        input.wMatrixVersion
      );
      return { transformedVector: transformed };
    }),

  getHistory: protectedProcedure
    .input(z.object({
      vectorId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      if (input.vectorId) {
        return await prisma.$queryRaw<Array<{
          id: number;
          vector_id: number;
          w_matrix_version: string;
          epsilon_value: string;
          fidelity_boost_estimate: string;
          computation_time_ms: number;
          computed_at: Date;
        }>>`
          SELECT * FROM alignment_calculations
          WHERE vector_id = ${input.vectorId}
          ORDER BY computed_at DESC
          LIMIT ${input.limit}
        `;
      }

      return await prisma.$queryRaw<Array<{
        id: number;
        vector_id: number;
        w_matrix_version: string;
        epsilon_value: string;
        fidelity_boost_estimate: string;
        computation_time_ms: number;
        computed_at: Date;
      }>>`
        SELECT * FROM alignment_calculations
        ORDER BY computed_at DESC
        LIMIT ${input.limit}
      `;
    }),
});
