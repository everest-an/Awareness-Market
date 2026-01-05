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
 */

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
 * Uses Jacobi algorithm for small matrices (<100x100)
 * For larger matrices, consider using a library like ml-matrix
 */
export function computeSVD(W: number[][]): SVDResult {
  const m = W.length; // rows
  const n = W[0].length; // columns
  
  if (m === 0 || n === 0) {
    throw new Error('Matrix dimensions must be positive');
  }
  
  // For production, use a robust SVD library
  // Here we implement a simplified version for demonstration
  
  // Step 1: Compute W^T * W
  const WTW = matrixMultiply(transpose(W), W);
  
  // Step 2: Compute eigenvalues and eigenvectors of W^T * W
  const { eigenvalues, eigenvectors } = computeEigen(WTW);
  
  // Step 3: Singular values are sqrt(eigenvalues)
  const S = eigenvalues.map(lambda => Math.sqrt(Math.max(0, lambda)));
  
  // Step 4: V = eigenvectors
  const V = eigenvectors;
  
  // Step 5: Compute U = W * V * Σ^{-1}
  const U = computeU(W, V, S);
  
  return { U, S, V };
}

/**
 * Compute U = W * V * Σ^{-1}
 */
function computeU(W: number[][], V: number[][], S: number[]): number[][] {
  const m = W.length;
  const n = V.length;
  const U: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        if (S[j] > 1e-10) { // Avoid division by zero
          sum += W[i][k] * V[k][j] / S[j];
        }
      }
      U[i][j] = sum;
    }
  }
  
  return U;
}

/**
 * Compute eigenvalues and eigenvectors using Power Iteration
 * (Simplified version - for production, use a robust library)
 */
function computeEigen(A: number[][]): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const n = A.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];
  
  // Make a copy of A for deflation
  const A_copy = A.map(row => [...row]);
  
  // Find top k eigenvalues/eigenvectors
  const k = Math.min(n, 10); // Limit to top 10
  
  for (let i = 0; i < k; i++) {
    const { value, vector } = powerIteration(A_copy, 100);
    eigenvalues.push(value);
    eigenvectors.push(vector);
    
    // Deflate matrix: A' = A - λ * v * v^T
    deflateMatrix(A_copy, value, vector);
  }
  
  // Pad with zeros if needed
  while (eigenvalues.length < n) {
    eigenvalues.push(0);
    eigenvectors.push(new Array(n).fill(0));
  }
  
  return { eigenvalues, eigenvectors: transpose(eigenvectors) };
}

/**
 * Power Iteration to find dominant eigenvalue/eigenvector
 */
function powerIteration(
  A: number[][],
  maxIter: number = 100,
  tolerance: number = 1e-6
): { value: number; vector: number[] } {
  const n = A.length;
  
  // Initialize with random vector
  let v = new Array(n).fill(0).map(() => Math.random());
  v = normalize(v);
  
  let lambda = 0;
  
  for (let iter = 0; iter < maxIter; iter++) {
    // v' = A * v
    const v_new = matrixVectorMultiply(A, v);
    
    // λ = v^T * A * v
    const lambda_new = dotProduct(v, v_new);
    
    // Normalize
    const v_normalized = normalize(v_new);
    
    // Check convergence
    if (Math.abs(lambda_new - lambda) < tolerance) {
      return { value: lambda_new, vector: v_normalized };
    }
    
    lambda = lambda_new;
    v = v_normalized;
  }
  
  return { value: lambda, vector: v };
}

/**
 * Deflate matrix: A' = A - λ * v * v^T
 */
function deflateMatrix(A: number[][], lambda: number, v: number[]): void {
  const n = A.length;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] -= lambda * v[i] * v[j];
    }
  }
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
 * @param W - Input matrix (possibly non-orthogonal)
 * @returns Q - Closest orthogonal matrix
 */
export function procrustesOrthogonalize(W: number[][]): number[][] {
  // Compute SVD: W = U * Σ * V^T
  const { U, S, V } = computeSVD(W);
  
  // Procrustes solution: Q = U * V^T
  const Q = matrixMultiply(U, transpose(V));
  
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

/**
 * Test Procrustes orthogonalization
 */
export function testProcrustesOrthogonalization(): void {
  console.log('Testing Procrustes Orthogonalization...\n');
  
  // Test 1: Small matrix
  const W1 = [
    [1.1, 0.2, 0.1],
    [0.2, 0.9, 0.1],
    [0.1, 0.1, 1.0],
  ];
  
  console.log('Test 1: 3x3 matrix');
  console.log('Original orthogonality score:', computeOrthogonalityScore(W1).toFixed(6));
  
  const Q1 = procrustesOrthogonalize(W1);
  console.log('After Procrustes:', computeOrthogonalityScore(Q1).toFixed(6));
  console.log('Is orthogonal?', isOrthogonal(Q1, 1e-3));
  console.log();
  
  // Test 2: Larger matrix
  const W2 = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => Math.random() * 2 - 1)
  );
  
  console.log('Test 2: 5x5 random matrix');
  console.log('Original orthogonality score:', computeOrthogonalityScore(W2).toFixed(6));
  
  const Q2 = procrustesOrthogonalize(W2);
  console.log('After Procrustes:', computeOrthogonalityScore(Q2).toFixed(6));
  console.log('Is orthogonal?', isOrthogonal(Q2, 1e-2));
  console.log();
  
  // Test 3: Soft constraint
  console.log('Test 3: Soft constraint (alpha=0.5)');
  const W3 = [[2, 0], [0, 2]];
  const Q3 = applySoftProcrustesConstraint(W3, 0.5);
  console.log('Original:', W3);
  console.log('After soft constraint:', Q3);
  console.log('Orthogonality score:', computeOrthogonalityScore(Q3).toFixed(6));
}

// Run test if executed directly
// Note: In ESM, use import.meta.url instead of require.main
// if (import.meta.url === `file://${process.argv[1]}`) {
//   testProcrustesOrthogonalization();
// }
