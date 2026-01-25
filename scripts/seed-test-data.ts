/**
 * Seed Test Data
 * 
 * Quickly populate the database with sample latent vectors for testing
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { latentVectors } from '../drizzle/schema';
import * as dotenv from 'dotenv';

dotenv.config();

const SAMPLE_VECTORS = [
  {
    creatorId: 1,
    title: "Solidity Gas Optimization Patterns",
    description: "Advanced techniques for reducing gas costs in smart contracts",
    category: "Smart Contracts",
    vectorFileKey: "vectors/solidity-gas-opt.bin",
    vectorFileUrl: "https://storage.example.com/vectors/solidity-gas-opt.bin",
    basePrice: "0.05",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "ZK-SNARK Circuit Design Best Practices",
    description: "Efficient circuit construction for zero-knowledge proofs",
    category: "Cryptography",
    vectorFileKey: "vectors/zk-snark-circuits.bin",
    vectorFileUrl: "https://storage.example.com/vectors/zk-snark-circuits.bin",
    basePrice: "0.08",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Uniswap V3 Concentrated Liquidity Strategy",
    description: "Maximize LP returns with optimal range selection",
    category: "DeFi",
    vectorFileKey: "vectors/uniswap-v3-strategy.bin",
    vectorFileUrl: "https://storage.example.com/vectors/uniswap-v3-strategy.bin",
    basePrice: "0.06",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Transformer Attention Mechanism Deep Dive",
    description: "Understanding multi-head attention in neural networks",
    category: "AI/ML",
    vectorFileKey: "vectors/transformer-attention.bin",
    vectorFileUrl: "https://storage.example.com/vectors/transformer-attention.bin",
    basePrice: "0.04",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Elliptic Curve Cryptography Fundamentals",
    description: "Mathematical foundations of ECC for blockchain",
    category: "Cryptography",
    vectorFileKey: "vectors/ecc-fundamentals.bin",
    vectorFileUrl: "https://storage.example.com/vectors/ecc-fundamentals.bin",
    basePrice: "0.07",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Raft Consensus Algorithm Implementation",
    description: "Building fault-tolerant distributed systems",
    category: "Infrastructure",
    vectorFileKey: "vectors/raft-consensus.bin",
    vectorFileUrl: "https://storage.example.com/vectors/raft-consensus.bin",
    basePrice: "0.05",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Formal Verification with Coq",
    description: "Proving smart contract correctness mathematically",
    category: "Security",
    vectorFileKey: "vectors/formal-verification-coq.bin",
    vectorFileUrl: "https://storage.example.com/vectors/formal-verification-coq.bin",
    basePrice: "0.09",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "MEV Sandwich Attack Detection",
    description: "Identifying and preventing sandwich attacks",
    category: "Trading",
    vectorFileKey: "vectors/mev-sandwich-detection.bin",
    vectorFileUrl: "https://storage.example.com/vectors/mev-sandwich-detection.bin",
    basePrice: "0.10",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Optimistic Rollup Architecture",
    description: "Layer 2 scaling with fraud proofs",
    category: "Infrastructure",
    vectorFileKey: "vectors/optimistic-rollup.bin",
    vectorFileUrl: "https://storage.example.com/vectors/optimistic-rollup.bin",
    basePrice: "0.06",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Bonding Curve Token Economics",
    description: "Designing sustainable token economies",
    category: "Economics",
    vectorFileKey: "vectors/bonding-curve-tokenomics.bin",
    vectorFileUrl: "https://storage.example.com/vectors/bonding-curve-tokenomics.bin",
    basePrice: "0.05",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Flash Loan Arbitrage Strategies",
    description: "Profitable DeFi arbitrage without capital",
    category: "DeFi",
    vectorFileKey: "vectors/flash-loan-arbitrage.bin",
    vectorFileUrl: "https://storage.example.com/vectors/flash-loan-arbitrage.bin",
    basePrice: "0.12",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Solidity Security Audit Checklist",
    description: "Comprehensive security review framework",
    category: "Security",
    vectorFileKey: "vectors/solidity-security-audit.bin",
    vectorFileUrl: "https://storage.example.com/vectors/solidity-security-audit.bin",
    basePrice: "0.08",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Neural Architecture Search Techniques",
    description: "Automated ML model design optimization",
    category: "AI/ML",
    vectorFileKey: "vectors/neural-architecture-search.bin",
    vectorFileUrl: "https://storage.example.com/vectors/neural-architecture-search.bin",
    basePrice: "0.07",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "ZK-Rollup State Transition Proofs",
    description: "Validity proofs for Layer 2 scaling",
    category: "Infrastructure",
    vectorFileKey: "vectors/zk-rollup-state-proofs.bin",
    vectorFileUrl: "https://storage.example.com/vectors/zk-rollup-state-proofs.bin",
    basePrice: "0.11",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
  {
    creatorId: 1,
    title: "Byzantine Fault Tolerance Explained",
    description: "Consensus in adversarial environments",
    category: "Infrastructure",
    vectorFileKey: "vectors/byzantine-fault-tolerance.bin",
    vectorFileUrl: "https://storage.example.com/vectors/byzantine-fault-tolerance.bin",
    basePrice: "0.06",
    wMatrixStandard: "8192" as const,
    sourceModel: "gpt-4",
    hiddenDim: 8192,
    memoryType: "reasoning_chain" as const,
    status: "active" as const,
  },
];

async function main() {
  console.log('🌱 Seeding test data...\n');
  
  // Create database connection with SSL support
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL!,
    ssl: {
      rejectUnauthorized: false
    }
  });
  const db = drizzle(connection);
  
  try {
    // Insert all sample vectors
    for (const vector of SAMPLE_VECTORS) {
      await db.insert(latentVectors).values(vector);
      console.log(`✓ Added: ${vector.title}`);
    }
    
    console.log(`\n✅ Successfully seeded ${SAMPLE_VECTORS.length} test vectors`);
    console.log('\n📊 Distribution by category:');
    
    const distribution = SAMPLE_VECTORS.reduce((acc, v) => {
      acc[v.category] = (acc[v.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(distribution).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} vectors`);
    });
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    await connection.end();
    process.exit(1);
  }
}

// Run if executed directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { SAMPLE_VECTORS };
