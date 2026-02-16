/**
 * Session Management Router — P2 Security Enhancement
 *
 * tRPC endpoints for managing user sessions:
 * - List active sessions
 * - Revoke specific sessions
 * - Logout from all devices
 * - View session details
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  listUserSessions,
  revokeSession,
  revokeAllUserSessions,
  revokeOtherSessions,
} from '../security/session-manager';
import { TRPCError } from '@trpc/server';

export const sessionManagementRouter = router({
  /**
   * List all active sessions for current user
   */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await listUserSessions(ctx.user.id);

    // Mark current session
    const currentSessionId = (ctx.req as any).sessionId;
    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
  }),

  /**
   * Get current session details
   */
  getCurrentSession: protectedProcedure.query(async ({ ctx }) => {
    const currentSessionId = (ctx.req as any).sessionId;

    if (!currentSessionId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active session found',
      });
    }

    const { prisma } = await import('../db-prisma');

    const session = await prisma.userSession.findUnique({
      where: { id: currentSessionId },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        lastActivityAt: true,
        createdAt: true,
        expiresAt: true,
        idleTimeoutMinutes: true,
      },
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    return session;
  }),

  /**
   * Revoke a specific session by ID
   */
  revokeSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = await import('../db-prisma');

      // Verify the session belongs to the user
      const session = await prisma.userSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot revoke a session that does not belong to you',
        });
      }

      const result = await revokeSession(input.sessionId, input.reason);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to revoke session',
        });
      }

      return { success: true, message: 'Session revoked successfully' };
    }),

  /**
   * Revoke all sessions (logout from all devices)
   */
  revokeAllSessions: protectedProcedure
    .input(
      z.object({
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await revokeAllUserSessions(ctx.user.id, input.reason);

      return {
        success: true,
        message: `Logged out from ${result.revokedCount} device(s)`,
        revokedCount: result.revokedCount,
      };
    }),

  /**
   * Revoke all other sessions (keep current session active)
   */
  revokeOtherSessions: protectedProcedure
    .input(
      z.object({
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentSessionId = (ctx.req as any).sessionId;

      if (!currentSessionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No current session found',
        });
      }

      const result = await revokeOtherSessions(
        ctx.user.id,
        currentSessionId,
        input.reason
      );

      return {
        success: true,
        message: `Logged out from ${result.revokedCount} other device(s)`,
        revokedCount: result.revokedCount,
      };
    }),

  /**
   * Get session statistics
   */
  getSessionStats: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = await import('../db-prisma');

    const now = new Date();

    const [totalSessions, activeSessions, expiringSoon] = await Promise.all([
      prisma.userSession.count({
        where: {
          userId: ctx.user.id,
        },
      }),
      prisma.userSession.count({
        where: {
          userId: ctx.user.id,
          isActive: true,
          expiresAt: { gt: now },
          revokedAt: null,
        },
      }),
      prisma.userSession.count({
        where: {
          userId: ctx.user.id,
          isActive: true,
          expiresAt: {
            gt: now,
            lt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Next 24 hours
          },
          revokedAt: null,
        },
      }),
    ]);

    return {
      totalSessions,
      activeSessions,
      expiringSoon,
    };
  }),
});
