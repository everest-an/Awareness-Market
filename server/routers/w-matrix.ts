import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as latentmas from "../latentmas";

export const wMatrixRouter = router({
  getSupportedModels: publicProcedure.query(() => {
    return latentmas.getSupportedModels();
  }),

  getModelSpec: publicProcedure
    .input(z.object({ model: z.string() }))
    .query(({ input }) => {
      return latentmas.getModelSpec(input.model as latentmas.ModelType);
    }),

  checkCompatibility: publicProcedure
    .input(z.object({
      model1: z.string(),
      model2: z.string(),
    }))
    .query(({ input }) => {
      return {
        compatible: latentmas.areModelsCompatible(
          input.model1 as latentmas.ModelType,
          input.model2 as latentmas.ModelType
        ),
      };
    }),

  getCurrentVersion: publicProcedure.query(() => {
    return { version: latentmas.WMatrixService.getCurrentVersion() };
  }),

  getVersions: publicProcedure.query(async () => {
    // Go service adapter removed — return empty for now
    return [];
  }),

  generate: publicProcedure
    .input(z.object({
      sourceModel: z.string(),
      targetModel: z.string(),
      method: z.enum(["orthogonal", "learned", "hybrid"]).default("orthogonal"),
    }))
    .query(({ input }) => {
      const wMatrix = latentmas.WMatrixService.getWMatrix(
        input.sourceModel as latentmas.ModelType,
        input.targetModel as latentmas.ModelType,
        latentmas.WMatrixService.getCurrentVersion(),
        input.method
      );
      return {
        version: wMatrix.version,
        sourceModel: wMatrix.sourceModel,
        targetModel: wMatrix.targetModel,
        unifiedDimension: wMatrix.unifiedDimension,
        method: wMatrix.method,
        kvCacheCompatibility: wMatrix.kvCacheCompatibility,
        qualityMetrics: wMatrix.qualityMetrics,
        metadata: wMatrix.metadata,
      };
    }),

  alignKVCache: protectedProcedure
    .input(z.object({
      kvCache: z.object({
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
      targetModel: z.string(),
      wMatrixVersion: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const aligned = latentmas.WMatrixService.alignKVCache(
        input.kvCache as any,
        input.targetModel as latentmas.ModelType,
        input.wMatrixVersion
      );
      return {
        targetModel: aligned.targetModel,
        wMatrixVersion: aligned.wMatrixVersion,
        alignmentQuality: aligned.alignmentQuality,
        metadata: aligned.metadata,
      };
    }),
});
