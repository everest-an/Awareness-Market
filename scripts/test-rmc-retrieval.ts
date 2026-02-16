/**
 * RMC Hybrid Retrieval Test
 *
 * Tests the RMCRetriever to ensure it can perform:
 * 1. Vector search
 * 2. Graph expansion via BFS
 * 3. Inference path discovery (causal chains, contradictions, support chains)
 */

import { PrismaClient } from '@prisma/client';
import { createRMCRetriever } from '../server/memory-core/rmc-retriever';
import { createEntityExtractor } from '../server/memory-core/entity-extractor';
import { createRelationBuilder } from '../server/memory-core/relation-builder';

const prisma = new PrismaClient();

async function testRMCRetrieval() {
  console.log('🧪 Testing RMC Hybrid Retrieval...\n');

  const entityExtractor = createEntityExtractor({ enableLLM: false });
  const relationBuilder = createRelationBuilder(prisma, { enableLLM: false });
  const retriever = createRMCRetriever(prisma);

  try {
    // Create test scenario: Server crash investigation
    console.log('Step 1: Creating test scenario (Server Crash Investigation)...');

    const memories = [];

    // Memory 1: Root cause
    const m1Result = await entityExtractor.extract("New recommendation algorithm was deployed");
    const m1 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'incidents',
        contentType: 'event',
        content: "New recommendation algorithm was deployed",
        confidence: 0.95,
        createdBy: 'agent-backend',
        entities: m1Result as any,
        embedding: new Array(1536).fill(0),
      },
    });
    memories.push(m1);
    console.log('  ✅ Memory 1: Algorithm deployment');

    // Memory 2: Consequence
    const m2Result = await entityExtractor.extract("Database queries became unoptimized");
    const m2 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'incidents',
        contentType: 'issue',
        content: "Database queries became unoptimized",
        confidence: 0.85,
        createdBy: 'agent-data',
        entities: m2Result as any,
        embedding: new Array(1536).fill(0),
      },
    });
    memories.push(m2);
    console.log('  ✅ Memory 2: Query issues');

    // Memory 3: Impact
    const m3Result = await entityExtractor.extract("CPU usage reached 100%");
    const m3 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'incidents',
        contentType: 'metric',
        content: "CPU usage reached 100%",
        confidence: 1.0,
        createdBy: 'agent-monitor',
        entities: m3Result as any,
        embedding: new Array(1536).fill(0),
      },
    });
    memories.push(m3);
    console.log('  ✅ Memory 3: CPU overload');

    // Memory 4: Final outcome
    const m4Result = await entityExtractor.extract("Server crashed and became unavailable");
    const m4 = await prisma.memoryEntry.create({
      data: {
        orgId: 'test-org',
        namespace: 'incidents',
        contentType: 'incident',
        content: "Server crashed and became unavailable",
        confidence: 1.0,
        createdBy: 'agent-monitor',
        entities: m4Result as any,
        embedding: new Array(1536).fill(0),
      },
    });
    memories.push(m4);
    console.log('  ✅ Memory 4: Server crash');
    console.log('');

    // Build causal chain: m1 -> m2 -> m3 -> m4
    console.log('Step 2: Building causal chain relationships...');

    // m1 CAUSES m2
    await prisma.memoryRelation.create({
      data: {
        sourceMemoryId: m1.id,
        targetMemoryId: m2.id,
        relationType: 'CAUSES',
        strength: 0.9,
        reason: 'New algorithm introduced inefficient queries',
        inferredBy: 'rule',
        entityOverlap: 0,
      },
    });
    console.log('  ✅ m1 --CAUSES--> m2');

    // m2 CAUSES m3
    await prisma.memoryRelation.create({
      data: {
        sourceMemoryId: m2.id,
        targetMemoryId: m3.id,
        relationType: 'CAUSES',
        strength: 0.95,
        reason: 'Unoptimized queries consumed CPU resources',
        inferredBy: 'rule',
        entityOverlap: 0,
      },
    });
    console.log('  ✅ m2 --CAUSES--> m3');

    // m3 IMPACTS m4
    await prisma.memoryRelation.create({
      data: {
        sourceMemoryId: m3.id,
        targetMemoryId: m4.id,
        relationType: 'IMPACTS',
        strength: 1.0,
        reason: 'CPU overload led to server failure',
        inferredBy: 'rule',
        entityOverlap: 0,
      },
    });
    console.log('  ✅ m3 --IMPACTS--> m4');
    console.log('');

    // Test retrieval
    console.log('Step 3: Testing hybrid retrieval...');
    const result = await retriever.retrieve("Why did the server crash?", {
      maxDepth: 3,
      relationTypes: ['CAUSES', 'IMPACTS'],
      includeInferencePaths: true,
      minConfidence: 0.5,
    });

    console.log(`  Direct Matches: ${result.directMatches.length}`);
    result.directMatches.forEach((m, i) => {
      console.log(`    ${i + 1}. ${m.content} (similarity: ${m.similarity?.toFixed(3)})`);
    });
    console.log('');

    console.log(`  Related Context: ${result.relatedContext.memories.length} memories, ${result.relatedContext.relations.length} relations`);
    console.log('');

    console.log(`  Inference Paths: ${result.inferencePaths.length}`);
    result.inferencePaths.forEach((path, i) => {
      console.log(`    Path ${i + 1} (${path.type}): confidence=${path.confidence.toFixed(2)}`);
      console.log(`      ${path.description}`);
      console.log(`      Nodes: ${path.nodes.length}`);
      path.nodes.forEach((n, j) => {
        console.log(`        ${j + 1}. ${n.content.substring(0, 60)}...`);
      });
      console.log(`      Edges: ${path.edges.length}`);
      path.edges.forEach((e) => {
        console.log(`        ${e.type} (strength: ${e.strength})`);
      });
      console.log('');
    });

    console.log(`  Summary: ${result.summary}`);
    console.log('');

    // Cleanup
    console.log('Step 4: Cleaning up test data...');
    await prisma.memoryRelation.deleteMany({
      where: {
        OR: [
          { sourceMemoryId: { in: memories.map(m => m.id) } },
          { targetMemoryId: { in: memories.map(m => m.id) } },
        ],
      },
    });
    await prisma.memoryEntry.deleteMany({
      where: { id: { in: memories.map(m => m.id) } },
    });
    console.log('  ✅ Cleanup complete');
    console.log('');

    console.log('✅ RMC Retrieval Tests Complete!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testRMCRetrieval().catch((error) => {
  console.error('❌ RMC Retrieval Test Failed:', error);
  process.exit(1);
});
