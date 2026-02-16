/**
 * MCP (Model Context Protocol) tRPC Router
 *
 * Provides endpoints for managing MCP tokens through the frontend UI
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import * as db from '../db';
import { TRPCError } from '@trpc/server';

export const mcpRouter = router({
  /**
   * List all MCP tokens for the authenticated user
   */
  listTokens: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const tokens = await db.listMcpTokens((ctx as any).session.userId);
        return tokens;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list MCP tokens',
        });
      }
    }),

  /**
   * Create a new MCP token
   */
  createToken: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        permissions: z.array(z.string()).optional(),
        expiresInDays: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await db.createMcpToken({
          userId: (ctx as any).session.userId,
          name: input.name,
          permissions: input.permissions,
          expiresInDays: input.expiresInDays,
        });

        return {
          success: true,
          token: result.token,
          tokenPrefix: result.tokenPrefix,
          expiresAt: result.expiresAt,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create MCP token',
        });
      }
    }),

  /**
   * Revoke an MCP token
   */
  revokeToken: protectedProcedure
    .input(
      z.object({
        tokenId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await db.revokeMcpToken({
          userId: (ctx as any).session.userId,
          tokenId: input.tokenId,
        });

        return {
          success: true,
          message: 'Token revoked successfully',
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to revoke MCP token',
        });
      }
    }),
});
