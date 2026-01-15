/**
 * Seed script for LatentMAS-compliant enterprise AI capability vectors
 * Demonstrates real-world B2B AI knowledge trading with proper vector format
 */

import { getDb } from "./server/db";
import { storagePut } from "./server/storage";
import { nanoid } from "nanoid";

async function generateMockVector(dimension: number, seed: string): Promise<number[]> {
  // Generate deterministic mock vector based on seed
  const vector: number[] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  
  for (let i = 0; i < dimension; i++) {
    // Use seed + index for deterministic generation
    const val = Math.sin(hash + i) * 0.5 + 0.5; // Normalize to [0, 1]
    vector.push(val);
  }
  
  return vector;
}

async function uploadVectorToS3(vectorData: number[], title: string): Promise<{ fileKey: string; fileUrl: string }> {
  // Convert vector to binary format (simulated)
  const vectorJson = JSON.stringify({
    format: "latentmas/1.0",
    vector: vectorData,
    checksum: nanoid(16)
  });
  
  const buffer = Buffer.from(vectorJson, 'utf-8');
  const fileKey = `vectors/${nanoid(16)}-${title.toLowerCase().replace(/\s+/g, '-')}.latent`;
  
  const { url } = await storagePut(fileKey, buffer, 'application/octet-stream');
  
  return { fileKey, fileUrl: url };
}

async function main() {
  console.log('🌱 Seeding LatentMAS-compliant enterprise AI vectors...\n');
  
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  // Get or create creator
  const { users } = await import("./drizzle/schema");
  const { eq } = await import("drizzle-orm");
  
  const [existingCreator] = await db.select()
    .from(users)
    .where(eq(users.role, 'creator'))
    .limit(1);

  let creatorId: number;
  
  if (existingCreator) {
    creatorId = existingCreator.id;
    console.log(`✓ Using existing creator: ${existingCreator.name} (ID: ${creatorId})\n`);
  } else {
    const [newCreator]: any = await db.insert(users).values({
      openId: 'enterprise-ai-creator',
      name: 'Enterprise AI Solutions',
      email: 'enterprise@awareness-network.com',
      role: 'creator'
    });
    creatorId = newCreator.insertId;
    console.log(`✓ Created creator user (ID: ${creatorId})\n`);
  }

  // LatentMAS-compliant enterprise vectors
  const vectors = [
    {
      title: "Financial Risk Analysis Expert",
      description: "Advanced financial risk assessment AI trained on 10+ years of Fortune 500 company data. Provides real-time risk scoring, fraud detection, and compliance monitoring. Specializes in credit risk, market risk, and operational risk analysis.",
      category: "Finance & Accounting",
      modelArchitecture: "gpt-4",
      vectorDimension: 1536,
      basePrice: 299.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 94.2,
        latency_ms: 450,
        success_rate: 98.5,
        alignment_quality: {
          cosine_similarity: 0.91,
          euclidean_distance: 0.18
        }
      })
    },
    {
      title: "SOP Management & Process Optimization",
      description: "Enterprise-grade Standard Operating Procedure management AI. Trained on manufacturing, healthcare, and logistics SOPs from 50+ organizations. Automates SOP creation, compliance checking, and process improvement recommendations.",
      category: "Operations & Management",
      modelArchitecture: "gpt-4",
      vectorDimension: 1536,
      basePrice: 199.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 91.3,
        latency_ms: 380,
        success_rate: 97.2,
        alignment_quality: {
          cosine_similarity: 0.89,
          euclidean_distance: 0.21
        }
      })
    },
    {
      title: "Customer Service Excellence AI",
      description: "Customer service AI trained on 5 million support interactions across e-commerce, SaaS, and telecom industries. Handles complex queries, sentiment analysis, and escalation prediction. Reduces response time by 60%.",
      category: "Customer Service",
      modelArchitecture: "claude-3",
      vectorDimension: 1024,
      basePrice: 149.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 89.1,
        latency_ms: 320,
        success_rate: 96.8,
        alignment_quality: {
          cosine_similarity: 0.87,
          euclidean_distance: 0.24
        }
      })
    },
    {
      title: "Supply Chain Demand Forecasting",
      description: "AI-powered demand forecasting for supply chain optimization. Trained on retail, manufacturing, and distribution data. Predicts demand with 92% accuracy, optimizes inventory levels, and reduces stockouts by 45%.",
      category: "Supply Chain & Logistics",
      modelArchitecture: "gpt-4",
      vectorDimension: 1536,
      basePrice: 349.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 92.4,
        latency_ms: 520,
        success_rate: 97.8,
        alignment_quality: {
          cosine_similarity: 0.93,
          euclidean_distance: 0.15
        }
      })
    },
    {
      title: "HR Talent Assessment & Matching",
      description: "AI-driven talent assessment and job matching system. Analyzes resumes, skills, and cultural fit. Trained on 100K+ hiring decisions from tech, finance, and healthcare sectors. Reduces time-to-hire by 40%.",
      category: "Human Resources",
      modelArchitecture: "bert",
      vectorDimension: 768,
      basePrice: 179.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 87.6,
        latency_ms: 290,
        success_rate: 95.5,
        alignment_quality: {
          cosine_similarity: 0.85,
          euclidean_distance: 0.27
        }
      })
    },
    {
      title: "Legal Contract Analysis & Review",
      description: "Legal AI specialized in contract review and risk identification. Trained on 50K+ commercial contracts, NDAs, and service agreements. Identifies risky clauses, suggests amendments, and ensures compliance.",
      category: "Legal & Compliance",
      modelArchitecture: "gpt-4",
      vectorDimension: 1536,
      basePrice: 399.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 93.7,
        latency_ms: 480,
        success_rate: 98.2,
        alignment_quality: {
          cosine_similarity: 0.92,
          euclidean_distance: 0.17
        }
      })
    },
    {
      title: "Marketing Campaign Optimizer",
      description: "AI-powered marketing campaign optimization. Analyzes ad performance, audience targeting, and ROI. Trained on $100M+ in ad spend data across Google, Facebook, and LinkedIn. Improves ROAS by 35%.",
      category: "Marketing & Sales",
      modelArchitecture: "claude-3",
      vectorDimension: 1024,
      basePrice: 229.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 88.4,
        latency_ms: 350,
        success_rate: 96.3,
        alignment_quality: {
          cosine_similarity: 0.88,
          euclidean_distance: 0.23
        }
      })
    },
    {
      title: "Cybersecurity Threat Detection",
      description: "Advanced cybersecurity AI for threat detection and incident response. Trained on 10M+ security events and attack patterns. Detects zero-day threats, analyzes malware, and provides remediation steps.",
      category: "IT & Security",
      modelArchitecture: "gpt-4",
      vectorDimension: 1536,
      basePrice: 449.00,
      pricingModel: "per-call" as const,
      performanceMetrics: JSON.stringify({
        accuracy: 95.1,
        latency_ms: 280,
        success_rate: 99.1,
        alignment_quality: {
          cosine_similarity: 0.94,
          euclidean_distance: 0.13
        }
      })
    }
  ];

  console.log('📦 Generating and uploading LatentMAS vectors...\n');

  const { latentVectors } = await import("./drizzle/schema");

  for (const vectorMeta of vectors) {
    // Generate mock vector data
    const vectorData = await generateMockVector(
      vectorMeta.vectorDimension,
      vectorMeta.title
    );

    // Upload to S3
    const { fileKey, fileUrl } = await uploadVectorToS3(vectorData, vectorMeta.title);

    // Insert into database
    await db.insert(latentVectors).values({
      ...vectorMeta,
      creatorId,
      vectorFileKey: fileKey,
      vectorFileUrl: fileUrl,
      status: 'active',
      totalCalls: Math.floor(Math.random() * 1000) + 100,
      totalRevenue: (Math.random() * 50000 + 10000).toFixed(2),
      averageRating: (Math.random() * 1.5 + 3.5).toFixed(2),
      reviewCount: Math.floor(Math.random() * 50) + 5
    });

    console.log(`  ✓ ${vectorMeta.title}`);
    console.log(`    Model: ${vectorMeta.modelArchitecture} (${vectorMeta.vectorDimension}D)`);
    console.log(`    Price: $${vectorMeta.basePrice} per call`);
    console.log(`    Vector: ${fileKey}`);
    console.log('');
  }

  console.log(`\n✅ Successfully seeded ${vectors.length} LatentMAS-compliant enterprise vectors!`);
  console.log('\n💡 These vectors follow LatentMAS/1.0 protocol:');
  console.log('   - Proper vector dimension specification');
  console.log('   - Model architecture identification');
  console.log('   - Alignment quality metrics');
  console.log('   - S3-stored vector files');
  console.log('\n🚀 Visit /marketplace to explore enterprise AI capabilities!\n');
}

main().catch(console.error);
