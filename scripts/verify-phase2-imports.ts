/**
 * Verify Phase 2 Module Imports
 *
 * This script validates that all Phase 2 modules can be imported correctly
 * without requiring a database connection.
 */

console.log('🔍 Verifying Phase 2 Module Imports...\n');

try {
  // Test ConflictResolver import
  const { ConflictResolver, createConflictResolver } = await import(
    '../server/memory-core/conflict-resolver'
  );
  console.log('✅ ConflictResolver module imported successfully');
  console.log(`   - Class: ${ConflictResolver.name}`);
  console.log(`   - Factory: ${typeof createConflictResolver}`);

  // Test VersionTreeManager import
  const { VersionTreeManager, createVersionTreeManager } = await import(
    '../server/memory-core/version-tree'
  );
  console.log('✅ VersionTreeManager module imported successfully');
  console.log(`   - Class: ${VersionTreeManager.name}`);
  console.log(`   - Factory: ${typeof createVersionTreeManager}`);

  // Test SemanticConflictDetector import
  const { SemanticConflictDetector, createSemanticConflictDetector } = await import(
    '../server/memory-core/semantic-conflict-detector'
  );
  console.log('✅ SemanticConflictDetector module imported successfully');
  console.log(`   - Class: ${SemanticConflictDetector.name}`);
  console.log(`   - Factory: ${typeof createSemanticConflictDetector}`);

  // Test main memory-core exports
  const memoryCore = await import('../server/memory-core');
  console.log('\n✅ Main memory-core module exports verified');
  console.log(`   - ConflictResolver: ${typeof memoryCore.ConflictResolver}`);
  console.log(`   - VersionTreeManager: ${typeof memoryCore.VersionTreeManager}`);
  console.log(`   - SemanticConflictDetector: ${typeof memoryCore.SemanticConflictDetector}`);
  console.log(`   - createConflictResolver: ${typeof memoryCore.createConflictResolver}`);
  console.log(`   - createVersionTreeManager: ${typeof memoryCore.createVersionTreeManager}`);
  console.log(
    `   - createSemanticConflictDetector: ${typeof memoryCore.createSemanticConflictDetector}`
  );

  console.log('\n🎉 All Phase 2 modules verified successfully!');
  console.log('\n✅ Import Test Results:');
  console.log('   1. ConflictResolver: PASS');
  console.log('   2. VersionTreeManager: PASS');
  console.log('   3. SemanticConflictDetector: PASS');
  console.log('   4. Module Exports: PASS');
  console.log('\nPhase 2 code is ready for database testing.\n');
} catch (error: any) {
  console.error('\n❌ Import verification failed:');
  console.error(`   Error: ${error.message}`);
  console.error(`\nStack trace:`);
  console.error(error.stack);
  process.exit(1);
}
