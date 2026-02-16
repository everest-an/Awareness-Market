/**
 * RMC Relation Building Test
 *
 * Tests the RelationBuilder module to ensure it can find candidate memories
 * and infer relationships between them.
 */

import { PrismaClient } from '@prisma/client';
import { createRelationBuilder } from '../server/memory-core/relation-builder';
import { createEntityExtractor } from '../server/memory-core/entity-extractor';

const prisma = new PrismaClient();

async function testRelationBuilding() {
  console.log('🧪 Testing RMC Relation Building...\n');

  const entityExtractor = createEntityExtractor({ enableLLM: false });
  const relationBuilder = createRelationBuilder(prisma, {
    enableLLM: false, // Use rule-based inference
    candidateLimit: 10,
    minEntityOverlap: 1,
  });

  try {
    // Create test memories
    console.log('Step 1: Creating test memories...');

    const memory1Result = await entityExtractor.extract(
      "Our primary database is PostgreSQL because it has ACID guarantees"
    );

    const memory1 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'tech-decisions',
        contentType: 'decision',
        content: "Our primary database is PostgreSQL because it has ACID guarantees",
        confidence: 0.9,
        createdBy: 'agent-backend',
        claimKey: 'primary_database',
        claimValue: 'PostgreSQL',
        entities: memory1Result as any,
        embedding: new Array(1536).fill(0), // Mock embedding
      },
    });
    console.log('  ✅ Created Memory 1:', memory1.id.substring(0, 8));

    const memory2Result = await entityExtractor.extract(
      "MongoDB is better for our document-heavy workload"
    );

    const memory2 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'tech-decisions',
        contentType: 'opinion',
        content: "MongoDB is better for our document-heavy workload",
        confidence: 0.8,
        createdBy: 'agent-data',
        claimKey: 'primary_database',
        claimValue: 'MongoDB',
        entities: memory2Result as any,
        embedding: new Array(1536).fill(0),
      },
    });
    console.log('  ✅ Created Memory 2:', memory2.id.substring(0, 8));

    const memory3Result = await entityExtractor.extract(
      "ACID guarantees are critical for financial transactions"
    );

    const memory3 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'tech-decisions',
        contentType: 'fact',
        content: "ACID guarantees are critical for financial transactions",
        confidence: 0.95,
        createdBy: 'agent-backend',
        entities: memory3Result as any,
        embedding: new Array(1536).fill(0),
      },
    });
    console.log('  ✅ Created Memory 3:', memory3.id.substring(0, 8));
    console.log('');

    // Build relations for Memory 1
    console.log('Step 2: Building relations for Memory 1...');
    const relationsCount = await relationBuilder.buildRelations(memory1.id);
    console.log(`  ✅ Created ${relationsCount} relations`);
    console.log('');

    // Check created relations
    console.log('Step 3: Verifying relations...');
    const relations = await prisma.memoryRelation.findMany({
      where: {
        OR: [
          { sourceMemoryId: memory1.id },
          { targetMemoryId: memory1.id },
        ],
      },
      include: {
        targetMemory: { select: { content: true, id: true } },
        sourceMemory: { select: { content: true, id: true } },
      },
    });

    console.log(`  Found ${relations.length} relations:`);
    relations.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.relationType} (strength: ${r.strength})`);
      console.log(`     Source: ${r.sourceMemory.content.substring(0, 50)}...`);
      console.log(`     Target: ${r.targetMemory.content.substring(0, 50)}...`);
      if (r.reason) console.log(`     Reason: ${r.reason}`);
      console.log('');
    });

    // Cleanup
    console.log('Step 4: Cleaning up test data...');
    await prisma.memoryRelation.deleteMany({
      where: {
        OR: [
          { sourceMemoryId: { in: [memory1.id, memory2.id, memory3.id] } },
          { targetMemoryId: { in: [memory1.id, memory2.id, memory3.id] } },
        ],
      },
    });
    await prisma.memoryEntry.deleteMany({
      where: { id: { in: [memory1.id, memory2.id, memory3.id] } },
    });
    console.log('  ✅ Cleanup complete');
    console.log('');

    console.log('✅ Relation Building Tests Complete!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testRelationBuilding().catch((error) => {
  console.error('❌ Relation Building Test Failed:', error);
  process.exit(1);
});
