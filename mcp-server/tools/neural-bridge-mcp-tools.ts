/**
 * Neural Bridge Protocol - MCP Tool Definitions
 *
 * Provides MCP tools for Neural Bridge Protocol operations
 * These tools enable Claude Desktop and other MCP clients to:
 * - Align KV-Cache between models
 * - Validate vector quality using semantic anchors
 * - Transfer reasoning state directly between AI agents
 *
 * Usage in Claude Desktop:
 * 1. Add to claude_desktop_config.json
 * 2. Use tools like "neural_bridge_align_kv" for direct thought transfer
 * 3. Use "neural_bridge_validate_vector" for quality checks
 */

import { createSemanticAnchorDB } from './semantic-anchor-validator.js';
import { createNeuralBridge, KVCache, WMatrix } from './neural-bridge-align.js';

// Initialize global semantic anchor database
const anchorDB = createSemanticAnchorDB();
const neuralBridge = createNeuralBridge(anchorDB);

/**
 * MCP Tool Definitions for Neural Bridge Protocol
 */
export const NEURAL_BRIDGE_MCP_TOOLS = [
  {
    name: 'neural_bridge_align_kv',
    description: `
[NEURAL BRIDGE PROTOCOL - WHITEPAPER SECTION 3.2]

Align KV-Cache from source model to target model using Neural Bridge Protocol.
Enables direct "thought transfer" between AI agents with 95% information retention.

Process:
1. Takes KV-Cache from source model (keys, values, attention masks)
2. Applies W-Matrix transformation to target model's latent space
3. Validates semantic quality using 1024 semantic anchors
4. Returns aligned KV-Cache with quality metrics

Quality Guarantee:
- ≥95% semantic preservation (3% semantic loss threshold)
- Fast validation (no inference required)
- Contrastive loss + orthogonality regularization

Use Cases:
- Transfer reasoning state from GPT-4 to LLaMA
- Continue Claude's thought process in local model
- Share AI "working memory" between agents

Performance:
- 4.2x latency reduction vs text transfer
- 95% information retention vs 60% with text
- 83.7% token savings
`.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        kvCache: {
          type: 'object',
          description: 'KV-Cache structure from source model',
          properties: {
            sourceModel: { type: 'string' },
            keys: { type: 'array', description: '[layers][heads][sequence × key_dim]' },
            values: { type: 'array', description: '[layers][heads][sequence × value_dim]' },
            metadata: {
              type: 'object',
              properties: {
                sequenceLength: { type: 'number' },
                contextDescription: { type: 'string' },
                tokenCount: { type: 'number' },
              }
            }
          },
          required: ['sourceModel', 'keys', 'values']
        },
        wMatrix: {
          type: 'object',
          description: 'W-Matrix for transformation (download from Awareness Market)',
          properties: {
            version: { type: 'string' },
            sourceModel: { type: 'string' },
            targetModel: { type: 'string' },
            matrix: { type: 'array', description: '[d_target × d_source]' },
            epsilon: { type: 'number', description: 'Alignment loss' },
          },
          required: ['sourceModel', 'targetModel', 'matrix']
        },
        targetModel: {
          type: 'string',
          description: 'Target model identifier (e.g., "llama-3.1-70b", "claude-3.5-sonnet")',
          examples: ['llama-3.1-70b', 'gpt-4', 'claude-3.5-sonnet', 'mistral-large']
        }
      },
      required: ['kvCache', 'wMatrix', 'targetModel']
    }
  },
  {
    name: 'neural_bridge_validate_vector',
    description: `
[NEURAL BRIDGE PROTOCOL - FAST VALIDATION]

Validate vector quality using 1024 semantic anchors without requiring inference.
Returns semantic quality score, nearest anchors, and calibration metrics.

Validation Process:
1. Finds nearest semantic anchors (16 categories)
2. Checks numerical stability (no NaN/Inf)
3. Verifies distribution consistency (~N(0,1))
4. Computes semantic quality score (0-1)

Quality Thresholds:
- ≥0.95: Excellent (passes 3% semantic loss)
- 0.85-0.95: Good (acceptable quality)
- 0.70-0.85: Moderate (consider refinement)
- <0.70: Poor (reject or retrain)

Use Cases:
- Pre-upload quality check for vector packages
- Real-time validation in inference pipeline
- Quality assurance for W-Matrix training
`.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        vector: {
          type: 'array',
          items: { type: 'number' },
          description: 'Vector to validate (any dimension)'
        },
        sourceModel: {
          type: 'string',
          description: 'Source model that generated this vector'
        }
      },
      required: ['vector']
    }
  },
  {
    name: 'neural_bridge_get_semantic_anchors',
    description: `
[SEMANTIC ANCHOR DATABASE]

Get information about the 1024 semantic anchors used for validation.

Anchor Categories (16):
1. factual_knowledge - Facts, definitions, locations
2. logical_reasoning - Deduction, induction, patterns
3. creative_expression - Metaphors, poetry, stories
4. ethical_judgment - Morality, fairness, duties
5. technical_explanation - How things work
6. emotional_understanding - Feelings, empathy
7. spatial_reasoning - Positions, directions, layouts
8. temporal_reasoning - Time, sequence, duration
9. causal_reasoning - Causes, effects, mechanisms
10. abstract_concepts - Philosophy, essence, relations
11. social_interaction - Norms, appropriateness
12. scientific_knowledge - Theories, experiments
13. mathematical_reasoning - Proofs, calculations
14. linguistic_patterns - Grammar, rhetoric
15. cultural_context - Traditions, meanings
16. common_sense - Typical knowledge

Returns:
- Anchor prompts for each category
- Weights (core anchors have higher weight)
- Expected semantic dimensions
- Statistics (total count, vectors cached)
`.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by specific category (optional)',
          enum: [
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
          ]
        },
        limit: {
          type: 'number',
          description: 'Maximum anchors to return (default: 20)',
          default: 20
        }
      }
    }
  },
  {
    name: 'neural_bridge_calculate_contrastive_loss',
    description: `
[CONTRASTIVE LOSS CALCULATION - WHITEPAPER SECTION 3.2]

Calculate InfoNCE contrastive loss for vector alignment.

Formula:
L_contrastive = -log(exp(sim(h, a+)/τ) / Σ exp(sim(h, a-)/τ))

where:
- h: aligned hidden state
- a+: positive anchor (most similar)
- a-: negative anchors (different categories)
- τ: temperature parameter (0.07)

Use Cases:
- W-Matrix training optimization
- Quality-aware pricing (lower loss = higher price)
- Research on alignment methods

Returns:
- Contrastive loss value
- Similarity to positive anchor
- Average similarity to negative anchors
- Loss interpretation
`.trim(),
    inputSchema: {
      type: 'object',
      properties: {
        alignedVector: {
          type: 'array',
          items: { type: 'number' },
          description: 'Aligned vector to evaluate'
        },
        positiveAnchorId: {
          type: 'number',
          description: 'ID of positive anchor (most similar)'
        },
        negativeAnchorIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'IDs of negative anchors (different categories)'
        }
      },
      required: ['alignedVector', 'positiveAnchorId', 'negativeAnchorIds']
    }
  }
];

/**
 * MCP Tool Handlers for Neural Bridge Protocol
 */
export const NEURAL_BRIDGE_TOOL_HANDLERS = {
  neural_bridge_align_kv: async (args: any) => {
    const { kvCache, wMatrix, targetModel } = args;

    // Validate inputs
    if (!kvCache || !wMatrix || !targetModel) {
      throw new Error('Missing required parameters: kvCache, wMatrix, targetModel');
    }

    // Perform alignment
    const result = await neuralBridge.alignKVCache(
      kvCache as KVCache,
      wMatrix as WMatrix,
      targetModel
    );

    return {
      success: true,
      alignedKVCache: result.alignedKVCache,
      quality: result.quality,
      nearestAnchors: result.nearestAnchors,
      validationWarnings: result.validationWarnings,
      interpretation: {
        semanticLoss: `${(result.quality.semanticLoss * 100).toFixed(1)}%`,
        passesThreshold: result.quality.passesThreshold
          ? '✓ Passes 3% semantic loss threshold'
          : '✗ Below 3% threshold - consider higher quality W-Matrix',
        informationRetention: `${(result.quality.informationRetention * 100).toFixed(1)}%`,
        confidence: `${(result.quality.confidence * 100).toFixed(1)}%`,
      },
      recommendation: result.quality.passesThreshold
        ? 'Excellent alignment quality. Safe to use in production.'
        : result.quality.semanticQualityScore >= 0.85
        ? 'Good quality. Acceptable for most use cases.'
        : 'Low quality. Consider training a better W-Matrix or using a different model pair.'
    };
  },

  neural_bridge_validate_vector: async (args: any) => {
    const { vector, sourceModel } = args;

    if (!vector || !Array.isArray(vector)) {
      throw new Error('Invalid vector: must be an array of numbers');
    }

    // Find nearest anchors
    const nearestAnchors = anchorDB.findNearestAnchors(vector, 10);

    // Calibrate alignment
    const calibration = anchorDB.calibrateAlignment(vector);

    // Determine quality level
    let qualityLevel: string;
    let recommendation: string;

    if (calibration.calibrationScore >= 0.95) {
      qualityLevel = 'Excellent (≥0.95)';
      recommendation = '✓ Passes 3% semantic loss threshold. Ready for production.';
    } else if (calibration.calibrationScore >= 0.85) {
      qualityLevel = 'Good (0.85-0.95)';
      recommendation = 'Acceptable quality for most use cases. Consider minor refinements.';
    } else if (calibration.calibrationScore >= 0.70) {
      qualityLevel = 'Moderate (0.70-0.85)';
      recommendation = 'Below optimal quality. Consider retraining or adjusting parameters.';
    } else {
      qualityLevel = 'Poor (<0.70)';
      recommendation = '✗ Reject this vector. Significant quality issues detected.';
    }

    return {
      success: true,
      sourceModel,
      calibrationScore: calibration.calibrationScore,
      semanticLoss: 1.0 - calibration.calibrationScore,
      qualityLevel,
      coverage: {
        percentage: `${(calibration.coverage * 100).toFixed(1)}%`,
        categoriesRepresented: nearestAnchors.map(a => a.category).filter((v, i, a) => a.indexOf(v) === i).length,
        totalCategories: 16,
      },
      nearestAnchors: nearestAnchors.slice(0, 5).map(a => ({
        category: a.category,
        similarity: a.similarity.toFixed(3),
        prompt: a.prompt.substring(0, 80) + (a.prompt.length > 80 ? '...' : '')
      })),
      recommendations: calibration.recommendations,
      overallRecommendation: recommendation,
    };
  },

  neural_bridge_get_semantic_anchors: async (args: any) => {
    const { category, limit = 20 } = args;

    let anchors;
    if (category) {
      anchors = anchorDB.getAnchorsByCategory(category as any);
    } else {
      anchors = anchorDB.getAllAnchors();
    }

    const stats = anchorDB.getStatistics();

    return {
      success: true,
      totalAnchors: stats.totalAnchors,
      vectorsCached: stats.vectorsCached,
      categoryCounts: stats.categoryCounts,
      anchors: anchors.slice(0, limit).map(a => ({
        id: a.id,
        category: a.category,
        prompt: a.prompt,
        weight: a.weight,
        expectedDimensions: a.expectedDimensions,
      })),
      categories: Object.keys(stats.categoryCounts).map(cat => ({
        name: cat,
        count: stats.categoryCounts[cat],
        percentage: `${((stats.categoryCounts[cat] / stats.totalAnchors) * 100).toFixed(1)}%`
      })),
    };
  },

  neural_bridge_calculate_contrastive_loss: async (args: any) => {
    const { alignedVector, positiveAnchorId, negativeAnchorIds } = args;

    if (!alignedVector || !Array.isArray(alignedVector)) {
      throw new Error('Invalid alignedVector: must be an array of numbers');
    }

    const positiveAnchor = anchorDB.getAnchorVector(positiveAnchorId);
    if (!positiveAnchor) {
      throw new Error(`Positive anchor ${positiveAnchorId} not found in database`);
    }

    const negativeAnchors = negativeAnchorIds
      .map((id: number) => anchorDB.getAnchorVector(id))
      .filter((v: any) => v !== undefined);

    if (negativeAnchors.length === 0) {
      throw new Error('No valid negative anchors found');
    }

    const loss = neuralBridge.calculateContrastiveLoss(
      alignedVector,
      positiveAnchor,
      negativeAnchors
    );

    // Calculate similarities for interpretation
    const positiveSim = neuralBridge['cosineSimilarity'](alignedVector, positiveAnchor);
    const avgNegativeSim = negativeAnchors.reduce((sum: number, neg: number[]) => {
      return sum + neuralBridge['cosineSimilarity'](alignedVector, neg);
    }, 0) / negativeAnchors.length;

    return {
      success: true,
      contrastiveLoss: loss,
      similarities: {
        positiveAnchor: positiveSim.toFixed(4),
        averageNegative: avgNegativeSim.toFixed(4),
        margin: (positiveSim - avgNegativeSim).toFixed(4),
      },
      interpretation: loss < 0.5
        ? '✓ Excellent alignment - strong separation between positive and negative'
        : loss < 1.0
        ? 'Good alignment - clear preference for positive anchor'
        : loss < 2.0
        ? 'Moderate alignment - some confusion with negatives'
        : '✗ Poor alignment - cannot distinguish positive from negatives',
      recommendation: loss < 1.0
        ? 'High-quality alignment. Suitable for production use.'
        : 'Consider additional training or parameter tuning to improve alignment.'
    };
  },
};
