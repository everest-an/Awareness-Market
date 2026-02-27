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
 *   search       — Hybrid search (BM25 + semantic + RRF)
 *   communities  — Get communities for a repo
 *   processes    — Get execution flows for a repo
 *   impact       — Blast radius analysis
 *   chat         — Graph RAG AI chat
 *   nodeContext   — 360-degree node context
 */

import { z } from 'zod';
import { randomBytes } from 'crypto';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as githubService from '../code-graph/github-service';
import { buildCodeGraph, getCachedGraph } from '../code-graph/graph-builder';
import { CodeSearchEngine } from '../code-graph/search-engine';
import { analyzeImpact } from '../code-graph/impact-analyzer';
import { chatWithGraph, getNodeContext } from '../code-graph/chat-agent';
import { createLogger } from '../utils/logger';

const logger = createLogger('CodeGraphRouter');
const CALLBACK_BASE_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000';

// In-memory state store (short-lived, for CSRF protection)
const pendingStates = new Map<string, { userId: number; expiresAt: number }>();

// Search engine cache (keyed by owner/repo)
const searchEngineCache = new Map<string, { engine: CodeSearchEngine; expiresAt: number }>();
const SEARCH_CACHE_TTL = 30 * 60 * 1000;

function getSearchEngine(owner: string, repo: string): CodeSearchEngine | null {
  const key = `${owner}/${repo}`;
  const cached = searchEngineCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.engine;
  searchEngineCache.delete(key);

  const graph = getCachedGraph(owner, repo);
  if (!graph) return null;

  const engine = new CodeSearchEngine(graph);
  searchEngineCache.set(key, { engine, expiresAt: Date.now() + SEARCH_CACHE_TTL });
  return engine;
}

function getGraphOrThrow(owner: string, repo: string) {
  const graph = getCachedGraph(owner, repo);
  if (!graph) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Graph not loaded. Fetch the graph first.',
    });
  }
  return graph;
}

export const codeGraphRouter = router({
  /** Get GitHub connection status for the authenticated user */
  status: protectedProcedure.query(async ({ ctx }) => {
    return githubService.getConnectionStatus(ctx.user.id);
  }),

  /** Generate an OAuth URL to connect GitHub (with repo scope) */
  getConnectUrl: protectedProcedure.mutation(async ({ ctx }) => {
    const state = randomBytes(32).toString('hex');

    pendingStates.set(state, {
      userId: ctx.user.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

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
    .input(z.object({ code: z.string().min(1), state: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const pending = pendingStates.get(input.state);
      if (!pending || pending.userId !== ctx.user.id || pending.expiresAt < Date.now()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired state parameter' });
      }
      pendingStates.delete(input.state);

      const tokenResponse = await githubService.exchangeCodeForRepoToken(input.code);
      const userInfo = await githubService.getGitHubUserFromToken(tokenResponse.access_token);

      await githubService.saveGitHubToken(
        ctx.user.id, tokenResponse.access_token, userInfo.login, userInfo.id, tokenResponse.scope,
      );

      logger.info('GitHub connected for code graph', { userId: ctx.user.id, github: userInfo.login });
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
    if (!token) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'GitHub not connected' });
    const repos = await githubService.listUserRepos(token);
    return { repos };
  }),

  /** Build code graph for a specific repository */
  fetchGraph: protectedProcedure
    .input(z.object({ owner: z.string().min(1), repo: z.string().min(1), branch: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const token = await githubService.getGitHubToken(ctx.user.id);
      if (!token) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'GitHub not connected' });

      let branch = input.branch;
      if (!branch) {
        const repoInfo = await githubService.getRepoInfo(token, input.owner, input.repo);
        branch = repoInfo.defaultBranch;
      }

      const graph = await buildCodeGraph(token, input.owner, input.repo, branch);

      // Pre-build search engine
      const engine = new CodeSearchEngine(graph);
      searchEngineCache.set(`${input.owner}/${input.repo}`, {
        engine, expiresAt: Date.now() + SEARCH_CACHE_TTL,
      });

      logger.info('Code graph fetched', {
        userId: ctx.user.id,
        repo: `${input.owner}/${input.repo}`,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        communities: graph.communities.length,
        processes: graph.processes.length,
      });

      return graph;
    }),

  /** Hybrid search (BM25 + semantic + RRF) */
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1), owner: z.string().min(1), repo: z.string().min(1), topK: z.number().optional().default(20) }))
    .mutation(async ({ input }) => {
      const engine = getSearchEngine(input.owner, input.repo);
      if (!engine) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Graph not loaded. Fetch the graph first.' });
      return engine.search(input.query, input.topK);
    }),

  /** Get communities for a repo */
  communities: protectedProcedure
    .input(z.object({ owner: z.string().min(1), repo: z.string().min(1) }))
    .query(async ({ input }) => {
      const graph = getGraphOrThrow(input.owner, input.repo);
      return graph.communities;
    }),

  /** Get execution flows for a repo */
  processes: protectedProcedure
    .input(z.object({ owner: z.string().min(1), repo: z.string().min(1) }))
    .query(async ({ input }) => {
      const graph = getGraphOrThrow(input.owner, input.repo);
      return graph.processes;
    }),

  /** Blast radius analysis */
  impact: protectedProcedure
    .input(z.object({ symbolIds: z.array(z.string().min(1)), owner: z.string().min(1), repo: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const graph = getGraphOrThrow(input.owner, input.repo);
      return analyzeImpact(input.symbolIds, graph.nodes, graph.edges, graph.processes);
    }),

  /** Graph RAG AI chat */
  chat: protectedProcedure
    .input(z.object({
      messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'tool']), content: z.string() })),
      owner: z.string().min(1),
      repo: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const graph = getGraphOrThrow(input.owner, input.repo);
      const engine = getSearchEngine(input.owner, input.repo);
      if (!engine) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Search engine not initialized.' });
      return chatWithGraph(input.messages, graph, engine);
    }),

  /** 360-degree node context */
  nodeContext: protectedProcedure
    .input(z.object({ nodeId: z.string().min(1), owner: z.string().min(1), repo: z.string().min(1) }))
    .query(async ({ input }) => {
      const graph = getGraphOrThrow(input.owner, input.repo);
      const ctx = getNodeContext(input.nodeId, graph);
      if (!ctx) throw new TRPCError({ code: 'NOT_FOUND', message: `Node "${input.nodeId}" not found` });
      return ctx;
    }),
});
