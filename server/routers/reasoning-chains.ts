import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { prisma } from "../db-prisma";

/**
 * Thin compatibility router for the ReasoningChainPublish page.
 * Stores reasoning chain data as a ChainPackage in the database.
 */
export const reasoningChainsRouter = router({
  publish: protectedProcedure
    .input(z.object({
      chainName: z.string().min(1),
      description: z.string().min(1),
      category: z.string(),
      inputExample: z.unknown().nullable(),
      outputExample: z.unknown().nullable(),
      kvCacheSnapshot: z.object({
        sourceModel: z.string(),
        keys: z.array(z.unknown()),
        values: z.array(z.unknown()),
        attentionMask: z.array(z.unknown()).optional(),
        positionEncodings: z.array(z.unknown()).optional(),
        metadata: z.object({
          sequenceLength: z.number(),
          contextDescription: z.string(),
          tokenCount: z.number(),
          generatedAt: z.date().optional(),
        }),
      }),
      pricePerUse: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const chainData = JSON.stringify({
        category: input.category,
        inputExample: input.inputExample,
        outputExample: input.outputExample,
        kvCacheSnapshot: {
          sourceModel: input.kvCacheSnapshot.sourceModel,
          keysLength: input.kvCacheSnapshot.keys.length,
          valuesLength: input.kvCacheSnapshot.values.length,
          metadata: input.kvCacheSnapshot.metadata,
        },
      });

      const result = await (prisma as any).chainPackage.create({
        data: {
          name: input.chainName,
          description: input.description,
          version: "1.0.0",
          chainData,
          price: input.pricePerUse,
          creatorId: ctx.user.id,
          status: "published",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return { id: result.id, name: result.name };
    }),
});
