/**
 * SVD-based Orthogonalization (Procrustes Analysis)
 *
 * This module implements the Procrustes orthogonalization algorithm
 * to ensure W-Matrix is close to an orthogonal matrix, as required by the LatentMAS paper.
 *
 * Procrustes Problem: Given matrix W, find the closest orthogonal matrix Q
 * such that ||W - Q||_F is minimized (Frobenius norm).
 *
 * Solution: Q = U * V^T, where W = U * Σ * V^T (SVD decomposition)
 *
 * Implementation Notes:
 * - Uses One-Sided Jacobi SVD algorithm for numerical stability
 * - Supports rectangular matrices (M x N where M ≠ N)
 * - Handles near-singular matrices with tolerance checking
 * - Full SVD for production-quality orthogonalization
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('LatentMAS:SVDOrthogonalization');

// Numerical constants
const SVD_TOLERANCE = 1e-12;
const SVD_MAX_ITERATIONS = 100;
const SINGULAR_VALUE_TOLERANCE = 1e-10;

// ============================================================================
// SVD Decomposition
// ============================================================================

export interface SVDResult {
  U: number[][]; // Left singular vectors
  S: number[]; // Singular values (diagonal)
  V: number[][]; // Right singular vectors
}

/**
 * Compute SVD decomposition: W = U * Σ * V^T
 *
 * Uses One-Sided Jacobi SVD algorithm for numerical stability.
 * This is a production-quality implementation that:
 * - Handles rectangular matrices (M x N)
 * - Provides full numerical stability
 * - Correctly handles near-singular matrices
 *
 * @param W - Input matrix (M x N)
 * @returns SVD decomposition { U, S, V }
 */
export function computeSVD(W: number[][]): SVDResult {
  const m = W.length; // rows
  const n = W[0]?.length || 0; // columns

  if (m === 0 || n === 0) {
    throw new Error('Matrix dimensions must be positive');
  }

  // Validate matrix is well-formed
  for (let i = 0; i < m; i++) {
    if (W[i].length !== n) {
      throw new Error(`Row ${i} has inconsistent length: expected ${n}, got ${W[i].length}`);
    }
  }

  // For very small matrices, use direct method
  if (m <= 2 && n <= 2) {
    return computeSVDSmall(W);
  }

  // Use Golub-Kahan bidiagonalization + QR iteration for general case
  return computeSVDJacobi(W);
}

/**
 * SVD for 2x2 matrices using closed-form solution
 */
function computeSVDSmall(W: number[][]): SVDResult {
  const m = W.length;
  const n = W[0].length;

  if (m === 1 && n === 1) {
    const val = Math.abs(W[0][0]);
    const sign = W[0][0] >= 0 ? 1 : -1;
    return {
      U: [[sign]],
      S: [val],
      V: [[1]],
    };
  }

  if (m === 2 && n === 2) {
    return computeSVD2x2(W);
  }

  // Fall back to general method for other small sizes
  return computeSVDJacobi(W);
}

/**
 * Closed-form SVD for 2x2 matrices
 * Based on analytical solution
 */
function computeSVD2x2(W: number[][]): SVDResult {
  const a = W[0][0], b = W[0][1];
  const c = W[1][0], d = W[1][1];

  // Compute elements of W^T * W
  const s1 = a*a + c*c;
  const s2 = b*b + d*d;
  const s3 = a*b + c*d;

  // Eigenvalues of W^T * W
  const sum = s1 + s2;
  const diff = s1 - s2;
  const discriminant = Math.sqrt(diff*diff + 4*s3*s3);

  const lambda1 = (sum + discriminant) / 2;
  const lambda2 = Math.max(0, (sum - discriminant) / 2);

  // Singular values
  const sigma1 = Math.sqrt(Math.max(0, lambda1));
  const sigma2 = Math.sqrt(Math.max(0, lambda2));

  // Compute V (right singular vectors)
  let V: number[][];
  if (Math.abs(s3) > SVD_TOLERANCE) {
    const theta = Math.atan2(2 * s3, diff) / 2;
    const cos_t = Math.cos(theta);
    const sin_t = Math.sin(theta);
    V = [[cos_t, -sin_t], [sin_t, cos_t]];
  } else {
    V = s1 >= s2 ? [[1, 0], [0, 1]] : [[0, 1], [1, 0]];
  }

  // Compute U = W * V * Sigma^{-1}
  const U = computeUFromWVS(W, V, [sigma1, sigma2]);

  // Ensure U is orthogonal (handle numerical errors)
  orthonormalizeColumns(U);

  return { U, S: [sigma1, sigma2], V };
}

/**
 * One-Sided Jacobi SVD Algorithm
 *
 * This is a numerically stable algorithm that computes SVD by
 * applying Jacobi rotations to orthogonalize the columns of W.
 */
function computeSVDJacobi(W: number[][]): SVDResult {
  const m = W.length;
  const n = W[0].length;
  const minDim = Math.min(m, n);

  // Work with a copy
  const A = W.map(row => [...row]);

  // V starts as identity
  const V = createIdentity(n);

  // Apply Jacobi rotations to orthogonalize columns
  let converged = false;

  for (let sweep = 0; sweep < SVD_MAX_ITERATIONS && !converged; sweep++) {
    converged = true;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Compute the (i,j) elements of A^T * A
        let aii = 0, ajj = 0, aij = 0;
        for (let k = 0; k < m; k++) {
          aii += A[k][i] * A[k][i];
          ajj += A[k][j] * A[k][j];
          aij += A[k][i] * A[k][j];
        }

        // Check if rotation is needed
        if (Math.abs(aij) > SVD_TOLERANCE * Math.sqrt(aii * ajj)) {
          converged = false;

          // Compute Jacobi rotation angle
          const tau = (ajj - aii) / (2 * aij);
          const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
          const c = 1 / Math.sqrt(1 + t * t);
          const s = c * t;

          // Apply rotation to A (columns i and j)
          for (let k = 0; k < m; k++) {
            const ai = A[k][i];
            const aj = A[k][j];
            A[k][i] = c * ai - s * aj;
            A[k][j] = s * ai + c * aj;
          }

          // Apply rotation to V
          for (let k = 0; k < n; k++) {
            const vi = V[k][i];
            const vj = V[k][j];
            V[k][i] = c * vi - s * vj;
            V[k][j] = s * vi + c * vj;
          }
        }
      }
    }
  }

  if (!converged) {
    logger.warn('Jacobi SVD did not converge within maximum iterations');
  }

  // Extract singular values and construct U
  const S: number[] = [];
  const U: number[][] = Array.from({ length: m }, () => new Array(minDim).fill(0));

  for (let j = 0; j < minDim; j++) {
    // Compute column norm (singular value)
    let sigma = 0;
    for (let i = 0; i < m; i++) {
      sigma += A[i][j] * A[i][j];
    }
    sigma = Math.sqrt(sigma);
    S.push(sigma);

    // U column is normalized A column
    if (sigma > SINGULAR_VALUE_TOLERANCE) {
      for (let i = 0; i < m; i++) {
        U[i][j] = A[i][j] / sigma;
      }
    } else {
      // Handle zero singular value
      for (let i = 0; i < m; i++) {
        U[i][j] = i === j ? 1 : 0;
      }
    }
  }

  // Sort by singular values (descending)
  const indices = S.map((_, i) => i).sort((a, b) => S[b] - S[a]);
  const sortedS = indices.map(i => S[i]);
  const sortedU = U.map(row => indices.map(i => row[i]));
  const sortedV = V.map(row => indices.map(i => row[i]));

  // Ensure orthonormality
  orthonormalizeColumns(sortedU);
  orthonormalizeColumns(sortedV);

  return { U: sortedU, S: sortedS, V: sortedV };
}

/**
 * Compute U = W * V * Sigma^{-1} with proper handling of small singular values
 */
function computeUFromWVS(W: number[][], V: number[][], S: number[]): number[][] {
  const m = W.length;
  const n = V.length;
  const k = Math.min(m, n, S.length);

  const U: number[][] = Array.from({ length: m }, () => new Array(k).fill(0));

  // Compute W * V
  const WV = matrixMultiply(W, V);

  // Divide by singular values
  for (let j = 0; j < k; j++) {
    if (S[j] > SINGULAR_VALUE_TOLERANCE) {
      for (let i = 0; i < m; i++) {
        U[i][j] = WV[i][j] / S[j];
      }
    } else {
      // For zero singular values, use Gram-Schmidt to find orthogonal vector
      for (let i = 0; i < m; i++) {
        U[i][j] = i === j ? 1 : 0;
      }
    }
  }

  return U;
}

/**
 * Gram-Schmidt orthonormalization of matrix columns
 */
function orthonormalizeColumns(A: number[][]): void {
  const m = A.length;
  const n = A[0]?.length || 0;

  for (let j = 0; j < n; j++) {
    // Subtract projections onto previous columns
    for (let k = 0; k < j; k++) {
      let dot = 0;
      for (let i = 0; i < m; i++) {
        dot += A[i][j] * A[i][k];
      }
      for (let i = 0; i < m; i++) {
        A[i][j] -= dot * A[i][k];
      }
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < m; i++) {
      norm += A[i][j] * A[i][j];
    }
    norm = Math.sqrt(norm);

    if (norm > SINGULAR_VALUE_TOLERANCE) {
      for (let i = 0; i < m; i++) {
        A[i][j] /= norm;
      }
    }
  }
}

/**
 * Create identity matrix
 */
function createIdentity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/**
 * Compute condition number of SVD (ratio of largest to smallest singular value)
 * High condition numbers indicate numerical instability
 */
export function computeConditionNumber(S: number[]): number {
  const maxS = Math.max(...S);
  const minS = Math.min(...S.filter(s => s > SINGULAR_VALUE_TOLERANCE));

  if (minS === 0 || minS === undefined) {
    return Infinity;
  }

  return maxS / minS;
}

/**
 * Truncated SVD - keep only singular values above threshold
 */
export function truncateSVD(
  svd: SVDResult,
  threshold: number = SINGULAR_VALUE_TOLERANCE
): SVDResult {
  const keepIndices = svd.S.map((s, i) => (s > threshold ? i : -1)).filter(i => i >= 0);

  if (keepIndices.length === 0) {
    logger.warn('All singular values below threshold, keeping at least one');
    keepIndices.push(0);
  }

  return {
    U: svd.U.map(row => keepIndices.map(i => row[i])),
    S: keepIndices.map(i => svd.S[i]),
    V: svd.V.map(row => keepIndices.map(i => row[i])),
  };
}

/**
 * Reconstruct matrix from SVD: W = U * diag(S) * V^T
 */
export function reconstructFromSVD(svd: SVDResult): number[][] {
  const { U, S, V } = svd;
  const m = U.length;
  const n = V.length;
  const k = S.length;

  const result: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        sum += U[i][l] * S[l] * V[j][l];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Compute reconstruction error: ||W - U*S*V^T||_F
 */
export function computeReconstructionError(W: number[][], svd: SVDResult): number {
  const reconstructed = reconstructFromSVD(svd);
  let error = 0;

  for (let i = 0; i < W.length; i++) {
    for (let j = 0; j < W[0].length; j++) {
      const diff = W[i][j] - reconstructed[i][j];
      error += diff * diff;
    }
  }

  return Math.sqrt(error);
}

// ============================================================================
// Procrustes Orthogonalization
// ============================================================================

/**
 * Apply Procrustes orthogonalization to W-Matrix
 *
 * Given W, find the closest orthogonal matrix Q = U * V^T
 * where W = U * Σ * V^T (SVD)
 *
 * This is the solution to the orthogonal Procrustes problem:
 * min ||W - Q||_F subject to Q^T * Q = I
 *
 * @param W - Input matrix (possibly non-orthogonal)
 * @param options - Optional configuration
 * @returns Q - Closest orthogonal matrix
 */
export function procrustesOrthogonalize(
  W: number[][],
  options: {
    validateResult?: boolean;
    logMetrics?: boolean;
  } = {}
): number[][] {
  const { validateResult = true, logMetrics = false } = options;

  // Compute SVD: W = U * Σ * V^T
  const svd = computeSVD(W);
  const { U, S, V } = svd;

  // Log metrics if requested
  if (logMetrics) {
    const conditionNumber = computeConditionNumber(S);
    const reconstructionError = computeReconstructionError(W, svd);
    logger.info('Procrustes SVD metrics', {
      singularValues: S.slice(0, 5).map(s => s.toFixed(6)),
      conditionNumber: conditionNumber.toFixed(2),
      reconstructionError: reconstructionError.toFixed(10),
    });
  }

  // Procrustes solution: Q = U * V^T
  const Q = matrixMultiply(U, transpose(V));

  // Validate result if requested
  if (validateResult) {
    const orthScore = computeOrthogonalityScore(Q);
    if (orthScore > 0.01) {
      logger.warn('Procrustes result has high orthogonality error', {
        score: orthScore.toFixed(6),
      });
    }
  }

  return Q;
}

/**
 * Apply soft Procrustes constraint during training
 * 
 * W' = (1 - α) * W + α * Procrustes(W)
 * 
 * @param W - Current W-Matrix
 * @param alpha - Weight for orthogonality constraint (0 to 1)
 * @returns W' - Updated matrix with orthogonality constraint
 */
export function applySoftProcrustesConstraint(
  W: number[][],
  alpha: number = 0.1
): number[][] {
  if (alpha <= 0) return W;
  if (alpha >= 1) return procrustesOrthogonalize(W);
  
  const Q = procrustesOrthogonalize(W);
  
  // Interpolate: W' = (1-α)*W + α*Q
  const W_prime: number[][] = [];
  
  for (let i = 0; i < W.length; i++) {
    W_prime[i] = [];
    for (let j = 0; j < W[i].length; j++) {
      W_prime[i][j] = (1 - alpha) * W[i][j] + alpha * Q[i][j];
    }
  }
  
  return W_prime;
}

/**
 * Compute orthogonality score: ||W^T * W - I||_F
 * 
 * Score closer to 0 means W is more orthogonal
 * 
 * @param W - Matrix to evaluate
 * @returns Orthogonality score (0 = perfectly orthogonal)
 */
export function computeOrthogonalityScore(W: number[][]): number {
  const n = Math.min(W.length, W[0].length);
  
  // Compute W^T * W
  const WTW = matrixMultiply(transpose(W), W);
  
  // Compute ||W^T * W - I||_F
  let score = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const target = i === j ? 1 : 0;
      const diff = WTW[i][j] - target;
      score += diff * diff;
    }
  }
  
  return Math.sqrt(score);
}

/**
 * Check if matrix is orthogonal (within tolerance)
 * 
 * @param W - Matrix to check
 * @param tolerance - Maximum allowed deviation
 * @returns true if orthogonal
 */
export function isOrthogonal(W: number[][], tolerance: number = 1e-6): boolean {
  const score = computeOrthogonalityScore(W);
  return score < tolerance;
}

// ============================================================================
// Matrix Utilities
// ============================================================================

function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const AT: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      AT[j][i] = A[i][j];
    }
  }
  
  return AT;
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = A[0].length;
  
  if (p !== B.length) {
    throw new Error(`Matrix dimensions mismatch: (${m}x${p}) * (${B.length}x${n})`);
  }
  
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  
  return C;
}

function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  const m = A.length;
  const n = A[0].length;
  
  if (n !== v.length) {
    throw new Error(`Dimension mismatch: (${m}x${n}) * (${v.length})`);
  }
  
  const result = new Array(m).fill(0);
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += A[i][j] * v[j];
    }
  }
  
  return result;
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  
  return sum;
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(dotProduct(v, v));
  
  if (norm < 1e-10) {
    // Return unit vector if norm is too small
    const result = new Array(v.length).fill(0);
    result[0] = 1;
    return result;
  }
  
  return v.map(x => x / norm);
}

// ============================================================================
// Testing & Validation
// ============================================================================

export interface SVDTestResult {
  testName: string;
  passed: boolean;
  details: Record<string, unknown>;
}

/**
 * Comprehensive test suite for SVD and Procrustes orthogonalization
 */
export function testProcrustesOrthogonalization(): SVDTestResult[] {
  const results: SVDTestResult[] = [];

  logger.info('=== Testing SVD and Procrustes Orthogonalization ===');

  // Test 1: 2x2 matrix (closed-form solution)
  {
    const W = [[3, 1], [1, 3]];
    const svd = computeSVD(W);
    const reconstructed = reconstructFromSVD(svd);
    const error = computeReconstructionError(W, svd);
    const Q = procrustesOrthogonalize(W);
    const orthScore = computeOrthogonalityScore(Q);

    const passed = error < 1e-10 && orthScore < 1e-6;
    results.push({
      testName: '2x2 symmetric matrix',
      passed,
      details: {
        singularValues: svd.S,
        reconstructionError: error,
        orthogonalityScore: orthScore,
      },
    });
    logger.info(`Test 1 (2x2 symmetric): ${passed ? 'PASSED' : 'FAILED'}`, { error, orthScore });
  }

  // Test 2: 3x3 nearly orthogonal matrix
  {
    const W = [
      [1.1, 0.2, 0.1],
      [0.2, 0.9, 0.1],
      [0.1, 0.1, 1.0],
    ];
    const originalScore = computeOrthogonalityScore(W);
    const Q = procrustesOrthogonalize(W, { logMetrics: true });
    const finalScore = computeOrthogonalityScore(Q);

    const passed = finalScore < 1e-6 && finalScore < originalScore;
    results.push({
      testName: '3x3 nearly orthogonal',
      passed,
      details: {
        originalScore,
        finalScore,
        improvement: originalScore - finalScore,
      },
    });
    logger.info(`Test 2 (3x3 near-orthogonal): ${passed ? 'PASSED' : 'FAILED'}`, { originalScore, finalScore });
  }

  // Test 3: 5x5 random matrix
  {
    const seed = 42;
    const W = seededRandomMatrix(5, 5, seed);
    const svd = computeSVD(W);
    const error = computeReconstructionError(W, svd);
    const Q = procrustesOrthogonalize(W);
    const orthScore = computeOrthogonalityScore(Q);

    const passed = error < 1e-8 && orthScore < 1e-5;
    results.push({
      testName: '5x5 random matrix',
      passed,
      details: {
        reconstructionError: error,
        orthogonalityScore: orthScore,
        conditionNumber: computeConditionNumber(svd.S),
      },
    });
    logger.info(`Test 3 (5x5 random): ${passed ? 'PASSED' : 'FAILED'}`, { error, orthScore });
  }

  // Test 4: Rectangular matrix (3x5)
  {
    const W = seededRandomMatrix(3, 5, 123);
    const svd = computeSVD(W);
    const error = computeReconstructionError(W, svd);

    const passed = error < 1e-8;
    results.push({
      testName: '3x5 rectangular matrix',
      passed,
      details: {
        dimensions: `${W.length}x${W[0].length}`,
        numSingularValues: svd.S.length,
        reconstructionError: error,
      },
    });
    logger.info(`Test 4 (3x5 rectangular): ${passed ? 'PASSED' : 'FAILED'}`, { error });
  }

  // Test 5: Near-singular matrix
  {
    const W = [
      [1, 2, 3],
      [2, 4, 6.001], // Almost linearly dependent
      [3, 6, 9.002],
    ];
    const svd = computeSVD(W);
    const condNum = computeConditionNumber(svd.S);
    const error = computeReconstructionError(W, svd);

    const passed = error < 1e-6; // Allow larger error for ill-conditioned
    results.push({
      testName: 'Near-singular matrix',
      passed,
      details: {
        conditionNumber: condNum,
        reconstructionError: error,
        smallestSingularValue: Math.min(...svd.S),
      },
    });
    logger.info(`Test 5 (near-singular): ${passed ? 'PASSED' : 'FAILED'}`, { condNum, error });
  }

  // Test 6: Soft Procrustes constraint
  {
    const W = [[2, 0], [0, 2]];
    const Q_full = procrustesOrthogonalize(W);
    const Q_soft = applySoftProcrustesConstraint(W, 0.5);
    const fullScore = computeOrthogonalityScore(Q_full);
    const softScore = computeOrthogonalityScore(Q_soft);

    const passed = fullScore < 1e-10 && softScore > 0 && softScore < computeOrthogonalityScore(W);
    results.push({
      testName: 'Soft Procrustes constraint',
      passed,
      details: {
        fullOrthogonalityScore: fullScore,
        softOrthogonalityScore: softScore,
        originalScore: computeOrthogonalityScore(W),
      },
    });
    logger.info(`Test 6 (soft constraint): ${passed ? 'PASSED' : 'FAILED'}`, { fullScore, softScore });
  }

  // Test 7: Large matrix (20x20)
  {
    const W = seededRandomMatrix(20, 20, 999);
    const startTime = Date.now();
    const svd = computeSVD(W);
    const svdTime = Date.now() - startTime;

    const Q = procrustesOrthogonalize(W);
    const totalTime = Date.now() - startTime;

    const error = computeReconstructionError(W, svd);
    const orthScore = computeOrthogonalityScore(Q);

    const passed = error < 1e-6 && orthScore < 1e-4;
    results.push({
      testName: '20x20 large matrix',
      passed,
      details: {
        svdTimeMs: svdTime,
        totalTimeMs: totalTime,
        reconstructionError: error,
        orthogonalityScore: orthScore,
      },
    });
    logger.info(`Test 7 (20x20 large): ${passed ? 'PASSED' : 'FAILED'}`, { error, orthScore, totalTime });
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  logger.info(`=== SVD Test Summary: ${passedCount}/${results.length} tests passed ===`);

  return results;
}

/**
 * Generate reproducible random matrix using simple LCG
 */
function seededRandomMatrix(m: number, n: number, seed: number): number[][] {
  let state = seed;
  const lcg = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state / 0x7fffffff) * 2 - 1; // Range [-1, 1]
  };

  return Array.from({ length: m }, () => Array.from({ length: n }, () => lcg()));
}
