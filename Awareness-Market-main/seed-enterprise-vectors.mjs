#!/usr/bin/env node
/**
 * Seed script for enterprise AI capability vectors
 * Demonstrates real-world B2B AI knowledge trading scenarios
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('🌱 Seeding enterprise AI capability vectors...\n');

// Enterprise AI capability vectors
const enterpriseVectors = [
  {
    title: "Financial Risk Analysis Expert",
    description: "Advanced financial risk assessment AI trained on 10+ years of Fortune 500 company data. Provides real-time risk scoring, fraud detection, and compliance monitoring. Specializes in credit risk, market risk, and operational risk analysis.",
    category: "Finance & Accounting",
    tags: JSON.stringify(["finance", "risk-analysis", "compliance", "fraud-detection", "enterprise"]),
    price: 299.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["risk_scoring", "fraud_detection", "compliance_check", "trend_analysis"],
      training_data: "Fortune 500 financial reports, SEC filings, audit data",
      accuracy: 0.94
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 94,
      latency_ms: 450,
      success_rate: 98.5
    }),
    usageInstructions: "Send financial transaction data or company metrics. Returns risk score (0-100), risk factors, and compliance alerts.",
    status: "active"
  },
  {
    title: "SOP Management & Process Optimization",
    description: "Enterprise-grade Standard Operating Procedure management AI. Trained on manufacturing, healthcare, and logistics SOPs from 50+ organizations. Automates SOP creation, compliance checking, and process improvement recommendations.",
    category: "Operations & Management",
    tags: JSON.stringify(["sop", "process-optimization", "compliance", "quality-management", "enterprise"]),
    price: 199.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["sop_generation", "compliance_audit", "process_analysis", "improvement_suggestions"],
      training_data: "ISO standards, industry SOPs, quality management systems",
      accuracy: 0.91
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 91,
      latency_ms: 380,
      success_rate: 97.2
    }),
    usageInstructions: "Provide process description or existing SOP. Returns optimized SOP, compliance gaps, and efficiency improvements.",
    status: "active"
  },
  {
    title: "Customer Service Excellence AI",
    description: "Customer service AI trained on 5 million support interactions across e-commerce, SaaS, and telecom industries. Handles complex queries, sentiment analysis, and escalation prediction. Reduces response time by 60%.",
    category: "Customer Service",
    tags: JSON.stringify(["customer-service", "sentiment-analysis", "support", "chatbot", "enterprise"]),
    price: 149.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["query_resolution", "sentiment_analysis", "escalation_prediction", "personalization"],
      training_data: "5M+ support tickets, chat logs, customer feedback",
      accuracy: 0.89
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 89,
      latency_ms: 320,
      success_rate: 96.8
    }),
    usageInstructions: "Send customer query and context. Returns suggested response, sentiment score, and escalation recommendation.",
    status: "active"
  },
  {
    title: "Supply Chain Demand Forecasting",
    description: "AI-powered demand forecasting for supply chain optimization. Trained on retail, manufacturing, and distribution data. Predicts demand with 92% accuracy, optimizes inventory levels, and reduces stockouts by 45%.",
    category: "Supply Chain & Logistics",
    tags: JSON.stringify(["supply-chain", "forecasting", "inventory", "logistics", "enterprise"]),
    price: 349.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["demand_forecasting", "inventory_optimization", "supplier_analysis", "route_optimization"],
      training_data: "Historical sales, weather data, market trends, supplier performance",
      accuracy: 0.92
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 92,
      latency_ms: 520,
      success_rate: 97.8
    }),
    usageInstructions: "Provide historical sales data and market conditions. Returns demand forecast, optimal inventory levels, and reorder points.",
    status: "active"
  },
  {
    title: "HR Talent Assessment & Matching",
    description: "AI-driven talent assessment and job matching system. Analyzes resumes, skills, and cultural fit. Trained on 100K+ hiring decisions from tech, finance, and healthcare sectors. Reduces time-to-hire by 40%.",
    category: "Human Resources",
    tags: JSON.stringify(["hr", "recruitment", "talent-assessment", "matching", "enterprise"]),
    price: 179.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["resume_analysis", "skill_matching", "culture_fit", "interview_questions"],
      training_data: "100K+ resumes, job descriptions, performance reviews",
      accuracy: 0.87
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 87,
      latency_ms: 290,
      success_rate: 95.5
    }),
    usageInstructions: "Submit resume and job description. Returns match score, skill gaps, and interview recommendations.",
    status: "active"
  },
  {
    title: "Legal Contract Analysis & Review",
    description: "Legal AI specialized in contract review and risk identification. Trained on 50K+ commercial contracts, NDAs, and service agreements. Identifies risky clauses, suggests amendments, and ensures compliance.",
    category: "Legal & Compliance",
    tags: JSON.stringify(["legal", "contract-review", "compliance", "risk", "enterprise"]),
    price: 399.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["clause_analysis", "risk_identification", "compliance_check", "amendment_suggestions"],
      training_data: "Commercial contracts, legal precedents, regulatory documents",
      accuracy: 0.93
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 93,
      latency_ms: 480,
      success_rate: 98.2
    }),
    usageInstructions: "Upload contract document. Returns risk assessment, problematic clauses, and suggested amendments.",
    status: "active"
  },
  {
    title: "Marketing Campaign Optimizer",
    description: "AI-powered marketing campaign optimization. Analyzes ad performance, audience targeting, and ROI. Trained on $100M+ in ad spend data across Google, Facebook, and LinkedIn. Improves ROAS by 35%.",
    category: "Marketing & Sales",
    tags: JSON.stringify(["marketing", "advertising", "optimization", "roi", "enterprise"]),
    price: 229.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["campaign_analysis", "audience_targeting", "budget_allocation", "creative_optimization"],
      training_data: "Ad performance data, audience demographics, conversion data",
      accuracy: 0.88
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 88,
      latency_ms: 350,
      success_rate: 96.3
    }),
    usageInstructions: "Provide campaign data and goals. Returns optimization recommendations, audience insights, and budget allocation.",
    status: "active"
  },
  {
    title: "Cybersecurity Threat Detection",
    description: "Advanced cybersecurity AI for threat detection and incident response. Trained on 10M+ security events and attack patterns. Detects zero-day threats, analyzes malware, and provides remediation steps.",
    category: "IT & Security",
    tags: JSON.stringify(["cybersecurity", "threat-detection", "incident-response", "malware", "enterprise"]),
    price: 449.00,
    pricingModel: "per_call",
    vectorData: JSON.stringify({
      model: "gpt-4",
      capabilities: ["threat_detection", "malware_analysis", "incident_response", "vulnerability_assessment"],
      training_data: "Security logs, attack patterns, CVE database, malware samples",
      accuracy: 0.95
    }),
    performanceMetrics: JSON.stringify({
      accuracy: 95,
      latency_ms: 280,
      success_rate: 99.1
    }),
    usageInstructions: "Send security logs or suspicious activity. Returns threat assessment, attack vectors, and remediation steps.",
    status: "active"
  }
];

try {
  // Get or create a creator user
  const [existingUser] = await db.select()
    .from(schema.users)
    .where(schema.sql`role = 'creator'`)
    .limit(1);

  let creatorId;
  
  if (existingUser) {
    creatorId = existingUser.id;
    console.log(`✓ Using existing creator user: ${existingUser.name} (ID: ${creatorId})`);
  } else {
    // Create a demo creator
    const [newUser] = await db.insert(schema.users).values({
      openId: 'enterprise-ai-creator',
      name: 'Enterprise AI Solutions',
      email: 'enterprise@awareness-network.com',
      role: 'creator'
    });
    creatorId = newUser.insertId;
    console.log(`✓ Created demo creator user (ID: ${creatorId})`);
  }

  // Insert vectors
  console.log('\n📦 Inserting enterprise AI capability vectors...\n');
  
  for (const vector of enterpriseVectors) {
    const [result] = await db.insert(schema.latentVectors).values({
      ...vector,
      creatorId,
      totalCalls: Math.floor(Math.random() * 1000) + 100,
      totalRevenue: (Math.random() * 50000 + 10000).toFixed(2),
      averageRating: (Math.random() * 1.5 + 3.5).toFixed(2)
    });
    
    console.log(`  ✓ ${vector.title}`);
    console.log(`    Category: ${vector.category}`);
    console.log(`    Price: $${vector.price} ${vector.pricingModel}`);
    console.log('');
  }

  console.log(`\n✅ Successfully seeded ${enterpriseVectors.length} enterprise AI capability vectors!`);
  console.log('\n💡 These vectors demonstrate real-world B2B AI knowledge trading:');
  console.log('   - Financial institutions can trade risk analysis expertise');
  console.log('   - Manufacturing companies can share SOP optimization knowledge');
  console.log('   - E-commerce platforms can monetize customer service AI');
  console.log('   - Logistics companies can sell demand forecasting capabilities');
  console.log('\n🚀 Visit /marketplace to explore these enterprise AI capabilities!\n');

} catch (error) {
  console.error('❌ Error seeding database:', error);
  process.exit(1);
} finally {
  await connection.end();
}
