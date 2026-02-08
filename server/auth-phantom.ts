/**
 * Phantom Auth - Pure API signature-based authentication
 *
 * Supports Python SDK's PhantomWallet without requiring browser-based WalletConnect.
 * Uses challenge-response authentication with ERC-191 message signatures.
 *
 * Flow:
 * 1. Client requests nonce: POST /api/phantom-auth/nonce
 * 2. Client signs message with private key
 * 3. Client sends signature: POST /api/phantom-auth/authenticate
 * 4. Server verifies signature and issues JWT
 */

import { z } from 'zod';
import { publicProcedure, router } from './_core/trpc';
import { verifyMessage } from 'viem';
import { prisma } from './db-prisma';
import jwt from 'jsonwebtoken';
import { logger } from './utils/logger';

// Redis for nonce storage (5 minute TTL)
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Phantom Auth Router
 * Provides nonce generation and signature verification endpoints
 */
export const phantomAuthRouter = router({
  /**
   * Get authentication nonce
   *
   * Generates a random nonce that must be signed by the client.
   * Nonce is valid for 5 minutes.
   */
  getNonce: publicProcedure
    .input(z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
    }))
    .mutation(async ({ input }) => {
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();

      const message = `Sign this message to authenticate with Awareness Network.

Address: ${input.address}
Nonce: ${nonce}
Timestamp: ${timestamp}

This request will not trigger a blockchain transaction or cost any gas fees.`;

      // Store nonce in Redis with 5-minute expiration
      try {
        const redis = await getRedis();
        await redis.setEx(
          `phantom-nonce:${input.address}`,
          300, // 5 minutes
          JSON.stringify({ nonce, timestamp })
        );
      } catch (error) {
        logger.warn('Redis unavailable, using in-memory nonce storage', { error });
        // Fallback: in-memory storage (not production-ready for multi-instance)
      }

      logger.info('Nonce generated for Phantom Auth', {
        address: input.address,
        nonce: nonce.substring(0, 8) + '...'
      });

      return {
        nonce,
        message,
        timestamp
      };
    }),

  /**
   * Authenticate with signature
   *
   * Verifies the signature and issues a JWT token.
   * Automatically creates user account if it doesn't exist.
   */
  authenticate: publicProcedure
    .input(z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/), // 65 bytes = 130 hex chars
      message: z.string()
    }))
    .mutation(async ({ input }) => {
      // 1. Verify signature using viem
      let isValid = false;
      try {
        isValid = await verifyMessage({
          address: input.address as `0x${string}`,
          message: input.message,
          signature: input.signature as `0x${string}`
        });
      } catch (error) {
        logger.error('Signature verification failed', { error, address: input.address });
        throw new Error('Invalid signature format');
      }

      if (!isValid) {
        logger.warn('Invalid signature', { address: input.address });
        throw new Error('Signature verification failed');
      }

      // 2. Verify nonce from Redis
      try {
        const redis = await getRedis();
        const storedData = await redis.get(`phantom-nonce:${input.address}`);

        if (!storedData) {
          throw new Error('Nonce expired or not found');
        }

        const { nonce, timestamp } = JSON.parse(storedData);

        // Check if message contains the correct nonce
        if (!input.message.includes(nonce)) {
          throw new Error('Invalid nonce in message');
        }

        // Check timestamp is recent (within 10 minutes)
        const age = Date.now() - timestamp;
        if (age > 600000) { // 10 minutes
          throw new Error('Nonce too old');
        }

        // Delete used nonce (one-time use)
        await redis.del(`phantom-nonce:${input.address}`);

      } catch (error) {
        logger.error('Nonce verification failed', { address: input.address });
        throw new Error('Nonce verification failed. Please request a new nonce and try again.');
      }

      // 3. Find or create user using Prisma
      let user = await prisma.user.findUnique({
        where: { walletAddress: input.address }
      });

      if (!user) {
        // Auto-create user account (zero-config experience)
        const agentName = `Agent-${input.address.slice(2, 8)}`;

        user = await prisma.user.create({
          data: {
            walletAddress: input.address,
            name: agentName,
            role: 'consumer',
            userType: 'consumer',
            onboardingCompleted: true, // Skip onboarding for API users
            loginMethod: 'phantom-wallet',
            creditsBalance: 1000.0, // Free credits for new agents
            totalMemories: 0,
            totalResonances: 0
          }
        });

        logger.info('New agent registered via Phantom Auth', {
          userId: user.id,
          address: input.address,
          name: agentName
        });
      } else {
        // Update last sign-in
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSignedIn: new Date() }
        });

        logger.info('Agent authenticated via Phantom Auth', {
          userId: user.id,
          address: input.address
        });
      }

      // 4. Issue JWT token
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
      }

      const token = jwt.sign(
        {
          userId: user.id,
          address: input.address,
          role: user.role,
          method: 'phantom-wallet'
        },
        JWT_SECRET,
        {
          expiresIn: '7d', // Wallet sessions use refresh token standard
          issuer: 'awareness-network',
          subject: user.id.toString()
        }
      );

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          address: input.address,
          role: user.role,
          creditsBalance: user.creditsBalance?.toString() || '0',
          totalMemories: user.totalMemories || 0
        },
        expiresIn: 604800 // 7 days in seconds (matches JWT expiresIn: '7d')
      };
    }),

  /**
   * Verify token (for middleware)
   */
  verifyToken: publicProcedure
    .input(z.object({
      token: z.string()
    }))
    .query(async ({ input }) => {
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
      }

      try {
        const decoded = jwt.verify(input.token, JWT_SECRET) as {
          userId: number;
          address: string;
          role: string;
        };

        const user = await prisma.user.findUnique({
          where: { id: decoded.userId }
        });

        if (!user) {
          throw new Error('User not found');
        }

        return {
          valid: true,
          user: {
            id: user.id,
            name: user.name,
            address: user.walletAddress,
            role: user.role
          }
        };
      } catch (error) {
        logger.warn('Token verification failed', { error });
        return {
          valid: false,
          error: error instanceof Error ? error.message : 'Invalid token'
        };
      }
    })
});

/**
 * Cleanup function (call on server shutdown)
 */
export async function closePhantomAuth() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
