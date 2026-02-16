/**
 * IP Whitelist Router — P2 Security Enhancement
 *
 * tRPC endpoints for IP whitelist management:
 * - Add/remove/list whitelist entries
 * - Organization-level and user-level control
 * - Access log viewing
 * - Blocked IP statistics
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import {
  addToWhitelist,
  removeFromWhitelist,
  listWhitelist,
  getIpAccessLogs,
  getBlockedIpStats,
  parseIpAddress,
  parseCIDR,
} from '../security/ip-whitelist-service';
import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';

export const ipWhitelistRouter = router({
  /**
   * Add IP to whitelist (organization or user level)
   */
  add: protectedProcedure
    .input(
      z.object({
        organizationId: z.number().int().optional(),
        userId: z.number().int().optional(),
        ipAddress: z.string().optional(),
        cidrNotation: z.string().optional(),
        ipRangeStart: z.string().optional(),
        ipRangeEnd: z.string().optional(),
        description: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate: must specify either org or user
      if (!input.organizationId && !input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Must specify either organizationId or userId',
        });
      }

      // Validate: must specify IP, CIDR, or range
      const hasIp = !!input.ipAddress;
      const hasCIDR = !!input.cidrNotation;
      const hasRange = !!(input.ipRangeStart && input.ipRangeEnd);

      if (!hasIp && !hasCIDR && !hasRange) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Must specify ipAddress, cidrNotation, or IP range',
        });
      }

      // Check permission for organization
      if (input.organizationId) {
        const membership = await prisma.orgMembership.findFirst({
          where: {
            userId: ctx.user.id,
            organizationId: input.organizationId,
            role: { in: ['owner', 'admin'] },
          },
        });

        if (!membership) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be organization owner or admin to manage IP whitelist',
          });
        }
      }

      // Check permission for user
      if (input.userId && input.userId !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Can only manage your own user-level whitelist',
        });
      }

      const result = await addToWhitelist({
        organizationId: input.organizationId,
        userId: input.userId,
        ipAddress: input.ipAddress,
        cidrNotation: input.cidrNotation,
        ipRangeStart: input.ipRangeStart,
        ipRangeEnd: input.ipRangeEnd,
        description: input.description,
        createdBy: ctx.user.id,
      });

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to add IP to whitelist',
        });
      }

      return { success: true, id: result.id };
    }),

  /**
   * Remove IP from whitelist
   */
  remove: protectedProcedure
    .input(
      z.object({
        whitelistId: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await removeFromWhitelist(input.whitelistId, ctx.user.id);

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to remove IP from whitelist',
        });
      }

      return { success: true };
    }),

  /**
   * List whitelist entries for organization
   */
  listOrg: protectedProcedure
    .input(
      z.object({
        organizationId: z.number().int(),
        includeInactive: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check permission
      const membership = await prisma.orgMembership.findFirst({
        where: {
          userId: ctx.user.id,
          organizationId: input.organizationId,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this organization',
        });
      }

      const whitelists = await listWhitelist({
        organizationId: input.organizationId,
        includeInactive: input.includeInactive,
      });

      return whitelists;
    }),

  /**
   * List whitelist entries for current user
   */
  listUser: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const whitelists = await listWhitelist({
        userId: ctx.user.id,
        includeInactive: input.includeInactive,
      });

      return whitelists;
    }),

  /**
   * Get access logs for current user
   */
  accessLogs: protectedProcedure
    .input(
      z.object({
        blocked: z.boolean().optional(),
        limit: z.number().int().min(1).max(1000).optional().default(100),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const logs = await getIpAccessLogs({
        userId: ctx.user.id,
        blocked: input.blocked,
        limit: input.limit,
        offset: input.offset,
      });

      return logs;
    }),

  /**
   * Get blocked IP statistics
   */
  blockedStats: protectedProcedure
    .input(
      z.object({
        sinceHours: z.number().int().min(1).max(720).optional().default(24),
      })
    )
    .query(async ({ ctx, input }) => {
      const stats = await getBlockedIpStats({
        userId: ctx.user.id,
        sinceHours: input.sinceHours,
      });

      return stats;
    }),

  /**
   * Test if an IP is whitelisted (admin only)
   */
  testIp: protectedProcedure
    .input(
      z.object({
        ipAddress: z.string(),
        userId: z.number().int(),
        organizationId: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Admin only
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const { isIpWhitelisted } = await import('../security/ip-whitelist-service');

      const result = await isIpWhitelisted(
        input.ipAddress,
        input.userId,
        input.organizationId
      );

      return result;
    }),

  /**
   * Validate IP address format
   */
  validateIp: protectedProcedure
    .input(
      z.object({
        ipAddress: z.string(),
      })
    )
    .query(({ input }) => {
      const result = parseIpAddress(input.ipAddress);
      return {
        valid: result.valid,
        version: result.version,
        normalized: result.normalized,
        error: result.error,
      };
    }),

  /**
   * Validate CIDR notation
   */
  validateCIDR: protectedProcedure
    .input(
      z.object({
        cidr: z.string(),
      })
    )
    .query(({ input }) => {
      const result = parseCIDR(input.cidr);
      return {
        valid: result.valid,
        network: result.network,
        prefix: result.prefix,
        firstIp: result.firstIp,
        lastIp: result.lastIp,
        error: result.error,
      };
    }),
});
