/**
 * Unified Authentication Router
 * 
 * Handles authentication for both human users and AI agents
 * - Human users: Email/password, OAuth (GitHub, Google, Hugging Face)
 * - AI agents: API key authentication
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as authStandalone from '../auth-standalone';
import * as authAIAgent from '../auth-ai-agent';
import * as authERC8004 from '../auth-erc8004';
import { COOKIE_NAME } from '@shared/const';
import { getSessionCookieOptions } from '../_core/cookies';
import { prisma } from '../db-prisma';

export const authUnifiedRouter = router({
  /**
   * Get current user/agent information
   */
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user || null;
  }),

  /**
   * Human User: Register with email/password
   */
  registerHuman: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await authStandalone.registerWithEmail(input);
      
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Registration failed',
        });
      }
      
      return {
        success: true,
        userId: result.userId,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    }),

  /**
   * Human User: Login with email/password
   */
  loginHuman: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await authStandalone.loginWithEmail(input);
      
      if (!result.success) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.error || 'Login failed',
        });
      }
      
      // Set JWT tokens in HTTP-only cookies
      if (result.accessToken && result.refreshToken) {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
        ctx.res.cookie('jwt_refresh', result.refreshToken, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }
      
      return {
        success: true,
        userId: result.user?.id,
        accessToken: result.accessToken,
      };
    }),

  /**
   * AI Agent: Register new agent
   */
  registerAIAgent: protectedProcedure
    .input(z.object({
      agentName: z.string().min(1).max(100),
      agentType: z.enum(['mcp', 'api', 'sdk']),
      email: z.string().email().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only allow admin users to register AI agents
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can register AI agents',
        });
      }
      
      const result = await authAIAgent.registerAIAgent(input);
      
      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Agent registration failed',
        });
      }
      
      return {
        success: true,
        credentials: result.credentials,
      };
    }),

  /**
   * AI Agent: Authenticate with API key
   */
  authenticateAIAgent: publicProcedure
    .input(z.object({
      apiKey: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Validate API key format
      if (!authAIAgent.isValidApiKeyFormat(input.apiKey)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid API key format',
        });
      }
      
      const result = await authAIAgent.authenticateAIAgent(input.apiKey);
      
      if (!result.success) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.error || 'Authentication failed',
        });
      }
      
      return {
        success: true,
        agent: result.agent,
      };
    }),

  /**
   * Get AI agent profile
   */
  getAIAgentProfile: protectedProcedure
    .input(z.object({
      agentId: z.string(),
    }))
    .query(async ({ input }) => {
      const profile = await authAIAgent.getAIAgentProfile(input.agentId);
      
      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Agent not found',
        });
      }
      
      return profile;
    }),

  /**
   * List all AI agents (admin only)
   */
  listAIAgents: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }
      
      const agents = await authAIAgent.listAIAgents();
      return { agents };
    }),

  /**
   * Revoke AI agent access (admin only)
   */
  revokeAIAgent: protectedProcedure
    .input(z.object({
      agentId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }
      
      const result = await authAIAgent.revokeAIAgentAccess(input.agentId);
      
      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error || 'Failed to revoke agent access',
        });
      }
      
      return { success: true };
    }),

  /**
   * Send email verification code
   */
  sendVerificationEmail: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No email associated with this account',
        });
      }

      const result = await authStandalone.sendEmailVerificationCode(
        ctx.user.id,
        ctx.user.email
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error || 'Failed to send verification email',
        });
      }

      return { success: true };
    }),

  /**
   * Verify email with code
   */
  verifyEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      const result = await authStandalone.verifyEmailWithCode(
        input.email,
        input.code
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Verification failed',
        };
      }

      return { success: true };
    }),

  /**
   * Get verification status
   */
  verificationStatus: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .query(async ({ input }) => {
      const status = await authStandalone.getVerificationStatus(input.email);
      return status;
    }),

  /**
   * Convert ERC-8004 token to JWT session
   * Allows AI agents authenticated via ERC-8004 to use standard JWT authentication
   */
  convertAgentToken: publicProcedure
    .input(z.object({
      erc8004Token: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify ERC-8004 token
      const verification = authERC8004.verifyERC8004Token(input.erc8004Token);

      if (!verification.valid || !verification.payload) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: verification.error || 'Invalid ERC-8004 token',
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: verification.payload.userId }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Generate standard JWT tokens
      const accessToken = authStandalone.generateAccessToken(user);
      const refreshToken = authStandalone.generateRefreshToken(user);

      // Set HTTP-only cookies
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie('jwt_token', accessToken, cookieOptions);
      ctx.res.cookie('jwt_refresh', refreshToken, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      };
    }),

  /**
   * Logout (for human users)
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie('jwt_token', { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie('jwt_refresh', { ...cookieOptions, maxAge: -1 });
    return { success: true };
  }),

  /**
   * Refresh access token (for human users)
   */
  refreshToken: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const payload = authStandalone.verifyToken(input.refreshToken);
      
      if (!payload || payload.type !== 'refresh') {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid refresh token',
        });
      }
      
      // Generate new access token
      const newAccessToken = authStandalone.generateAccessToken({
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      });
      
      // Set new access token in cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie('jwt_token', newAccessToken, cookieOptions);
      
      return {
        success: true,
        accessToken: newAccessToken,
      };
    }),
});
