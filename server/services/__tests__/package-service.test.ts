/**
 * Unit tests for package-service.ts — resolvePackageSeller
 *
 * Uses Vitest's mocking to stub Prisma, so no real DB is needed.
 * Tests the three package type branches and the treasury fallback logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Mock prisma before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../../db-prisma', () => ({
  prisma: {
    vectorPackage: { findUnique: vi.fn() },
    memoryPackage: { findUnique: vi.fn() },
    chainPackage: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

// Mock constants so tests don't depend on env vars
vi.mock('../../blockchain/constants', () => ({
  PLATFORM_TREASURY_ADDRESS: '0xTREASURY',
}));

import { resolvePackageSeller } from '../package-service';
import { prisma } from '../../db-prisma';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPkg = (userId: number, price: number) => ({
  userId,
  price,
});

const mockUser = (walletAddress: string | null) => ({ walletAddress });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolvePackageSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('vector packages', () => {
    it('resolves seller address and price for a vector package', async () => {
      vi.mocked(prisma.vectorPackage.findUnique).mockResolvedValue(mockPkg(42, 9.99) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('0xSELLER') as any);

      const result = await resolvePackageSeller('vector', 'pkg-abc');

      expect(result.priceUSD).toBe(9.99);
      expect(result.sellerId).toBe(42);
      expect(result.sellerAddress).toBe('0xSELLER');
    });

    it('throws NOT_FOUND when vector package does not exist', async () => {
      vi.mocked(prisma.vectorPackage.findUnique).mockResolvedValue(null);

      await expect(resolvePackageSeller('vector', 'nonexistent')).rejects.toThrow(TRPCError);

      const call = resolvePackageSeller('vector', 'nonexistent').catch((e) => e);
      const err = await call;
      expect((err as TRPCError).code).toBe('NOT_FOUND');
    });
  });

  describe('memory packages', () => {
    it('resolves a memory package seller', async () => {
      vi.mocked(prisma.memoryPackage.findUnique).mockResolvedValue(mockPkg(7, 24.99) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('0xMEMORY_SELLER') as any);

      const result = await resolvePackageSeller('memory', 'mem-xyz');
      expect(result.priceUSD).toBe(24.99);
      expect(result.sellerAddress).toBe('0xMEMORY_SELLER');
    });
  });

  describe('chain packages', () => {
    it('resolves a chain package seller', async () => {
      vi.mocked(prisma.chainPackage.findUnique).mockResolvedValue(mockPkg(99, 49.0) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser('0xCHAIN_SELLER') as any);

      const result = await resolvePackageSeller('chain', 'chain-001');
      expect(result.priceUSD).toBe(49.0);
      expect(result.sellerAddress).toBe('0xCHAIN_SELLER');
    });
  });

  describe('treasury fallback', () => {
    it('uses PLATFORM_TREASURY_ADDRESS when seller has no registered wallet', async () => {
      vi.mocked(prisma.vectorPackage.findUnique).mockResolvedValue(mockPkg(5, 10.0) as any);
      // Seller record exists but walletAddress is null
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser(null) as any);

      const result = await resolvePackageSeller('vector', 'no-wallet-pkg');
      expect(result.sellerAddress).toBe('0xTREASURY');
    });

    it('uses PLATFORM_TREASURY_ADDRESS when seller user record does not exist', async () => {
      vi.mocked(prisma.vectorPackage.findUnique).mockResolvedValue(mockPkg(5, 10.0) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await resolvePackageSeller('vector', 'no-user-pkg');
      expect(result.sellerAddress).toBe('0xTREASURY');
    });
  });
});
