/**
 * V3 Migration / Backfill Script
 *
 * Run this AFTER applying 03_add_v3_governance_models.sql to your database.
 *
 * What it does:
 * 1. Creates a default organization for existing users (if none exists)
 * 2. Sets pool_type='domain' on all memory_entries missing a pool_type
 * 3. Creates default memory pools (private/domain/global) for each org
 * 4. Initializes reputation records for active agents
 *
 * Usage:
 *   npx tsx scripts/migrate-v3-backfill.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[v3-backfill] Starting v3 migration backfill...\n');

  // ========================================================================
  // Step 1: Create default organization for existing users
  // ========================================================================
  console.log('[Step 1] Checking for existing organizations...');

  const orgCount = await prisma.organization.count();
  let defaultOrgId: number;

  if (orgCount === 0) {
    console.log('  No organizations found. Creating default org...');

    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { id: 'asc' },
    });

    const org = await prisma.organization.create({
      data: {
        name: 'Default Organization',
        slug: 'default-org',
        planTier: 'team',
        maxAgents: 32,
        maxMemories: 100000,
        maxDepartments: 10,
        enableMemoryPools: true,
        enableDecisions: true,
        ownerId: adminUser?.id || 1,
      },
    });

    defaultOrgId = org.id;
    console.log(`  Created default org: id=${org.id}, name="${org.name}"`);

    // Add admin as owner member
    if (adminUser) {
      await prisma.orgMembership.create({
        data: {
          organizationId: org.id,
          userId: adminUser.id,
          role: 'owner',
        },
      });
      console.log(`  Added admin user ${adminUser.id} as owner`);
    }
  } else {
    const firstOrg = await prisma.organization.findFirst({ orderBy: { id: 'asc' } });
    defaultOrgId = firstOrg!.id;
    console.log(`  Found ${orgCount} existing organization(s). Default org id=${defaultOrgId}`);
  }

  // ========================================================================
  // Step 2: Backfill pool_type on memory_entries
  // ========================================================================
  console.log('\n[Step 2] Backfilling pool_type on memory_entries...');

  const updated = await prisma.memoryEntry.updateMany({
    where: { poolType: { not: { in: ['private', 'domain', 'global'] } } },
    data: { poolType: 'domain' },
  });

  console.log(`  Updated ${updated.count} memories with pool_type='domain'`);

  // Set organizationId where missing
  const orphanMemories = await prisma.memoryEntry.updateMany({
    where: { organizationId: null as any },
    data: { organizationId: defaultOrgId },
  });

  console.log(`  Assigned ${orphanMemories.count} orphan memories to org ${defaultOrgId}`);

  // ========================================================================
  // Step 3: Create default memory pools
  // ========================================================================
  console.log('\n[Step 3] Creating default memory pools...');

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of orgs) {
    for (const poolType of ['private', 'domain', 'global'] as const) {
      const existing = await prisma.memoryPool.findFirst({
        where: { organizationId: org.id, poolType, departmentId: null },
      });

      if (!existing) {
        await prisma.memoryPool.create({
          data: {
            organizationId: org.id,
            poolType,
            promotionThreshold: poolType === 'domain' ? 5 : 10,
            promotionMinScore: poolType === 'domain' ? 60 : 75,
            autoPromote: poolType === 'domain',
          },
        });
        console.log(`  Created ${poolType} pool for org "${org.name}" (${org.id})`);
      } else {
        console.log(`  ${poolType} pool already exists for org "${org.name}" (${org.id})`);
      }
    }
  }

  // ========================================================================
  // Step 4: Initialize reputation for active agents
  // ========================================================================
  console.log('\n[Step 4] Initializing agent reputations...');

  const agents = await prisma.agentAssignment.findMany({
    where: { isActive: true },
    select: { agentId: true, organizationId: true },
  });

  let reputationCreated = 0;

  for (const agent of agents) {
    const existing = await prisma.agentReputation.findFirst({
      where: {
        agentId: agent.agentId,
        organizationId: agent.organizationId,
        departmentId: null,
      },
    });

    if (!existing) {
      await prisma.agentReputation.create({
        data: {
          agentId: agent.agentId,
          organizationId: agent.organizationId,
          departmentId: null,
        },
      });
      reputationCreated++;
    }
  }

  console.log(`  Created ${reputationCreated} agent reputation records (${agents.length} agents total)`);

  // ========================================================================
  // Done
  // ========================================================================
  console.log('\n[v3-backfill] Migration complete!');
  console.log('  Summary:');
  console.log(`  - Organizations: ${orgs.length}`);
  console.log(`  - Memories backfilled: ${updated.count}`);
  console.log(`  - Memory pools created: ${orgs.length * 3}`);
  console.log(`  - Agent reputations initialized: ${reputationCreated}`);
}

main()
  .catch((e) => {
    console.error('[v3-backfill] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
