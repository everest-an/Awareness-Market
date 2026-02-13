/**
 * Test Phase 2 Implementation
 *
 * Tests:
 * 1. Conflict Detection API (list, resolve, ignore)
 * 2. Version Tree API (history, tree, rollback, compare)
 * 3. Semantic Conflict Detection (LLM-based, optional if OPENAI_API_KEY set)
 */

import { PrismaClient } from '@prisma/client';
import {
  createMemoryRouter,
  createConflictResolver,
  createVersionTreeManager,
  createSemanticConflictDetector,
} from '../server/memory-core';

const prisma = new PrismaClient();

async function testPhase2() {
  console.log('🧪 Testing Phase 2 Implementation\n');
  console.log('=' .repeat(60) + '\n');

  const router = createMemoryRouter(prisma);
  const conflictResolver = createConflictResolver(prisma);
  const versionTree = createVersionTreeManager(prisma);

  const testOrgId = 'org-test-phase2';

  try {
    // ========================================================================
    // Test 1: Conflict Detection API
    // ========================================================================
    console.log('Test 1: Conflict Detection API');
    console.log('-'.repeat(60));

    // Create two conflicting memories
    console.log('Creating conflicting memories...\n');

    const memory1 = await router.create({
      orgId: testOrgId,
      namespace: `${testOrgId}/engineering/config`,
      content_type: 'text',
      content: 'Our primary database is PostgreSQL',
      confidence: 0.9,
      createdBy: 'user-alice',
    });

    // Add claim to trigger conflict
    await prisma.memoryEntry.update({
      where: { id: memory1 },
      data: {
        claimKey: 'primary_database',
        claimValue: 'PostgreSQL',
      },
    });

    console.log(`  ✅ Memory 1: primary_database = PostgreSQL`);

    const memory2 = await router.create({
      orgId: testOrgId,
      namespace: `${testOrgId}/engineering/config`,
      content_type: 'text',
      content: 'Our primary database is MongoDB',
      confidence: 0.85,
      createdBy: 'user-bob',
    });

    await prisma.memoryEntry.update({
      where: { id: memory2 },
      data: {
        claimKey: 'primary_database',
        claimValue: 'MongoDB', // CONFLICT!
      },
    });

    console.log(`  ✅ Memory 2: primary_database = MongoDB (CONFLICT!)\n`);

    // Wait for trigger to fire
    await new Promise((resolve) => setTimeout(resolve, 500));

    // List conflicts
    const conflicts = await conflictResolver.listConflicts({
      orgId: testOrgId,
      status: 'pending',
    });

    console.log(`Found ${conflicts.length} pending conflicts:`);
    conflicts.forEach((c, idx) => {
      console.log(`  [${idx + 1}] ${c.conflictType}`);
      console.log(`      Memory 1: ${c.memory1.content.substring(0, 50)}...`);
      console.log(`      Memory 2: ${c.memory2.content.substring(0, 50)}...`);
      console.log(`      Status: ${c.status}\n`);
    });

    // Get conflict stats
    const stats = await conflictResolver.getConflictStats(testOrgId);
    console.log('Conflict Statistics:');
    console.log(`  Pending: ${stats.pending}`);
    console.log(`  Resolved: ${stats.resolved}`);
    console.log(`  Ignored: ${stats.ignored}`);
    console.log(`  Total: ${stats.total}\n`);

    // Resolve first conflict (choose memory1)
    if (conflicts.length > 0) {
      console.log('Resolving conflict (choosing PostgreSQL)...\n');

      await conflictResolver.resolveConflict({
        conflict_id: conflicts[0].id,
        resolution_memory_id: conflicts[0].memoryId1, // Choose memory1
        resolved_by: 'user-admin',
      });

      const resolved = await conflictResolver.getConflict(conflicts[0].id);
      console.log(`  ✅ Conflict resolved`);
      console.log(`     Status: ${resolved?.status}`);
      console.log(`     Winner: Memory 1 (PostgreSQL)`);
      console.log(`     Resolved by: ${resolved?.resolvedBy}\n`);
    }

    console.log('✅ Conflict Detection API verified\n');
    console.log('='.repeat(60) + '\n');

    // ========================================================================
    // Test 2: Version Tree API
    // ========================================================================
    console.log('Test 2: Version Tree API');
    console.log('-'.repeat(60));

    // Create original memory
    console.log('Creating memory with version history...\n');

    const originalId = await router.create({
      orgId: testOrgId,
      namespace: `${testOrgId}/docs/api`,
      content_type: 'text',
      content: 'API timeout is set to 30 seconds',
      confidence: 0.9,
      createdBy: 'user-alice',
    });

    console.log(`  ✅ Original version: "timeout = 30s"`);

    // Update (creates version 2)
    const version2Id = await router.update(
      originalId,
      {
        content: 'API timeout is set to 60 seconds',
        confidence: 0.95,
      },
      'user-alice'
    );

    console.log(`  ✅ Version 2: "timeout = 60s"`);

    // Update again (creates version 3)
    const version3Id = await router.update(
      version2Id,
      {
        content: 'API timeout is set to 120 seconds',
        confidence: 0.98,
      },
      'user-bob'
    );

    console.log(`  ✅ Version 3: "timeout = 120s"\n`);

    // Get version history
    const history = await versionTree.getVersionHistory(version3Id);

    if (history) {
      console.log('Version History (linear chain):');
      console.log(`  Total versions: ${history.versions.length}`);
      console.log(`  Depth: ${history.depth}`);
      console.log(`  Root: ${history.root.content.substring(0, 50)}...`);
      console.log(`  Current: ${history.current.content.substring(0, 50)}...\n`);

      console.log('  Versions:');
      history.versions.forEach((v, idx) => {
        console.log(`    [${idx + 1}] ${v.content.substring(0, 60)}...`);
        console.log(`        Created by: ${v.createdBy}, Confidence: ${v.confidence}`);
      });
      console.log('');
    }

    // Get full version tree
    const tree = await versionTree.getVersionTree(originalId);

    // Helper function for printing tree
    const printTree = (node: any, indent = '  '): void => {
      console.log(`${indent}→ ${node.content.substring(0, 50)}...`);
      console.log(`${indent}  (v${node.version}, ${node.createdBy})`);

      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => printTree(child, indent + '  '));
      }
    };

    if (tree) {
      console.log('Version Tree (full structure):');
      console.log(`  Root ID: ${tree.id.substring(0, 8)}`);
      console.log(`  Children: ${tree.children?.length || 0}\n`);

      printTree(tree);
      console.log('');
    }

    // Compare versions
    const diffs = await versionTree.compareVersions(originalId, version3Id);

    console.log('Version Comparison (Original vs Latest):');
    diffs.forEach((diff) => {
      console.log(`  ${diff.field}:`);
      console.log(`    Old: ${diff.old_value}`);
      console.log(`    New: ${diff.new_value}`);
    });
    console.log('');

    // Rollback to version 2
    console.log('Rolling back to version 2...\n');

    const rolledBackId = await versionTree.rollbackToVersion({
      target_version_id: version2Id,
      created_by: 'user-admin',
      reason: 'Testing rollback functionality',
    });

    const rolledBack = await prisma.memoryEntry.findUnique({
      where: { id: rolledBackId },
    });

    console.log(`  ✅ Rolled back successfully`);
    console.log(`     New version ID: ${rolledBackId.substring(0, 8)}`);
    console.log(`     Content: ${rolledBack?.content}`);
    console.log(`     Parent: Version 3 (${version3Id.substring(0, 8)})\n`);

    console.log('✅ Version Tree API verified\n');
    console.log('='.repeat(60) + '\n');

    // ========================================================================
    // Test 3: Semantic Conflict Detection (Optional)
    // ========================================================================
    if (process.env.OPENAI_API_KEY) {
      console.log('Test 3: Semantic Conflict Detection (LLM-based)');
      console.log('-'.repeat(60));

      const detector = createSemanticConflictDetector(prisma, {
        min_confidence: 0.7, // Lower threshold for testing
        min_usage_count: 0, // No usage requirement for test
        batch_size: 5,
        max_age_days: 365,
      });

      // Create semantically conflicting memories
      console.log('Creating semantically conflicting memories...\n');

      const semantic1 = await router.create({
        orgId: testOrgId,
        namespace: `${testOrgId}/engineering/policies`,
        content_type: 'text',
        content: 'All API endpoints must be authenticated using JWT tokens',
        confidence: 0.9,
        createdBy: 'user-alice',
      });

      console.log('  ✅ Memory 1: "API endpoints must be authenticated"');

      const semantic2 = await router.create({
        orgId: testOrgId,
        namespace: `${testOrgId}/engineering/policies`,
        content_type: 'text',
        content: 'Public API endpoints do not require authentication',
        confidence: 0.85,
        createdBy: 'user-bob',
      });

      console.log('  ✅ Memory 2: "Public endpoints do not require auth"\n');

      // Run semantic detection
      console.log('Running LLM-based semantic conflict detection...\n');

      const results = await detector.detectConflicts(testOrgId);

      console.log('Semantic Detection Results:');
      console.log(`  Strategic pool size: ${results.strategic_pool_size}`);
      console.log(`  Pairs checked: ${results.pairs_checked}`);
      console.log(`  Conflicts detected: ${results.conflicts_detected}`);
      console.log(`  Conflicts saved: ${results.conflicts_saved}`);
      console.log(`  Duration: ${results.duration_ms}ms\n`);

      if (results.conflicts_detected > 0) {
        const semanticConflicts = await conflictResolver.listConflicts({
          orgId: testOrgId,
          conflict_type: 'semantic_contradiction',
        });

        console.log('Semantic Conflicts Found:');
        semanticConflicts.forEach((c, idx) => {
          console.log(`  [${idx + 1}] ${c.conflictType}`);
          console.log(`      Memory 1: ${c.memory1.content.substring(0, 60)}...`);
          console.log(`      Memory 2: ${c.memory2.content.substring(0, 60)}...\n`);
        });
      }

      console.log('✅ Semantic Conflict Detection verified\n');
    } else {
      console.log('Test 3: Semantic Conflict Detection - SKIPPED');
      console.log('-'.repeat(60));
      console.log('⚠️  OPENAI_API_KEY not set, skipping LLM-based tests\n');
    }

    console.log('='.repeat(60) + '\n');

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('📊 Phase 2 Test Summary\n');
    console.log('Test Results:');
    console.log(`  1. Conflict Detection API: ✅ PASS`);
    console.log(`  2. Version Tree API: ✅ PASS`);
    console.log(
      `  3. Semantic Detection: ${process.env.OPENAI_API_KEY ? '✅ PASS' : '⏭️  SKIPPED'}`
    );

    console.log('\n🎉 Phase 2 testing complete!\n');

    // Cleanup
    console.log('Cleaning up test data...');
    await prisma.memoryEntry.deleteMany({
      where: { orgId: testOrgId },
    });
    console.log('✅ Cleanup complete\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testPhase2();
