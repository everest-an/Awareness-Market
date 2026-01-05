/**
 * Generate Cold Start Data CLI
 * 
 * Generates W-Matrices for popular model pairs to bootstrap the marketplace.
 * 
 * Usage:
 *   pnpm tsx scripts/generate-cold-start-data.ts [options]
 * 
 * Options:
 *   --min-popularity <number>  Minimum popularity score (default: 75)
 *   --max-pairs <number>       Maximum pairs to generate (default: 50)
 *   --test-samples <number>    Test samples for quality (default: 1000)
 *   --publish                  Auto-publish to marketplace
 *   --dry-run                  Preview without generating
 */

import { createAlignmentFactory, POPULAR_MODELS } from '../server/latentmas/alignment-factory';

// ============================================================================
// CLI Arguments
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const config: any = {
    minPopularity: 75,
    maxPairsPerBatch: 50,
    testSamples: 1000,
    autoPublish: false,
    dryRun: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--min-popularity':
        config.minPopularity = parseInt(args[++i], 10);
        break;
      case '--max-pairs':
        config.maxPairsPerBatch = parseInt(args[++i], 10);
        break;
      case '--test-samples':
        config.testSamples = parseInt(args[++i], 10);
        break;
      case '--publish':
        config.autoPublish = true;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--help':
        console.log(`
Generate Cold Start Data CLI

Usage:
  pnpm tsx scripts/generate-cold-start-data.ts [options]

Options:
  --min-popularity <number>  Minimum popularity score (default: 75)
  --max-pairs <number>       Maximum pairs to generate (default: 50)
  --test-samples <number>    Test samples for quality (default: 1000)
  --publish                  Auto-publish to marketplace
  --dry-run                  Preview without generating
  --help                     Show this help message
        `);
        process.exit(0);
    }
  }
  
  return config;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Alignment Factory - Cold Start Data Generator');
  console.log('='.repeat(80));
  console.log();
  
  const config = parseArgs();
  
  console.log('Configuration:');
  console.log(`  Min Popularity: ${config.minPopularity}`);
  console.log(`  Max Pairs: ${config.maxPairsPerBatch}`);
  console.log(`  Test Samples: ${config.testSamples}`);
  console.log(`  Auto Publish: ${config.autoPublish ? 'Yes' : 'No'}`);
  console.log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  console.log();
  
  // Create factory
  const factory = createAlignmentFactory(config);
  
  // Preview model pairs
  const pairs = factory.getPopularModelPairs();
  console.log(`Found ${pairs.length} model pairs to generate:`);
  console.log();
  
  // Show sample pairs
  const sampleSize = Math.min(10, pairs.length);
  console.log(`Sample pairs (showing first ${sampleSize}):`);
  for (let i = 0; i < sampleSize; i++) {
    const pair = pairs[i];
    console.log(`  ${i + 1}. ${pair.sourceModel} (${pair.sourceDimension}D) → ${pair.targetModel} (${pair.targetDimension}D)`);
  }
  console.log();
  
  if (config.dryRun) {
    console.log('Dry run mode - skipping generation');
    console.log();
    
    // Show model statistics
    const eligibleModels = POPULAR_MODELS.filter(m => m.popularity >= config.minPopularity);
    console.log('Eligible Models:');
    console.log(`  Total: ${eligibleModels.length}`);
    
    const families = new Set(eligibleModels.map(m => m.family));
    console.log(`  Families: ${Array.from(families).join(', ')}`);
    
    const standards = new Set(eligibleModels.map(m => m.standard));
    console.log(`  Standards: ${Array.from(standards).join(', ')}`);
    
    console.log();
    console.log('Run without --dry-run to generate W-Matrices');
    return;
  }
  
  // Generate W-Matrices
  console.log('Starting generation...');
  console.log();
  
  const startTime = Date.now();
  const results = await factory.generateBatch();
  const duration = Date.now() - startTime;
  
  console.log();
  console.log('='.repeat(80));
  console.log('Generation Complete');
  console.log('='.repeat(80));
  console.log();
  
  // Show statistics
  const stats = factory.getStatistics(results);
  
  console.log('Statistics:');
  console.log(`  Total Generated: ${stats.totalGenerated}`);
  console.log(`  Average Epsilon: ${stats.avgEpsilon.toFixed(4)}`);
  console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log();
  
  console.log('Certification Distribution:');
  console.log(`  Platinum: ${stats.certificationDistribution.platinum}`);
  console.log(`  Gold: ${stats.certificationDistribution.gold}`);
  console.log(`  Silver: ${stats.certificationDistribution.silver}`);
  console.log(`  Bronze: ${stats.certificationDistribution.bronze}`);
  console.log();
  
  console.log('Quality Grades:');
  console.log(`  Excellent: ${stats.qualityGrades.excellent}`);
  console.log(`  Good: ${stats.qualityGrades.good}`);
  console.log(`  Fair: ${stats.qualityGrades.fair}`);
  console.log(`  Poor: ${stats.qualityGrades.poor}`);
  console.log();
  
  console.log('Model Family Coverage:');
  for (const [family, count] of Object.entries(stats.modelFamilyCoverage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${family}: ${count} matrices`);
  }
  console.log();
  
  // Show sample results
  console.log('Sample Generated W-Matrices (first 5):');
  for (let i = 0; i < Math.min(5, results.length); i++) {
    const result = results[i];
    const meta = result.protocol.metadata;
    console.log(`  ${i + 1}. ${result.modelPair.sourceModel} → ${result.modelPair.targetModel}`);
    console.log(`     Version: ${meta.version.major}.${meta.version.minor}.${meta.version.patch}`);
    console.log(`     Certification: ${meta.certification.level}`);
    console.log(`     Quality: ${meta.qualityGrade}`);
    console.log(`     Epsilon: ${result.quality.epsilon.toFixed(4)}`);
    console.log(`     Checksum: ${meta.checksumSHA256.substring(0, 16)}...`);
    console.log();
  }
  
  if (config.autoPublish) {
    console.log('Publishing to marketplace...');
    console.log('(Publishing functionality to be implemented)');
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log('Done!');
  console.log('='.repeat(80));
}

// Run
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
