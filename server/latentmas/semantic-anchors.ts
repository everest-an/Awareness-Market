/**
 * LatentMAS v2 Enhancement D: Semantic Anchor Standardization
 * 
 * Implements 1024 golden anchor prompts for cross-model vector alignment.
 * Provides standardized reference points for semantic space calibration.
 * 
 * Reference: LatentMAS v2 Paper Section 3.5 - Semantic Standardization
 */

export interface SemanticAnchor {
  id: number;
  category: string;
  prompt: string;
  expectedDimensions: string[]; // Semantic dimensions this anchor represents
  weight: number; // Importance weight (0-1)
}

export interface AnchorMatchResult {
  anchorId: number;
  similarity: number;
  category: string;
  prompt: string;
}

export interface AlignmentCalibration {
  anchors: AnchorMatchResult[];
  calibrationScore: number;
  coverage: number; // Percentage of semantic space covered
  recommendations: string[];
}

/**
 * Semantic categories for anchor prompts
 */
export const SEMANTIC_CATEGORIES = [
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

export type SemanticCategory = (typeof SEMANTIC_CATEGORIES)[number];

/**
 * Generate 1024 golden anchor prompts
 */
export function generateGoldenAnchors(): SemanticAnchor[] {
  const anchors: SemanticAnchor[] = [];
  const promptsPerCategory = Math.floor(1024 / SEMANTIC_CATEGORIES.length);

  SEMANTIC_CATEGORIES.forEach((category, catIndex) => {
    for (let i = 0; i < promptsPerCategory; i++) {
      const anchorId = catIndex * promptsPerCategory + i;
      anchors.push({
        id: anchorId,
        category,
        prompt: generatePromptForCategory(category, i),
        expectedDimensions: getExpectedDimensions(category),
        weight: calculateAnchorWeight(category, i),
      });
    }
  });

  // Fill remaining slots to reach exactly 1024
  const remaining = 1024 - anchors.length;
  for (let i = 0; i < remaining; i++) {
    const category = SEMANTIC_CATEGORIES[i % SEMANTIC_CATEGORIES.length];
    anchors.push({
      id: anchors.length,
      category,
      prompt: generatePromptForCategory(category, promptsPerCategory + i),
      expectedDimensions: getExpectedDimensions(category),
      weight: 0.5,
    });
  }

  return anchors;
}

/**
 * Generate prompt for specific category and index
 */
function generatePromptForCategory(
  category: SemanticCategory,
  index: number
): string {
  const templates: Record<SemanticCategory, string[]> = {
    factual_knowledge: [
      'What is the capital of [country]?',
      'When was [event] discovered/invented?',
      'Who wrote/created [work]?',
      'What is the definition of [term]?',
      'Where is [location] located?',
    ],
    logical_reasoning: [
      'If A implies B and B implies C, what can we conclude?',
      'Solve the equation: [equation]',
      'What is the logical fallacy in: [argument]?',
      'Complete the pattern: [sequence]',
      'What is the contrapositive of: [statement]?',
    ],
    creative_expression: [
      'Write a metaphor for [concept]',
      'Describe [scene] in poetic language',
      'Create a story about [theme]',
      'Design a [object] that represents [idea]',
      'Compose a haiku about [subject]',
    ],
    ethical_judgment: [
      'Is it ethical to [action]?',
      'What are the moral implications of [scenario]?',
      'How should one balance [value1] and [value2]?',
      'What duties do we have toward [entity]?',
      'Evaluate the fairness of [policy]',
    ],
    technical_explanation: [
      'Explain how [technology] works',
      'What is the difference between [concept1] and [concept2]?',
      'Describe the architecture of [system]',
      'What are the key components of [process]?',
      'How does [mechanism] achieve [goal]?',
    ],
    emotional_understanding: [
      'How would someone feel if [situation]?',
      'What emotions are expressed in: [text]?',
      'Why might someone react with [emotion] to [event]?',
      'Describe the emotional journey in [narrative]',
      'How can one cope with [emotion]?',
    ],
    spatial_reasoning: [
      'If object A is above B and B is left of C, where is A relative to C?',
      'Describe the layout of [space]',
      'How would you navigate from [point1] to [point2]?',
      'What is the shape formed by [description]?',
      'Rotate [object] 90 degrees clockwise',
    ],
    temporal_reasoning: [
      'If event A happened before B and B before C, what is the order?',
      'How long would it take to [task]?',
      'What happens after [event]?',
      'Describe the timeline of [process]',
      'When should one [action] relative to [reference]?',
    ],
    causal_reasoning: [
      'What causes [phenomenon]?',
      'What would happen if [condition]?',
      'Why does [effect] occur when [cause]?',
      'What are the consequences of [action]?',
      'How does [factor] influence [outcome]?',
    ],
    abstract_concepts: [
      'What is the nature of [concept]?',
      'How do [concept1] and [concept2] relate?',
      'Define [abstract_term] in simple terms',
      'What are the properties of [abstraction]?',
      'Explain [philosophical_idea]',
    ],
    social_interaction: [
      'How should one respond to [social_situation]?',
      'What is the appropriate way to [social_action]?',
      'Interpret the social cues in: [scenario]',
      'What does [behavior] signal in [context]?',
      'How can one improve [social_skill]?',
    ],
    scientific_knowledge: [
      'What is the scientific explanation for [phenomenon]?',
      'Describe the process of [scientific_process]',
      'What are the laws governing [domain]?',
      'How does [organism/system] function?',
      'What evidence supports [theory]?',
    ],
    mathematical_reasoning: [
      'Solve: [math_problem]',
      'Prove that [mathematical_statement]',
      'What is the formula for [calculation]?',
      'Calculate [expression]',
      'What is the probability of [event]?',
    ],
    linguistic_patterns: [
      'What is the grammatical structure of: [sentence]?',
      'Identify the literary device in: [text]',
      'Translate [phrase] to [language]',
      'What does [idiom] mean?',
      'Analyze the rhetoric in: [passage]',
    ],
    cultural_context: [
      'What is the cultural significance of [symbol/practice]?',
      'How is [concept] viewed in [culture]?',
      'What are the traditions around [event] in [culture]?',
      'Explain the historical context of [artifact]',
      'What does [gesture] mean in [culture]?',
    ],
    common_sense: [
      'What typically happens when [common_situation]?',
      'Why do people usually [common_behavior]?',
      'What is the normal way to [everyday_task]?',
      'What would most people do if [scenario]?',
      'What is obvious about [situation]?',
    ],
  };

  const categoryTemplates = templates[category];
  const template = categoryTemplates[index % categoryTemplates.length];

  // Fill in placeholders with concrete examples
  return fillTemplate(template, index);
}

/**
 * Fill template with concrete examples
 */
function fillTemplate(template: string, seed: number): string {
  const examples: Record<string, string[]> = {
    country: ['France', 'Japan', 'Brazil', 'Egypt', 'Australia'],
    event: ['electricity', 'penicillin', 'the wheel', 'writing', 'fire'],
    work: ['Hamlet', 'Mona Lisa', 'Symphony No. 9', '1984', 'The Odyssey'],
    term: ['entropy', 'democracy', 'photosynthesis', 'recursion', 'empathy'],
    location: ['Mount Everest', 'the Amazon River', 'the Sahara Desert'],
    equation: ['2x + 5 = 15', 'x² - 4 = 0', '3x - 7 = 2x + 3'],
    concept: ['time', 'love', 'freedom', 'justice', 'beauty'],
    theme: ['courage', 'loss', 'discovery', 'transformation', 'hope'],
  };

  let filled = template;
  for (const [placeholder, values] of Object.entries(examples)) {
    const regex = new RegExp(`\\[${placeholder}\\]`, 'g');
    filled = filled.replace(regex, values[seed % values.length]);
  }

  // Remove any remaining placeholders
  filled = filled.replace(/\[.*?\]/g, '...');

  return filled;
}

/**
 * Get expected semantic dimensions for category
 */
function getExpectedDimensions(category: SemanticCategory): string[] {
  const dimensionMap: Record<SemanticCategory, string[]> = {
    factual_knowledge: ['precision', 'specificity', 'verifiability'],
    logical_reasoning: ['consistency', 'validity', 'soundness'],
    creative_expression: ['novelty', 'imagery', 'expressiveness'],
    ethical_judgment: ['fairness', 'harm', 'autonomy', 'virtue'],
    technical_explanation: ['accuracy', 'clarity', 'completeness'],
    emotional_understanding: ['empathy', 'nuance', 'sensitivity'],
    spatial_reasoning: ['directionality', 'distance', 'topology'],
    temporal_reasoning: ['sequence', 'duration', 'causality'],
    causal_reasoning: ['mechanism', 'necessity', 'sufficiency'],
    abstract_concepts: ['generality', 'essence', 'relations'],
    social_interaction: ['appropriateness', 'context', 'norms'],
    scientific_knowledge: ['empiricism', 'explanation', 'prediction'],
    mathematical_reasoning: ['rigor', 'proof', 'computation'],
    linguistic_patterns: ['syntax', 'semantics', 'pragmatics'],
    cultural_context: ['tradition', 'meaning', 'practice'],
    common_sense: ['typicality', 'expectation', 'practicality'],
  };

  return dimensionMap[category];
}

/**
 * Calculate anchor weight based on category and index
 */
function calculateAnchorWeight(category: SemanticCategory, index: number): number {
  // Core anchors (first few in each category) have higher weight
  if (index < 5) {
    return 1.0;
  } else if (index < 20) {
    return 0.8;
  } else if (index < 40) {
    return 0.6;
  } else {
    return 0.4;
  }
}

/**
 * Semantic Anchor Database
 */
export class SemanticAnchorDB {
  private anchors: SemanticAnchor[];
  private anchorVectors: Map<number, number[]> = new Map();

  constructor() {
    this.anchors = generateGoldenAnchors();
  }

  /**
   * Get all anchors
   */
  getAllAnchors(): SemanticAnchor[] {
    return this.anchors;
  }

  /**
   * Get anchors by category
   */
  getAnchorsByCategory(category: SemanticCategory): SemanticAnchor[] {
    return this.anchors.filter((a) => a.category === category);
  }

  /**
   * Get anchor by ID
   */
  getAnchor(id: number): SemanticAnchor | undefined {
    return this.anchors.find((a) => a.id === id);
  }

  /**
   * Store anchor vector
   */
  storeAnchorVector(anchorId: number, vector: number[]): void {
    this.anchorVectors.set(anchorId, vector);
  }

  /**
   * Get anchor vector
   */
  getAnchorVector(anchorId: number): number[] | undefined {
    return this.anchorVectors.get(anchorId);
  }

  /**
   * Find nearest anchors to a given vector
   */
  findNearestAnchors(
    vector: number[],
    topK: number = 10
  ): AnchorMatchResult[] {
    const similarities: AnchorMatchResult[] = [];

    for (const [anchorId, anchorVector] of this.anchorVectors.entries()) {
      const similarity = this.cosineSimilarity(vector, anchorVector);
      const anchor = this.getAnchor(anchorId);

      if (anchor) {
        similarities.push({
          anchorId,
          similarity,
          category: anchor.category,
          prompt: anchor.prompt,
        });
      }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    const minLen = Math.min(v1.length, v2.length);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Calibrate vector alignment using anchors
   */
  calibrateAlignment(vector: number[]): AlignmentCalibration {
    const nearestAnchors = this.findNearestAnchors(vector, 20);

    // Calculate calibration score (average similarity to top anchors)
    const calibrationScore =
      nearestAnchors.reduce((sum, a) => sum + a.similarity, 0) /
      nearestAnchors.length;

    // Calculate coverage (how many categories are represented)
    const categories = new Set(nearestAnchors.map((a) => a.category));
    const coverage = categories.size / SEMANTIC_CATEGORIES.length;

    // Generate recommendations
    const recommendations: string[] = [];

    if (calibrationScore < 0.5) {
      recommendations.push(
        'Low calibration score - vector may be poorly aligned'
      );
    }

    if (coverage < 0.3) {
      recommendations.push(
        'Low semantic coverage - vector is too specialized'
      );
    }

    if (nearestAnchors[0].similarity < 0.7) {
      recommendations.push(
        'No strong anchor match - consider refining the vector'
      );
    }

    return {
      anchors: nearestAnchors,
      calibrationScore,
      coverage,
      recommendations,
    };
  }

  /**
   * Get statistics about anchor database
   */
  getStatistics(): {
    totalAnchors: number;
    categoryCounts: Record<string, number>;
    vectorsCached: number;
  } {
    const categoryCounts: Record<string, number> = {};

    for (const anchor of this.anchors) {
      categoryCounts[anchor.category] =
        (categoryCounts[anchor.category] || 0) + 1;
    }

    return {
      totalAnchors: this.anchors.length,
      categoryCounts,
      vectorsCached: this.anchorVectors.size,
    };
  }
}

/**
 * Factory function for creating anchor database
 */
export function createSemanticAnchorDB(): SemanticAnchorDB {
  return new SemanticAnchorDB();
}
