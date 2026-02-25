import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import * as semanticIndex from "../semantic-index";
import { GENESIS_MEMORIES } from "../../shared/genesis-memories";

export const semanticIndexRouter = router({
  findByTopic: publicProcedure
    .input(z.object({
      topic: z.string().min(1),
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(({ input }) => {
      return semanticIndex.findMemoryByTopic(input.topic, input.limit);
    }),

  findByDomain: publicProcedure
    .input(z.object({
      domain: z.string(),
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(({ input }) => {
      return semanticIndex.findMemoryByDomain(input.domain as any, input.limit);
    }),

  findByTask: publicProcedure
    .input(z.object({
      taskType: z.string(),
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(({ input }) => {
      return semanticIndex.findMemoryByTask(input.taskType as any, input.limit);
    }),

  search: publicProcedure
    .input(z.object({
      query: z.string().optional(),
      domain: z.string().optional(),
      taskType: z.string().optional(),
      modelOrigin: z.string().optional(),
      isPublic: z.boolean().optional(),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(({ input }) => {
      return semanticIndex.semanticSearch({
        query: input.query,
        domain: input.domain as any,
        task_type: input.taskType as any,
        model_origin: input.modelOrigin,
        is_public: input.isPublic,
        limit: input.limit
      });
    }),

  leaderboard: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(({ input }) => {
      return semanticIndex.getMemoryLeaderboard(input.limit);
    }),

  stats: publicProcedure.query(() => {
    return semanticIndex.getNetworkStats();
  }),

  domains: publicProcedure.query(() => {
    return semanticIndex.getAvailableDomains();
  }),

  taskTypes: publicProcedure.query(() => {
    return semanticIndex.getAvailableTaskTypes();
  }),

  genesisMemories: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(100) }))
    .query(({ input }) => {
      return GENESIS_MEMORIES.slice(0, input.limit);
    }),
});
