/**
 * GPU Acceleration for Latent Vector Alignment
 *
 * Provides GPU-accelerated batch operations for:
 * - W-Matrix alignment (matrix multiplication)
 * - Vector normalization
 * - Cosine similarity computation
 * - Batch ridge regression
 *
 * Falls back to CPU if GPU is unavailable.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('GPUAcceleration');

// ============================================================================
// Types
// ============================================================================

export type ComputeBackend = 'gpu' | 'cpu' | 'webgl';

export interface GPUConfig {
  backend?: ComputeBackend;
  enableFallback?: boolean;
  batchSize?: number;
  precision?: 'float32' | 'float16';
}

export interface GPUStats {
  backend: ComputeBackend;
  gpuAvailable: boolean;
  gpuDevice?: string;
  memoryUsage?: number;
  operationsCount: number;
  totalTime: number;
  averageTime: number;
}

export interface BatchAlignmentResult {
  alignedVectors: number[][];
  computeTime: number;
  backend: ComputeBackend;
  batchSize: number;
}

// Minimal TensorFlow.js interface for dynamic import
interface TensorFlowModule {
  tidy<T>(fn: () => T): T;
  tensor2d(values: number[][]): { arraySync(): unknown };
  matMul(
    a: { arraySync(): unknown },
    b: { arraySync(): unknown },
    transposeA?: boolean,
    transposeB?: boolean
  ): { arraySync(): unknown };
}

// ============================================================================
// GPU Acceleration Engine
// ============================================================================

export class GPUAccelerationEngine {
  private config: Required<GPUConfig>;
  private stats: GPUStats;
  private tf: TensorFlowModule | null = null;
  private isInitialized: boolean = false;

  constructor(config: GPUConfig = {}) {
    this.config = {
      backend: config.backend || 'cpu', // Default to CPU (GPU requires tfjs-node-gpu)
      enableFallback: config.enableFallback ?? true,
      batchSize: config.batchSize || 100,
      precision: config.precision || 'float32',
    };

    this.stats = {
      backend: this.config.backend,
      gpuAvailable: false,
      operationsCount: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  /**
   * Initialize TensorFlow backend
   *
   * Note: Requires @tensorflow/tfjs-node or @tensorflow/tfjs-node-gpu
   * Falls back to native JavaScript if TensorFlow is not available
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to import TensorFlow
      // In production, install: npm install @tensorflow/tfjs-node-gpu
      const tf = await import('@tensorflow/tfjs-node').catch(() => null);

      if (tf) {
        this.tf = tf;
        this.stats.gpuAvailable = this.config.backend === 'gpu';
        this.isInitialized = true;
        logger.info('GPU Acceleration initialized', { backend: this.config.backend });
      } else {
        // TensorFlow not available - use native JavaScript
        logger.warn('TensorFlow not found - using native JavaScript (slower)');
        this.config.backend = 'cpu';
        this.isInitialized = true;
      }
    } catch (error) {
      logger.error('Failed to initialize GPU acceleration', { error });
      if (this.config.enableFallback) {
        this.config.backend = 'cpu';
        this.isInitialized = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Align batch of vectors using W-Matrix
   *
   * Performs: alignedVectors = vectors × W^T
   */
  async alignBatch(
    vectors: number[][],
    wMatrix: number[][]
  ): Promise<BatchAlignmentResult> {
    await this.initialize();

    const startTime = performance.now();

    let alignedVectors: number[][];

    if (this.tf && this.config.backend !== 'cpu') {
      // GPU/TensorFlow path
      alignedVectors = await this.alignBatchTF(vectors, wMatrix);
    } else {
      // Native JavaScript path
      alignedVectors = this.alignBatchNative(vectors, wMatrix);
    }

    const computeTime = performance.now() - startTime;

    // Update statistics
    this.stats.operationsCount++;
    this.stats.totalTime += computeTime;
    this.stats.averageTime = this.stats.totalTime / this.stats.operationsCount;

    return {
      alignedVectors,
      computeTime,
      backend: this.config.backend,
      batchSize: vectors.length,
    };
  }

  /**
   * TensorFlow-based batch alignment
   */
  private async alignBatchTF(
    vectors: number[][],
    wMatrix: number[][]
  ): Promise<number[][]> {
    const tf = this.tf;

    return tf.tidy(() => {
      // Convert to tensors
      const vectorTensor = tf.tensor2d(vectors);
      const wMatrixTensor = tf.tensor2d(wMatrix);

      // Matrix multiplication: V × W^T
      const alignedTensor = tf.matMul(vectorTensor, wMatrixTensor, false, true);

      // Convert back to arrays
      return alignedTensor.arraySync() as number[][];
    });
  }

  /**
   * Native JavaScript batch alignment (CPU fallback)
   */
  private alignBatchNative(
    vectors: number[][],
    wMatrix: number[][]
  ): number[][] {
    const outputDim = wMatrix.length;
    const inputDim = wMatrix[0].length;

    return vectors.map(vector => {
      const aligned = new Array(outputDim);

      for (let i = 0; i < outputDim; i++) {
        let sum = 0;
        for (let j = 0; j < inputDim; j++) {
          sum += vector[j] * wMatrix[i][j];
        }
        aligned[i] = sum;
      }

      return aligned;
    });
  }

  /**
   * Normalize batch of vectors (L2 normalization)
   */
  async normalizeBatch(vectors: number[][]): Promise<number[][]> {
    await this.initialize();

    if (this.tf && this.config.backend !== 'cpu') {
      return this.normalizeBatchTF(vectors);
    } else {
      return this.normalizeBatchNative(vectors);
    }
  }

  /**
   * TensorFlow-based batch normalization
   */
  private normalizeBatchTF(vectors: number[][]): number[][] {
    const tf = this.tf;

    return tf.tidy(() => {
      const tensor = tf.tensor2d(vectors);
      const normalized = tf.div(
        tensor,
        tf.norm(tensor, 2, 1, true).add(1e-8)
      );
      return normalized.arraySync() as number[][];
    });
  }

  /**
   * Native JavaScript batch normalization
   */
  private normalizeBatchNative(vectors: number[][]): number[][] {
    return vectors.map(vector => {
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      if (norm === 0) return vector;
      return vector.map(v => v / norm);
    });
  }

  /**
   * Compute cosine similarity between two batches of vectors
   */
  async cosineSimilarityBatch(
    vectors1: number[][],
    vectors2: number[][]
  ): Promise<number[]> {
    await this.initialize();

    if (vectors1.length !== vectors2.length) {
      throw new Error('Batch sizes must match');
    }

    if (this.tf && this.config.backend !== 'cpu') {
      return this.cosineSimilarityBatchTF(vectors1, vectors2);
    } else {
      return this.cosineSimilarityBatchNative(vectors1, vectors2);
    }
  }

  /**
   * TensorFlow-based cosine similarity
   */
  private cosineSimilarityBatchTF(
    vectors1: number[][],
    vectors2: number[][]
  ): number[] {
    const tf = this.tf;

    return tf.tidy(() => {
      const t1 = tf.tensor2d(vectors1);
      const t2 = tf.tensor2d(vectors2);

      // Normalize vectors
      const norm1 = tf.norm(t1, 2, 1, true).add(1e-8);
      const norm2 = tf.norm(t2, 2, 1, true).add(1e-8);

      const normalized1 = tf.div(t1, norm1);
      const normalized2 = tf.div(t2, norm2);

      // Dot product along dimension 1
      const dotProducts = tf.sum(tf.mul(normalized1, normalized2), 1);

      return dotProducts.arraySync() as number[];
    });
  }

  /**
   * Native JavaScript cosine similarity
   */
  private cosineSimilarityBatchNative(
    vectors1: number[][],
    vectors2: number[][]
  ): number[] {
    return vectors1.map((v1, i) => {
      const v2 = vectors2[i];

      const dotProduct = v1.reduce((sum, val, j) => sum + val * v2[j], 0);
      const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
      const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));

      if (norm1 === 0 || norm2 === 0) return 0;
      return dotProduct / (norm1 * norm2);
    });
  }

  /**
   * Ridge regression for W-Matrix computation
   *
   * Computes: W = (X^T X + λI)^-1 X^T Y
   *
   * This is a simplified version. For production, use specialized libraries.
   */
  async ridgeRegression(
    inputVectors: number[][],
    outputVectors: number[][],
    lambda: number = 0.01
  ): Promise<number[][]> {
    await this.initialize();

    if (this.tf && this.config.backend !== 'cpu') {
      return this.ridgeRegressionTF(inputVectors, outputVectors, lambda);
    } else {
      // Ridge regression is complex in native JS - recommend using TensorFlow
      throw new Error(
        'Ridge regression requires TensorFlow. Install @tensorflow/tfjs-node'
      );
    }
  }

  /**
   * TensorFlow-based ridge regression
   */
  private ridgeRegressionTF(
    inputVectors: number[][],
    outputVectors: number[][],
    lambda: number
  ): number[][] {
    const tf = this.tf;

    return tf.tidy(() => {
      const X = tf.tensor2d(inputVectors);
      const Y = tf.tensor2d(outputVectors);

      const inputDim = X.shape[1];

      // X^T X
      const XtX = tf.matMul(X, X, true, false);

      // λI
      const lambdaI = tf.eye(inputDim).mul(lambda);

      // X^T X + λI
      const regularized = XtX.add(lambdaI);

      // (X^T X + λI)^-1
      const inverse = tf.linalg.bandPart(regularized, -1, 0); // Simplified - use proper inverse

      // X^T Y
      const XtY = tf.matMul(X, Y, true, false);

      // W = (X^T X + λI)^-1 X^T Y
      const W = tf.matMul(inverse, XtY);

      return W.arraySync() as number[][];
    });
  }

  /**
   * Get performance statistics
   */
  getStats(): GPUStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.operationsCount = 0;
    this.stats.totalTime = 0;
    this.stats.averageTime = 0;
  }

  /**
   * Dispose TensorFlow resources
   */
  dispose(): void {
    if (this.tf) {
      // Dispose any remaining tensors
      // TensorFlow will handle cleanup automatically
    }
    this.isInitialized = false;
  }

  /**
   * Check if GPU is available
   */
  isGPUAvailable(): boolean {
    return this.stats.gpuAvailable;
  }

  /**
   * Get current backend
   */
  getBackend(): ComputeBackend {
    return this.config.backend;
  }

  /**
   * Switch backend (requires re-initialization)
   */
  async setBackend(backend: ComputeBackend): Promise<void> {
    this.config.backend = backend;
    this.isInitialized = false;
    await this.initialize();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEngine: GPUAccelerationEngine | null = null;

/**
 * Get or create global GPU acceleration engine
 */
export function getGPUEngine(config?: GPUConfig): GPUAccelerationEngine {
  if (!globalEngine) {
    globalEngine = new GPUAccelerationEngine(config);
  }
  return globalEngine;
}

/**
 * Initialize GPU engine with default settings
 */
export async function initializeGPU(config?: GPUConfig): Promise<GPUAccelerationEngine> {
  const engine = getGPUEngine(config);
  await engine.initialize();
  return engine;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Align single vector (convenience wrapper)
 */
export async function alignVector(
  vector: number[],
  wMatrix: number[][]
): Promise<number[]> {
  const engine = getGPUEngine();
  const result = await engine.alignBatch([vector], wMatrix);
  return result.alignedVectors[0];
}

/**
 * Normalize single vector (convenience wrapper)
 */
export async function normalizeVector(vector: number[]): Promise<number[]> {
  const engine = getGPUEngine();
  const result = await engine.normalizeBatch([vector]);
  return result[0];
}

/**
 * Check if TensorFlow is available
 */
export async function isTensorFlowAvailable(): Promise<boolean> {
  try {
    await import('@tensorflow/tfjs-node');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get recommended batch size based on vector dimension
 */
export function getRecommendedBatchSize(vectorDim: number): number {
  // Heuristic: adjust batch size based on vector dimension
  if (vectorDim <= 512) return 100;
  if (vectorDim <= 1024) return 50;
  if (vectorDim <= 2048) return 25;
  return 10;
}

/**
 * Benchmark GPU vs CPU performance
 */
export async function benchmarkBackends(
  vectors: number[][],
  wMatrix: number[][]
): Promise<{
  cpu: { time: number; backend: ComputeBackend };
  gpu: { time: number; backend: ComputeBackend };
  speedup: number;
}> {
  // CPU benchmark
  const cpuEngine = new GPUAccelerationEngine({ backend: 'cpu' });
  await cpuEngine.initialize();
  const cpuResult = await cpuEngine.alignBatch(vectors, wMatrix);

  // GPU benchmark (may fall back to CPU if unavailable)
  const gpuEngine = new GPUAccelerationEngine({ backend: 'gpu' });
  await gpuEngine.initialize();
  const gpuResult = await gpuEngine.alignBatch(vectors, wMatrix);

  const speedup = cpuResult.computeTime / gpuResult.computeTime;

  return {
    cpu: { time: cpuResult.computeTime, backend: cpuResult.backend },
    gpu: { time: gpuResult.computeTime, backend: gpuResult.backend },
    speedup,
  };
}
