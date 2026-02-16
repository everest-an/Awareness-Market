/**
 * API Key Router — P2 Security Enhancement
 *
 * tRPC endpoints for API key lifecycle management:
 * - Create/list/revoke API keys
 * - Manual key rotation
 * - Auto-rotation configuration
 * - Rotation history tracking
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  rotateApiKey,
  enableAutoRotation,
  disableAutoRotation,
  getRotationHistory,
  validateApiKey,
} from '../api-key-manager';

export const apiKeyRouter = router({
  /**
   * Create a new API key
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        permissions: z.array(z.string()).optional(),
        expiresAt: z.date().optional().nullable(),
        autoRotationEnabled: z.boolean().optional().default(false),
        rotationIntervalDays: z.number().int().min(1).max(365).optional().default(90),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, key, keyPrefix } = await createApiKey({
        userId: ctx.user.id,
        name: input.name,
        permissions: input.permissions,
        expiresAt: input.expiresAt,
      });

      // Enable auto-rotation if requested
      if (input.autoRotationEnabled) {
        await enableAutoRotation(id, ctx.user.id, input.rotationIntervalDays);
      }

      return {
        id,
        key, // Only returned once on creation
        keyPrefix,
        name: input.name,
        autoRotationEnabled: input.autoRotationEnabled,
        rotationIntervalDays: input.rotationIntervalDays,
      };
    }),

  /**
   * List all API keys for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await listApiKeys(ctx.user.id);
    return keys;
  }),

  /**
   * Get details of a specific API key
   */
  get: protectedProcedure
    .input(z.object({ keyId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const keys = await listApiKeys(ctx.user.id);
      const key = keys.find((k) => k.id === input.keyId);

      if (!key) {
        throw new Error('API key not found');
      }

      return key;
    }),

  /**
   * Revoke (deactivate) an API key
   */
  revoke: protectedProcedure
    .input(z.object({ keyId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const success = await revokeApiKey(input.keyId, ctx.user.id);

      if (!success) {
        throw new Error('Failed to revoke API key');
      }

      return { success: true };
    }),

  /**
   * Delete an API key permanently
   */
  delete: protectedProcedure
    .input(z.object({ keyId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const success = await deleteApiKey(input.keyId, ctx.user.id);

      if (!success) {
        throw new Error('Failed to delete API key');
      }

      return { success: true };
    }),

  /**
   * Manually rotate an API key
   */
  rotate: protectedProcedure
    .input(
      z.object({
        keyId: z.number().int(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await rotateApiKey(input.keyId, ctx.user.id, {
        rotationType: 'manual',
        rotatedBy: ctx.user.id,
        reason: input.reason,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to rotate API key');
      }

      return {
        success: true,
        newKey: result.newKey, // Only returned on manual rotation
        newKeyPrefix: result.newKeyPrefix,
        newKeyId: result.newKeyId,
      };
    }),

  /**
   * Enable auto-rotation for an API key
   */
  enableAutoRotation: protectedProcedure
    .input(
      z.object({
        keyId: z.number().int(),
        rotationIntervalDays: z.number().int().min(1).max(365).optional().default(90),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await enableAutoRotation(
        input.keyId,
        ctx.user.id,
        input.rotationIntervalDays
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to enable auto-rotation');
      }

      return { success: true };
    }),

  /**
   * Disable auto-rotation for an API key
   */
  disableAutoRotation: protectedProcedure
    .input(z.object({ keyId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const result = await disableAutoRotation(input.keyId, ctx.user.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to disable auto-rotation');
      }

      return { success: true };
    }),

  /**
   * Get rotation history for an API key
   */
  getRotationHistory: protectedProcedure
    .input(z.object({ keyId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const history = await getRotationHistory(input.keyId, ctx.user.id);
      return history;
    }),

  /**
   * Test API key validity
   */
  testKey: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const result = await validateApiKey(input.key);
      return result;
    }),
});
