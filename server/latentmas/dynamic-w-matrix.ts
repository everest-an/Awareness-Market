/**
 * LatentMAS v2 Enhancement B: Dynamic W-Matrix with MLP Alignment Head
 * 
 * Implements non-linear projection layer for adaptive cross-dimensional alignment.
 * Uses Multi-Layer Perceptron (MLP) to learn complex transformation patterns.
 * 
 * Reference: LatentMAS v2 Paper Section 3.3 - Dynamic Alignment Mechanism
 */

export interface MLPConfig {
  inputDim: number;
  outputDim: number;
  hiddenDims: number[]; // Hidden layer dimensions
  activation: 'relu' | 'tanh' | 'sigmoid' | 'gelu';
  dropout?: number;
  learningRate?: number;
}

export interface MLPWeights {
  layers: {
    weights: number[][];
    biases: number[];
  }[];
}

export interface AlignmentResult {
  alignedVector: number[];
  confidence: number;
  alignmentLoss: number;
  transformationPath: string[];
}

/**
 * Multi-Layer Perceptron for non-linear vector transformation
 */
export class MLPAlignmentHead {
  private config: MLPConfig;
  private weights: MLPWeights;
  private initialized: boolean = false;

  constructor(config: MLPConfig) {
    this.config = {
      ...config,
      dropout: config.dropout ?? 0.1,
      learningRate: config.learningRate ?? 0.001,
    };
    this.weights = this.initializeWeights();
    this.initialized = true;
  }

  /**
   * Initialize MLP weights using Xavier initialization
   */
  private initializeWeights(): MLPWeights {
    const layers: MLPWeights['layers'] = [];
    const dims = [
      this.config.inputDim,
      ...this.config.hiddenDims,
      this.config.outputDim,
    ];

    for (let i = 0; i < dims.length - 1; i++) {
      const inputSize = dims[i];
      const outputSize = dims[i + 1];

      // Xavier initialization
      const scale = Math.sqrt(2.0 / (inputSize + outputSize));
      const weights: number[][] = [];

      for (let j = 0; j < outputSize; j++) {
        const row: number[] = [];
        for (let k = 0; k < inputSize; k++) {
          row.push((Math.random() * 2 - 1) * scale);
        }
        weights.push(row);
      }

      const biases = Array(outputSize).fill(0);
      layers.push({ weights, biases });
    }

    return { layers };
  }

  /**
   * Activation functions
   */
  private activate(x: number, type: MLPConfig['activation']): number {
    switch (type) {
      case 'relu':
        return Math.max(0, x);
      case 'tanh':
        return Math.tanh(x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'gelu':
        // Approximation of GELU
        return (
          0.5 *
          x *
          (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)))
        );
      default:
        return x;
    }
  }

  /**
   * Forward pass through MLP
   */
  forward(input: number[]): number[] {
    if (input.length !== this.config.inputDim) {
      throw new Error(
        `Input dimension mismatch: expected ${this.config.inputDim}, got ${input.length}`
      );
    }

    let activation = [...input];

    // Pass through each layer
    for (let i = 0; i < this.weights.layers.length; i++) {
      const layer = this.weights.layers[i];
      const nextActivation: number[] = [];

      // Matrix multiplication + bias
      for (let j = 0; j < layer.weights.length; j++) {
        let sum = layer.biases[j];
        for (let k = 0; k < activation.length; k++) {
          sum += layer.weights[j][k] * activation[k];
        }

        // Apply activation (except last layer)
        if (i < this.weights.layers.length - 1) {
          sum = this.activate(sum, this.config.activation);
        }

        nextActivation.push(sum);
      }

      activation = nextActivation;
    }

    return activation;
  }

  /**
   * Calculate alignment confidence based on output distribution
   */
  private calculateConfidence(output: number[]): number {
    // Use entropy as confidence measure (lower entropy = higher confidence)
    const sum = output.reduce((a, b) => a + Math.abs(b), 0);
    if (sum === 0) return 0;

    const probs = output.map((x) => Math.abs(x) / sum);
    const entropy = -probs.reduce((acc, p) => {
      if (p === 0) return acc;
      return acc + p * Math.log2(p);
    }, 0);

    const maxEntropy = Math.log2(output.length);
    return 1 - entropy / maxEntropy;
  }

  /**
   * Align vector using MLP transformation
   */
  align(input: number[]): AlignmentResult {
    const alignedVector = this.forward(input);
    const confidence = this.calculateConfidence(alignedVector);

    // Calculate alignment loss (MSE between input and output norms)
    const inputNorm = Math.sqrt(
      input.reduce((sum, x) => sum + x * x, 0)
    );
    const outputNorm = Math.sqrt(
      alignedVector.reduce((sum, x) => sum + x * x, 0)
    );
    const alignmentLoss = Math.abs(inputNorm - outputNorm) / inputNorm;

    const transformationPath = [
      `Input(${this.config.inputDim})`,
      ...this.config.hiddenDims.map((d) => `Hidden(${d})`),
      `Output(${this.config.outputDim})`,
    ];

    return {
      alignedVector,
      confidence,
      alignmentLoss,
      transformationPath,
    };
  }

  /**
   * Get MLP architecture summary
   */
  getArchitecture(): string {
    const dims = [
      this.config.inputDim,
      ...this.config.hiddenDims,
      this.config.outputDim,
    ];
    return dims.join(' → ');
  }

  /**
   * Export weights for serialization
   */
  exportWeights(): MLPWeights {
    return JSON.parse(JSON.stringify(this.weights));
  }

  /**
   * Import weights from serialized format
   */
  importWeights(weights: MLPWeights): void {
    // Validate dimensions
    if (weights.layers.length !== this.weights.layers.length) {
      throw new Error('Weight structure mismatch');
    }
    this.weights = JSON.parse(JSON.stringify(weights));
  }
}

/**
 * Dynamic W-Matrix that adapts to different model architectures
 */
export class DynamicWMatrix {
  private mlpHead: MLPAlignmentHead;
  private sourceModel: string;
  private targetModel: string;
  private version: string;

  constructor(
    sourceModel: string,
    targetModel: string,
    sourceDim: number,
    targetDim: number,
    version: string = '2.0'
  ) {
    this.sourceModel = sourceModel;
    this.targetModel = targetModel;
    this.version = version;

    // Create MLP with adaptive hidden layers
    const hiddenDims = this.calculateHiddenDims(sourceDim, targetDim);

    this.mlpHead = new MLPAlignmentHead({
      inputDim: sourceDim,
      outputDim: targetDim,
      hiddenDims,
      activation: 'gelu', // GELU works well for transformer-based models
      dropout: 0.1,
      learningRate: 0.001,
    });
  }

  /**
   * Calculate optimal hidden layer dimensions
   */
  private calculateHiddenDims(sourceDim: number, targetDim: number): number[] {
    const avgDim = Math.floor((sourceDim + targetDim) / 2);

    if (Math.abs(sourceDim - targetDim) < 1000) {
      // Small dimension gap: single hidden layer
      return [avgDim];
    } else {
      // Large dimension gap: two hidden layers for smoother transition
      const mid1 = Math.floor((sourceDim + avgDim) / 2);
      const mid2 = Math.floor((avgDim + targetDim) / 2);
      return [mid1, mid2];
    }
  }

  /**
   * Align vector from source to target model space
   */
  align(sourceVector: number[]): AlignmentResult {
    return this.mlpHead.align(sourceVector);
  }

  /**
   * Batch alignment for multiple vectors
   */
  alignBatch(sourceVectors: number[][]): AlignmentResult[] {
    return sourceVectors.map((v) => this.align(v));
  }

  /**
   * Get W-Matrix metadata
   */
  getMetadata(): {
    sourceModel: string;
    targetModel: string;
    version: string;
    architecture: string;
  } {
    return {
      sourceModel: this.sourceModel,
      targetModel: this.targetModel,
      version: this.version,
      architecture: this.mlpHead.getArchitecture(),
    };
  }

  /**
   * Serialize W-Matrix for storage
   */
  serialize(): string {
    return JSON.stringify({
      sourceModel: this.sourceModel,
      targetModel: this.targetModel,
      version: this.version,
      weights: this.mlpHead.exportWeights(),
    });
  }

  /**
   * Deserialize W-Matrix from storage
   */
  static deserialize(data: string): DynamicWMatrix {
    const parsed = JSON.parse(data);
    const matrix = new DynamicWMatrix(
      parsed.sourceModel,
      parsed.targetModel,
      parsed.weights.layers[0].weights[0].length,
      parsed.weights.layers[parsed.weights.layers.length - 1].weights.length,
      parsed.version
    );
    matrix.mlpHead.importWeights(parsed.weights);
    return matrix;
  }
}

/**
 * Factory function for creating dynamic W-Matrix
 */
export function createDynamicWMatrix(
  sourceModel: string,
  targetModel: string,
  sourceDim: number,
  targetDim: number
): DynamicWMatrix {
  return new DynamicWMatrix(sourceModel, targetModel, sourceDim, targetDim);
}

/**
 * Utility: Calculate alignment quality metrics
 */
export function calculateAlignmentQuality(
  sourceVector: number[],
  alignedVector: number[]
): {
  cosineSimilarity: number;
  euclideanDistance: number;
  normRatio: number;
} {
  // Cosine similarity
  let dotProduct = 0;
  let sourceNorm = 0;
  let alignedNorm = 0;

  const minLen = Math.min(sourceVector.length, alignedVector.length);

  for (let i = 0; i < minLen; i++) {
    dotProduct += sourceVector[i] * alignedVector[i];
    sourceNorm += sourceVector[i] * sourceVector[i];
    alignedNorm += alignedVector[i] * alignedVector[i];
  }

  sourceNorm = Math.sqrt(sourceNorm);
  alignedNorm = Math.sqrt(alignedNorm);

  const cosineSimilarity =
    sourceNorm > 0 && alignedNorm > 0
      ? dotProduct / (sourceNorm * alignedNorm)
      : 0;

  // Euclidean distance (normalized)
  let sumSquares = 0;
  for (let i = 0; i < minLen; i++) {
    const diff = sourceVector[i] - alignedVector[i];
    sumSquares += diff * diff;
  }
  const euclideanDistance = Math.sqrt(sumSquares) / minLen;

  // Norm ratio
  const normRatio = alignedNorm / sourceNorm;

  return {
    cosineSimilarity,
    euclideanDistance,
    normRatio,
  };
}
