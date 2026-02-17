/**
 * Provider Keys Router — BYOK
 *
 * tRPC endpoints for managing per-user LLM provider API keys.
 * Keys are stored AES-256-GCM encrypted on the server.
 *
 * Endpoints:
 *   upsert   — save/update an API key for a provider
 *   list     — list keys (masked, no plaintext)
 *   delete   — deactivate a key
 *   test     — verify a key can call the provider API
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { upsertProviderKey, listProviderKeys, deleteProviderKey } from '../provider-keys-service';
import { createLogger } from '../utils/logger';

const logger = createLogger('ProviderKeysRouter');

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini', 'forge', 'custom'] as const;

const upsertSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  label: z.string().max(100).optional(),
  /** The raw API key — sent over HTTPS, encrypted before storing */
  apiKey: z.string().min(10).max(512),
  /** Optional: override the provider's base URL (e.g. for local Ollama, proxy, etc.) */
  baseUrl: z.string().url().optional().or(z.literal('')),
});

const deleteSchema = z.object({
  id: z.number().int().positive(),
});

const testSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
});

export const providerKeysRouter = router({
  /**
   * Save or update a provider API key.
   * If a key for the same provider already exists it is replaced.
   */
  upsert: protectedProcedure
    .input(upsertSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const result = await upsertProviderKey({
        userId,
        provider: input.provider,
        label: input.label,
        plainKey: input.apiKey,
        baseUrl: input.baseUrl || undefined,
      });

      return {
        success: true,
        key: result,
        message: `${input.provider} API key saved successfully`,
      };
    }),

  /**
   * List all active provider keys for the authenticated user.
   * Returns masked keys only — plaintext is never exposed.
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const keys = await listProviderKeys(ctx.user.id);
      return { keys };
    }),

  /**
   * Deactivate a provider key by ID.
   */
  delete: protectedProcedure
    .input(deleteSchema)
    .mutation(async ({ input, ctx }) => {
      await deleteProviderKey(input.id, ctx.user.id);
      return { success: true, deletedId: input.id };
    }),

  /**
   * Test a saved provider key by making a minimal API call.
   * Returns { ok: true, latencyMs } or { ok: false, error: string }.
   */
  test: protectedProcedure
    .input(testSchema)
    .mutation(async ({ input, ctx }) => {
      const { resolveProviderKey } = await import('../provider-keys-service');
      const resolved = await resolveProviderKey(ctx.user.id, input.provider);

      if (!resolved) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No ${input.provider} API key configured`,
        });
      }

      const start = Date.now();

      try {
        if (input.provider === 'openai' || input.provider === 'forge') {
          const baseUrl = resolved.baseUrl || 'https://api.openai.com';
          const response = await fetch(`${baseUrl}/v1/models`, {
            headers: { Authorization: `Bearer ${resolved.apiKey}` },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            return { ok: false, error: `${response.status}: ${text.slice(0, 120)}` };
          }
        } else if (input.provider === 'anthropic') {
          const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': resolved.apiKey,
              'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            return { ok: false, error: `${response.status}: ${text.slice(0, 120)}` };
          }
        } else if (input.provider === 'gemini') {
          // Gemini: list models endpoint
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${resolved.apiKey}`,
            { signal: AbortSignal.timeout(8000) },
          );
          if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            return { ok: false, error: `${response.status}: ${text.slice(0, 120)}` };
          }
        } else if (input.provider === 'custom') {
          // Custom: just do a GET to /v1/models if baseUrl is provided
          if (!resolved.baseUrl) {
            return { ok: false, error: 'No base URL configured for custom provider' };
          }
          const response = await fetch(`${resolved.baseUrl}/v1/models`, {
            headers: { Authorization: `Bearer ${resolved.apiKey}` },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            return { ok: false, error: `${response.status}: ${response.statusText}` };
          }
        }

        logger.info('Provider key test passed', { provider: input.provider, userId: ctx.user.id });
        return { ok: true, latencyMs: Date.now() - start };
      } catch (err: any) {
        const msg = err?.message || String(err);
        logger.warn('Provider key test failed', { provider: input.provider, error: msg });
        return { ok: false, error: msg };
      }
    }),
});
