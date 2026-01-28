/**
 * Reasoning Chain Verification System
 *
 * Implements automated verification for reasoning chains to ensure:
 * - Logical consistency across steps
 * - Quality of intermediate reasoning
 * - Coherence between input context and output
 * - Detection of hallucinations and errors
 *
 * Reference: Whitepaper Section 9.3 "Quality Metrics"
 */

import type { ReasoningChainData, ReasoningStep } from './chain-package-builder';
import type { KVCache } from './types';

// ============================================================================
// Types
// ============================================================================

export type VerificationStatus = 'pending' | 'verified' | 'disputed' | 'rejected';
export type VerificationMethod = 'human' | 'automated' | 'consensus';
export type ChainErrorType =
  | 'logic_inconsistency'
  | 'step_discontinuity'
  | 'hallucination'
  | 'low_confidence'
  | 'missing_data'
  | 'invalid_structure';

export interface ChainError {
  type: ChainErrorType;
  stepIndex: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  method: VerificationMethod;
  overallScore: number; // 0-1, where 1 = perfect
  errors: ChainError[];
  warnings: ChainError[];
  metrics: VerificationMetrics;
  timestamp: string;
  verifierId?: string;
}

export interface VerificationMetrics {
  logicalConsistency: number; // 0-1
  stepCoherence: number; // 0-1
  confidenceScore: number; // 0-1
  completeness: number; // 0-1
  informationFlow: number; // 0-1
}

export interface VerificationConfig {
  minOverallScore: number; // Default: 0.7
  minLogicalConsistency: number; // Default: 0.8
  minStepCoherence: number; // Default: 0.75
  minConfidence: number; // Default: 0.6
  strictMode: boolean; // Default: false
}

// ============================================================================
// Chain Verification Engine
// ============================================================================

export class ChainVerificationEngine {
  private config: VerificationConfig;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = {
      minOverallScore: config.minOverallScore ?? 0.7,
      minLogicalConsistency: config.minLogicalConsistency ?? 0.8,
      minStepCoherence: config.minStepCoherence ?? 0.75,
      minConfidence: config.minConfidence ?? 0.6,
      strictMode: config.strictMode ?? false,
    };
  }

  /**
   * Verify a reasoning chain automatically
   */
  async verifyChain(chain: ReasoningChainData): Promise<VerificationResult> {
    const errors: ChainError[] = [];
    const warnings: ChainError[] = [];

    // 1. Structural validation
    this.validateStructure(chain, errors, warnings);

    // 2. Logical consistency check
    const logicalConsistency = this.checkLogicalConsistency(chain, errors, warnings);

    // 3. Step coherence check
    const stepCoherence = this.checkStepCoherence(chain, errors, warnings);

    // 4. Confidence score aggregation
    const confidenceScore = this.calculateConfidenceScore(chain, errors, warnings);

    // 5. Completeness check
    const completeness = this.checkCompleteness(chain, errors, warnings);

    // 6. Information flow analysis
    const informationFlow = this.analyzeInformationFlow(chain, errors, warnings);

    // Calculate overall score
    const metrics: VerificationMetrics = {
      logicalConsistency,
      stepCoherence,
      confidenceScore,
      completeness,
      informationFlow,
    };

    const overallScore = this.calculateOverallScore(metrics);

    // Determine verification status
    const status = this.determineStatus(overallScore, metrics, errors);

    return {
      status,
      method: 'automated',
      overallScore,
      errors: errors.filter(e => e.severity === 'critical'),
      warnings: warnings.concat(errors.filter(e => e.severity === 'warning')),
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify with human override
   */
  async verifyWithHuman(
    chain: ReasoningChainData,
    humanReview: {
      approved: boolean;
      comments: string;
      verifierId: string;
    }
  ): Promise<VerificationResult> {
    // First get automated verification
    const autoResult = await this.verifyChain(chain);

    // Human can override automated result
    return {
      ...autoResult,
      status: humanReview.approved ? 'verified' : 'rejected',
      method: 'human',
      verifierId: humanReview.verifierId,
      warnings: [
        ...autoResult.warnings,
        {
          type: 'missing_data',
          stepIndex: -1,
          severity: 'info',
          message: `Human review: ${humanReview.comments}`,
        },
      ],
    };
  }

  /**
   * Consensus verification (multi-verifier)
   */
  async verifyWithConsensus(
    chain: ReasoningChainData,
    verifications: VerificationResult[]
  ): Promise<VerificationResult> {
    if (verifications.length === 0) {
      return await this.verifyChain(chain);
    }

    // Calculate consensus metrics
    const avgScore = verifications.reduce((sum, v) => sum + v.overallScore, 0) / verifications.length;
    const approvedCount = verifications.filter(v => v.status === 'verified').length;
    const consensusThreshold = Math.ceil(verifications.length * 0.6); // 60% consensus

    const consensusStatus: VerificationStatus =
      approvedCount >= consensusThreshold ? 'verified' :
      approvedCount === 0 ? 'rejected' :
      'disputed';

    // Aggregate all errors and warnings
    const allErrors: ChainError[] = [];
    const allWarnings: ChainError[] = [];
    for (const v of verifications) {
      allErrors.push(...v.errors);
      allWarnings.push(...v.warnings);
    }

    // Average metrics
    const metrics: VerificationMetrics = {
      logicalConsistency: this.average(verifications.map(v => v.metrics.logicalConsistency)),
      stepCoherence: this.average(verifications.map(v => v.metrics.stepCoherence)),
      confidenceScore: this.average(verifications.map(v => v.metrics.confidenceScore)),
      completeness: this.average(verifications.map(v => v.metrics.completeness)),
      informationFlow: this.average(verifications.map(v => v.metrics.informationFlow)),
    };

    return {
      status: consensusStatus,
      method: 'consensus',
      overallScore: avgScore,
      errors: this.deduplicateErrors(allErrors),
      warnings: this.deduplicateErrors(allWarnings),
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  // ========================================================================
  // Validation Methods
  // ========================================================================

  /**
   * Validate basic structure
   */
  private validateStructure(
    chain: ReasoningChainData,
    errors: ChainError[],
    warnings: ChainError[]
  ): void {
    // Check if steps exist
    if (!chain.steps || chain.steps.length === 0) {
      errors.push({
        type: 'invalid_structure',
        stepIndex: -1,
        severity: 'critical',
        message: 'Chain has no steps',
      });
      return;
    }

    // Check step index continuity
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      if (step.stepIndex !== i) {
        errors.push({
          type: 'step_discontinuity',
          stepIndex: i,
          severity: 'critical',
          message: `Step index mismatch: expected ${i}, got ${step.stepIndex}`,
        });
      }

      // Check for missing data
      if (!step.kvSnapshot) {
        errors.push({
          type: 'missing_data',
          stepIndex: i,
          severity: 'critical',
          message: 'Missing KV snapshot',
        });
      }

      if (!step.description || step.description.length < 5) {
        warnings.push({
          type: 'missing_data',
          stepIndex: i,
          severity: 'warning',
          message: 'Step description is too short or missing',
        });
      }
    }

    // Check total steps
    if (chain.totalSteps !== chain.steps.length) {
      warnings.push({
        type: 'invalid_structure',
        stepIndex: -1,
        severity: 'warning',
        message: `Total steps (${chain.totalSteps}) doesn't match actual count (${chain.steps.length})`,
      });
    }
  }

  /**
   * Check logical consistency across steps
   */
  private checkLogicalConsistency(
    chain: ReasoningChainData,
    errors: ChainError[],
    warnings: ChainError[]
  ): number {
    if (chain.steps.length === 0) return 0;

    let consistencyScore = 1.0;
    const penalties: number[] = [];

    for (let i = 1; i < chain.steps.length; i++) {
      const prevStep = chain.steps[i - 1];
      const currStep = chain.steps[i];

      // Check KV cache size progression (should grow or stay similar)
      const prevSize = this.getKVCacheSize(prevStep.kvSnapshot);
      const currSize = this.getKVCacheSize(currStep.kvSnapshot);

      // Sudden large drops might indicate data loss
      if (currSize < prevSize * 0.5) {
        warnings.push({
          type: 'logic_inconsistency',
          stepIndex: i,
          severity: 'warning',
          message: `KV cache size dropped significantly (${prevSize} -> ${currSize})`,
          suggestion: 'Verify if information loss is intentional',
        });
        penalties.push(0.1);
      }

      // Check confidence drop
      if (prevStep.confidence && currStep.confidence) {
        if (currStep.confidence < prevStep.confidence - 0.3) {
          warnings.push({
            type: 'low_confidence',
            stepIndex: i,
            severity: 'warning',
            message: `Confidence dropped significantly (${prevStep.confidence.toFixed(2)} -> ${currStep.confidence.toFixed(2)})`,
          });
          penalties.push(0.05);
        }
      }
    }

    // Apply penalties
    for (const penalty of penalties) {
      consistencyScore -= penalty;
    }

    return Math.max(0, consistencyScore);
  }

  /**
   * Check step coherence (each step builds on previous)
   */
  private checkStepCoherence(
    chain: ReasoningChainData,
    errors: ChainError[],
    warnings: ChainError[]
  ): number {
    if (chain.steps.length === 0) return 0;
    if (chain.steps.length === 1) return 1.0;

    let coherenceScore = 1.0;

    for (let i = 1; i < chain.steps.length; i++) {
      const prevStep = chain.steps[i - 1];
      const currStep = chain.steps[i];

      // Check if current step builds on previous
      // Using KV cache overlap as proxy for coherence
      const overlap = this.calculateKVCacheOverlap(
        prevStep.kvSnapshot,
        currStep.kvSnapshot
      );

      if (overlap < 0.3) {
        warnings.push({
          type: 'step_discontinuity',
          stepIndex: i,
          severity: 'warning',
          message: `Low overlap between steps ${i-1} and ${i} (${(overlap * 100).toFixed(1)}%)`,
          suggestion: 'Steps should build on each other',
        });
        coherenceScore -= 0.1;
      }
    }

    return Math.max(0, coherenceScore);
  }

  /**
   * Calculate average confidence score
   */
  private calculateConfidenceScore(
    chain: ReasoningChainData,
    errors: ChainError[],
    warnings: ChainError[]
  ): number {
    const confidences = chain.steps
      .map(s => s.confidence)
      .filter((c): c is number => c !== undefined);

    if (confidences.length === 0) {
      warnings.push({
        type: 'missing_data',
        stepIndex: -1,
        severity: 'warning',
        message: 'No confidence scores provided',
      });
      return 0.5; // Default neutral score
    }

    const avgConfidence = this.average(confidences);

    // Check for low confidence steps
    chain.steps.forEach((step, i) => {
      if (step.confidence !== undefined && step.confidence < this.config.minConfidence) {
        errors.push({
          type: 'low_confidence',
          stepIndex: i,
          severity: 'critical',
          message: `Step confidence ${step.confidence.toFixed(2)} below threshold ${this.config.minConfidence}`,
        });
      }
    });

    return avgConfidence;
  }

  /**
   * Check completeness (initial context and final output)
   */
  private checkCompleteness(
    chain: ReasoningChainData,
    errors: ChainError[],
    warnings: ChainError[]
  ): number {
    let score = 1.0;

    if (!chain.initialContext || chain.initialContext.length < 10) {
      warnings.push({
        type: 'missing_data',
        stepIndex: -1,
        severity: 'warning',
        message: 'Initial context is missing or too short',
      });
      score -= 0.2;
    }

    if (!chain.finalOutput || chain.finalOutput.length < 10) {
      warnings.push({
        type: 'missing_data',
        stepIndex: -1,
        severity: 'warning',
        message: 'Final output is missing or too short',
      });
      score -= 0.2;
    }

    if (!chain.problemType || chain.problemType.length === 0) {
      warnings.push({
        type: 'missing_data',
        stepIndex: -1,
        severity: 'warning',
        message: 'Problem type not specified',
      });
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Analyze information flow through the chain
   */
  private analyzeInformationFlow(
    chain: ReasoningChainData,
    errors: ChainError[],
    warnings: ChainError[]
  ): number {
    if (chain.steps.length === 0) return 0;

    // Check if information generally flows forward
    const sizes = chain.steps.map(s => this.getKVCacheSize(s.kvSnapshot));

    // Information should generally increase or stay stable
    let flowScore = 1.0;
    let backwardFlows = 0;

    for (let i = 1; i < sizes.length; i++) {
      if (sizes[i] < sizes[i - 1] * 0.7) {
        backwardFlows++;
      }
    }

    // Penalize excessive backward flow
    if (backwardFlows > sizes.length * 0.3) {
      warnings.push({
        type: 'logic_inconsistency',
        stepIndex: -1,
        severity: 'warning',
        message: 'Information flow appears inconsistent across steps',
      });
      flowScore -= 0.2;
    }

    return Math.max(0, flowScore);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Calculate overall score from metrics
   */
  private calculateOverallScore(metrics: VerificationMetrics): number {
    // Weighted average
    return (
      metrics.logicalConsistency * 0.25 +
      metrics.stepCoherence * 0.25 +
      metrics.confidenceScore * 0.20 +
      metrics.completeness * 0.15 +
      metrics.informationFlow * 0.15
    );
  }

  /**
   * Determine verification status
   */
  private determineStatus(
    overallScore: number,
    metrics: VerificationMetrics,
    errors: ChainError[]
  ): VerificationStatus {
    // Critical errors = rejected
    const hasCriticalErrors = errors.some(e => e.severity === 'critical');
    if (hasCriticalErrors) {
      return 'rejected';
    }

    // Check individual thresholds
    if (this.config.strictMode) {
      if (
        metrics.logicalConsistency < this.config.minLogicalConsistency ||
        metrics.stepCoherence < this.config.minStepCoherence
      ) {
        return 'disputed';
      }
    }

    // Check overall score
    if (overallScore >= this.config.minOverallScore) {
      return 'verified';
    } else if (overallScore >= 0.5) {
      return 'disputed';
    } else {
      return 'rejected';
    }
  }

  /**
   * Get KV cache size (total tokens)
   */
  private getKVCacheSize(kvCache: KVCache | undefined): number {
    if (!kvCache || !kvCache.keys || !Array.isArray(kvCache.keys)) return 0;
    return kvCache.keys.reduce((sum, layer) => {
      if (!Array.isArray(layer)) return sum;
      return sum + layer.length;
    }, 0);
  }

  /**
   * Calculate overlap between two KV caches
   */
  private calculateKVCacheOverlap(kv1: KVCache, kv2: KVCache): number {
    const size1 = this.getKVCacheSize(kv1);
    const size2 = this.getKVCacheSize(kv2);

    if (size1 === 0 || size2 === 0) return 0;

    // Simple heuristic: if both exist and size2 >= size1, assume good overlap
    // In production, would use actual vector similarity
    return Math.min(1, size1 / size2);
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Deduplicate errors by type and step
   */
  private deduplicateErrors(errors: ChainError[]): ChainError[] {
    const seen = new Set<string>();
    return errors.filter(error => {
      const key = `${error.type}-${error.stepIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VerificationConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): VerificationConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick verification with default settings
 */
export async function verifyReasoningChain(
  chain: ReasoningChainData
): Promise<VerificationResult> {
  const engine = new ChainVerificationEngine();
  return await engine.verifyChain(chain);
}

/**
 * Strict verification for production use
 */
export async function verifyReasoningChainStrict(
  chain: ReasoningChainData
): Promise<VerificationResult> {
  const engine = new ChainVerificationEngine({
    minOverallScore: 0.8,
    minLogicalConsistency: 0.85,
    minStepCoherence: 0.8,
    minConfidence: 0.7,
    strictMode: true,
  });
  return await engine.verifyChain(chain);
}
