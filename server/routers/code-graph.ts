/**
 * Code Graph Router — tRPC endpoints for GitHub code knowledge graph
 *
 * Endpoints:
 *   status       — Get GitHub connection status
 *   getConnectUrl — Generate OAuth URL with repo scope
 *   connect      — Handle OAuth callback, save encrypted token
 *   disconnect   — Remove GitHub connection
 *   listRepos    — List user's GitHub repos
 *   fetchGraph   — Build code graph for a specific repo
 */

import { z } from 'zod';
import { randomBytes } from 'crypto';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as githubService from '../code-graph/github-service';
import { buildCodeGraph } from '../code-graph/graph-builder';
import { createLogger } from '../utils/logger';

const logger = createLogger('CodeGraphRouter');
const CALLBACK_BASE_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000';

// In-memory state store (short-lived, for CSRF protection)
const pendingStates = new Map<string, { userId: number; expiresAt: number }>();

export const codeGraphRouter = router({
  /** Get GitHub connection status for the authenticated user */
  status: protectedProcedure.query(async ({ ctx }) => {
    return githubService.getConnectionStatus(ctx.user.id);
  }),

  /** Generate an OAuth URL to connect GitHub (with repo scope) */
  getConnectUrl: protectedProcedure.mutation(async ({ ctx }) => {
    const state = randomBytes(32).toString('hex');

    // Store state in memory (expires in 10 minutes)
    pendingStates.set(state, {
      userId: ctx.user.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Clean up expired states
    for (const [key, val] of pendingStates.entries()) {
      if (val.expiresAt < Date.now()) pendingStates.delete(key);
    }

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      redirect_uri: `${CALLBACK_BASE_URL}/api/auth/callback/github-code-graph`,
      scope: 'repo read:user',
      state,
      response_type: 'code',
    });

    return { url: `https://github.com/login/oauth/authorize?${params}` };
  }),

  /** Handle OAuth callback — exchange code for token and store */
  connect: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        state: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Validate state
      const pending = pendingStates.get(input.state);
      if (!pending || pending.userId !== ctx.user.id || pending.expiresAt < Date.now()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired state parameter',
        });
      }
      pendingStates.delete(input.state);

      // Exchange code for token
      const tokenResponse = await githubService.exchangeCodeForRepoToken(input.code);

      // Get GitHub user info
      const userInfo = await githubService.getGitHubUserFromToken(tokenResponse.access_token);

      // Save encrypted token
      await githubService.saveGitHubToken(
        ctx.user.id,
        tokenResponse.access_token,
        userInfo.login,
        userInfo.id,
        tokenResponse.scope,
      );

      logger.info('GitHub connected for code graph', {
        userId: ctx.user.id,
        github: userInfo.login,
      });

      return { success: true, username: userInfo.login };
    }),

  /** Disconnect GitHub */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await githubService.disconnectGitHub(ctx.user.id);
    return { success: true };
  }),

  /** List user's GitHub repositories */
  listRepos: protectedProcedure.query(async ({ ctx }) => {
    const token = await githubService.getGitHubToken(ctx.user.id);
    if (!token) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'GitHub not connected',
      });
    }

    const repos = await githubService.listUserRepos(token);
    return { repos };
  }),

  /** Build code graph for a specific repository */
  fetchGraph: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const token = await githubService.getGitHubToken(ctx.user.id);
      if (!token) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'GitHub not connected',
        });
      }

      // Resolve branch
      let branch = input.branch;
      if (!branch) {
        const repoInfo = await githubService.getRepoInfo(token, input.owner, input.repo);
        branch = repoInfo.defaultBranch;
      }

      const graph = await buildCodeGraph(token, input.owner, input.repo, branch);

      logger.info('Code graph fetched', {
        userId: ctx.user.id,
        repo: `${input.owner}/${input.repo}`,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
      });

      return graph;
    }),
});
