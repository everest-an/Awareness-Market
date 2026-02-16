#!/usr/bin/env tsx
/**
 * Backfill Script for v3.0 Organizations
 *
 * Migrates existing MemoryEntry records to the new v3.0 organization structure.
 *
 * What this script does:
 * 1. Creates a default "Legacy" organization for existing memories
 * 2. Creates a "General" department under the default organization
 * 3. Associates all existing MemoryEntry records with the default organization
 * 4. Optionally migrates existing users to organization memberships
 *
 * Usage:
 *   npx tsx scripts/backfill-v3-organizations.ts [--dry-run] [--migrate-users]
 *
 * Flags:
 *   --dry-run: Preview changes without committing to database
 *   --migrate-users: Also create org memberships for existing users
 */

import { prisma } from '../server/db-prisma';
import { OrgPlanTier } from '@prisma/client';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ORG = {
  name: 'Legacy Organization',
  slug: 'legacy',
  description: 'Default organization for pre-v3.0 memories and users',
  planTier: OrgPlanTier.enterprise, // Give legacy org enterprise features
};

const DEFAULT_DEPT = {
  name: 'General',
  slug: 'general',
  description: 'Default department for legacy memories',
};

// ============================================================================
// Parse CLI Arguments
// ============================================================================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const migrateUsers = args.includes('--migrate-users');

if (dryRun) {
  warning('DRY RUN MODE: No changes will be committed to the database\n');
}

// ============================================================================
// Step 1: Check Current State
// ============================================================================

async function checkCurrentState() {
  log('\n📊 Checking current database state...', 'blue');

  const memoryCount = await prisma.memoryEntry.count();
  const memoriesWithOrg = await prisma.memoryEntry.count({
    where: { organizationId: { not: null } },
  });
  const memoriesWithoutOrg = memoryCount - memoriesWithOrg;

  const userCount = await prisma.user.count();
  const orgCount = await prisma.organization.count();
  const deptCount = await prisma.department.count();
  const membershipCount = await prisma.orgMembership.count();

  info(`Total memories: ${memoryCount}`);
  info(`Memories with organization: ${memoriesWithOrg}`);
  info(`Memories without organization: ${memoriesWithoutOrg}`);
  info(`Total users: ${userCount}`);
  info(`Total organizations: ${orgCount}`);
  info(`Total departments: ${deptCount}`);
  info(`Total memberships: ${membershipCount}`);

  return {
    memoryCount,
    memoriesWithOrg,
    memoriesWithoutOrg,
    userCount,
    orgCount,
    deptCount,
    membershipCount,
  };
}

// ============================================================================
// Step 2: Create Default Organization
// ============================================================================

async function createDefaultOrganization() {
  log('\n🏢 Creating default organization...', 'blue');

  // Check if default org already exists
  const existing = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORG.slug },
  });

  if (existing) {
    info(`Default organization already exists (ID: ${existing.id})`);
    return existing;
  }

  if (dryRun) {
    info(`[DRY RUN] Would create organization: ${DEFAULT_ORG.name}`);
    return null;
  }

  // Get first user as owner (or create a system user)
  let ownerId: number;
  const firstUser = await prisma.user.findFirst({
    orderBy: { id: 'asc' },
  });

  if (firstUser) {
    ownerId = firstUser.id;
    info(`Using first user as owner (ID: ${ownerId})`);
  } else {
    warning('No users found, creating system user as owner');
    const systemUser = await prisma.user.create({
      data: {
        email: 'system@awareness.market',
        name: 'System',
        role: 'admin',
        userType: 'consumer',
        onboardingCompleted: true,
        loginMethod: 'email',
        creditsBalance: 0,
        totalMemories: 0,
        totalResonances: 0,
      },
    });
    ownerId = systemUser.id;
  }

  // Create organization with transaction
  const org = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: DEFAULT_ORG.name,
        slug: DEFAULT_ORG.slug,
        description: DEFAULT_ORG.description,
        planTier: DEFAULT_ORG.planTier,
        maxAgents: 9999, // Unlimited for legacy
        maxMemories: 10000000, // Unlimited for legacy
        maxDepartments: 200,
        enableMemoryPools: true,
        enableDecisions: true,
        enableVerification: true,
      },
    });

    // Create owner membership
    await tx.orgMembership.create({
      data: {
        userId: ownerId,
        organizationId: newOrg.id,
        role: 'owner',
      },
    });

    success(`Created organization: ${newOrg.name} (ID: ${newOrg.id})`);
    return newOrg;
  });

  return org;
}

// ============================================================================
// Step 3: Create Default Department
// ============================================================================

async function createDefaultDepartment(orgId: number) {
  log('\n🏗️  Creating default department...', 'blue');

  // Check if department already exists
  const existing = await prisma.department.findFirst({
    where: {
      organizationId: orgId,
      slug: DEFAULT_DEPT.slug,
    },
  });

  if (existing) {
    info(`Default department already exists (ID: ${existing.id})`);
    return existing;
  }

  if (dryRun) {
    info(`[DRY RUN] Would create department: ${DEFAULT_DEPT.name}`);
    return null;
  }

  const dept = await prisma.department.create({
    data: {
      organizationId: orgId,
      name: DEFAULT_DEPT.name,
      slug: DEFAULT_DEPT.slug,
      description: DEFAULT_DEPT.description,
    },
  });

  success(`Created department: ${dept.name} (ID: ${dept.id})`);
  return dept;
}

// ============================================================================
// Step 4: Migrate Memories to Organization
// ============================================================================

async function migrateMemoriesToOrganization(orgId: number) {
  log('\n🔄 Migrating memories to organization...', 'blue');

  // Count memories without organization
  const memoriesWithoutOrg = await prisma.memoryEntry.count({
    where: { organizationId: null },
  });

  if (memoriesWithoutOrg === 0) {
    success('All memories already have an organization');
    return 0;
  }

  info(`Found ${memoriesWithoutOrg} memories without organization`);

  if (dryRun) {
    info(`[DRY RUN] Would update ${memoriesWithoutOrg} memories`);
    return memoriesWithoutOrg;
  }

  // Update in batches to avoid timeout
  const batchSize = 1000;
  let updated = 0;
  let batch = 0;

  while (true) {
    const result = await prisma.memoryEntry.updateMany({
      where: { organizationId: null },
      data: { organizationId: orgId },
      take: batchSize,
    });

    updated += result.count;
    batch++;

    if (result.count === 0) {
      break;
    }

    info(`Batch ${batch}: Updated ${result.count} memories (total: ${updated})`);

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  success(`Migrated ${updated} memories to organization ${orgId}`);
  return updated;
}

// ============================================================================
// Step 5: Migrate Users to Organization Memberships
// ============================================================================

async function migrateUsersToMemberships(orgId: number) {
  log('\n👥 Migrating users to organization memberships...', 'blue');

  if (!migrateUsers) {
    info('Skipping user migration (use --migrate-users to enable)');
    return 0;
  }

  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  info(`Found ${users.length} users`);

  // Check existing memberships
  const existingMemberships = await prisma.orgMembership.findMany({
    where: { organizationId: orgId },
    select: { userId: true },
  });
  const existingUserIds = new Set(existingMemberships.map((m) => m.userId));

  const usersToMigrate = users.filter((u) => !existingUserIds.has(u.id));

  if (usersToMigrate.length === 0) {
    success('All users already have memberships');
    return 0;
  }

  info(`${usersToMigrate.length} users need memberships`);

  if (dryRun) {
    info(`[DRY RUN] Would create ${usersToMigrate.length} memberships`);
    return usersToMigrate.length;
  }

  // Create memberships in batches
  const batchSize = 100;
  let created = 0;

  for (let i = 0; i < usersToMigrate.length; i += batchSize) {
    const batch = usersToMigrate.slice(i, i + batchSize);

    await prisma.orgMembership.createMany({
      data: batch.map((user) => ({
        userId: user.id,
        organizationId: orgId,
        role: 'member' as const,
      })),
      skipDuplicates: true,
    });

    created += batch.length;
    info(`Created ${batch.length} memberships (total: ${created}/${usersToMigrate.length})`);
  }

  success(`Created ${created} organization memberships`);
  return created;
}

// ============================================================================
// Step 6: Update Organization Counters
// ============================================================================

async function updateOrganizationCounters(orgId: number) {
  log('\n🔢 Updating organization counters...', 'blue');

  const memoryCount = await prisma.memoryEntry.count({
    where: { organizationId: orgId },
  });

  const agentCount = await prisma.agentAssignment.count({
    where: { organizationId: orgId, isActive: true },
  });

  if (dryRun) {
    info(`[DRY RUN] Would set counters: memories=${memoryCount}, agents=${agentCount}`);
    return;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      currentMemoryCount: memoryCount,
      currentAgentCount: agentCount,
    },
  });

  success(`Updated counters: ${memoryCount} memories, ${agentCount} agents`);
}

// ============================================================================
// Step 7: Verify Migration
// ============================================================================

async function verifyMigration() {
  log('\n✅ Verifying migration...', 'blue');

  const memoriesWithoutOrg = await prisma.memoryEntry.count({
    where: { organizationId: null },
  });

  if (memoriesWithoutOrg > 0) {
    error(`Found ${memoriesWithoutOrg} memories still without organization!`);
    return false;
  }

  success('All memories have been migrated to an organization');

  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          memories: true,
          departments: true,
          memberships: true,
        },
      },
    },
  });

  log('\n📊 Final State:', 'blue');
  for (const org of orgs) {
    info(`Organization: ${org.name} (${org.slug})`);
    info(`  - Memories: ${org._count.memories}`);
    info(`  - Departments: ${org._count.departments}`);
    info(`  - Members: ${org._count.memberships}`);
    info(`  - Plan: ${org.planTier}`);
  }

  return true;
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function main() {
  log('╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Awareness Network v3.0 - Organization Backfill       ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  try {
    // Step 1: Check current state
    const state = await checkCurrentState();

    if (state.memoriesWithoutOrg === 0) {
      success('\n✅ All memories already have organizations. Nothing to migrate!');
      process.exit(0);
    }

    // Step 2: Create default organization
    const org = await createDefaultOrganization();
    const orgId = org?.id;

    if (!orgId && !dryRun) {
      error('Failed to create or find default organization');
      process.exit(1);
    }

    // Use a dummy ID for dry run
    const effectiveOrgId = orgId || 1;

    // Step 3: Create default department
    await createDefaultDepartment(effectiveOrgId);

    // Step 4: Migrate memories
    const migratedMemories = await migrateMemoriesToOrganization(effectiveOrgId);

    // Step 5: Migrate users (optional)
    const migratedUsers = await migrateUsersToMemberships(effectiveOrgId);

    // Step 6: Update counters
    await updateOrganizationCounters(effectiveOrgId);

    // Step 7: Verify
    if (!dryRun) {
      const verified = await verifyMigration();
      if (!verified) {
        error('\n❌ Migration verification failed!');
        process.exit(1);
      }
    }

    // Summary
    log('\n' + '═'.repeat(60), 'cyan');
    log('MIGRATION SUMMARY', 'cyan');
    log('═'.repeat(60), 'cyan');

    if (dryRun) {
      warning('DRY RUN - No changes were made');
    } else {
      success(`Created organization: ${DEFAULT_ORG.name}`);
      success(`Created department: ${DEFAULT_DEPT.name}`);
      success(`Migrated ${migratedMemories} memories`);
      if (migrateUsers) {
        success(`Migrated ${migratedUsers} users`);
      }
    }

    log('\n✅ Migration completed successfully!', 'green');

    if (dryRun) {
      info('\n💡 Run without --dry-run to apply changes');
    } else {
      info('\n💡 Next steps:');
      info('  1. Run database migrations: npx prisma migrate deploy');
      info('  2. Start workers: see SECURITY_DEPLOYMENT_GUIDE.md');
      info('  3. Enable feature flags: set ENABLE_ORGANIZATIONS=true');
    }
  } catch (err: any) {
    error(`\n❌ Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();
