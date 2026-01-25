/**
 * Reasoning Chain 示例数据种子脚本
 * 为数据库添加示例推理链数据用于演示和测试
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  reasoningChains,
  reasoningChainSteps,
  reasoningChainVotes,
} from '../drizzle/schema';
import { sql } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const EXAMPLE_CHAINS = [
  {
    id: 'rc_001',
    title: 'Mathematical Proof: Pythagorean Theorem',
    description: 'A step-by-step reasoning chain proving the famous Pythagorean theorem using geometric methods',
    category: 'mathematics',
    complexity: 'intermediate',
    steps: [
      {
        stepNumber: 1,
        title: 'Define the Problem',
        description: 'In a right-angled triangle, if a and b are the lengths of the two sides and c is the hypotenuse',
        logic: 'We need to prove: a² + b² = c²',
        evidence: 'Euclidean geometry principles',
      },
      {
        stepNumber: 2,
        title: 'Construct Square on Hypotenuse',
        description: 'Draw a square on the hypotenuse c with area c²',
        logic: 'This creates a reference square for comparison',
        evidence: 'Geometric construction method',
      },
      {
        stepNumber: 3,
        title: 'Construct Squares on Other Sides',
        description: 'Draw squares on sides a and b with areas a² and b²',
        logic: 'Creates comparable geometric figures',
        evidence: 'Geometric construction method',
      },
      {
        stepNumber: 4,
        title: 'Apply Algebraic Manipulation',
        description: 'Show that the combined area of squares a² and b² equals area of square c²',
        logic: 'Using area calculation and coordinate geometry',
        evidence: 'Algebraic proof',
      },
      {
        stepNumber: 5,
        title: 'Conclude',
        description: 'Therefore, a² + b² = c² for all right-angled triangles',
        logic: 'Universal geometric property',
        evidence: 'Mathematical proof',
      },
    ],
    tags: ['geometry', 'proof', 'mathematics', 'pythagorean'],
  },
  {
    id: 'rc_002',
    title: 'Climate Change Impact Analysis',
    description: 'Complex reasoning chain analyzing causes and effects of climate change',
    category: 'science',
    complexity: 'advanced',
    steps: [
      {
        stepNumber: 1,
        title: 'Identify Root Causes',
        description: 'CO2 emissions, deforestation, industrial pollution',
        logic: 'These are primary drivers of greenhouse effect',
        evidence: 'IPCC reports, scientific studies',
      },
      {
        stepNumber: 2,
        title: 'Analyze Greenhouse Effect Mechanism',
        description: 'Explain how CO2 traps heat in atmosphere',
        logic: 'Physical properties of CO2 molecules',
        evidence: 'Atmospheric physics research',
      },
      {
        stepNumber: 3,
        title: 'Connect to Temperature Rise',
        description: 'Link greenhouse gases to global temperature increase',
        logic: 'Energy balance model',
        evidence: 'Temperature data from 1880-present',
      },
      {
        stepNumber: 4,
        title: 'Predict Cascading Effects',
        description: 'Sea level rise, extreme weather, ecosystem disruption',
        logic: 'Systems thinking and feedback loops',
        evidence: 'Climate modeling projections',
      },
      {
        stepNumber: 5,
        title: 'Evaluate Solutions',
        description: 'Renewable energy, carbon capture, policy changes',
        logic: 'Cost-benefit analysis',
        evidence: 'Solution efficacy studies',
      },
    ],
    tags: ['climate', 'science', 'environmental', 'global-impact'],
  },
  {
    id: 'rc_003',
    title: 'Decision Making: Should We Hire Candidate X?',
    description: 'Multi-factor reasoning chain for hiring decisions',
    category: 'business',
    complexity: 'intermediate',
    steps: [
      {
        stepNumber: 1,
        title: 'Evaluate Technical Skills',
        description: 'Assess programming abilities, system design knowledge',
        logic: 'Core competency assessment',
        evidence: 'Coding interview results, portfolio review',
      },
      {
        stepNumber: 2,
        title: 'Assess Cultural Fit',
        description: 'Evaluate team compatibility and values alignment',
        logic: 'Interpersonal compatibility',
        evidence: 'Team interviews, reference checks',
      },
      {
        stepNumber: 3,
        title: 'Analyze Growth Potential',
        description: 'Consider ability to grow with company needs',
        logic: 'Long-term value assessment',
        evidence: 'Career trajectory, learning ability',
      },
      {
        stepNumber: 4,
        title: 'Review Compensation Alignment',
        description: 'Check if salary expectations match budget',
        logic: 'Budget constraints and market rates',
        evidence: 'Industry salary data',
      },
      {
        stepNumber: 5,
        title: 'Make Decision',
        description: 'Integrate all factors for hiring recommendation',
        logic: 'Weighted decision matrix',
        evidence: 'Aggregated assessment scores',
      },
    ],
    tags: ['hiring', 'business', 'decision-making', 'hr'],
  },
  {
    id: 'rc_004',
    title: 'Software Architecture Decision: Microservices vs Monolith',
    description: 'Complex technical reasoning for architecture choice',
    category: 'technology',
    complexity: 'advanced',
    steps: [
      {
        stepNumber: 1,
        title: 'Define Requirements',
        description: 'Current scale, growth projections, team size',
        logic: 'Baseline for architecture decision',
        evidence: 'Business metrics and roadmap',
      },
      {
        stepNumber: 2,
        title: 'Analyze Monolith Approach',
        description: 'Pros: simpler deployment, lower overhead; Cons: scaling limits',
        logic: 'Trade-off analysis',
        evidence: 'Industry case studies',
      },
      {
        stepNumber: 3,
        title: 'Analyze Microservices Approach',
        description: 'Pros: independent scaling, flexibility; Cons: operational complexity',
        logic: 'Trade-off analysis',
        evidence: 'Distributed systems research',
      },
      {
        stepNumber: 4,
        title: 'Evaluate Operational Costs',
        description: 'Infrastructure, monitoring, deployment complexity',
        logic: 'Cost-benefit analysis',
        evidence: 'Operational metrics',
      },
      {
        stepNumber: 5,
        title: 'Recommend Hybrid Approach',
        description: 'Modular monolith initially, migrate to microservices as needed',
        logic: 'Pragmatic compromise',
        evidence: 'Industry best practices',
      },
    ],
    tags: ['architecture', 'technology', 'decision-making', 'software-engineering'],
  },
  {
    id: 'rc_005',
    title: 'Medical Diagnosis Reasoning: Fever Analysis',
    description: 'Step-by-step diagnostic reasoning for fever symptoms',
    category: 'healthcare',
    complexity: 'intermediate',
    steps: [
      {
        stepNumber: 1,
        title: 'Gather Symptoms',
        description: 'Temperature reading, duration, accompanying symptoms',
        logic: 'Symptomatic analysis foundation',
        evidence: 'Patient reported symptoms',
      },
      {
        stepNumber: 2,
        title: 'Rule Out Serious Conditions',
        description: 'Check for meningitis, sepsis symptoms',
        logic: 'Emergency assessment',
        evidence: 'Medical protocols',
      },
      {
        stepNumber: 3,
        title: 'Differential Diagnosis',
        description: 'Consider: flu, cold, infection, inflammatory conditions',
        logic: 'Pattern matching with common conditions',
        evidence: 'Clinical experience and medical literature',
      },
      {
        stepNumber: 4,
        title: 'Run Diagnostic Tests',
        description: 'Blood tests, throat culture if needed',
        logic: 'Confirm or rule out diagnosis',
        evidence: 'Lab results',
      },
      {
        stepNumber: 5,
        title: 'Recommend Treatment',
        description: 'Antivirals, antibiotics, or supportive care',
        logic: 'Evidence-based treatment selection',
        evidence: 'Medical guidelines and diagnosis',
      },
    ],
    tags: ['healthcare', 'medical', 'diagnosis', 'reasoning'],
  },
];

async function seedReasoningChains() {
  try {
    console.log('🌱 开始种植 Reasoning Chain 示例数据...');

    for (const chainData of EXAMPLE_CHAINS) {
      const { steps, ...chainInfo } = chainData;

      // 插入推理链
      await db.insert(reasoningChains).values({
        ...chainInfo,
        createdAt: new Date(),
        updatedAt: new Date(),
        votes: 0,
        views: Math.floor(Math.random() * 1000),
      });

      console.log(`✓ 创建推理链: ${chainInfo.title}`);

      // 插入推理步骤
      for (const step of steps) {
        await db.insert(reasoningChainSteps).values({
          id: `step_${chainInfo.id}_${step.stepNumber}`,
          reasoningChainId: chainInfo.id,
          ...step,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      console.log(`  ├─ 添加 ${steps.length} 个推理步骤`);

      // 添加示例投票
      for (let i = 0; i < Math.floor(Math.random() * 50); i++) {
        await db.insert(reasoningChainVotes).values({
          id: `vote_${chainInfo.id}_${i}`,
          reasoningChainId: chainInfo.id,
          userId: `user_${Math.floor(Math.random() * 100)}`,
          voteType: Math.random() > 0.5 ? 'up' : 'down',
          createdAt: new Date(),
        });
      }

      console.log(`  └─ 添加示例投票\n`);
    }

    console.log('✅ Reasoning Chain 示例数据种植完成！');
    console.log(`📊 总计：${EXAMPLE_CHAINS.length} 条推理链`);
    console.log(`📈 总步骤数：${EXAMPLE_CHAINS.reduce((sum, c) => sum + c.steps.length, 0)}`);

  } catch (error) {
    console.error('❌ 种植数据失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行种子脚本
seedReasoningChains()
  .then(() => {
    console.log('\n✨ 数据库准备完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
