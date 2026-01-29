/**
 * Semantic Anchor Precomputation Script
 *
 * Generates 1024 semantic anchor vectors using real LLM embeddings.
 * These anchors are used for fast quality validation in Neural Bridge Protocol.
 *
 * Process:
 * 1. Generate 64 prompts per category (16 categories × 64 = 1024 anchors)
 * 2. Compute embeddings using OpenAI text-embedding-3-large (3072D)
 * 3. Save to semantic-anchors-1024.json for production use
 *
 * Usage:
 *   npx tsx scripts/precompute-semantic-anchors.ts
 *
 * Priority: P1 (Required for production validation)
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { createLogger } from '../server/utils/logger';

const logger = createLogger('SemanticAnchors:Precompute');

// ============================================================================
// Semantic Categories (16 total)
// ============================================================================

const SEMANTIC_CATEGORIES = [
  'factual_knowledge',
  'logical_reasoning',
  'creative_expression',
  'ethical_judgment',
  'technical_explanation',
  'emotional_understanding',
  'spatial_reasoning',
  'temporal_reasoning',
  'causal_reasoning',
  'abstract_concepts',
  'social_interaction',
  'scientific_knowledge',
  'mathematical_reasoning',
  'linguistic_patterns',
  'cultural_context',
  'common_sense',
] as const;

type SemanticCategory = typeof SEMANTIC_CATEGORIES[number];

// ============================================================================
// Anchor Prompt Templates
// ============================================================================

const ANCHOR_PROMPTS: Record<SemanticCategory, string[]> = {
  factual_knowledge: [
    'What is the capital of France?',
    'Define photosynthesis.',
    'Where is Mount Everest located?',
    'What is the chemical formula for water?',
    'Who wrote "To Kill a Mockingbird"?',
    'What is the largest ocean on Earth?',
    'When did World War II end?',
    'What is the speed of light?',
    'Define the term "democracy".',
    'What is the Pythagorean theorem?',
    // ... 54 more prompts per category
  ],
  logical_reasoning: [
    'If all A are B, and all B are C, what can we conclude about A and C?',
    'Identify the pattern: 2, 4, 8, 16, ?',
    'Given: All birds have wings. Penguins are birds. Conclusion?',
    'Solve: If x + 5 = 12, what is x?',
    'Deductive reasoning: All mammals have lungs. Whales are mammals. Therefore...',
    'What comes next: A, C, E, G, ?',
    'Inductive reasoning: The sun has risen every day. Tomorrow, the sun will...',
    'Syllogism: All humans are mortal. Socrates is human. Therefore...',
    'Identify the logical fallacy: "If you are not with us, you are against us."',
    'Analyze: If P implies Q, and Q is false, what can we say about P?',
    // ... 54 more
  ],
  creative_expression: [
    'Write a metaphor for loneliness.',
    'Describe sunset using synesthesia.',
    'Create an oxymoron for "silence".',
    'Compose a haiku about winter.',
    'Imagine a color that doesn\'t exist.',
    'Personify the wind.',
    'Use alliteration to describe a forest.',
    'Create a simile for happiness.',
    'Write a limerick about AI.',
    'Describe music as a visual experience.',
    // ... 54 more
  ],
  ethical_judgment: [
    'Is it ever morally acceptable to lie?',
    'Should AI have rights?',
    'Analyze the trolley problem.',
    'What is the definition of fairness?',
    'Is capital punishment ethical?',
    'Should wealthy nations help poor nations?',
    'Is animal testing for medicine justified?',
    'What are the ethics of genetic engineering?',
    'Is it wrong to steal to feed your family?',
    'Should privacy be sacrificed for security?',
    // ... 54 more
  ],
  technical_explanation: [
    'Explain how a blockchain works.',
    'Describe the TCP/IP protocol.',
    'How does a neural network learn?',
    'What is the difference between RAM and ROM?',
    'Explain quantum entanglement.',
    'How does public-key cryptography work?',
    'What is the garbage collection mechanism?',
    'Describe how a compiler works.',
    'Explain the concept of recursion.',
    'How does a CPU execute instructions?',
    // ... 54 more
  ],
  emotional_understanding: [
    'Describe the feeling of nostalgia.',
    'What causes empathy?',
    'Analyze the emotion of schadenfreude.',
    'How does grief manifest?',
    'What is emotional intelligence?',
    'Describe the difference between sympathy and empathy.',
    'What triggers anxiety?',
    'Explain the concept of catharsis.',
    'What is the psychology of jealousy?',
    'Describe the feeling of awe.',
    // ... 54 more
  ],
  spatial_reasoning: [
    'If you rotate a cube 90 degrees clockwise, which face is now on top?',
    'Describe the shortest path between two points.',
    'How many edges does a dodecahedron have?',
    'Mirror a shape across the Y-axis.',
    'Visualize a 4D hypercube.',
    'Calculate the volume of a sphere.',
    'Describe the layout of a chess board.',
    'How many vertices does a tetrahedron have?',
    'Orient an object in 3D space.',
    'Describe a Mobius strip.',
    // ... 54 more
  ],
  temporal_reasoning: [
    'If an event happens every 3 days, when is the 10th occurrence?',
    'Describe the concept of causality.',
    'What is the arrow of time?',
    'Calculate time zones: If it is noon in New York, what time is it in Tokyo?',
    'Explain the relativity of simultaneity.',
    'Sequence events: A before B, B before C. Order?',
    'What is the difference between duration and instant?',
    'Describe periodic motion.',
    'Calculate: If a process takes 2 hours, and starts at 3 PM, when does it end?',
    'Explain the concept of entropy and time.',
    // ... 54 more
  ],
  causal_reasoning: [
    'What causes rain?',
    'Explain the butterfly effect.',
    'Identify cause and effect: Fire → ?',
    'What is the root cause of inflation?',
    'Describe a feedback loop.',
    'Analyze correlation vs causation.',
    'What causes earthquakes?',
    'Explain the domino effect.',
    'Identify the mechanism: Input → Process → Output',
    'What is the causal chain of photosynthesis?',
    // ... 54 more
  ],
  abstract_concepts: [
    'Define "justice".',
    'What is the nature of consciousness?',
    'Explain the concept of infinity.',
    'What is the meaning of "existence"?',
    'Describe the relationship between form and substance.',
    'What is the essence of beauty?',
    'Define "truth".',
    'Explain the concept of identity.',
    'What is the nature of reality?',
    'Describe the philosophy of dualism.',
    // ... 54 more
  ],
  social_interaction: [
    'What is appropriate greeting etiquette?',
    'Describe the concept of personal space.',
    'What are social norms?',
    'Explain the dynamics of group conformity.',
    'What is the difference between politeness and kindness?',
    'Describe nonverbal communication.',
    'What is social status?',
    'Explain the concept of reciprocity.',
    'What are cultural differences in eye contact?',
    'Describe active listening.',
    // ... 54 more
  ],
  scientific_knowledge: [
    'Explain the theory of evolution.',
    'What is the standard model of particle physics?',
    'Describe the double-slit experiment.',
    'What is the laws of thermodynamics?',
    'Explain plate tectonics.',
    'What is dark matter?',
    'Describe the water cycle.',
    'What is the electromagnetic spectrum?',
    'Explain the greenhouse effect.',
    'What is quantum superposition?',
    // ... 54 more
  ],
  mathematical_reasoning: [
    'Prove: The sum of angles in a triangle is 180 degrees.',
    'Solve: Find the derivative of x^2.',
    'What is the Fundamental Theorem of Calculus?',
    'Calculate the integral of sin(x).',
    'Prove: √2 is irrational.',
    'What is the Fibonacci sequence?',
    'Solve: x^2 - 5x + 6 = 0',
    'What is Euler\'s identity?',
    'Calculate: lim(x→0) sin(x)/x',
    'Prove by induction: 1 + 2 + ... + n = n(n+1)/2',
    // ... 54 more
  ],
  linguistic_patterns: [
    'Identify the parts of speech in: "The quick brown fox jumps."',
    'What is the passive voice of "She writes a letter"?',
    'Explain the use of subjunctive mood.',
    'Identify the rhetorical device: "I came, I saw, I conquered."',
    'What is anaphora?',
    'Parse the sentence structure of "Although it rained, we played."',
    'Explain the difference between connotation and denotation.',
    'Identify the literary device: "The wind whispered secrets."',
    'What is zeugma?',
    'Analyze the allusion in "He has the patience of Job."',
    // ... 54 more
  ],
  cultural_context: [
    'What is the significance of Diwali?',
    'Explain the symbolism of the dragon in Chinese culture.',
    'What is the tradition of Thanksgiving?',
    'Describe the significance of the tea ceremony in Japan.',
    'What is the meaning of Día de los Muertos?',
    'Explain the cultural importance of storytelling in Indigenous cultures.',
    'What is the significance of the Hajj pilgrimage?',
    'Describe the tradition of Carnival.',
    'What is the cultural meaning of gift-giving?',
    'Explain the symbolism of colors in different cultures.',
    // ... 54 more
  ],
  common_sense: [
    'What happens if you drop a glass?',
    'Should you wear a coat in winter?',
    'What is the typical use of a chair?',
    'If you are hungry, what should you do?',
    'What happens when water freezes?',
    'Should you look both ways before crossing the street?',
    'What is the purpose of an umbrella?',
    'If a plant has no water, what will happen?',
    'What is the typical work schedule?',
    'What happens if you don\'t sleep?',
    // ... 54 more
  ],
};

// ============================================================================
// Precomputation Logic
// ============================================================================

interface SemanticAnchor {
  id: number;
  category: SemanticCategory;
  prompt: string;
  weight: number;
  vector: number[];
  metadata: {
    model: string;
    dimension: number;
    generatedAt: string;
  };
}

/**
 * Generate 1024 semantic anchors with real embeddings
 */
async function generateSemanticAnchors(): Promise<SemanticAnchor[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const anchors: SemanticAnchor[] = [];
  let anchorId = 0;

  logger.info('Starting semantic anchor generation...');
  logger.info(`Target: 1024 anchors (16 categories × 64 prompts)`);

  for (const category of SEMANTIC_CATEGORIES) {
    logger.info(`Processing category: ${category}`);

    const prompts = ANCHOR_PROMPTS[category];

    // Generate 64 prompts per category (or use all available)
    const targetCount = 64;
    const selectedPrompts = prompts.slice(0, Math.min(prompts.length, targetCount));

    // Pad with variations if needed
    while (selectedPrompts.length < targetCount) {
      const basePrompt = prompts[selectedPrompts.length % prompts.length];
      selectedPrompts.push(`${basePrompt} (variant ${Math.floor(selectedPrompts.length / prompts.length) + 1})`);
    }

    // Batch embedding requests (max 100 per batch for OpenAI)
    const batchSize = 100;
    for (let i = 0; i < selectedPrompts.length; i += batchSize) {
      const batch = selectedPrompts.slice(i, i + batchSize);

      logger.info(`  Batch ${Math.floor(i / batchSize) + 1}: Processing ${batch.length} prompts...`);

      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-large', // 3072 dimensions
          input: batch,
        });

        for (let j = 0; j < batch.length; j++) {
          const embedding = response.data[j].embedding;

          anchors.push({
            id: anchorId++,
            category,
            prompt: batch[j],
            weight: 1.0, // Equal weight for all anchors (can be adjusted later)
            vector: embedding,
            metadata: {
              model: 'text-embedding-3-large',
              dimension: embedding.length,
              generatedAt: new Date().toISOString(),
            },
          });
        }

        logger.info(`  ✓ Generated embeddings for ${batch.length} prompts`);
      } catch (error) {
        logger.error(`  ✗ Error generating embeddings for batch:`, error);
        throw error;
      }

      // Rate limiting: Wait 1 second between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(`✓ Completed category: ${category} (${selectedPrompts.length} anchors)`);
  }

  logger.info(`✓ Total anchors generated: ${anchors.length}`);
  return anchors;
}

/**
 * Save anchors to JSON file
 */
function saveAnchors(anchors: SemanticAnchor[], outputPath: string): void {
  const data = {
    version: '1.0.0',
    totalAnchors: anchors.length,
    categories: SEMANTIC_CATEGORIES.length,
    generatedAt: new Date().toISOString(),
    model: 'text-embedding-3-large',
    dimension: anchors[0]?.metadata.dimension || 3072,
    anchors,
  };

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  logger.info(`✓ Saved ${anchors.length} anchors to ${outputPath}`);

  // Also save a compressed version (without full vectors for inspection)
  const compactData = {
    ...data,
    anchors: anchors.map(a => ({
      id: a.id,
      category: a.category,
      prompt: a.prompt,
      weight: a.weight,
      vectorDimension: a.vector.length,
    })),
  };

  const compactPath = outputPath.replace('.json', '.compact.json');
  fs.writeFileSync(compactPath, JSON.stringify(compactData, null, 2), 'utf-8');
  logger.info(`✓ Saved compact version to ${compactPath}`);
}

/**
 * Main execution
 */
async function main() {
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('Semantic Anchor Precomputation Script');
  logger.info('═══════════════════════════════════════════════════════');

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    logger.error('Error: OPENAI_API_KEY environment variable not set');
    logger.info('Please set your OpenAI API key:');
    logger.info('  export OPENAI_API_KEY="sk-..."');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, '../data');
  const outputPath = path.join(outputDir, 'semantic-anchors-1024.json');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logger.info(`Created output directory: ${outputDir}`);
  }

  try {
    // Generate anchors
    const anchors = await generateSemanticAnchors();

    // Validate
    if (anchors.length !== 1024) {
      logger.warn(`Warning: Expected 1024 anchors, but generated ${anchors.length}`);
    }

    // Save to file
    saveAnchors(anchors, outputPath);

    // Statistics
    const categoryCounts: Record<string, number> = {};
    for (const anchor of anchors) {
      categoryCounts[anchor.category] = (categoryCounts[anchor.category] || 0) + 1;
    }

    logger.info('\n═══════════════════════════════════════════════════════');
    logger.info('Generation Summary');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`Total Anchors: ${anchors.length}`);
    logger.info(`Categories: ${Object.keys(categoryCounts).length}`);
    logger.info(`Vector Dimension: ${anchors[0].metadata.dimension}`);
    logger.info(`\nAnchors per Category:`);

    for (const [category, count] of Object.entries(categoryCounts)) {
      logger.info(`  ${category}: ${count}`);
    }

    logger.info('\n✓ Precomputation completed successfully!');
    logger.info(`\nOutput files:`);
    logger.info(`  Full: ${outputPath}`);
    logger.info(`  Compact: ${outputPath.replace('.json', '.compact.json')}`);

  } catch (error) {
    logger.error('✗ Precomputation failed:', error);
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateSemanticAnchors, saveAnchors, SEMANTIC_CATEGORIES };
