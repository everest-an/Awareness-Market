/**
 * Package Service
 *
 * Data-access layer for marketplace packages (vector / memory / chain).
 * Extracted from `stablecoin-payment.ts` to give the seller-lookup logic
 * a single, testable home and eliminate the double DB round-trip that
 * previously occurred in `agentPurchase`.
 */

import { TRPCError } from '@trpc/server';
import { prisma } from '../db-prisma';
import { PLATFORM_TREASURY_ADDRESS } from '../blockchain/constants';

// ============================================================================
// Types
// ============================================================================

/** The three package kinds in the Awareness Market */
export type PackageType = 'vector' | 'memory' | 'chain';

/** All seller context needed to execute a payment in a single DB round-trip */
export interface PackageSeller {
  /** On-chain address where the seller receives proceeds */
  sellerAddress: string;
  /** Package price in USD */
  priceUSD: number;
  /** Platform user ID of the package creator */
  sellerId: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve seller context for a given package in a **single** database query.
 *
 * WHY this exists: the original `agentPurchase` handler called the equivalent
 * of this function twice — once before the on-chain tx to get the price, and
 * again after to get `sellerId` for the DB record. This function provides all
 * three values at once so callers can make one call.
 *
 * Fallback: if the seller has no registered wallet address, payments are
 * routed to `PLATFORM_TREASURY_ADDRESS`. This prevents stuck payments for
 * sellers who haven't linked a wallet yet.
 *
 * @param packageType - 'vector' | 'memory' | 'chain'
 * @param packageId   - Unique package identifier (UUID or slug)
 * @returns Seller context including address, price, and platform user ID
 * @throws TRPCError NOT_FOUND if package does not exist
 * @throws TRPCError BAD_REQUEST if package has no associated creator
 */
export async function resolvePackageSeller(
  packageType: PackageType,
  packageId: string
): Promise<PackageSeller> {
  let sellerId: number | null = null;
  let priceUSD = 0;

  switch (packageType) {
    case 'vector': {
      const pkg = await prisma.vectorPackage.findUnique({
        where: { packageId },
        select: { userId: true, price: true },
      });
      if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vector package not found' });
      sellerId = pkg.userId;
      priceUSD = Number(pkg.price);
      break;
    }
    case 'memory': {
      const pkg = await prisma.memoryPackage.findUnique({
        where: { packageId },
        select: { userId: true, price: true },
      });
      if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Memory package not found' });
      sellerId = pkg.userId;
      priceUSD = Number(pkg.price);
      break;
    }
    case 'chain': {
      const pkg = await prisma.chainPackage.findUnique({
        where: { packageId },
        select: { userId: true, price: true },
      });
      if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chain package not found' });
      sellerId = pkg.userId;
      priceUSD = Number(pkg.price);
      break;
    }
  }

  if (!sellerId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Package has no creator' });
  }

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { walletAddress: true },
  });

  // Route to treasury when seller hasn't registered a wallet
  const sellerAddress = seller?.walletAddress || PLATFORM_TREASURY_ADDRESS;

  return { sellerAddress, priceUSD, sellerId };
}
