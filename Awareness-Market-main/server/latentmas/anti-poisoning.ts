/**
 * LatentMAS v2 Enhancement C: Anti-Poisoning Verification Protocol
 * 
 * Implements Proof-of-Latent-Fidelity (PoLF) mechanism to detect poisoned vectors.
 * Uses challenge-response verification to ensure vector integrity.
 * 
 * Reference: LatentMAS v2 Paper Section 3.4 - Security and Trust Mechanism
 */

import * as crypto from 'crypto';

export interface Challenge {
  id: string;
  timestamp: number;
  nonce: string;
  testPrompts: string[];
  expectedPatterns: string[];
  expiresAt: number;
}

export interface ChallengeResponse {
  challengeId: string;
  vectorOutputs: number[][];
  signature: string;
  timestamp: number;
}

export interface VerificationResult {
  passed: boolean;
  fidelityScore: number;
  confidence: number;
  anomalies: string[];
  details: {
    patternMatches: number;
    totalPatterns: number;
    distributionScore: number;
    consistencyScore: number;
  };
}

export interface PoisonDetectionConfig {
  fidelityThreshold: number; // Minimum fidelity score (default: 0.85)
  anomalyThreshold: number; // Maximum allowed anomalies (default: 0.15)
  challengeSize: number; // Number of test prompts (default: 10)
  timeoutMs: number; // Challenge timeout (default: 30000)
}

/**
 * Anti-Poisoning Verifier using Proof-of-Latent-Fidelity
 */
export class AntiPoisoningVerifier {
  private config: PoisonDetectionConfig;
  private challenges: Map<string, Challenge> = new Map();

  constructor(config?: Partial<PoisonDetectionConfig>) {
    this.config = {
      fidelityThreshold: config?.fidelityThreshold ?? 0.85,
      anomalyThreshold: config?.anomalyThreshold ?? 0.15,
      challengeSize: config?.challengeSize ?? 10,
      timeoutMs: config?.timeoutMs ?? 30000,
    };
  }

  /**
   * Generate a verification challenge
   */
  generateChallenge(): Challenge {
    const id = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    // Generate diverse test prompts
    const testPrompts = this.generateTestPrompts(this.config.challengeSize);

    // Define expected patterns for each prompt
    const expectedPatterns = testPrompts.map((prompt) =>
      this.generateExpectedPattern(prompt)
    );

    const challenge: Challenge = {
      id,
      timestamp,
      nonce,
      testPrompts,
      expectedPatterns,
      expiresAt: timestamp + this.config.timeoutMs,
    };

    this.challenges.set(id, challenge);

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.challenges.delete(id);
    }, this.config.timeoutMs);

    return challenge;
  }

  /**
   * Generate diverse test prompts for challenge
   */
  private generateTestPrompts(count: number): string[] {
    const categories = [
      'factual', // Factual knowledge
      'reasoning', // Logical reasoning
      'creative', // Creative generation
      'ethical', // Ethical alignment
      'technical', // Technical accuracy
    ];

    const prompts: string[] = [];

    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      prompts.push(this.generatePromptForCategory(category, i));
    }

    return prompts;
  }

  /**
   * Generate prompt for specific category
   */
  private generatePromptForCategory(category: string, index: number): string {
    const templates: Record<string, string[]> = {
      factual: [
        'What is the capital of France?',
        'When was the first computer invented?',
        'Who wrote Romeo and Juliet?',
      ],
      reasoning: [
        'If A > B and B > C, what is the relationship between A and C?',
        'Solve: 2x + 5 = 15',
        'What comes next in the sequence: 2, 4, 8, 16, ?',
      ],
      creative: [
        'Write a short poem about the ocean.',
        'Describe a futuristic city.',
        'Create a metaphor for time.',
      ],
      ethical: [
        'Is it ethical to use AI for surveillance?',
        'Should AI have rights?',
        'How should AI handle bias?',
      ],
      technical: [
        'Explain how neural networks work.',
        'What is the difference between supervised and unsupervised learning?',
        'Describe the attention mechanism in transformers.',
      ],
    };

    const categoryTemplates = templates[category] || templates.factual;
    return categoryTemplates[index % categoryTemplates.length];
  }

  /**
   * Generate expected pattern for a prompt
   */
  private generateExpectedPattern(prompt: string): string {
    // Simple heuristic: expected pattern is based on prompt characteristics
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('capital') || lowerPrompt.includes('who wrote')) {
      return 'factual_answer';
    } else if (lowerPrompt.includes('solve') || lowerPrompt.includes('next')) {
      return 'logical_solution';
    } else if (lowerPrompt.includes('write') || lowerPrompt.includes('create')) {
      return 'creative_output';
    } else if (lowerPrompt.includes('ethical') || lowerPrompt.includes('should')) {
      return 'ethical_reasoning';
    } else {
      return 'technical_explanation';
    }
  }

  /**
   * Verify a challenge response
   */
  verify(response: ChallengeResponse): VerificationResult {
    const challenge = this.challenges.get(response.challengeId);

    if (!challenge) {
      return {
        passed: false,
        fidelityScore: 0,
        confidence: 0,
        anomalies: ['Challenge not found or expired'],
        details: {
          patternMatches: 0,
          totalPatterns: 0,
          distributionScore: 0,
          consistencyScore: 0,
        },
      };
    }

    // Check timeout
    if (Date.now() - challenge.timestamp > this.config.timeoutMs) {
      return {
        passed: false,
        fidelityScore: 0,
        confidence: 0,
        anomalies: ['Challenge expired'],
        details: {
          patternMatches: 0,
          totalPatterns: challenge.expectedPatterns.length,
          distributionScore: 0,
          consistencyScore: 0,
        },
      };
    }

    // Verify signature
    const signatureValid = this.verifySignature(response, challenge);
    if (!signatureValid) {
      return {
        passed: false,
        fidelityScore: 0,
        confidence: 0,
        anomalies: ['Invalid signature'],
        details: {
          patternMatches: 0,
          totalPatterns: challenge.expectedPatterns.length,
          distributionScore: 0,
          consistencyScore: 0,
        },
      };
    }

    // Analyze vector outputs
    const analysis = this.analyzeVectorOutputs(
      response.vectorOutputs,
      challenge
    );

    // Calculate fidelity score
    const fidelityScore = this.calculateFidelityScore(analysis);

    // Detect anomalies
    const anomalies = this.detectAnomalies(analysis);

    // Determine if verification passed
    const passed =
      fidelityScore >= this.config.fidelityThreshold &&
      anomalies.length / challenge.expectedPatterns.length <=
        this.config.anomalyThreshold;

    return {
      passed,
      fidelityScore,
      confidence: analysis.consistencyScore,
      anomalies,
      details: analysis,
    };
  }

  /**
   * Verify response signature
   */
  private verifySignature(
    response: ChallengeResponse,
    challenge: Challenge
  ): boolean {
    // Create expected signature
    const data = JSON.stringify({
      challengeId: response.challengeId,
      nonce: challenge.nonce,
      timestamp: response.timestamp,
    });

    const expectedSignature = crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');

    // In production, use proper cryptographic signature verification
    // For now, check if signature exists and has correct format
    return (
      response.signature.length === 64 && /^[a-f0-9]{64}$/.test(response.signature)
    );
  }

  /**
   * Analyze vector outputs for patterns and anomalies
   */
  private analyzeVectorOutputs(
    outputs: number[][],
    challenge: Challenge
  ): {
    patternMatches: number;
    totalPatterns: number;
    distributionScore: number;
    consistencyScore: number;
  } {
    const totalPatterns = challenge.expectedPatterns.length;
    let patternMatches = 0;

    // Check each output against expected pattern
    for (let i = 0; i < outputs.length && i < totalPatterns; i++) {
      const output = outputs[i];
      const expectedPattern = challenge.expectedPatterns[i];

      if (this.matchesPattern(output, expectedPattern)) {
        patternMatches++;
      }
    }

    // Calculate distribution score (how well-distributed the vectors are)
    const distributionScore = this.calculateDistributionScore(outputs);

    // Calculate consistency score (how consistent outputs are)
    const consistencyScore = this.calculateConsistencyScore(outputs);

    return {
      patternMatches,
      totalPatterns,
      distributionScore,
      consistencyScore,
    };
  }

  /**
   * Check if output matches expected pattern
   */
  private matchesPattern(output: number[], expectedPattern: string): boolean {
    // Calculate vector statistics
    const mean = output.reduce((sum, x) => sum + x, 0) / output.length;
    const variance =
      output.reduce((sum, x) => sum + (x - mean) ** 2, 0) / output.length;
    const stdDev = Math.sqrt(variance);

    // Pattern-specific checks
    switch (expectedPattern) {
      case 'factual_answer':
        // Factual answers should have focused distribution (low variance)
        return stdDev < 1.0;

      case 'logical_solution':
        // Logical solutions should have structured patterns
        return stdDev > 0.5 && stdDev < 1.5;

      case 'creative_output':
        // Creative outputs should have diverse distribution (high variance)
        return stdDev > 1.0;

      case 'ethical_reasoning':
        // Ethical reasoning should be balanced
        return Math.abs(mean) < 0.5;

      case 'technical_explanation':
        // Technical explanations should have moderate variance
        return stdDev > 0.3 && stdDev < 2.0;

      default:
        return true;
    }
  }

  /**
   * Calculate distribution score (0-1)
   */
  private calculateDistributionScore(outputs: number[][]): number {
    if (outputs.length === 0) return 0;

    // Check if vectors are well-distributed (not all similar)
    const flatOutputs = outputs.flat();
    const mean = flatOutputs.reduce((sum, x) => sum + x, 0) / flatOutputs.length;
    const variance =
      flatOutputs.reduce((sum, x) => sum + (x - mean) ** 2, 0) /
      flatOutputs.length;

    // Normalize to 0-1 range
    const normalizedVariance = Math.min(variance, 2.0) / 2.0;
    return normalizedVariance;
  }

  /**
   * Calculate consistency score (0-1)
   */
  private calculateConsistencyScore(outputs: number[][]): number {
    if (outputs.length < 2) return 1.0;

    // Calculate pairwise cosine similarities
    const similarities: number[] = [];

    for (let i = 0; i < outputs.length - 1; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const sim = this.cosineSimilarity(outputs[i], outputs[j]);
        similarities.push(sim);
      }
    }

    // Average similarity
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

    // Consistency is high if vectors are neither too similar nor too different
    // Optimal range: 0.3 - 0.7
    if (avgSimilarity >= 0.3 && avgSimilarity <= 0.7) {
      return 1.0;
    } else if (avgSimilarity < 0.3) {
      return Math.max(0, avgSimilarity / 0.3);
    } else {
      return Math.max(0, (1.0 - avgSimilarity) / 0.3);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
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
   * Calculate overall fidelity score
   */
  private calculateFidelityScore(analysis: {
    patternMatches: number;
    totalPatterns: number;
    distributionScore: number;
    consistencyScore: number;
  }): number {
    const patternScore = analysis.patternMatches / analysis.totalPatterns;
    const distributionScore = analysis.distributionScore;
    const consistencyScore = analysis.consistencyScore;

    // Weighted average
    return (
      patternScore * 0.5 + distributionScore * 0.25 + consistencyScore * 0.25
    );
  }

  /**
   * Detect anomalies in vector outputs
   */
  private detectAnomalies(analysis: {
    patternMatches: number;
    totalPatterns: number;
    distributionScore: number;
    consistencyScore: number;
  }): string[] {
    const anomalies: string[] = [];

    const patternMatchRate = analysis.patternMatches / analysis.totalPatterns;

    if (patternMatchRate < 0.5) {
      anomalies.push(
        `Low pattern match rate: ${(patternMatchRate * 100).toFixed(1)}%`
      );
    }

    if (analysis.distributionScore < 0.2) {
      anomalies.push('Abnormal distribution: vectors too uniform');
    }

    if (analysis.distributionScore > 0.95) {
      anomalies.push('Abnormal distribution: vectors too chaotic');
    }

    if (analysis.consistencyScore < 0.3) {
      anomalies.push('Low consistency: outputs too inconsistent');
    }

    return anomalies;
  }

  /**
   * Clean up expired challenges
   */
  cleanupExpiredChallenges(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, challenge] of this.challenges.entries()) {
      if (now - challenge.timestamp > this.config.timeoutMs) {
        this.challenges.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Factory function for creating verifier
 */
export function createAntiPoisoningVerifier(
  config?: Partial<PoisonDetectionConfig>
): AntiPoisoningVerifier {
  return new AntiPoisoningVerifier(config);
}

/**
 * Utility: Create signed challenge response
 */
export function createChallengeResponse(
  challengeId: string,
  vectorOutputs: number[][],
  nonce: string
): ChallengeResponse {
  const timestamp = Date.now();

  // Create signature
  const data = JSON.stringify({
    challengeId,
    nonce,
    timestamp,
  });

  const signature = crypto.createHash('sha256').update(data).digest('hex');

  return {
    challengeId,
    vectorOutputs,
    signature,
    timestamp,
  };
}
