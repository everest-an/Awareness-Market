/**
 * RMC Entity Extraction Test
 *
 * Tests the EntityExtractor module to ensure it can extract entities,
 * concepts, and topics from memory content.
 */

import { createEntityExtractor } from '../server/memory-core/entity-extractor';

async function testEntityExtraction() {
  console.log('🧪 Testing RMC Entity Extraction...\n');

  const extractor = createEntityExtractor({
    enableLLM: false, // Use rule-based extraction for testing
  });

  // Test Case 1: Technical decision
  console.log('Test 1: Technical Decision');
  const result1 = await extractor.extract(
    "Our primary database is PostgreSQL because it has ACID guarantees and strong community support."
  );
  console.log('  Entities:', result1.entities);
  console.log('  Concepts:', result1.concepts);
  console.log('  Topics:', result1.topics);
  console.log('');

  // Test Case 2: Business metrics
  console.log('Test 2: Business Metrics');
  const result2 = await extractor.extract(
    "Q4 revenue target is $2M, primarily from enterprise customers in San Francisco."
  );
  console.log('  Entities:', result2.entities);
  console.log('  Concepts:', result2.concepts);
  console.log('  Topics:', result2.topics);
  console.log('');

  // Test Case 3: Technical issue
  console.log('Test 3: Technical Issue');
  const result3 = await extractor.extract(
    "CPU usage reached 100% due to unoptimized database queries in the recommendation algorithm."
  );
  console.log('  Entities:', result3.entities);
  console.log('  Concepts:', result3.concepts);
  console.log('  Topics:', result3.topics);
  console.log('');

  // Test Case 4: Batch extraction
  console.log('Test 4: Batch Extraction');
  const results = await extractor.extractBatch([
    "MongoDB is better for document-heavy workloads",
    "Redis provides sub-millisecond latency for caching",
    "Kubernetes simplifies container orchestration",
  ]);
  console.log(`  Extracted entities from ${results.length} memories`);
  results.forEach((r, i) => {
    console.log(`  Memory ${i + 1}:`, r.entities.map(e => e.name).join(', '));
  });
  console.log('');

  console.log('✅ Entity Extraction Tests Complete!');
}

testEntityExtraction().catch((error) => {
  console.error('❌ Entity Extraction Test Failed:', error);
  process.exit(1);
});
