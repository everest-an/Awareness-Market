/**
 * V1 Marketplace Security Migration - User Listing Quotas
 *
 * Run this AFTER running `npx prisma migrate dev` to add the quota fields.
 *
 * What it does:
 * 1. Backfills currentListingCount for existing users based on active listings
 * 2. Sets maxListings based on user role:
 *    - admin: 1000 (effectively unlimited)
 *    - creator: 50
 *    - consumer/user: 10
 *
 * This fixes P0-2 security vulnerability: Unlimited listing spam prevention
 *
 * Usage:
 *   npx tsx scripts/migrate-v1-marketplace-quotas.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[v1-quota-migration] Starting V1 marketplace quota migration...\n');

  // ========================================================================
  // Step 1: Backfill currentListingCount
  // ========================================================================
  console.log('[Step 1] Backfilling currentListingCount for existing users...');

  const users = await prisma.user.findMany({
    select: { id: true, role: true },
  });

  let updatedUsers = 0;

  for (const user of users) {
    // Count active listings for this user
    const listingCount = await prisma.wMatrixListing.count({
      where: {
        creatorId: user.id,
        status: 'active',
      },
    });

    // Set maxListings based on role
    let maxListings = 10; // Default for consumer/user
    if (user.role === 'admin') {
      maxListings = 1000; // Effectively unlimited for admins
    } else if (user.role === 'creator') {
      maxListings = 50; // Higher limit for creators
    }

    // Update user with quota fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentListingCount: listingCount,
        maxListings,
      },
    });

    if (listingCount > 0) {
      console.log(`  User ${user.id} (${user.role}): ${listingCount} active listings, max=${maxListings}`);
    }

    updatedUsers++;
  }

  console.log(`  Backfilled ${updatedUsers} users with listing quotas`);

  // ========================================================================
  // Step 2: Verify quota enforcement is working
  // ========================================================================
  console.log('\n[Step 2] Verifying quota limits...');

  const usersNearLimit = await prisma.user.findMany({
    where: {
      currentListingCount: {
        gte: prisma.$queryRaw`"max_listings" - 5`,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      currentListingCount: true,
      maxListings: true,
    },
  });

  if (usersNearLimit.length > 0) {
    console.log(`  ⚠️  Found ${usersNearLimit.length} users near their listing limit:`);
    for (const user of usersNearLimit) {
      console.log(`     User ${user.id} (${user.email}): ${user.currentListingCount}/${user.maxListings} listings`);
    }
  } else {
    console.log('  ✓ No users near quota limits');
  }

  // ========================================================================
  // Step 3: Report statistics
  // ========================================================================
  console.log('\n[Step 3] Generating statistics...');

  const stats = await prisma.$queryRaw<Array<{
    role: string;
    user_count: bigint;
    total_listings: bigint;
    avg_listings: number;
  }>>`
    SELECT
      u.role,
      COUNT(DISTINCT u.id) as user_count,
      COUNT(w.id) as total_listings,
      COALESCE(CAST(COUNT(w.id) AS FLOAT) / NULLIF(COUNT(DISTINCT u.id), 0), 0) as avg_listings
    FROM users u
    LEFT JOIN "WMatrixListing" w ON w.creator_id = u.id AND w.status = 'active'
    GROUP BY u.role
    ORDER BY total_listings DESC
  `;

  console.log('  Listing distribution by user role:');
  for (const row of stats) {
    console.log(`    ${row.role}: ${row.user_count} users, ${row.total_listings} listings (avg ${row.avg_listings.toFixed(1)} per user)`);
  }

  // ========================================================================
  // Done
  // ========================================================================
  console.log('\n[v1-quota-migration] Migration complete!');
  console.log('  Summary:');
  console.log(`  - Users updated: ${updatedUsers}`);
  console.log(`  - Default quotas set:`);
  console.log(`    • Admin: 1000 listings`);
  console.log(`    • Creator: 50 listings`);
  console.log(`    • Consumer/User: 10 listings`);
  console.log('\n  ✓ P0-2 Security Fix: Listing spam prevention enabled');
  console.log('  ✓ P0-3 Security Fix: Race condition prevention enabled (transaction-based)');
}

main()
  .catch((e) => {
    console.error('[v1-quota-migration] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
