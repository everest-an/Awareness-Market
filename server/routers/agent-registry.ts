import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as semanticIndex from "../semantic-index";

export const agentRegistryRouter = router({
  register: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      modelType: z.string().min(1),
      capabilities: z.array(z.string()),
      tbaAddress: z.string().min(1)
    }))
    .mutation(({ input }) => {
      return semanticIndex.registerAgent({
        name: input.name,
        description: input.description,
        model_type: input.modelType,
        capabilities: input.capabilities,
        tba_address: input.tbaAddress
      });
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return semanticIndex.getAgent(input.id);
    }),

  list: publicProcedure
    .input(z.object({
      modelType: z.string().optional(),
      capability: z.string().optional(),
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(({ input }) => {
      return semanticIndex.listAgents({
        model_type: input.modelType,
        capability: input.capability,
        limit: input.limit
      });
    }),

  recent: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(({ input }) => {
      return semanticIndex.getRecentAgents(input.limit);
    }),

  top: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(({ input }) => {
      return semanticIndex.getTopAgents(input.limit);
    }),

  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(20)
    }))
    .query(({ input }) => {
      return semanticIndex.searchAgentsByCapability(input.query, input.limit);
    }),

  activityTimeline: publicProcedure.query(() => {
    return semanticIndex.getAgentActivityTimeline();
  }),
});
