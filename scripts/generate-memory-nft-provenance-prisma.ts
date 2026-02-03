/**
 * Generate Memory NFT Provenance Test Data (Prisma Version)
 *
 * Creates a set of Memory NFTs with derivation relationships
 * to test the Memory Provenance visualization feature.
 *
 * Run with: pnpm tsx scripts/generate-memory-nft-provenance-prisma.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Test Data Structure
// ============================================================================

const testData = [
  // Root: Original W-Matrix
  {
    id: 'mem-root-001',
    name: 'GPT-3.5 → GPT-4 Original W-Matrix',
    description: 'Original alignment matrix for GPT-3.5 to GPT-4 cross-model communication. Trained on 50k examples with epsilon 2.8%.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '1',
    owner: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
    tbaAddress: '0x1111111111111111111111111111111111111111',
    memoryType: 'w-matrix',
    epsilon: '2.8',
    certification: 'gold',
    qualityGrade: 'A+',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/root-001.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmRoot001',
    parentNftId: null,
    derivationType: null,
    royaltyPercent: 30,
    totalRoyaltiesPaid: '0',
    price: '10.00',
    downloads: 342,
  },

  // Level 1: Fine-tuned for Medical Domain
  {
    id: 'mem-child-002',
    name: 'GPT-3.5 → GPT-4 Medical Enhanced',
    description: 'Fine-tuned version optimized for medical terminology and diagnosis. Epsilon improved to 2.5%.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '2',
    owner: '0xBEEF1234567890ABCDEF1234567890ABCDEF1234',
    tbaAddress: '0x2222222222222222222222222222222222222222',
    memoryType: 'w-matrix',
    epsilon: '2.5',
    certification: 'gold',
    qualityGrade: 'A+',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/child-002.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmChild002',
    parentNftId: 'mem-root-001',
    derivationType: 'fine-tune',
    royaltyPercent: 30,
    totalRoyaltiesPaid: '150.00',
    price: '15.00',
    downloads: 156,
  },

  // Level 1: Optimized for Speed
  {
    id: 'mem-child-003',
    name: 'GPT-3.5 → GPT-4 Lite',
    description: 'Optimized for inference speed with minimal quality loss. 2x faster than original.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '3',
    owner: '0xCAFE1234567890ABCDEF1234567890ABCDEF1234',
    tbaAddress: '0x3333333333333333333333333333333333333333',
    memoryType: 'w-matrix',
    epsilon: '3.2',
    certification: 'silver',
    qualityGrade: 'B+',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/child-003.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmChild003',
    parentNftId: 'mem-root-001',
    derivationType: 'compress',
    royaltyPercent: 30,
    totalRoyaltiesPaid: '234.00',
    price: '5.00',
    downloads: 234,
  },

  // Level 2: Medical + Radiology Specialist
  {
    id: 'mem-grandchild-004',
    name: 'GPT-3.5 → GPT-4 Radiology Specialist',
    description: 'Further specialized for radiology image analysis and reporting. Epsilon 2.2%.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '4',
    owner: '0xDEAD1234567890ABCDEF1234567890ABCDEF1234',
    tbaAddress: '0x4444444444444444444444444444444444444444',
    memoryType: 'w-matrix',
    epsilon: '2.2',
    certification: 'platinum',
    qualityGrade: 'A++',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/grandchild-004.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmGrandchild004',
    parentNftId: 'mem-child-002',
    derivationType: 'fine-tune',
    royaltyPercent: 30,
    totalRoyaltiesPaid: '89.00',
    price: '20.00',
    downloads: 89,
  },

  // Level 2: Medical + Surgery Specialist
  {
    id: 'mem-grandchild-005',
    name: 'GPT-3.5 → GPT-4 Surgery Specialist',
    description: 'Specialized for surgical procedure planning and documentation.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '5',
    owner: '0xFEED1234567890ABCDEF1234567890ABCDEF1234',
    tbaAddress: '0x5555555555555555555555555555555555555555',
    memoryType: 'w-matrix',
    epsilon: '2.4',
    certification: 'gold',
    qualityGrade: 'A+',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/grandchild-005.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmGrandchild005',
    parentNftId: 'mem-child-002',
    derivationType: 'fine-tune',
    royaltyPercent: 30,
    totalRoyaltiesPaid: '67.00',
    price: '18.00',
    downloads: 67,
  },

  // Level 2: Lite + Mobile Optimized
  {
    id: 'mem-grandchild-006',
    name: 'GPT-3.5 → GPT-4 Mobile',
    description: 'Ultra-light version for mobile devices. 5x faster, epsilon 3.5%.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '6',
    owner: '0xF00D1234567890ABCDEF1234567890ABCDEF1234',
    tbaAddress: '0x6666666666666666666666666666666666666666',
    memoryType: 'w-matrix',
    epsilon: '3.5',
    certification: 'silver',
    qualityGrade: 'B+',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/grandchild-006.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmGrandchild006',
    parentNftId: 'mem-child-003',
    derivationType: 'compress',
    royaltyPercent: 30,
    totalRoyaltiesPaid: '445.00',
    price: '3.00',
    downloads: 445,
  },

  // Additional Root: Claude → GPT-4
  {
    id: 'mem-root-007',
    name: 'Claude-3 → GPT-4 W-Matrix',
    description: 'Cross-model alignment matrix for Claude-3 to GPT-4. Epsilon 3.1%.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '7',
    owner: '0xC0DE1234567890ABCDEF1234567890ABCDEF1234',
    tbaAddress: '0x7777777777777777777777777777777777777777',
    memoryType: 'w-matrix',
    epsilon: '3.1',
    certification: 'gold',
    qualityGrade: 'A',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/root-007.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmRoot007',
    parentNftId: null,
    derivationType: null,
    royaltyPercent: 30,
    totalRoyaltiesPaid: '0',
    price: '12.00',
    downloads: 189,
  },

  // Level 1: Claude → GPT-4 Code Specialist
  {
    id: 'mem-child-008',
    name: 'Claude-3 → GPT-4 Code Specialist',
    description: 'Optimized for code generation and debugging tasks.',
    contractAddress: '0x1234567890123456789012345678901234567890',
    tokenId: '8',
    owner: '0xBEEF1234567890ABCDEF1234567890ABCDEF5678',
    tbaAddress: '0x8888888888888888888888888888888888888888',
    memoryType: 'w-matrix',
    epsilon: '2.9',
    certification: 'gold',
    qualityGrade: 'A',
    assetUrl: 'https://s3.amazonaws.com/awareness/w-matrix/child-008.bin',
    metadataUrl: 'https://ipfs.io/ipfs/QmChild008',
    parentNftId: 'mem-root-007',
    derivationType: 'fine-tune',
    royaltyPercent: 30,
    totalRoyaltiesPaid: '123.00',
    price: '16.00',
    downloads: 123,
  },
];

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('🌳 Generating Memory NFT Provenance Test Data...\n');

  try {
    // Clear existing test data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing test data...');
    await prisma.memoryNFT.deleteMany({
      where: {
        id: {
          in: testData.map((m) => m.id),
        },
      },
    });

    // Insert all test data
    for (const memory of testData) {
      console.log(`📝 Creating: ${memory.name}`);
      console.log(`   ID: ${memory.id}`);
      console.log(`   Parent: ${memory.parentNftId || 'None (Root)'}`);
      console.log(`   Epsilon: ${memory.epsilon}%`);
      console.log(`   Price: $${memory.price}`);
      console.log('');

      await prisma.memoryNFT.create({
        data: memory,
      });
    }

    console.log('✅ Successfully created all test memories!\n');
    console.log('📊 Summary:');
    console.log(`   Total memories: ${testData.length}`);
    console.log(`   Root memories: ${testData.filter((m) => !m.parentNftId).length}`);
    console.log(`   Derived memories: ${testData.filter((m) => m.parentNftId).length}`);
    console.log('');
    console.log('🔗 Family Trees:');
    console.log('   1. mem-root-001 (GPT-3.5 → GPT-4 Original)');
    console.log('      ├── mem-child-002 (Medical Enhanced)');
    console.log('      │   ├── mem-grandchild-004 (Radiology)');
    console.log('      │   └── mem-grandchild-005 (Surgery)');
    console.log('      └── mem-child-003 (Lite)');
    console.log('          └── mem-grandchild-006 (Mobile)');
    console.log('');
    console.log('   2. mem-root-007 (Claude-3 → GPT-4)');
    console.log('      └── mem-child-008 (Code Specialist)');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Test provenance API:');
    console.log('      curl http://localhost:3001/api/trpc/memoryNFT.getProvenance?input={"json":{"memoryId":"mem-root-001"}}');
    console.log('');
    console.log('   2. Or visit the Memory Marketplace frontend:');
    console.log('      https://awareness.market/memory-provenance/mem-root-001');
    console.log('');
  } catch (error) {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
