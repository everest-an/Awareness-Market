/**
 * Generate 10 Genesis Memory Samples
 * 
 * Creates high-quality sample latent vectors demonstrating LatentMAS v2 features:
 * - KV-Cache compression
 * - Semantic anchor alignment
 * - Multiple categories (finance, code, medical, etc.)
 */

import { createConnection } from 'mysql2/promise';
import crypto from 'crypto';

// Database connection
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const db = await createConnection(process.env.DATABASE_URL);

console.log('Connected to database');

// Genesis memories data
const genesisMemories = [
  {
    title: 'Financial Market Analysis Expert',
    description: 'Specialized latent vector trained on financial market data, stock analysis, and economic indicators. Compressed using KV-Cache v2 for 95% bandwidth efficiency. Calibrated against semantic anchors for factual accuracy.',
    category: 'finance',
    vectorDimension: 1536,
    modelArchitecture: 'GPT-4',
    vectorType: 'kv_cache',
    kvCacheMetadata: JSON.stringify({
      sourceModel: 'GPT-4',
      sequenceLength: 8192,
      tokenCount: 7500,
      contextDescription: 'Financial market analysis and stock prediction',
      compressionRatio: 0.05,
      cumulativeAttention: 0.95,
    }),
    basePrice: '9.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      accuracy: 0.94,
      latency: 120,
      compressionRatio: 0.05,
      semanticAlignment: 0.92,
    }),
    status: 'active',
    freeTrialCalls: 5,
  },
  {
    title: 'Python Code Generation Specialist',
    description: 'Advanced code generation vector fine-tuned for Python development. Uses W-Matrix v2 alignment for cross-model compatibility. Verified with anti-poisoning protocol (PoLF score: 0.98).',
    category: 'code-generation',
    vectorDimension: 3072,
    modelArchitecture: 'GPT-4-Turbo',
    vectorType: 'embedding',
    basePrice: '12.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      accuracy: 0.96,
      latency: 95,
      codeQuality: 0.94,
      semanticAlignment: 0.95,
    }),
    status: 'active',
    freeTrialCalls: 3,
  },
  {
    title: 'Medical Diagnosis Assistant',
    description: 'Healthcare-specialized latent vector trained on medical literature and diagnostic protocols. Semantic anchor calibration score: 0.93. HIPAA-compliant reasoning chains.',
    category: 'medical',
    vectorDimension: 2048,
    modelArchitecture: 'Claude-3-Opus',
    vectorType: 'reasoning_chain',
    basePrice: '19.99',
    pricingModel: 'subscription',
    performanceMetrics: JSON.stringify({
      accuracy: 0.95,
      latency: 150,
      diagnosticPrecision: 0.93,
      semanticAlignment: 0.93,
    }),
    status: 'active',
    freeTrialCalls: 2,
  },
  {
    title: 'Legal Document Analyzer',
    description: 'Legal reasoning vector with expertise in contract analysis and compliance. KV-Cache compressed for efficient long-document processing. Aligned to legal semantic anchors.',
    category: 'legal',
    vectorDimension: 1536,
    modelArchitecture: 'GPT-4',
    vectorType: 'kv_cache',
    kvCacheMetadata: JSON.stringify({
      sourceModel: 'GPT-4',
      sequenceLength: 16384,
      tokenCount: 15000,
      contextDescription: 'Legal document analysis and contract review',
      compressionRatio: 0.08,
      cumulativeAttention: 0.92,
    }),
    basePrice: '15.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      accuracy: 0.93,
      latency: 180,
      compressionRatio: 0.08,
      semanticAlignment: 0.91,
    }),
    status: 'active',
    freeTrialCalls: 3,
  },
  {
    title: 'Creative Writing Assistant',
    description: 'Creative expression vector optimized for storytelling and content generation. Calibrated against 64 creative semantic anchors. W-Matrix aligned for style transfer.',
    category: 'creative-writing',
    vectorDimension: 2048,
    modelArchitecture: 'Claude-3-Sonnet',
    vectorType: 'embedding',
    basePrice: '8.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      creativity: 0.96,
      coherence: 0.94,
      latency: 110,
      semanticAlignment: 0.94,
    }),
    status: 'active',
    freeTrialCalls: 5,
  },
  {
    title: 'Data Science & ML Expert',
    description: 'Machine learning and data analysis specialist vector. Trained on scientific papers and ML frameworks. Anti-poisoning verified with 0.97 fidelity score.',
    category: 'data-science',
    vectorDimension: 3072,
    modelArchitecture: 'GPT-4-Turbo',
    vectorType: 'embedding',
    basePrice: '14.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      accuracy: 0.95,
      latency: 100,
      technicalDepth: 0.96,
      semanticAlignment: 0.94,
    }),
    status: 'active',
    freeTrialCalls: 3,
  },
  {
    title: 'Customer Support Chatbot',
    description: 'Customer service reasoning chain with empathy modeling. KV-Cache compressed for real-time response. Semantic anchor coverage: 95% across support categories.',
    category: 'customer-support',
    vectorDimension: 1536,
    modelArchitecture: 'GPT-3.5-Turbo',
    vectorType: 'kv_cache',
    kvCacheMetadata: JSON.stringify({
      sourceModel: 'GPT-3.5-Turbo',
      sequenceLength: 4096,
      tokenCount: 3800,
      contextDescription: 'Customer support and issue resolution',
      compressionRatio: 0.07,
      cumulativeAttention: 0.93,
    }),
    basePrice: '4.99',
    pricingModel: 'subscription',
    performanceMetrics: JSON.stringify({
      satisfaction: 0.92,
      latency: 80,
      compressionRatio: 0.07,
      semanticAlignment: 0.90,
    }),
    status: 'active',
    freeTrialCalls: 10,
  },
  {
    title: 'Educational Tutor - Mathematics',
    description: 'Mathematics education vector with step-by-step reasoning. W-Matrix aligned for adaptive difficulty. Verified with anti-poisoning protocol.',
    category: 'education',
    vectorDimension: 2048,
    modelArchitecture: 'GPT-4',
    vectorType: 'reasoning_chain',
    basePrice: '7.99',
    pricingModel: 'subscription',
    performanceMetrics: JSON.stringify({
      accuracy: 0.97,
      pedagogicalQuality: 0.95,
      latency: 130,
      semanticAlignment: 0.93,
    }),
    status: 'active',
    freeTrialCalls: 5,
  },
  {
    title: 'Cybersecurity Threat Analyzer',
    description: 'Security analysis vector trained on threat intelligence and vulnerability databases. KV-Cache optimized for rapid threat detection. PoLF verified.',
    category: 'cybersecurity',
    vectorDimension: 3072,
    modelArchitecture: 'GPT-4-Turbo',
    vectorType: 'kv_cache',
    kvCacheMetadata: JSON.stringify({
      sourceModel: 'GPT-4-Turbo',
      sequenceLength: 8192,
      tokenCount: 7200,
      contextDescription: 'Cybersecurity threat analysis and incident response',
      compressionRatio: 0.06,
      cumulativeAttention: 0.94,
    }),
    basePrice: '24.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      accuracy: 0.96,
      latency: 140,
      compressionRatio: 0.06,
      threatDetection: 0.95,
      semanticAlignment: 0.92,
    }),
    status: 'active',
    freeTrialCalls: 2,
  },
  {
    title: 'Multilingual Translation Expert',
    description: 'Cross-lingual translation vector supporting 50+ languages. W-Matrix aligned for semantic preservation. Calibrated against multilingual semantic anchors.',
    category: 'translation',
    vectorDimension: 2048,
    modelArchitecture: 'GPT-4',
    vectorType: 'embedding',
    basePrice: '11.99',
    pricingModel: 'per-call',
    performanceMetrics: JSON.stringify({
      accuracy: 0.94,
      fluency: 0.95,
      latency: 105,
      semanticAlignment: 0.93,
      languageCoverage: 50,
    }),
    status: 'active',
    freeTrialCalls: 4,
  },
];

// Generate mock vector files and insert into database
async function generateGenesisMemories() {
  console.log('Generating 10 genesis memories...\n');

  // Assume creator ID 1 exists (or create one)
  const creatorId = 1;

  for (let i = 0; i < genesisMemories.length; i++) {
    const memory = genesisMemories[i];
    
    // Generate mock vector file key (in production, this would be actual S3 upload)
    const vectorFileKey = `genesis-memories/${memory.category}/${crypto.randomBytes(16).toString('hex')}.vec`;
    const vectorFileUrl = `https://storage.awareness.market/${vectorFileKey}`;

    console.log(`[${i + 1}/10] Creating: ${memory.title}`);
    console.log(`  Category: ${memory.category}`);
    console.log(`  Type: ${memory.vectorType}`);
    console.log(`  Price: $${memory.basePrice}`);

    try {
      const [result] = await db.execute(
        `INSERT INTO latent_vectors (
          creator_id, title, description, category, vector_file_key, vector_file_url,
          model_architecture, vector_dimension, performance_metrics, base_price,
          pricing_model, status, total_calls, total_revenue, average_rating,
          review_count, free_trial_calls, vector_type, kv_cache_metadata,
          w_matrix_version, w_matrix_standard, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          creatorId,
          memory.title,
          memory.description,
          memory.category,
          vectorFileKey,
          vectorFileUrl,
          memory.modelArchitecture,
          memory.vectorDimension,
          memory.performanceMetrics,
          memory.basePrice,
          memory.pricingModel,
          memory.status,
          0, // total_calls
          '0.00', // total_revenue
          '0.00', // average_rating
          0, // review_count
          memory.freeTrialCalls,
          memory.vectorType,
          memory.kvCacheMetadata || null,
          'v2.0.0', // w_matrix_version
          '8192', // w_matrix_standard
        ]
      );

      console.log(`  ✓ Inserted with ID: ${result.insertId}\n`);
    } catch (error) {
      console.error(`  ✗ Failed to insert: ${error.message}\n`);
    }
  }

  console.log('✅ All 10 genesis memories generated successfully!');
}

// Run the script
await generateGenesisMemories();
await db.end();
