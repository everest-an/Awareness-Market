import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import * as authStandalone from "../auth-standalone";
import * as authOAuth from "../auth-oauth";
import * as authRateLimiter from "../auth-rate-limiter";
import * as authPasswordValidator from "../auth-password-validator";
import * as authEmailVerification from "../auth-email-verification";
import { prisma } from "../db-prisma";
import * as db from "../db";
import crypto from 'crypto';
import type { TrpcRequest } from "../types/router-types";

// Wallet login nonce store for replay protection
const walletNonces = new Map<string, { nonce: string; expiresAt: number }>();
const WALLET_NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of walletNonces) {
    if (now > entry.expiresAt) {
      walletNonces.delete(key);
    }
  }
}, 60 * 1000);

function getClientIp(req: TrpcRequest): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const realIp = req.headers['x-real-ip'];
  const realIpStr = Array.isArray(realIp) ? realIp[0] : realIp;

  return firstIp?.split(',')[0]?.trim()
    || realIpStr
    || req.socket?.remoteAddress
    || req.ip
    || '127.0.0.1';
}

export const authRouter = router({
  me: publicProcedure.query(opts => {
    const u = opts.ctx.user;
    if (!u) return null;
    const { password: _pw, ...safe } = u;
    return safe;
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie('jwt_token', { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie('jwt_refresh', { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  registerEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const passwordValidation = authPasswordValidator.validatePassword(input.password, input.email);
      if (!passwordValidation.valid) {
        return {
          success: false,
          error: passwordValidation.errors[0],
          passwordErrors: passwordValidation.errors,
        };
      }

      const result = await authStandalone.registerWithEmail(input);

      if (result.success && result.userId) {
        await authEmailVerification.sendVerificationEmail(result.userId, input.email);
      }

      return {
        ...result,
        requiresVerification: result.success,
      };
    }),

  sendVerificationEmail: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user.email) {
        return { success: false, error: "No email associated with account" };
      }
      if (ctx.user.emailVerified) {
        return { success: false, error: "Email already verified" };
      }
      return await authEmailVerification.sendVerificationEmail(ctx.user.id, ctx.user.email);
    }),

  verifyEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      return await authEmailVerification.verifyEmail(input.email, input.code);
    }),

  verificationStatus: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .query(({ input }) => {
      return authEmailVerification.getVerificationStatus(input.email);
    }),

  loginEmail: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const clientIp = getClientIp(ctx.req);

      const rateLimitCheck = await authRateLimiter.checkLoginAllowed(clientIp, input.email);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: rateLimitCheck.reason,
          retryAfter: rateLimitCheck.retryAfter,
        };
      }

      const result = await authStandalone.loginWithEmail(input);

      if (result.success && result.accessToken) {
        await authRateLimiter.recordSuccessfulLogin(clientIp, input.email);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
        ctx.res.cookie('jwt_refresh', result.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
      } else {
        await authRateLimiter.recordFailedAttempt(clientIp, input.email);

        const remaining = await authRateLimiter.getRemainingAttempts(clientIp, input.email);
        if (remaining <= 2 && remaining > 0) {
          result.error = `${result.error}. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`;
        }
      }

      return result;
    }),

  updateRole: protectedProcedure
    .input(z.object({ role: z.enum(["creator", "consumer"]) }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserRole(ctx.user.id, input.role);
      return { success: true };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      return await authStandalone.requestPasswordReset(input.email);
    }),

  verifyResetCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      return await authStandalone.verifyResetCode(input.email, input.code);
    }),

  resetPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const passwordValidation = authPasswordValidator.validatePassword(input.newPassword, input.email);
      if (!passwordValidation.valid) {
        return {
          success: false,
          error: passwordValidation.errors[0],
        };
      }

      return await authStandalone.resetPassword(input.email, input.code, input.newPassword);
    }),

  validatePassword: publicProcedure
    .input(z.object({
      password: z.string(),
      email: z.string().email().optional(),
    }))
    .query(({ input }) => {
      const result = authPasswordValidator.validatePassword(input.password, input.email);
      const strength = authPasswordValidator.getPasswordStrengthLabel(result.score);
      return {
        ...result,
        strength: strength.label,
        strengthColor: strength.color,
      };
    }),

  oauthStatus: publicProcedure.query(() => {
    return authOAuth.getOAuthStatus();
  }),

  oauthAuthorizeUrl: publicProcedure
    .input(z.object({
      provider: z.enum(["github", "google"]),
    }))
    .query(({ input, ctx }) => {
      const state = authOAuth.generateOAuthState();

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });

      const url = authOAuth.getOAuthAuthorizeUrl(input.provider, state);
      return { url, state };
    }),

  oauthCallback: publicProcedure
    .input(z.object({
      provider: z.enum(["github", "google"]),
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const storedState = ctx.req.cookies?.oauth_state;
      if (!storedState || storedState !== input.state) {
        return { success: false, error: "Invalid state parameter. Please try again." };
      }

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie('oauth_state', cookieOptions);

      const result = await authOAuth.handleOAuthCallback(input.provider, input.code);

      if (result.success && result.accessToken) {
        ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
        ctx.res.cookie('jwt_refresh', result.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
      }

      return result;
    }),

  refreshToken: publicProcedure.mutation(async ({ ctx }) => {
    const refreshToken = ctx.req.cookies?.jwt_refresh;

    if (!refreshToken) {
      return { success: false, error: "No refresh token" };
    }

    const result = await authStandalone.refreshAccessToken(refreshToken);

    if (result.success && result.accessToken) {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie('jwt_token', result.accessToken, cookieOptions);
    }

    return result;
  }),

  getWalletNonce: publicProcedure
    .input(z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    }))
    .mutation(async ({ input }) => {
      const nonce = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + WALLET_NONCE_EXPIRY_MS;
      const message = `Sign this message to authenticate with Awareness Market.\n\nNonce: ${nonce}\nAddress: ${input.address}\nTimestamp: ${new Date().toISOString()}`;

      walletNonces.set(input.address.toLowerCase(), { nonce, expiresAt });

      return { message, nonce, expiresAt };
    }),

  walletLogin: publicProcedure
    .input(z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
      signature: z.string(),
      message: z.string(),
      nonce: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const storedNonce = walletNonces.get(input.address.toLowerCase());
        if (!storedNonce || storedNonce.nonce !== input.nonce) {
          return { success: false, error: 'Invalid or expired nonce. Please request a new one.' };
        }
        if (Date.now() > storedNonce.expiresAt) {
          walletNonces.delete(input.address.toLowerCase());
          return { success: false, error: 'Nonce has expired. Please request a new one.' };
        }
        walletNonces.delete(input.address.toLowerCase());

        if (!input.message.includes(input.nonce)) {
          return { success: false, error: 'Message does not contain the expected nonce.' };
        }

        const { verifyMessage } = await import('viem');
        const isValid = await verifyMessage({
          address: input.address as `0x${string}`,
          message: input.message,
          signature: input.signature as `0x${string}`,
        });

        if (!isValid) {
          return { success: false, error: 'Signature verification failed' };
        }

        let user = await prisma.user.findUnique({
          where: { walletAddress: input.address.toLowerCase() }
        });

        if (!user) {
          const agentName = `Wallet-${input.address.slice(2, 8)}`;
          user = await prisma.user.create({
            data: {
              walletAddress: input.address.toLowerCase(),
              name: agentName,
              email: `${input.address.toLowerCase()}@wallet.awareness.market`,
              role: 'consumer',
              userType: 'consumer',
              onboardingCompleted: false,
              loginMethod: 'metamask-wallet',
              creditsBalance: 1000.0,
              totalMemories: 0,
              totalResonances: 0,
            }
          });
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastSignedIn: new Date() }
          });
        }

        const accessToken = authStandalone.generateAccessToken(user);
        const refreshToken = authStandalone.generateRefreshToken(user);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('jwt_token', accessToken, cookieOptions);
        ctx.res.cookie('jwt_refresh', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            address: input.address,
            role: user.role,
          },
        };
      } catch (error: any) {
        return { success: false, error: 'Wallet authentication failed' };
      }
    }),
});
