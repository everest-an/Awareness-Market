/**
 * Multi-Modal Vector Support
 *
 * Enables handling of text, image, and audio vectors with fusion strategies.
 * Extends the LatentMAS protocol to support multi-modal AI models like:
 * - CLIP (text + image)
 * - Whisper (audio)
 * - ImageBind (all modalities)
 *
 * Reference: Whitepaper Section 15.1.2 "Multi-Modal Vectors"
 */

// ============================================================================
// Types
// ============================================================================

export type Modality = 'text' | 'image' | 'audio' | 'video';

export type FusionMethod = 'early' | 'late' | 'hybrid' | 'attention';

export interface ModalityVector {
  modality: Modality;
  vector: number[];
  dimension: number;
  model: string; // e.g., "clip-vit-b-32", "whisper-large"
  confidence?: number;
}

export interface MultiModalVector {
  id: string;
  modalityVectors: ModalityVector[];
  fusionMethod: FusionMethod;
  fusedVector?: number[]; // Cached fusion result
  metadata: {
    created: Date;
    updated: Date;
    sourceModel: string;
    description?: string;
  };
}

export interface FusionConfig {
  method: FusionMethod;
  weights?: Record<Modality, number>; // For weighted fusion
  attentionConfig?: {
    heads: number;
    hiddenDim: number;
  };
  normalizeInputs?: boolean;
  normalizeOutput?: boolean;
}

export interface FusionResult {
  fusedVector: number[];
  dimension: number;
  method: FusionMethod;
  modalitiesUsed: Modality[];
  confidence?: number;
}

// ============================================================================
// Multi-Modal Vector Fusion Engine
// ============================================================================

export class MultiModalFusionEngine {
  private config: FusionConfig;

  constructor(config: Partial<FusionConfig> = {}) {
    this.config = {
      method: config.method || 'late',
      weights: config.weights || undefined,
      attentionConfig: config.attentionConfig,
      normalizeInputs: config.normalizeInputs ?? true,
      normalizeOutput: config.normalizeOutput ?? true,
    };
  }

  /**
   * Fuse multiple modality vectors into a single unified vector
   */
  fuse(multiModalVector: MultiModalVector): FusionResult {
    const { modalityVectors, fusionMethod } = multiModalVector;

    if (modalityVectors.length === 0) {
      throw new Error('No modality vectors to fuse');
    }

    if (modalityVectors.length === 1) {
      // Single modality - return as is
      return {
        fusedVector: modalityVectors[0].vector,
        dimension: modalityVectors[0].dimension,
        method: fusionMethod,
        modalitiesUsed: [modalityVectors[0].modality],
        confidence: modalityVectors[0].confidence,
      };
    }

    // Select fusion method
    const method = fusionMethod || this.config.method;

    switch (method) {
      case 'early':
        return this.earlyFusion(modalityVectors);
      case 'late':
        return this.lateFusion(modalityVectors);
      case 'hybrid':
        return this.hybridFusion(modalityVectors);
      case 'attention':
        return this.attentionFusion(modalityVectors);
      default:
        throw new Error(`Unknown fusion method: ${method}`);
    }
  }

  /**
   * Early Fusion: Concatenate all modality vectors
   *
   * Best for: Tightly coupled modalities (e.g., subtitles + video)
   * Pros: Preserves all information
   * Cons: High dimensionality
   */
  private earlyFusion(modalityVectors: ModalityVector[]): FusionResult {
    // Normalize inputs if configured
    const normalized = this.config.normalizeInputs
      ? modalityVectors.map(mv => ({
          ...mv,
          vector: this.normalizeVector(mv.vector),
        }))
      : modalityVectors;

    // Concatenate all vectors
    const fusedVector: number[] = [];
    for (const mv of normalized) {
      fusedVector.push(...mv.vector);
    }

    // Normalize output if configured
    const output = this.config.normalizeOutput
      ? this.normalizeVector(fusedVector)
      : fusedVector;

    return {
      fusedVector: output,
      dimension: output.length,
      method: 'early',
      modalitiesUsed: modalityVectors.map(mv => mv.modality),
      confidence: this.averageConfidence(modalityVectors),
    };
  }

  /**
   * Late Fusion: Average/weighted average of modality vectors
   *
   * Best for: Independent modalities (e.g., separate text + image search)
   * Pros: Fixed dimensionality, simple
   * Cons: Requires same dimension or projection
   */
  private lateFusion(modalityVectors: ModalityVector[]): FusionResult {
    // Check if all vectors have same dimension
    const dimensions = modalityVectors.map(mv => mv.dimension);
    const hasSameDimension = dimensions.every(d => d === dimensions[0]);

    if (!hasSameDimension) {
      throw new Error(
        'Late fusion requires all modality vectors to have the same dimension. ' +
        'Use hybrid fusion or project vectors to common dimension.'
      );
    }

    const dimension = dimensions[0];

    // Normalize inputs if configured
    const normalized = this.config.normalizeInputs
      ? modalityVectors.map(mv => ({
          ...mv,
          vector: this.normalizeVector(mv.vector),
        }))
      : modalityVectors;

    // Get weights (default: equal weights)
    const weights = this.getModalityWeights(normalized);

    // Weighted average
    const fusedVector = new Array(dimension).fill(0);
    for (let i = 0; i < normalized.length; i++) {
      const mv = normalized[i];
      const weight = weights[mv.modality] || 1.0;

      for (let j = 0; j < dimension; j++) {
        fusedVector[j] += mv.vector[j] * weight;
      }
    }

    // Normalize by sum of weights
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
    for (let j = 0; j < dimension; j++) {
      fusedVector[j] /= weightSum;
    }

    // Normalize output if configured
    const output = this.config.normalizeOutput
      ? this.normalizeVector(fusedVector)
      : fusedVector;

    return {
      fusedVector: output,
      dimension: output.length,
      method: 'late',
      modalitiesUsed: modalityVectors.map(mv => mv.modality),
      confidence: this.averageConfidence(modalityVectors),
    };
  }

  /**
   * Hybrid Fusion: Project to common space, then fuse
   *
   * Best for: Mixed dimensionalities
   * Pros: Handles different dimensions
   * Cons: Requires projection matrices
   */
  private hybridFusion(modalityVectors: ModalityVector[]): FusionResult {
    // Find target dimension (use largest)
    const targetDim = Math.max(...modalityVectors.map(mv => mv.dimension));

    // Project all vectors to target dimension
    const projected = modalityVectors.map(mv => {
      if (mv.dimension === targetDim) {
        return mv;
      }

      // Projection: pad with zeros or truncate
      let projectedVector: number[];
      if (mv.dimension < targetDim) {
        // Pad with zeros
        projectedVector = [...mv.vector, ...new Array(targetDim - mv.dimension).fill(0)];
      } else {
        // Truncate (or could use PCA/learned projection)
        projectedVector = mv.vector.slice(0, targetDim);
      }

      return {
        ...mv,
        vector: projectedVector,
        dimension: targetDim,
      };
    });

    // Now use late fusion on projected vectors
    const result = this.lateFusion(projected);

    // Preserve 'hybrid' method name
    return {
      ...result,
      method: 'hybrid',
    };
  }

  /**
   * Attention Fusion: Learn importance of each modality
   *
   * Best for: Dynamic modality importance
   * Pros: Adaptive, state-of-the-art
   * Cons: Requires training, more complex
   */
  private attentionFusion(modalityVectors: ModalityVector[]): FusionResult {
    // Simplified attention mechanism
    // In production, this would use a learned attention network

    // 1. Compute attention scores based on confidence
    const confidences = modalityVectors.map(mv => mv.confidence || 1.0);
    const totalConfidence = confidences.reduce((a, b) => a + b, 0);
    const attentionWeights = confidences.map(c => c / totalConfidence);

    // 2. Project to common dimension
    const targetDim = Math.max(...modalityVectors.map(mv => mv.dimension));
    const projected = modalityVectors.map(mv => {
      let vector = mv.vector;
      if (mv.dimension < targetDim) {
        vector = [...vector, ...new Array(targetDim - mv.dimension).fill(0)];
      } else if (mv.dimension > targetDim) {
        vector = vector.slice(0, targetDim);
      }
      return { ...mv, vector, dimension: targetDim };
    });

    // 3. Attention-weighted fusion
    const fusedVector = new Array(targetDim).fill(0);
    for (let i = 0; i < projected.length; i++) {
      const weight = attentionWeights[i];
      for (let j = 0; j < targetDim; j++) {
        fusedVector[j] += projected[i].vector[j] * weight;
      }
    }

    // Normalize output
    const output = this.config.normalizeOutput
      ? this.normalizeVector(fusedVector)
      : fusedVector;

    return {
      fusedVector: output,
      dimension: output.length,
      method: 'attention',
      modalitiesUsed: modalityVectors.map(mv => mv.modality),
      confidence: this.averageConfidence(modalityVectors),
    };
  }

  /**
   * Split a fused vector back into modality vectors (inverse fusion)
   */
  unfuse(
    fusedVector: number[],
    method: FusionMethod,
    modalityDimensions: Record<Modality, number>
  ): ModalityVector[] {
    if (method !== 'early') {
      throw new Error('Unfuse only supported for early fusion (concatenation)');
    }

    const result: ModalityVector[] = [];
    let offset = 0;

    for (const [modality, dimension] of Object.entries(modalityDimensions)) {
      if (offset + dimension > fusedVector.length) {
        throw new Error('Invalid fusion vector length for unfuse');
      }

      const vector = fusedVector.slice(offset, offset + dimension);
      result.push({
        modality: modality as Modality,
        vector,
        dimension,
        model: 'unfused',
      });

      offset += dimension;
    }

    return result;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }

  /**
   * Get modality weights from config or default
   */
  private getModalityWeights(modalityVectors: ModalityVector[]): Record<Modality, number> {
    if (this.config.weights) {
      return this.config.weights;
    }

    // Default: equal weights
    const weights: Record<string, number> = {};
    for (const mv of modalityVectors) {
      weights[mv.modality] = 1.0;
    }
    return weights as Record<Modality, number>;
  }

  /**
   * Calculate average confidence across modalities
   */
  private averageConfidence(modalityVectors: ModalityVector[]): number | undefined {
    const confidences = modalityVectors
      .map(mv => mv.confidence)
      .filter((c): c is number => c !== undefined);

    if (confidences.length === 0) return undefined;

    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }
}

// ============================================================================
// Multi-Modal Vector Builder
// ============================================================================

export class MultiModalVectorBuilder {
  private modalityVectors: ModalityVector[] = [];
  private fusionMethod: FusionMethod = 'late';

  /**
   * Add a modality vector
   */
  addModality(
    modality: Modality,
    vector: number[],
    model: string,
    confidence?: number
  ): this {
    this.modalityVectors.push({
      modality,
      vector,
      dimension: vector.length,
      model,
      confidence,
    });
    return this;
  }

  /**
   * Set fusion method
   */
  setFusionMethod(method: FusionMethod): this {
    this.fusionMethod = method;
    return this;
  }

  /**
   * Build the multi-modal vector
   */
  build(
    id: string,
    sourceModel: string,
    description?: string
  ): MultiModalVector {
    if (this.modalityVectors.length === 0) {
      throw new Error('No modality vectors added');
    }

    return {
      id,
      modalityVectors: this.modalityVectors,
      fusionMethod: this.fusionMethod,
      metadata: {
        created: new Date(),
        updated: new Date(),
        sourceModel,
        description,
      },
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a multi-modal vector from CLIP-style text + image
 */
export function createCLIPVector(
  id: string,
  textVector: number[],
  imageVector: number[]
): MultiModalVector {
  return new MultiModalVectorBuilder()
    .addModality('text', textVector, 'clip-text-encoder')
    .addModality('image', imageVector, 'clip-image-encoder')
    .setFusionMethod('late')
    .build(id, 'clip-vit-b-32', 'CLIP text-image vector');
}

/**
 * Create a multi-modal vector from audio + text (e.g., speech transcription)
 */
export function createAudioTextVector(
  id: string,
  audioVector: number[],
  textVector: number[]
): MultiModalVector {
  return new MultiModalVectorBuilder()
    .addModality('audio', audioVector, 'whisper-large')
    .addModality('text', textVector, 'text-encoder')
    .setFusionMethod('hybrid')
    .build(id, 'whisper-text-fusion', 'Audio + text transcription');
}

/**
 * Check if a vector is multi-modal
 */
export function isMultiModal(vector: any): vector is MultiModalVector {
  if (!vector) return false;
  return (
    Array.isArray(vector.modalityVectors) &&
    vector.modalityVectors.length > 1
  );
}

/**
 * Extract specific modality from multi-modal vector
 */
export function extractModality(
  multiModalVector: MultiModalVector,
  modality: Modality
): ModalityVector | null {
  return (
    multiModalVector.modalityVectors.find(mv => mv.modality === modality) || null
  );
}
