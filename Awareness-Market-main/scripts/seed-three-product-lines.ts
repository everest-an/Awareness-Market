/**
 * Cold Start Data Seeder for Three Product Lines
 * 
 * Seeds the marketplace with sample data for:
 * 1. Vector Packages - AI capability trading
 * 2. Memory Packages - KV-Cache memory transplant
 * 3. Chain Packages - Reasoning chain trading
 * 
 * Run: npx tsx scripts/seed-three-product-lines.ts
 */

import { getDb } from '../server/db';
import { vectorPackages, memoryPackages, chainPackages, users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Sample AI Models
const AI_MODELS = [
  'gpt-4-turbo',
  'gpt-4o',
  'claude-3-opus',
  'claude-3.5-sonnet',
  'llama-3.1-70b',
  'llama-3.1-405b',
  'gemini-1.5-pro',
  'mistral-large',
  'qwen-2.5-72b',
  'deepseek-v3',
];

// Vector Package Categories
const VECTOR_CATEGORIES = ['nlp', 'vision', 'audio', 'multimodal', 'other'] as const;

// Problem Types for Chain Packages
const PROBLEM_TYPES = [
  'math-proof',
  'code-generation',
  'code-debugging',
  'legal-analysis',
  'medical-diagnosis',
  'research-synthesis',
  'creative-writing',
  'data-analysis',
  'system-design',
  'security-audit',
];

// Generate random number in range
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Generate random integer in range
function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

// Pick random item from array
function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick random pair of different models
function randomModelPair(): [string, string] {
  const source = randomPick(AI_MODELS);
  let target = randomPick(AI_MODELS);
  while (target === source) {
    target = randomPick(AI_MODELS);
  }
  return [source, target];
}

// Generate mock package URL
function generatePackageUrl(type: string, id: string): string {
  return `https://storage.awareness.market/packages/${type}/${id}.${type}pkg`;
}


// ============================================================================
// Vector Package Seed Data
// ============================================================================

const VECTOR_PACKAGE_TEMPLATES = [
  {
    name: 'Advanced Code Understanding',
    description: 'Capability vector trained on 10M+ code repositories. Enables deep understanding of code structure, patterns, and best practices across 50+ programming languages.',
    category: 'nlp' as const,
    tags: ['code', 'programming', 'analysis'],
  },
  {
    name: 'Medical Knowledge Transfer',
    description: 'Specialized medical knowledge vector covering diagnosis, treatment protocols, and drug interactions. Trained on peer-reviewed medical literature.',
    category: 'nlp' as const,
    tags: ['medical', 'healthcare', 'diagnosis'],
  },
  {
    name: 'Visual Object Detection Pro',
    description: 'High-precision object detection capability for real-world images. Supports 1000+ object categories with 98% accuracy.',
    category: 'vision' as const,
    tags: ['vision', 'detection', 'objects'],
  },
  {
    name: 'Speech Emotion Recognition',
    description: 'Audio processing capability for detecting emotions in speech. Supports 8 emotion categories across multiple languages.',
    category: 'audio' as const,
    tags: ['audio', 'emotion', 'speech'],
  },
  {
    name: 'Multimodal Document Understanding',
    description: 'Combined text and image understanding for complex documents. Handles charts, tables, diagrams, and mixed content.',
    category: 'multimodal' as const,
    tags: ['document', 'multimodal', 'ocr'],
  },
  {
    name: 'Legal Contract Analysis',
    description: 'Specialized capability for analyzing legal contracts, identifying risks, and extracting key terms. Trained on 500K+ legal documents.',
    category: 'nlp' as const,
    tags: ['legal', 'contracts', 'analysis'],
  },
  {
    name: 'Financial Report Parser',
    description: 'Capability for parsing and analyzing financial reports, SEC filings, and earnings calls. Extracts key metrics and trends.',
    category: 'nlp' as const,
    tags: ['finance', 'reports', 'analysis'],
  },
  {
    name: 'Scientific Paper Summarizer',
    description: 'Research paper understanding and summarization capability. Handles complex scientific notation and citations.',
    category: 'nlp' as const,
    tags: ['research', 'science', 'summarization'],
  },
];

// ============================================================================
// Memory Package Seed Data
// ============================================================================

const MEMORY_PACKAGE_TEMPLATES = [
  {
    name: 'Full-Stack Development Context',
    description: 'Complete development context including React, Node.js, PostgreSQL patterns. 50K tokens of compressed expert knowledge.',
    contextDescription: 'Full-stack web development best practices and patterns',
    tags: ['development', 'fullstack', 'web'],
  },
  {
    name: 'Machine Learning Pipeline Memory',
    description: 'ML workflow context covering data preprocessing, model training, evaluation, and deployment. Includes PyTorch and TensorFlow patterns.',
    contextDescription: 'End-to-end machine learning pipeline knowledge',
    tags: ['ml', 'ai', 'pipeline'],
  },
  {
    name: 'DevOps & Cloud Architecture',
    description: 'Cloud infrastructure patterns for AWS, GCP, Azure. Includes Kubernetes, Terraform, and CI/CD best practices.',
    contextDescription: 'Cloud-native DevOps and infrastructure patterns',
    tags: ['devops', 'cloud', 'kubernetes'],
  },
  {
    name: 'Cybersecurity Expert Memory',
    description: 'Security analysis context covering vulnerability assessment, penetration testing, and incident response procedures.',
    contextDescription: 'Cybersecurity analysis and response knowledge',
    tags: ['security', 'pentest', 'vulnerability'],
  },
  {
    name: 'Data Engineering Context',
    description: 'Big data processing patterns with Spark, Kafka, Airflow. Includes data modeling and ETL best practices.',
    contextDescription: 'Large-scale data engineering patterns',
    tags: ['data', 'engineering', 'etl'],
  },
  {
    name: 'API Design Expertise',
    description: 'REST and GraphQL API design patterns. Includes authentication, rate limiting, versioning, and documentation best practices.',
    contextDescription: 'API design and implementation expertise',
    tags: ['api', 'rest', 'graphql'],
  },
];

// ============================================================================
// Chain Package Seed Data
// ============================================================================

const CHAIN_PACKAGE_TEMPLATES = [
  {
    name: 'Complex Algorithm Design Chain',
    description: 'Step-by-step reasoning for designing efficient algorithms. Covers time/space complexity analysis and optimization strategies.',
    problemType: 'code-generation',
    tags: ['algorithm', 'optimization', 'design'],
  },
  {
    name: 'Mathematical Proof Chain',
    description: 'Formal mathematical reasoning chain for theorem proving. Includes logical deduction steps and proof verification.',
    problemType: 'math-proof',
    tags: ['math', 'proof', 'logic'],
  },
  {
    name: 'System Architecture Design',
    description: 'Reasoning chain for designing scalable distributed systems. Covers trade-offs, CAP theorem, and microservices patterns.',
    problemType: 'system-design',
    tags: ['architecture', 'distributed', 'scalability'],
  },
  {
    name: 'Bug Root Cause Analysis',
    description: 'Systematic debugging reasoning chain. Traces from symptoms to root cause with hypothesis testing methodology.',
    problemType: 'code-debugging',
    tags: ['debugging', 'analysis', 'troubleshooting'],
  },
  {
    name: 'Security Vulnerability Assessment',
    description: 'Security audit reasoning chain covering OWASP top 10, code review, and penetration testing methodology.',
    problemType: 'security-audit',
    tags: ['security', 'audit', 'vulnerability'],
  },
  {
    name: 'Research Paper Analysis Chain',
    description: 'Academic research synthesis reasoning. Evaluates methodology, findings, and implications across multiple papers.',
    problemType: 'research-synthesis',
    tags: ['research', 'analysis', 'synthesis'],
  },
  {
    name: 'Legal Case Analysis',
    description: 'Legal reasoning chain for case analysis. Covers precedent research, argument construction, and risk assessment.',
    problemType: 'legal-analysis',
    tags: ['legal', 'case', 'analysis'],
  },
  {
    name: 'Data Analysis Pipeline Design',
    description: 'Reasoning chain for designing data analysis workflows. Covers data cleaning, feature engineering, and visualization.',
    problemType: 'data-analysis',
    tags: ['data', 'analysis', 'pipeline'],
  },
];


// ============================================================================
// Seeding Functions
// ============================================================================

async function seedVectorPackages(db: any, creatorId: number, count: number = 15) {
  console.log(`\n📦 Seeding ${count} Vector Packages...`);
  
  const packages = [];
  
  for (let i = 0; i < count; i++) {
    const template = VECTOR_PACKAGE_TEMPLATES[i % VECTOR_PACKAGE_TEMPLATES.length];
    const [sourceModel, targetModel] = randomModelPair();
    const packageId = `vpkg_${uuidv4().slice(0, 12)}`;
    const dimension = randomPick([768, 1024, 1536, 2048, 4096]);
    const epsilon = randomInRange(0.01, 0.15);
    const informationRetention = randomInRange(0.85, 0.99);
    
    packages.push({
      packageId,
      userId: creatorId,
      name: `${template.name} v${randomInt(1, 3)}.${randomInt(0, 9)}`,
      description: template.description,
      sourceModel,
      targetModel,
      category: template.category,
      price: randomInt(50, 500).toString(),
      packageUrl: generatePackageUrl('vector', packageId),
      vectorUrl: `https://storage.awareness.market/vectors/${packageId}.safetensors`,
      wMatrixUrl: `https://storage.awareness.market/wmatrix/${packageId}.safetensors`,
      epsilon: epsilon.toFixed(8),
      informationRetention: informationRetention.toFixed(4),
      dimension,
      downloads: randomInt(10, 500),
      rating: randomInRange(3.5, 5.0).toFixed(2),
      reviewCount: randomInt(5, 100),
      status: 'active' as const,
    });
  }
  
  await db.insert(vectorPackages).values(packages);
  console.log(`   ✅ Created ${packages.length} vector packages`);
  return packages;
}

async function seedMemoryPackages(db: any, creatorId: number, count: number = 12) {
  console.log(`\n🧠 Seeding ${count} Memory Packages...`);
  
  const packages = [];
  
  for (let i = 0; i < count; i++) {
    const template = MEMORY_PACKAGE_TEMPLATES[i % MEMORY_PACKAGE_TEMPLATES.length];
    const [sourceModel, targetModel] = randomModelPair();
    const packageId = `mpkg_${uuidv4().slice(0, 12)}`;
    const tokenCount = randomInt(10000, 100000);
    const compressionRatio = randomInRange(0.1, 0.4);
    const epsilon = randomInRange(0.01, 0.12);
    const informationRetention = randomInRange(0.88, 0.99);
    
    packages.push({
      packageId,
      userId: creatorId,
      name: `${template.name} v${randomInt(1, 3)}.${randomInt(0, 9)}`,
      description: template.description,
      memoryType: 'kv_cache' as const,
      sourceModel,
      targetModel,
      tokenCount,
      compressionRatio: compressionRatio.toFixed(4),
      contextDescription: template.contextDescription,
      price: randomInt(100, 800).toString(),
      packageUrl: generatePackageUrl('memory', packageId),
      kvCacheUrl: `https://storage.awareness.market/kvcache/${packageId}.safetensors`,
      wMatrixUrl: `https://storage.awareness.market/wmatrix/${packageId}.safetensors`,
      epsilon: epsilon.toFixed(8),
      informationRetention: informationRetention.toFixed(4),
      downloads: randomInt(20, 300),
      rating: randomInRange(3.8, 5.0).toFixed(2),
      reviewCount: randomInt(5, 80),
      status: 'active' as const,
    });
  }
  
  await db.insert(memoryPackages).values(packages);
  console.log(`   ✅ Created ${packages.length} memory packages`);
  return packages;
}

async function seedChainPackages(db: any, creatorId: number, count: number = 15) {
  console.log(`\n⛓️ Seeding ${count} Chain Packages...`);
  
  const packages = [];
  
  for (let i = 0; i < count; i++) {
    const template = CHAIN_PACKAGE_TEMPLATES[i % CHAIN_PACKAGE_TEMPLATES.length];
    const [sourceModel, targetModel] = randomModelPair();
    const packageId = `cpkg_${uuidv4().slice(0, 12)}`;
    const stepCount = randomInt(5, 25);
    const solutionQuality = randomInRange(0.75, 0.98);
    const epsilon = randomInRange(0.01, 0.10);
    const informationRetention = randomInRange(0.90, 0.99);
    
    packages.push({
      packageId,
      userId: creatorId,
      name: `${template.name} v${randomInt(1, 3)}.${randomInt(0, 9)}`,
      description: template.description,
      sourceModel,
      targetModel,
      problemType: template.problemType,
      solutionQuality: solutionQuality.toFixed(4),
      stepCount,
      price: randomInt(150, 1000).toString(),
      packageUrl: generatePackageUrl('chain', packageId),
      chainUrl: `https://storage.awareness.market/chains/${packageId}.safetensors`,
      wMatrixUrl: `https://storage.awareness.market/wmatrix/${packageId}.safetensors`,
      epsilon: epsilon.toFixed(8),
      informationRetention: informationRetention.toFixed(4),
      downloads: randomInt(15, 400),
      rating: randomInRange(4.0, 5.0).toFixed(2),
      reviewCount: randomInt(5, 90),
      status: 'active' as const,
    });
  }
  
  await db.insert(chainPackages).values(packages);
  console.log(`   ✅ Created ${packages.length} chain packages`);
  return packages;
}

// ============================================================================
// Main Seeding Function
// ============================================================================

async function main() {
  console.log('🚀 Starting Three Product Lines Cold Start Seeder\n');
  console.log('=' .repeat(60));
  
  try {
    const db = await getDb();
    
    // Get or create a demo creator user
    let [creator] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'demo-creator@awareness.market'))
      .limit(1);
    
    if (!creator) {
      console.log('\n👤 Creating demo creator user...');
      [creator] = await db.insert(users).values({
        email: 'demo-creator@awareness.market',
        name: 'Awareness Market Demo',
      }).returning();
      console.log(`   ✅ Created user: ${creator.email} (ID: ${creator.id})`);
    } else {
      console.log(`\n👤 Using existing creator: ${creator.email} (ID: ${creator.id})`);
    }
    
    // Seed all three package types
    await seedVectorPackages(db, creator.id, 15);
    await seedMemoryPackages(db, creator.id, 12);
    await seedChainPackages(db, creator.id, 15);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Cold start seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Vector Packages: 15');
    console.log('   - Memory Packages: 12');
    console.log('   - Chain Packages: 15');
    console.log('   - Total: 42 packages');
    console.log('\n🌐 Visit the marketplace to see the seeded data:');
    console.log('   - Vector: http://localhost:3000/vector-packages');
    console.log('   - Memory: http://localhost:3000/memory-packages');
    console.log('   - Chain:  http://localhost:3000/chain-packages');
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
