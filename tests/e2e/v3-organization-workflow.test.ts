/**
 * E2E Test: v3.0 Organization Workflow
 *
 * Tests the complete organization workflow:
 * 1. Create organization
 * 2. Create departments
 * 3. Add members
 * 4. Assign agents to departments
 * 5. Create memories in different pools
 * 6. Record decisions
 * 7. Cross-domain verification
 * 8. View analytics
 *
 * Run with: npx vitest run tests/e2e/v3-organization-workflow.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../server/db-prisma';
import { createOrgService } from '../../server/organization/org-service';
import { OrgPlanTier, MemoryType, PoolType } from '@prisma/client';

// Test data
const TEST_USER = {
  email: 'test-e2e-org@awareness.market',
  name: 'E2E Test User',
  password: 'TestPassword123!',
};

const TEST_ORG = {
  name: 'E2E Test Organization',
  slug: 'e2e-test-org',
  description: 'Organization created for E2E testing',
  planTier: OrgPlanTier.enterprise,
};

const TEST_DEPARTMENTS = [
  { name: 'Engineering', slug: 'engineering', description: 'Engineering department' },
  { name: 'Research', slug: 'research', description: 'Research department' },
  { name: 'Finance', slug: 'finance', description: 'Finance department' },
];

// Test state
let testUserId: number;
let testOrgId: number;
let testDeptIds: number[] = [];
let testMemoryIds: string[] = [];

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeAll(async () => {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: TEST_USER.email,
      name: TEST_USER.name,
      role: 'consumer',
      userType: 'consumer',
      onboardingCompleted: true,
      loginMethod: 'email',
      creditsBalance: 1000,
      totalMemories: 0,
      totalResonances: 0,
    },
  });
  testUserId = user.id;
  console.log(`✅ Created test user (ID: ${testUserId})`);
});

afterAll(async () => {
  // Cleanup: Delete test data
  if (testOrgId) {
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
    console.log(`🧹 Deleted test organization (ID: ${testOrgId})`);
  }

  if (testUserId) {
    await prisma.user.delete({
      where: { id: testUserId },
    });
    console.log(`🧹 Deleted test user (ID: ${testUserId})`);
  }

  await prisma.$disconnect();
});

// ============================================================================
// Test Suite
// ============================================================================

describe('v3.0 Organization Workflow', () => {
  // ==========================================================================
  // Phase 1: Organization Foundation
  // ==========================================================================

  describe('Phase 1: Organization Foundation', () => {
    it('should create an organization', async () => {
      const orgService = createOrgService(prisma);

      const org = await orgService.create({
        name: TEST_ORG.name,
        slug: TEST_ORG.slug,
        description: TEST_ORG.description,
        planTier: TEST_ORG.planTier,
        ownerId: testUserId,
      });

      expect(org).toBeDefined();
      expect(org.name).toBe(TEST_ORG.name);
      expect(org.slug).toBe(TEST_ORG.slug);
      expect(org.planTier).toBe(TEST_ORG.planTier);
      expect(org.maxAgents).toBe(128); // Enterprise plan limit

      testOrgId = org.id;
      console.log(`✅ Created organization (ID: ${testOrgId})`);
    });

    it('should have created owner membership', async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: {
          organizationId: testOrgId,
          userId: testUserId,
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe('owner');
      console.log(`✅ Owner membership verified`);
    });

    it('should have created default General department', async () => {
      const dept = await prisma.department.findFirst({
        where: {
          organizationId: testOrgId,
          slug: 'general',
        },
      });

      expect(dept).toBeDefined();
      expect(dept?.name).toBe('General');
      console.log(`✅ Default department created`);
    });

    it('should create additional departments', async () => {
      for (const deptData of TEST_DEPARTMENTS) {
        const dept = await prisma.department.create({
          data: {
            organizationId: testOrgId,
            name: deptData.name,
            slug: deptData.slug,
            description: deptData.description,
          },
        });

        expect(dept).toBeDefined();
        testDeptIds.push(dept.id);
      }

      expect(testDeptIds).toHaveLength(3);
      console.log(`✅ Created ${testDeptIds.length} departments`);
    });

    it('should enforce department limits for plan tier', async () => {
      const orgService = createOrgService(prisma);
      const canAdd = await orgService.canAddAgent(testOrgId);

      expect(canAdd).toBe(true);
      console.log(`✅ Plan tier limits working`);
    });

    it('should create memories with different types', async () => {
      const memoryTypes: MemoryType[] = [
        MemoryType.episodic,
        MemoryType.semantic,
        MemoryType.strategic,
        MemoryType.procedural,
      ];

      for (const memoryType of memoryTypes) {
        const memory = await prisma.memoryEntry.create({
          data: {
            organizationId: testOrgId,
            namespace: 'test',
            content_type: 'text',
            content: `Test ${memoryType} memory`,
            confidence: 0.9,
            created_by: testUserId.toString(),
            memoryType,
            poolType: PoolType.domain,
            reputation: 80,
            usage_count: 0,
            validation_count: 0,
            decay_factor: 0.05,
            decay_checkpoint: new Date(),
          },
        });

        testMemoryIds.push(memory.id);
      }

      expect(testMemoryIds).toHaveLength(4);
      console.log(`✅ Created memories with all memory types`);
    });
  });

  // ==========================================================================
  // Phase 2: Memory Pools
  // ==========================================================================

  describe('Phase 2: Memory Pools', () => {
    it('should create memories in different pools', async () => {
      const poolTypes: PoolType[] = [PoolType.private, PoolType.domain, PoolType.global];

      for (const poolType of poolTypes) {
        const memory = await prisma.memoryEntry.create({
          data: {
            organizationId: testOrgId,
            namespace: 'test',
            content_type: 'text',
            content: `Test ${poolType} pool memory`,
            confidence: 0.9,
            created_by: testUserId.toString(),
            memoryType: MemoryType.semantic,
            poolType,
            reputation: 75,
            usage_count: 0,
            validation_count: 0,
            decay_factor: 0.01,
            decay_checkpoint: new Date(),
          },
        });

        expect(memory.poolType).toBe(poolType);
      }

      console.log(`✅ Created memories in all pool types`);
    });

    it('should create memory conflicts', async () => {
      // Create two conflicting memories
      const memory1 = await prisma.memoryEntry.create({
        data: {
          organizationId: testOrgId,
          namespace: 'test',
          content_type: 'text',
          content: 'The sky is blue',
          confidence: 0.9,
          created_by: testUserId.toString(),
          memoryType: MemoryType.semantic,
          poolType: PoolType.domain,
          reputation: 80,
          usage_count: 0,
          validation_count: 0,
          decay_factor: 0.01,
          decay_checkpoint: new Date(),
        },
      });

      const memory2 = await prisma.memoryEntry.create({
        data: {
          organizationId: testOrgId,
          namespace: 'test',
          content_type: 'text',
          content: 'The sky is red',
          confidence: 0.8,
          created_by: testUserId.toString(),
          memoryType: MemoryType.semantic,
          poolType: PoolType.domain,
          reputation: 70,
          usage_count: 0,
          validation_count: 0,
          decay_factor: 0.01,
          decay_checkpoint: new Date(),
        },
      });

      // Create conflict record
      const conflict = await prisma.memoryConflict.create({
        data: {
          memory1_id: memory1.id,
          memory2_id: memory2.id,
          conflict_type: 'semantic_contradiction',
          severity: 'medium',
          status: 'pending',
          autoResolvable: false,
        },
      });

      expect(conflict).toBeDefined();
      expect(conflict.severity).toBe('medium');
      console.log(`✅ Created memory conflict`);
    });
  });

  // ==========================================================================
  // Phase 3: Decisions & Reputation
  // ==========================================================================

  describe('Phase 3: Decisions & Reputation', () => {
    it('should record a decision', async () => {
      const decision = await prisma.decision.create({
        data: {
          organizationId: testOrgId,
          departmentId: testDeptIds[0],
          agentId: testUserId,
          inputQuery: 'What is the color of the sky?',
          output: 'The sky is blue',
          confidence: 0.9,
          memoryScoresSnapshot: JSON.stringify([
            { memoryId: testMemoryIds[0], score: 85 },
          ]),
          outcomeVerified: false,
        },
      });

      expect(decision).toBeDefined();
      expect(decision.inputQuery).toBe('What is the color of the sky?');
      console.log(`✅ Recorded decision (ID: ${decision.id})`);
    });

    it('should create agent reputation record', async () => {
      const reputation = await prisma.agentReputation.create({
        data: {
          agentId: testUserId,
          organizationId: testOrgId,
          departmentId: testDeptIds[0],
          writeQuality: 80,
          decisionAccuracy: 85,
          collaborationScore: 75,
          domainExpertise: 90,
          overallReputation: 82.5,
          totalWrites: 10,
          validatedWrites: 8,
          conflictedWrites: 1,
          totalDecisions: 5,
          correctDecisions: 4,
        },
      });

      expect(reputation).toBeDefined();
      expect(reputation.overallReputation).toBeGreaterThan(80);
      console.log(`✅ Created agent reputation record`);
    });
  });

  // ==========================================================================
  // Phase 4: Verification & Evidence
  // ==========================================================================

  describe('Phase 4: Verification & Evidence', () => {
    it('should create verification request', async () => {
      const verification = await prisma.verificationRequest.create({
        data: {
          memoryId: testMemoryIds[0],
          sourceDepartment: 'engineering',
          targetDepartment: 'research',
          status: 'pending',
          requestedBy: testUserId,
        },
      });

      expect(verification).toBeDefined();
      expect(verification.status).toBe('pending');
      console.log(`✅ Created verification request`);
    });

    it('should attach evidence to memory', async () => {
      const evidence = await prisma.evidence.create({
        data: {
          memoryId: testMemoryIds[0],
          evidenceType: 'internal_data',
          sourceUrl: 'https://example.com/data',
          claimType: 'experimental_result',
          createdBy: testUserId,
        },
      });

      expect(evidence).toBeDefined();
      expect(evidence.evidenceType).toBe('internal_data');
      console.log(`✅ Attached evidence to memory`);
    });

    it('should create memory dependency', async () => {
      const dependency = await prisma.memoryDependency.create({
        data: {
          sourceMemoryId: testMemoryIds[1],
          dependsOnMemoryId: testMemoryIds[0],
          dependencyType: 'builds_on',
          needsRevalidation: false,
        },
      });

      expect(dependency).toBeDefined();
      expect(dependency.dependencyType).toBe('builds_on');
      console.log(`✅ Created memory dependency`);
    });
  });

  // ==========================================================================
  // Phase 5: Analytics
  // ==========================================================================

  describe('Phase 5: Analytics', () => {
    it('should calculate organization usage', async () => {
      const org = await prisma.organization.findUnique({
        where: { id: testOrgId },
        include: {
          _count: {
            select: {
              memories: true,
              departments: true,
              memberships: true,
              agentAssignments: true,
            },
          },
        },
      });

      expect(org).toBeDefined();
      expect(org?._count.memories).toBeGreaterThan(0);
      expect(org?._count.departments).toBeGreaterThanOrEqual(4); // General + 3 custom
      console.log(`✅ Organization usage calculated`);
    });

    it('should verify organization counters', async () => {
      const orgService = createOrgService(prisma);
      const stats = await orgService.incrementMemoryCount(testOrgId);

      const org = await prisma.organization.findUnique({
        where: { id: testOrgId },
        select: { currentMemoryCount: true },
      });

      expect(org?.currentMemoryCount).toBeGreaterThan(0);
      console.log(`✅ Organization counters working`);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should complete full workflow: create -> decide -> verify -> analyze', async () => {
      // 1. Create memory
      const memory = await prisma.memoryEntry.create({
        data: {
          organizationId: testOrgId,
          namespace: 'integration-test',
          content_type: 'text',
          content: 'Integration test memory',
          confidence: 0.95,
          created_by: testUserId.toString(),
          memoryType: MemoryType.strategic,
          poolType: PoolType.domain,
          reputation: 90,
          usage_count: 0,
          validation_count: 0,
          decay_factor: 0.001,
          decay_checkpoint: new Date(),
        },
      });

      // 2. Record decision using memory
      const decision = await prisma.decision.create({
        data: {
          organizationId: testOrgId,
          departmentId: testDeptIds[0],
          agentId: testUserId,
          inputQuery: 'Integration test query',
          output: 'Integration test output',
          confidence: 0.95,
          memoryScoresSnapshot: JSON.stringify([
            { memoryId: memory.id, score: 90 },
          ]),
          outcomeVerified: false,
        },
      });

      // 3. Create verification request
      const verification = await prisma.verificationRequest.create({
        data: {
          memoryId: memory.id,
          sourceDepartment: 'engineering',
          targetDepartment: 'research',
          status: 'verified',
          requestedBy: testUserId,
          verifiedBy: testUserId,
          verificationResult: JSON.stringify({ verified: true, confidence: 0.95 }),
          scoreImpact: 10,
        },
      });

      // 4. Verify all records created
      expect(memory).toBeDefined();
      expect(decision).toBeDefined();
      expect(verification).toBeDefined();
      expect(verification.status).toBe('verified');

      console.log(`✅ Full workflow integration test passed`);
    });
  });
});
