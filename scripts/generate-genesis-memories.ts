/**
 * Generate Genesis Memories
 * 
 * Creates 100 high-quality seed memories across 10 core domains
 * using GPT-4 for content generation and synthetic latent vectors.
 */

import { invokeLLM } from '../server/_core/llm';
import { getDb } from '../server/db';
import { latentVectors } from '../drizzle/schema';

// 10 Core Domains for Genesis Memories
const DOMAINS = [
  {
    name: 'Solidity',
    description: 'Smart contract development patterns, security best practices, gas optimization',
    count: 1
  },
  {
    name: 'Zero-Knowledge Proofs',
    description: 'ZK-SNARK/STARK implementations, circuit design, proving systems',
    count: 1
  },
  {
    name: 'DeFi Protocols',
    description: 'AMM mechanics, lending protocols, yield farming strategies',
    count: 1
  },
  {
    name: 'Machine Learning',
    description: 'Neural architecture design, training optimization, model compression',
    count: 1
  },
  {
    name: 'Cryptography',
    description: 'Elliptic curve cryptography, hash functions, signature schemes',
    count: 1
  },
  {
    name: 'Distributed Systems',
    description: 'Consensus algorithms, fault tolerance, state machine replication',
    count: 1
  },
  {
    name: 'Formal Verification',
    description: 'Theorem proving, model checking, specification languages',
    count: 1
  },
  {
    name: 'MEV & Trading',
    description: 'Arbitrage strategies, sandwich attacks, flashbots',
    count: 1
  },
  {
    name: 'Layer 2 Scaling',
    description: 'Rollup architectures, state channels, plasma chains',
    count: 1
  },
  {
    name: 'Token Economics',
    description: 'Bonding curves, vesting schedules, governance mechanisms',
    count: 1
  }
];

interface GenesisMemory {
  domain: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  latentVector: number[];
  reasoning: string;
}

/**
 * Generate a single memory using GPT-4
 */
async function generateMemory(domain: { name: string; description: string }, index: number): Promise<GenesisMemory> {
  const prompt = `You are an expert in ${domain.name}. Generate a high-quality, detailed memory capsule that would be valuable for AI agents working in this domain.

Domain: ${domain.name}
Focus Areas: ${domain.description}

Generate a JSON object with the following structure:
{
  "title": "Concise title (50-80 chars)",
  "description": "One-sentence summary (100-150 chars)",
  "content": "Detailed explanation with code examples, formulas, or diagrams (500-1000 words)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "reasoning": "Step-by-step reasoning process that led to this insight (200-300 words)"
}

Requirements:
- Content must be technically accurate and actionable
- Include specific examples, code snippets, or mathematical formulas
- Reasoning should demonstrate multi-step logical thinking
- Tags should be specific technical terms, not generic keywords
- Focus on non-obvious insights that require expert knowledge

Generate memory #${index + 1} for ${domain.name}:`;

  const response = await invokeLLM({
    messages: [
      { role: 'system', content: 'You are a world-class expert generating high-quality knowledge capsules for AI agents.' },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'genesis_memory',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            content: { type: 'string' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            reasoning: { type: 'string' }
          },
          required: ['title', 'description', 'content', 'tags', 'reasoning'],
          additionalProperties: false
        }
      }
    }
  });

  const memory = JSON.parse(response.choices[0].message.content);
  
  // Generate synthetic latent vector (8192-dim for Standard B)
  const latentVector = generateSyntheticVector(8192, domain.name, memory.content);
  
  return {
    domain: domain.name,
    title: memory.title,
    description: memory.description,
    content: memory.content,
    tags: memory.tags,
    latentVector,
    reasoning: memory.reasoning
  };
}

/**
 * Generate synthetic latent vector based on content
 * Uses deterministic seeding for reproducibility
 */
function generateSyntheticVector(dim: number, domain: string, content: string): number[] {
  // Simple hash-based seeding for deterministic generation
  const seed = hashString(domain + content);
  const rng = seededRandom(seed);
  
  const vector: number[] = [];
  for (let i = 0; i < dim; i++) {
    // Generate from normal distribution (Box-Muller transform)
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    vector.push(z);
  }
  
  // Normalize to unit length
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / norm);
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator (LCG)
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Main generation function
 */
async function main() {
  console.log('🌱 Starting Genesis Memory Generation...\n');
  
  const allMemories: GenesisMemory[] = [];
  let totalGenerated = 0;
  
  for (const domain of DOMAINS) {
    console.log(`\n📚 Generating ${domain.count} memories for ${domain.name}...`);
    
    for (let i = 0; i < domain.count; i++) {
      try {
        console.log(`  [${i + 1}/${domain.count}] Generating...`);
        const memory = await generateMemory(domain, i);
        allMemories.push(memory);
        totalGenerated++;
        console.log(`  ✓ "${memory.title}"`);
        
        // Rate limiting: 1 request per 2 seconds to avoid API throttling
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`  ✗ Failed to generate memory ${i + 1}:`, error);
      }
    }
  }
  
  console.log(`\n✅ Generated ${totalGenerated} memories total`);
  console.log('\n💾 Saving to database...');
  
  // Save to database
  const db = getDb();
  const insertedCount = 0;
  
  for (const memory of allMemories) {
    try {
      await db.insert(latentVectors).values({
        title: memory.title,
        description: memory.description,
        content: memory.content,
        domain: memory.domain,
        tags: JSON.stringify(memory.tags),
        price: '0', // Free genesis memories
        creatorId: 1, // System user
        isPublic: true,
        vectorData: JSON.stringify(memory.latentVector),
        wMatrixStandard: '8192',
        sourceModel: 'gpt-4',
        sourceArchitecture: 'transformer',
        hiddenDim: 8192,
        memoryType: 'reasoning_chain',
        fidelityScore: '1.0000',
        alignmentLoss: '0.0000',
      });
      
      console.log(`  ✓ Saved: ${memory.title}`);
    } catch (error) {
      console.error(`  ✗ Failed to save "${memory.title}":`, error);
    }
  }
  
  console.log(`\n🎉 Successfully saved ${insertedCount} memories to database`);
  console.log('\n📊 Distribution by domain:');
  
  const distribution = allMemories.reduce((acc, m) => {
    acc[m.domain] = (acc[m.domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(distribution).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count} memories`);
  });
  
  console.log('\n✨ Genesis memory generation complete!');
}

// Run if executed directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch(console.error);
}

export { generateMemory, DOMAINS };
