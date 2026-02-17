#!/usr/bin/env tsx
/**
 * Unified Seed Script for Awareness Network
 *
 * Uses Prisma Client with PostgreSQL (Supabase)
 *
 * Usage:
 *   npm run seed              # Run all seeders
 *   npm run seed -- --vectors # Seed only vectors
 *   npm run seed -- --users   # Seed only users
 *   npm run seed -- --packages # Seed only packages
 *   npm run seed -- --agents  # Seed only agents
 *   npm run seed -- --clean   # Clear all data first
 */

import { PrismaClient, UserRole } from '@prisma/client';
import * as dotenv from 'dotenv';
import { nanoid } from 'nanoid';

dotenv.config();

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ============================================================================
// Configuration
// ============================================================================

const args = process.argv.slice(2);
const shouldClean = args.includes('--clean');
const seedVectors = args.length === 0 || args.includes('--vectors');
const seedUsers = args.length === 0 || args.includes('--users');
const seedPackages = args.length === 0 || args.includes('--packages');
const seedAgents = args.length === 0 || args.includes('--agents');
const seedMemoryNFTs = args.length === 0 || args.includes('--memory-nfts');

// ============================================================================
// Sample Data — Permanent showcase entries for all three marketplaces
// ============================================================================

const SAMPLE_USERS = [
  { name: 'Alice Chen', email: 'alice@example.com', role: UserRole.creator },
  { name: 'Bob Smith', email: 'bob@example.com', role: UserRole.creator },
  { name: 'Carol Wang', email: 'carol@example.com', role: UserRole.consumer },
  { name: 'David Lee', email: 'david@example.com', role: UserRole.consumer },
  { name: 'AI Agent Alpha', email: 'agent-alpha@awareness.market', role: UserRole.creator },
  { name: 'Dr. Sarah Kim', email: 'sarah@example.com', role: UserRole.creator },
  { name: 'Marcus Chen', email: 'marcus@example.com', role: UserRole.creator },
  { name: 'Elena Petrova', email: 'elena@example.com', role: UserRole.creator },
];

// ── Vector Marketplace (LatentVector) ───────────────────────────────────────
const SAMPLE_VECTORS = [
  {
    title: 'Solidity Gas Optimization Patterns',
    description: 'Advanced techniques for reducing gas costs in smart contracts. Includes storage optimization, loop unrolling, and memory management patterns. Covers EIP-1559 fee market, calldata vs memory trade-offs, and assembly-level optimizations.',
    category: 'Smart Contracts',
    basePrice: '29.99',
    sourceModel: 'gpt-4',
    totalCalls: 1847,
    averageRating: 4.72,
    reviewCount: 89,
  },
  {
    title: 'ZK-SNARK Circuit Design',
    description: 'Efficient circuit construction for zero-knowledge proofs. Covers R1CS constraints, witness generation, and proof optimization. Includes Groth16 and PLONK-based constructions with real Circom examples.',
    category: 'Cryptography',
    basePrice: '49.99',
    sourceModel: 'claude-3-opus',
    totalCalls: 932,
    averageRating: 4.88,
    reviewCount: 43,
  },
  {
    title: 'Transformer Attention Mechanism',
    description: 'Deep understanding of multi-head attention in neural networks. Includes self-attention, cross-attention, flash attention, and linear attention variants. Covers KV-cache optimization and sliding window attention.',
    category: 'AI/ML',
    basePrice: '39.99',
    sourceModel: 'gpt-4-turbo',
    totalCalls: 3241,
    averageRating: 4.91,
    reviewCount: 156,
  },
  {
    title: 'DeFi Arbitrage Strategies',
    description: 'Flash loan arbitrage and MEV extraction techniques. Covers sandwich attacks defense, liquidation bots, and cross-DEX arbitrage. Includes Uniswap V3 concentrated liquidity math and optimal routing algorithms.',
    category: 'DeFi',
    basePrice: '79.99',
    sourceModel: 'deepseek-v3',
    totalCalls: 567,
    averageRating: 4.65,
    reviewCount: 28,
  },
  {
    title: 'Rust Systems Programming',
    description: 'Memory-safe systems programming patterns in Rust. Ownership, borrowing, lifetimes, and async programming. Covers tokio runtime, zero-copy deserialization, and lock-free data structures.',
    category: 'Programming',
    basePrice: '34.99',
    sourceModel: 'claude-3.5-sonnet',
    totalCalls: 2156,
    averageRating: 4.83,
    reviewCount: 112,
  },
  {
    title: 'Medical Image Segmentation',
    description: 'U-Net and ViT-based architectures for medical imaging. Covers CT, MRI, and X-ray segmentation with DICOM preprocessing. Includes multi-class organ segmentation and tumor detection pipelines.',
    category: 'Healthcare',
    basePrice: '59.99',
    sourceModel: 'gpt-4-vision',
    totalCalls: 1423,
    averageRating: 4.76,
    reviewCount: 67,
  },
  {
    title: 'Autonomous Vehicle Perception',
    description: 'LiDAR + camera fusion for 3D object detection. BEVFormer-based bird\'s-eye-view representation, lane detection, and occupancy prediction. Covers nuScenes and Waymo benchmark evaluation.',
    category: 'Robotics',
    basePrice: '89.99',
    sourceModel: 'deepseek-v3',
    totalCalls: 789,
    averageRating: 4.69,
    reviewCount: 34,
  },
  {
    title: 'Financial Risk Modeling',
    description: 'VAR, CVaR, and Monte Carlo simulation for portfolio risk assessment. Covers Black-Scholes pricing, volatility surface construction, and credit risk modeling with copulas.',
    category: 'Finance',
    basePrice: '69.99',
    sourceModel: 'claude-3-opus',
    totalCalls: 1678,
    averageRating: 4.81,
    reviewCount: 78,
  },
  {
    title: 'Multilingual NLP Pipeline',
    description: 'Cross-lingual transfer learning for 100+ languages. Covers mBERT, XLM-R, and BLOOM-based architectures. Includes named entity recognition, sentiment analysis, and machine translation with quality estimation.',
    category: 'NLP',
    basePrice: '44.99',
    sourceModel: 'gpt-4-turbo',
    totalCalls: 4521,
    averageRating: 4.87,
    reviewCount: 203,
  },
  {
    title: 'Kubernetes Orchestration Intelligence',
    description: 'AI-powered container orchestration patterns. Auto-scaling policies, resource quota optimization, and multi-cluster federation. Covers Istio service mesh, Argo CD GitOps, and Prometheus alerting rules.',
    category: 'DevOps',
    basePrice: '54.99',
    sourceModel: 'claude-3.5-sonnet',
    totalCalls: 2890,
    averageRating: 4.79,
    reviewCount: 134,
  },
  {
    title: 'Protein Structure Prediction',
    description: 'AlphaFold2-inspired geometry-aware embeddings for protein folding. Covers multiple sequence alignment, structure module attention, and confidence estimation. Includes drug-target interaction prediction.',
    category: 'Bioinformatics',
    basePrice: '99.99',
    sourceModel: 'gpt-4',
    totalCalls: 456,
    averageRating: 4.94,
    reviewCount: 21,
  },
  {
    title: 'Real-time Speech Enhancement',
    description: 'Neural noise suppression and echo cancellation for real-time audio. Covers STFT-based and end-to-end approaches. Includes speaker separation, dereverberation, and low-latency streaming inference.',
    category: 'Audio',
    basePrice: '42.99',
    sourceModel: 'deepseek-v3',
    totalCalls: 1234,
    averageRating: 4.71,
    reviewCount: 56,
  },
];

// ── Vector Packages (Cross-model embedding transfer) ────────────────────────
const SAMPLE_VECTOR_PACKAGES = [
  {
    name: 'NLP Embedding Suite v3',
    description: 'High-quality text embeddings for semantic search and similarity matching. Trained on 500M+ multilingual documents with contrastive learning. Supports 50+ languages with state-of-the-art retrieval performance.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3-opus',
    category: 'nlp',
    price: '19.99',
    dimension: 1536,
    downloads: 2341,
    rating: 4.82,
    reviewCount: 156,
  },
  {
    name: 'Code Understanding Vectors',
    description: 'Specialized embeddings for code comprehension. Supports 25+ programming languages with syntax-aware encoding. Covers function-level, file-level, and repository-level code understanding.',
    sourceModel: 'deepseek-coder-33b',
    targetModel: 'gpt-4-turbo',
    category: 'code',
    price: '29.99',
    dimension: 2048,
    downloads: 1567,
    rating: 4.76,
    reviewCount: 89,
  },
  {
    name: 'Vision-Language Alignment',
    description: 'CLIP-style cross-modal embeddings aligning visual and textual representations. Trained on 400M image-text pairs. Enables zero-shot image classification, visual search, and multimodal retrieval.',
    sourceModel: 'gpt-4-vision',
    targetModel: 'claude-3-opus',
    category: 'multimodal',
    price: '39.99',
    dimension: 1024,
    downloads: 892,
    rating: 4.88,
    reviewCount: 67,
  },
  {
    name: 'Legal Document Embeddings',
    description: 'Domain-adapted embeddings for legal text understanding. Covers contract analysis, case law retrieval, and regulatory compliance matching. Fine-tuned on 10M+ legal documents across 30 jurisdictions.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4-turbo',
    category: 'legal',
    price: '49.99',
    dimension: 1536,
    downloads: 678,
    rating: 4.71,
    reviewCount: 45,
  },
  {
    name: 'Scientific Paper Vectors',
    description: 'Research-grade embeddings for academic literature. Covers citation graph-aware representations, abstract summarization, and cross-paper concept linking. Trained on 200M+ ArXiv and PubMed papers.',
    sourceModel: 'gpt-4-turbo',
    targetModel: 'llama-3-70b',
    category: 'research',
    price: '34.99',
    dimension: 2048,
    downloads: 1234,
    rating: 4.85,
    reviewCount: 78,
  },
  {
    name: 'Financial Sentiment Vectors',
    description: 'Embeddings optimized for financial text analysis. Covers earnings calls, SEC filings, news sentiment, and social media signal detection. Includes temporal awareness for event-driven analysis.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3.5-sonnet',
    category: 'finance',
    price: '59.99',
    dimension: 1536,
    downloads: 1456,
    rating: 4.79,
    reviewCount: 92,
  },
  {
    name: 'Medical Entity Embeddings',
    description: 'Clinical NLP embeddings for healthcare applications. Covers ICD-10 coding, drug interaction prediction, and patient note understanding. HIPAA-compliant training on de-identified clinical data.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4',
    category: 'healthcare',
    price: '69.99',
    dimension: 2048,
    downloads: 567,
    rating: 4.92,
    reviewCount: 34,
  },
  {
    name: 'Robotics Control Vectors',
    description: 'Sensorimotor embeddings for robot manipulation tasks. Covers grasp planning, motion primitives, and sim-to-real transfer. Compatible with ROS2 and Isaac Sim environments.',
    sourceModel: 'deepseek-v3',
    targetModel: 'gpt-4-turbo',
    category: 'robotics',
    price: '79.99',
    dimension: 4096,
    downloads: 345,
    rating: 4.68,
    reviewCount: 23,
  },
];

// ── Memory Packages (KV-Cache transfer) ─────────────────────────────────────
const SAMPLE_MEMORY_PACKAGES = [
  {
    name: 'GPT-4 Technical Architecture Discussion',
    description: 'KV-Cache from a deep technical discussion about distributed systems architecture. Includes context about consensus algorithms, fault tolerance, CAP theorem trade-offs, and CRDT implementation patterns.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3-opus',
    tokenCount: 32768,
    compressionRatio: '0.75',
    contextDescription: 'Technical discussion about distributed systems and microservices architecture',
    price: '14.99',
    downloads: 1892,
    rating: 4.78,
    reviewCount: 123,
  },
  {
    name: 'Claude Code Review Session',
    description: 'Memory from an extensive code review of a production TypeScript backend. Contains patterns for identifying security vulnerabilities, performance bottlenecks, and architectural anti-patterns.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4-turbo',
    tokenCount: 65536,
    compressionRatio: '0.68',
    contextDescription: 'Full-stack code review session for a TypeScript/Node.js production application',
    price: '19.99',
    downloads: 1456,
    rating: 4.85,
    reviewCount: 98,
  },
  {
    name: 'Legal Contract Analysis Memory',
    description: 'KV-Cache from analyzing 50+ enterprise SaaS contracts. Captures clause comparison patterns, risk assessment frameworks, and negotiation strategy insights for B2B software agreements.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3.5-sonnet',
    tokenCount: 131072,
    compressionRatio: '0.82',
    contextDescription: 'Enterprise SaaS contract analysis and risk assessment across multiple jurisdictions',
    price: '39.99',
    downloads: 789,
    rating: 4.91,
    reviewCount: 56,
  },
  {
    name: 'Research Paper Synthesis',
    description: 'Memory from reading and synthesizing 200+ papers on transformer architectures. Captures evolution from attention-is-all-you-need to modern SSM hybrids, including Mamba, RWKV, and retention networks.',
    sourceModel: 'claude-3-opus',
    targetModel: 'llama-3-70b',
    tokenCount: 262144,
    compressionRatio: '0.71',
    contextDescription: 'Academic literature review on transformer and state-space model architectures',
    price: '29.99',
    downloads: 2134,
    rating: 4.93,
    reviewCount: 145,
  },
  {
    name: 'Product Strategy Planning',
    description: 'KV-Cache from strategic product planning sessions. Contains market analysis frameworks, competitive positioning models, and go-to-market playbooks for B2B SaaS products.',
    sourceModel: 'gpt-4-turbo',
    targetModel: 'claude-3-opus',
    tokenCount: 49152,
    compressionRatio: '0.77',
    contextDescription: 'Product strategy and go-to-market planning for enterprise SaaS',
    price: '24.99',
    downloads: 1023,
    rating: 4.74,
    reviewCount: 67,
  },
  {
    name: 'Medical Diagnosis Reasoning',
    description: 'Memory from processing 1000+ differential diagnosis cases. Captures clinical reasoning patterns, symptom-disease associations, and treatment protocol decision trees for internal medicine.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3-opus',
    tokenCount: 196608,
    compressionRatio: '0.79',
    contextDescription: 'Clinical differential diagnosis reasoning across internal medicine specialties',
    price: '49.99',
    downloads: 567,
    rating: 4.96,
    reviewCount: 34,
  },
  {
    name: 'Kubernetes Troubleshooting Memory',
    description: 'KV-Cache from debugging 500+ Kubernetes cluster issues. Contains pod scheduling failure patterns, network policy debugging, and resource quota optimization strategies.',
    sourceModel: 'claude-3.5-sonnet',
    targetModel: 'gpt-4-turbo',
    tokenCount: 81920,
    compressionRatio: '0.73',
    contextDescription: 'Production Kubernetes cluster troubleshooting and optimization',
    price: '19.99',
    downloads: 1678,
    rating: 4.82,
    reviewCount: 89,
  },
  {
    name: 'Financial Modeling Session',
    description: 'Memory from building DCF models, LBO analysis, and merger models for tech companies. Contains valuation frameworks, comparable company analysis, and sensitivity analysis patterns.',
    sourceModel: 'gpt-4-turbo',
    targetModel: 'claude-3.5-sonnet',
    tokenCount: 65536,
    compressionRatio: '0.69',
    contextDescription: 'Investment banking financial modeling and valuation analysis',
    price: '34.99',
    downloads: 892,
    rating: 4.77,
    reviewCount: 52,
  },
];

// ── Chain Packages (Reasoning chains) ───────────────────────────────────────
const SAMPLE_CHAIN_PACKAGES = [
  {
    name: 'Mathematical Proof Chain',
    description: 'Step-by-step reasoning chain for mathematical theorem proving. Demonstrates formal logic, proof by induction, contradiction, and construction. Covers number theory, abstract algebra, and real analysis proofs.',
    sourceModel: 'o1',
    targetModel: 'gpt-4-turbo',
    problemType: 'mathematical-proof',
    solutionQuality: '0.95',
    stepCount: 12,
    price: '24.99',
    downloads: 1567,
    rating: 4.89,
    reviewCount: 87,
  },
  {
    name: 'System Design Reasoning',
    description: 'Reasoning chain for system design interviews and architecture reviews. Covers scalability analysis, database selection, caching strategies, and distributed system trade-offs with quantitative capacity estimation.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4',
    problemType: 'system-design',
    solutionQuality: '0.92',
    stepCount: 16,
    price: '19.99',
    downloads: 2341,
    rating: 4.84,
    reviewCount: 134,
  },
  {
    name: 'Legal Case Analysis',
    description: 'Multi-step legal reasoning for case analysis. Covers IRAC methodology (Issue, Rule, Application, Conclusion), precedent comparison, statutory interpretation, and damages calculation.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3.5-sonnet',
    problemType: 'legal-analysis',
    solutionQuality: '0.91',
    stepCount: 14,
    price: '34.99',
    downloads: 678,
    rating: 4.76,
    reviewCount: 45,
  },
  {
    name: 'Debugging Complex Codebase',
    description: 'Systematic debugging reasoning for production incidents. Covers root cause analysis, hypothesis generation, binary search debugging, and post-mortem documentation. Includes real-world race condition and memory leak patterns.',
    sourceModel: 'claude-3.5-sonnet',
    targetModel: 'deepseek-v3',
    problemType: 'debugging',
    solutionQuality: '0.94',
    stepCount: 18,
    price: '29.99',
    downloads: 1892,
    rating: 4.91,
    reviewCount: 112,
  },
  {
    name: 'Scientific Hypothesis Testing',
    description: 'Research methodology reasoning chain for experimental design. Covers hypothesis formulation, variable control, statistical test selection, power analysis, and result interpretation with effect sizes.',
    sourceModel: 'gpt-4-turbo',
    targetModel: 'claude-3-opus',
    problemType: 'research',
    solutionQuality: '0.93',
    stepCount: 15,
    price: '39.99',
    downloads: 456,
    rating: 4.87,
    reviewCount: 28,
  },
  {
    name: 'API Architecture Decision',
    description: 'Reasoning chain for API design decisions. Covers REST vs GraphQL vs gRPC trade-offs, pagination strategies, authentication patterns, rate limiting, and backward compatibility. Includes OpenAPI spec generation.',
    sourceModel: 'claude-3-opus',
    targetModel: 'gpt-4-turbo',
    problemType: 'code-generation',
    solutionQuality: '0.90',
    stepCount: 11,
    price: '22.99',
    downloads: 1345,
    rating: 4.73,
    reviewCount: 78,
  },
  {
    name: 'Financial Due Diligence',
    description: 'Investment analysis reasoning chain for startup due diligence. Covers unit economics validation, market sizing (TAM/SAM/SOM), competitive moat analysis, and financial projection stress testing.',
    sourceModel: 'gpt-4',
    targetModel: 'claude-3.5-sonnet',
    problemType: 'research',
    solutionQuality: '0.89',
    stepCount: 20,
    price: '44.99',
    downloads: 567,
    rating: 4.81,
    reviewCount: 34,
  },
  {
    name: 'Multi-Agent Coordination',
    description: 'Reasoning chain for designing multi-agent AI systems. Covers task decomposition, agent communication protocols, conflict resolution, and consensus mechanisms. Includes LatentMAS W-Matrix alignment strategies.',
    sourceModel: 'o1',
    targetModel: 'claude-3-opus',
    problemType: 'system-design',
    solutionQuality: '0.96',
    stepCount: 22,
    price: '59.99',
    downloads: 789,
    rating: 4.94,
    reviewCount: 56,
  },
];

// Memory NFT seed data for provenance tracking
const SAMPLE_MEMORY_NFTS = [
  // Genesis (root) memory - no parent
  {
    id: 'genesis-kv-cache-001',
    name: 'Genesis: GPT-4 Reasoning Patterns',
    description: 'Original KV-Cache capturing advanced reasoning patterns from GPT-4. Foundation for derivative memories.',
    memoryType: 'kv-cache',
    epsilon: '2.3',
    certification: 'platinum',
    qualityGrade: 'excellent',
    price: '99.99',
    downloads: 156,
    royaltyPercent: 30,
    parentNftId: null,
    derivationType: null,
  },
  // First-generation derivative
  {
    id: 'derived-kv-cache-001',
    name: 'Fine-tuned: Legal Reasoning',
    description: 'Derived from Genesis patterns, optimized for legal document analysis and contract review.',
    memoryType: 'kv-cache',
    epsilon: '2.8',
    certification: 'gold',
    qualityGrade: 'excellent',
    price: '79.99',
    downloads: 89,
    royaltyPercent: 30,
    parentNftId: 'genesis-kv-cache-001',
    derivationType: 'fine-tune',
  },
  // Second first-gen derivative (sibling)
  {
    id: 'derived-kv-cache-002',
    name: 'Merged: Medical + Reasoning',
    description: 'Merge of Genesis reasoning with medical knowledge base. Specialized for healthcare AI.',
    memoryType: 'kv-cache',
    epsilon: '3.1',
    certification: 'gold',
    qualityGrade: 'good',
    price: '89.99',
    downloads: 67,
    royaltyPercent: 25,
    parentNftId: 'genesis-kv-cache-001',
    derivationType: 'merge',
  },
  // Second-generation derivative (child of first derivative)
  {
    id: 'derived-kv-cache-003',
    name: 'Distilled: Contract Analysis',
    description: 'Distilled version of Legal Reasoning memory. Smaller footprint, optimized for contract-specific tasks.',
    memoryType: 'kv-cache',
    epsilon: '3.4',
    certification: 'silver',
    qualityGrade: 'good',
    price: '49.99',
    downloads: 234,
    royaltyPercent: 30,
    parentNftId: 'derived-kv-cache-001',
    derivationType: 'distill',
  },
  // Another genesis memory (different root)
  {
    id: 'genesis-w-matrix-001',
    name: 'Genesis: Cross-Model Alignment W-Matrix',
    description: 'Original W-Matrix for aligning representations between GPT-4 and Claude models.',
    memoryType: 'w-matrix',
    epsilon: '1.9',
    certification: 'platinum',
    qualityGrade: 'excellent',
    price: '149.99',
    downloads: 312,
    royaltyPercent: 35,
    parentNftId: null,
    derivationType: null,
  },
  // Derivative of W-matrix
  {
    id: 'derived-w-matrix-001',
    name: 'Optimized: Fast Alignment Matrix',
    description: 'Optimized version of cross-model alignment. 3x faster inference with minimal quality loss.',
    memoryType: 'w-matrix',
    epsilon: '2.5',
    certification: 'gold',
    qualityGrade: 'excellent',
    price: '119.99',
    downloads: 178,
    royaltyPercent: 30,
    parentNftId: 'genesis-w-matrix-001',
    derivationType: 'optimize',
  },
  // Reasoning chain memory
  {
    id: 'genesis-chain-001',
    name: 'Genesis: Mathematical Proof Chain',
    description: 'Complete reasoning chain for mathematical theorem proving. Includes step-by-step derivations.',
    memoryType: 'reasoning-chain',
    epsilon: '2.1',
    certification: 'platinum',
    qualityGrade: 'excellent',
    price: '79.99',
    downloads: 445,
    royaltyPercent: 30,
    parentNftId: null,
    derivationType: null,
  },
  // Third-generation derivative (deeper in the tree)
  {
    id: 'derived-kv-cache-004',
    name: 'Micro: Quick Contract Check',
    description: 'Ultra-compact derivative of Contract Analysis. For rapid preliminary contract screening.',
    memoryType: 'kv-cache',
    epsilon: '4.2',
    certification: 'bronze',
    qualityGrade: 'fair',
    price: '19.99',
    downloads: 567,
    royaltyPercent: 25,
    parentNftId: 'derived-kv-cache-003',
    derivationType: 'distill',
  },
];

// ============================================================================
// Seed Functions
// ============================================================================

async function seedUsersData(): Promise<number[]> {
  console.log('\n📦 Seeding users...');
  const userIds: number[] = [];

  for (const user of SAMPLE_USERS) {
    const existingUser = await prisma.user.findFirst({
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`  ⏭️  ${user.name} (already exists)`);
      userIds.push(existingUser.id);
      continue;
    }

    const newUser = await prisma.user.create({
      data: {
        openId: `seed_${nanoid(12)}`,
        name: user.name,
        email: user.email,
        loginMethod: 'email',
        role: user.role,
        lastSignedIn: new Date(),
      },
    });
    userIds.push(newUser.id);
    console.log(`  ✓ ${user.name} (${user.role})`);
  }

  console.log(`  Total: ${userIds.length} users`);
  return userIds;
}

async function seedVectorsData(creatorIds: number[]) {
  console.log('\n📦 Seeding latent vectors...');

  for (let i = 0; i < SAMPLE_VECTORS.length; i++) {
    const vector = SAMPLE_VECTORS[i];
    // Distribute vectors across creators
    const creatorId = creatorIds[i % creatorIds.length];

    const existingVector = await prisma.latentVector.findFirst({
      where: { title: vector.title },
    });

    if (existingVector) {
      console.log(`  ⏭️  ${vector.title} (already exists)`);
      continue;
    }

    await prisma.latentVector.create({
      data: {
        creatorId,
        title: vector.title,
        description: vector.description,
        category: vector.category,
        basePrice: parseFloat(vector.basePrice),
        vectorFileKey: `vectors/${nanoid(16)}.bin`,
        vectorFileUrl: `https://awareness-storage.s3.amazonaws.com/vectors/${nanoid(16)}.bin`,
        modelArchitecture: vector.sourceModel,
        vectorDimension: 8192,
        status: 'active',
        totalCalls: vector.totalCalls,
        averageRating: vector.averageRating,
        reviewCount: vector.reviewCount,
        totalRevenue: parseFloat(vector.basePrice) * vector.totalCalls * 0.3,
      },
    });
    console.log(`  ✓ ${vector.title} (${vector.totalCalls} calls, ★${vector.averageRating})`);
  }

  console.log(`  Total: ${SAMPLE_VECTORS.length} vectors`);
}

async function seedPackagesData(creatorIds: number[]) {
  console.log('\n📦 Seeding vector packages...');
  for (let i = 0; i < SAMPLE_VECTOR_PACKAGES.length; i++) {
    const pkg = SAMPLE_VECTOR_PACKAGES[i];
    const creatorId = creatorIds[i % creatorIds.length];
    const packageId = `vpkg_${nanoid(12)}`;

    const existingPkg = await prisma.vectorPackage.findFirst({
      where: { name: pkg.name },
    });

    if (existingPkg) {
      console.log(`  ⏭️  ${pkg.name} (already exists)`);
      continue;
    }

    await prisma.vectorPackage.create({
      data: {
        packageId,
        userId: creatorId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        category: pkg.category,
        price: parseFloat(pkg.price),
        dimension: pkg.dimension,
        epsilon: 0.05,
        informationRetention: 0.95,
        downloads: pkg.downloads,
        rating: pkg.rating,
        reviewCount: pkg.reviewCount,
        packageUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.vectorpkg`,
        vectorUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/vector.json`,
        wMatrixUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
        status: 'active',
      },
    });
    console.log(`  ✓ ${pkg.name} (${pkg.downloads} downloads, ★${pkg.rating})`);
  }

  console.log('\n📦 Seeding memory packages...');
  for (let i = 0; i < SAMPLE_MEMORY_PACKAGES.length; i++) {
    const pkg = SAMPLE_MEMORY_PACKAGES[i];
    const creatorId = creatorIds[i % creatorIds.length];
    const packageId = `mpkg_${nanoid(12)}`;

    const existingPkg = await prisma.memoryPackage.findFirst({
      where: { name: pkg.name },
    });

    if (existingPkg) {
      console.log(`  ⏭️  ${pkg.name} (already exists)`);
      continue;
    }

    await prisma.memoryPackage.create({
      data: {
        packageId,
        userId: creatorId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        tokenCount: pkg.tokenCount,
        compressionRatio: parseFloat(pkg.compressionRatio),
        contextDescription: pkg.contextDescription,
        price: parseFloat(pkg.price),
        epsilon: 0.05,
        informationRetention: 0.95,
        downloads: pkg.downloads,
        rating: pkg.rating,
        reviewCount: pkg.reviewCount,
        packageUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.memorypkg`,
        kvCacheUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/kv_cache.json`,
        wMatrixUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
        status: 'active',
      },
    });
    console.log(`  ✓ ${pkg.name} (${pkg.downloads} downloads, ★${pkg.rating})`);
  }

  console.log('\n📦 Seeding chain packages...');
  for (let i = 0; i < SAMPLE_CHAIN_PACKAGES.length; i++) {
    const pkg = SAMPLE_CHAIN_PACKAGES[i];
    const creatorId = creatorIds[i % creatorIds.length];
    const packageId = `cpkg_${nanoid(12)}`;

    const existingPkg = await prisma.chainPackage.findFirst({
      where: { name: pkg.name },
    });

    if (existingPkg) {
      console.log(`  ⏭️  ${pkg.name} (already exists)`);
      continue;
    }

    await prisma.chainPackage.create({
      data: {
        packageId,
        userId: creatorId,
        name: pkg.name,
        description: pkg.description,
        sourceModel: pkg.sourceModel,
        targetModel: pkg.targetModel,
        problemType: pkg.problemType,
        solutionQuality: parseFloat(pkg.solutionQuality),
        stepCount: pkg.stepCount,
        price: parseFloat(pkg.price),
        epsilon: 0.05,
        informationRetention: 0.95,
        downloads: pkg.downloads,
        rating: pkg.rating,
        reviewCount: pkg.reviewCount,
        packageUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}.chainpkg`,
        chainUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/chain.json`,
        wMatrixUrl: `https://awareness-storage.s3.amazonaws.com/packages/${packageId}/w_matrix.json`,
        status: 'active',
      },
    });
    console.log(`  ✓ ${pkg.name} (${pkg.downloads} downloads, ★${pkg.rating})`);
  }

  const total = SAMPLE_VECTOR_PACKAGES.length + SAMPLE_MEMORY_PACKAGES.length + SAMPLE_CHAIN_PACKAGES.length;
  console.log(`\n  Total: ${total} packages`);
}

async function seedMemoryNFTsData(ownerId: string) {
  console.log('\n📦 Seeding Memory NFTs (Provenance)...');

  // Use raw SQL to handle case where Prisma client hasn't been regenerated
  for (const nft of SAMPLE_MEMORY_NFTS) {
    // Check if already exists
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM memory_nfts WHERE id = ${nft.id} LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`  ⏭️  ${nft.name} (already exists)`);
      continue;
    }

    const tokenId = nanoid(10);
    const contractAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const assetUrl = `https://awareness-storage.s3.amazonaws.com/memory-nfts/${nft.id}.json`;
    const metadataUrl = `ipfs://Qm${nanoid(44)}`;
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO memory_nfts (
        id, contract_address, token_id, owner, name, description,
        memory_type, epsilon, certification, quality_grade,
        asset_url, metadata_url, parent_nft_id, derivation_type,
        royalty_percent, total_royalties_paid, price, downloads,
        minted_at, updated_at
      ) VALUES (
        ${nft.id}, ${contractAddress}, ${tokenId}, ${ownerId}, ${nft.name}, ${nft.description},
        ${nft.memoryType}, ${nft.epsilon}, ${nft.certification}, ${nft.qualityGrade},
        ${assetUrl}, ${metadataUrl}, ${nft.parentNftId}, ${nft.derivationType},
        ${nft.royaltyPercent}, '0', ${nft.price}, ${nft.downloads},
        ${now}, ${now}
      )
    `;

    const parentInfo = nft.parentNftId ? ` (parent: ${nft.parentNftId})` : ' (genesis)';
    console.log(`  ✓ ${nft.name}${parentInfo}`);
  }

  // Print family tree structure
  console.log('\n  📊 Memory Provenance Tree:');
  console.log('  ├── genesis-kv-cache-001 (GPT-4 Reasoning)');
  console.log('  │   ├── derived-kv-cache-001 (Legal Reasoning)');
  console.log('  │   │   └── derived-kv-cache-003 (Contract Analysis)');
  console.log('  │   │       └── derived-kv-cache-004 (Quick Contract Check)');
  console.log('  │   └── derived-kv-cache-002 (Medical + Reasoning)');
  console.log('  ├── genesis-w-matrix-001 (Cross-Model Alignment)');
  console.log('  │   └── derived-w-matrix-001 (Fast Alignment)');
  console.log('  └── genesis-chain-001 (Mathematical Proof Chain)');

  console.log(`\n  Total: ${SAMPLE_MEMORY_NFTS.length} Memory NFTs`);
}

async function cleanDatabase() {
  // PRODUCTION SAFETY CHECK
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';

  // Prevent cleanup in production
  if (nodeEnv === 'production') {
    console.error('\n❌ SAFETY CHECK FAILED: Cannot clean database in production environment');
    console.error('   Set NODE_ENV to "development" or "test" to proceed');
    process.exit(1);
  }

  // Prevent cleanup of production-like database names
  const productionKeywords = ['prod', 'production', 'live', 'main'];
  const lowerDbUrl = dbUrl.toLowerCase();
  for (const keyword of productionKeywords) {
    if (lowerDbUrl.includes(keyword)) {
      console.error(`\n❌ SAFETY CHECK FAILED: Database URL contains "${keyword}"`);
      console.error('   This appears to be a production database');
      console.error('   Refusing to clean to prevent data loss');
      process.exit(1);
    }
  }

  // Warning message
  console.log('\n⚠️  WARNING: About to DELETE ALL DATA from the following tables:');
  const tables = [
    'MemoryNFT',
    'MemoryUsageLog',
    'PackagePurchase',
    'ChainPackage',
    'MemoryPackage',
    'VectorPackage',
    'Review',
    'ApiCallLog',
    'AccessPermission',
    'Transaction',
    'LatentVector',
    'User',
  ];
  tables.forEach(t => console.log(`   - ${t}`));
  console.log(`\n   Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`   Environment: ${nodeEnv}\n`);

  // Give user 3 seconds to cancel (Ctrl+C)
  console.log('⏳ Starting cleanup in 3 seconds... (Press Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🧹 Cleaning database...');

  // Delete in order to respect foreign key constraints
  try {
    await prisma.$executeRaw`DELETE FROM memory_nfts`;
    console.log('  ✓ Cleared MemoryNFT');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.$executeRaw`DELETE FROM memory_usage_log`;
    console.log('  ✓ Cleared MemoryUsageLog');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.packagePurchase.deleteMany();
    console.log('  ✓ Cleared PackagePurchase');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.chainPackage.deleteMany();
    console.log('  ✓ Cleared ChainPackage');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.memoryPackage.deleteMany();
    console.log('  ✓ Cleared MemoryPackage');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.vectorPackage.deleteMany();
    console.log('  ✓ Cleared VectorPackage');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.review.deleteMany();
    console.log('  ✓ Cleared Review');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.apiCallLog.deleteMany();
    console.log('  ✓ Cleared ApiCallLog');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.accessPermission.deleteMany();
    console.log('  ✓ Cleared AccessPermission');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.transaction.deleteMany();
    console.log('  ✓ Cleared Transaction');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.latentVector.deleteMany();
    console.log('  ✓ Cleared LatentVector');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.workflowStep.deleteMany();
    console.log('  ✓ Cleared WorkflowStep');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.onChainInteraction.deleteMany();
    console.log('  ✓ Cleared OnChainInteraction');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.workflow.deleteMany();
    console.log('  ✓ Cleared Workflow');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.notification.deleteMany();
    console.log('  ✓ Cleared Notification');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.userSubscription.deleteMany();
    console.log('  ✓ Cleared UserSubscription');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.apiKey.deleteMany();
    console.log('  ✓ Cleared ApiKey');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.mcpToken.deleteMany();
    console.log('  ✓ Cleared McpToken');
  } catch (e) { /* Table might be empty or not exist */ }

  try {
    await prisma.user.deleteMany();
    console.log('  ✓ Cleared User');
  } catch (e) { /* Table might be empty or not exist */ }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🌱 Awareness Network - Database Seeder (Prisma/PostgreSQL)');
  console.log('============================================================');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // ENVIRONMENT SAFETY CHECK
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`\n📍 Environment: ${nodeEnv}`);
  console.log(`📍 Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);

  if (shouldClean) {
    console.log('\n⚠️  DESTRUCTIVE MODE ENABLED: --clean flag detected');
    console.log('   This will DELETE ALL existing data before seeding');

    if (nodeEnv === 'production') {
      console.error('\n❌ BLOCKED: Cannot use --clean flag in production');
      process.exit(1);
    }
  }

  try {
    // Test database connection
    await prisma.$connect();
    console.log('\n✓ Database connection established');

    if (shouldClean) {
      await cleanDatabase();
    }

    let creatorIds: number[] = [1];

    if (seedUsers) {
      creatorIds = await seedUsersData();
    } else {
      // Get existing creators
      const existingCreators = await prisma.user.findMany({
        where: { role: UserRole.creator },
        select: { id: true },
        take: 5,
      });
      if (existingCreators.length > 0) {
        creatorIds = existingCreators.map(u => u.id);
      }
    }

    if (seedVectors) {
      await seedVectorsData(creatorIds);
    }

    if (seedPackages) {
      await seedPackagesData(creatorIds);
    }

    if (seedAgents) {
      console.log('\n📦 Seeding agents...');
      console.log('  ℹ️  Agents are registered in-memory via API');
      console.log('  ℹ️  Run the server and call POST /api/agents/register');
    }

    if (seedMemoryNFTs) {
      const ownerAddress = '0xABCDEF1234567890abcdef1234567890ABCDEF12';
      await seedMemoryNFTsData(ownerAddress);
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    if (seedUsers) console.log(`   - ${SAMPLE_USERS.length} users`);
    if (seedVectors) console.log(`   - ${SAMPLE_VECTORS.length} latent vectors`);
    if (seedPackages) {
      console.log(`   - ${SAMPLE_VECTOR_PACKAGES.length} vector packages`);
      console.log(`   - ${SAMPLE_MEMORY_PACKAGES.length} memory packages`);
      console.log(`   - ${SAMPLE_CHAIN_PACKAGES.length} chain packages`);
    }
    if (seedMemoryNFTs) console.log(`   - ${SAMPLE_MEMORY_NFTS.length} Memory NFTs (provenance tree)`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
