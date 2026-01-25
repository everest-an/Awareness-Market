/**
 * Alignment Service - Node.js wrapper for Python W-Matrix engine
 * 
 * Provides TypeScript interface to call Python alignment engine
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { randomBytes } from 'crypto';

export interface AlignmentResult {
  epsilon: number;
  fidelityScore: number;
  improvementPct: number;
  informationRetention: number;
  computationTimeMs: number;
  wMatrixVersion: string;
}

export interface WMatrixMetadata {
  version: string;
  standardDim: number;
  sourceModels: string[];
  alignmentPairsCount: number;
  avgReconstructionError: number;
}

/**
 * Call Python W-Matrix alignment engine
 */
export class AlignmentService {
  private pythonPath: string;
  private enginePath: string;
  
  constructor() {
    this.pythonPath = 'python3';
    this.enginePath = path.join(__dirname, 'w_matrix_engine.py');
  }
  
  /**
   * Compute alignment for a vector using existing W-matrix
   * 
   * @param vectorData - Latent vector data (base64 encoded numpy array or JSON array)
   * @param wMatrixVersion - W-matrix version to use
   * @returns Alignment metrics
   */
  async computeAlignment(
    vectorData: string,
    wMatrixVersion: string
  ): Promise<AlignmentResult> {
    // Create temporary files for input/output
    const tempDir = '/tmp/alignment';
    await fs.mkdir(tempDir, { recursive: true });
    
    const inputFile = path.join(tempDir, `input_${randomBytes(8).toString('hex')}.json`);
    const outputFile = path.join(tempDir, `output_${randomBytes(8).toString('hex')}.json`);
    
    try {
      // Write input data
      await fs.writeFile(inputFile, JSON.stringify({
        vector_data: vectorData,
        w_matrix_version: wMatrixVersion,
        action: 'compute_epsilon'
      }));
      
      // Call Python engine
      const result = await this.executePython([
        '--input', inputFile,
        '--output', outputFile
      ]);
      
      // Read output
      const outputData = await fs.readFile(outputFile, 'utf-8');
      const output = JSON.parse(outputData);
      
      return {
        epsilon: output.epsilon,
        fidelityScore: output.fidelity_score,
        improvementPct: output.improvement_pct,
        informationRetention: output.information_retention,
        computationTimeMs: output.computation_time_ms,
        wMatrixVersion
      };
    } finally {
      // Cleanup temp files
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
    }
  }
  
  /**
   * Train new W-matrix from anchor points
   * 
   * @param sourceVectors - Source latent vectors (N x D_source)
   * @param targetVectors - Target latent vectors (N x D_target)
   * @param standardDim - Target standard dimension (4096 or 8192)
   * @returns W-matrix metadata and serialized matrix
   */
  async trainWMatrix(
    sourceVectors: number[][],
    targetVectors: number[][],
    standardDim: 4096 | 8192,
    options?: {
      useLora?: boolean;
      loraRank?: number;
    }
  ): Promise<{
    metadata: WMatrixMetadata;
    serializedMatrix: string;
    metrics: AlignmentResult;
  }> {
    const tempDir = '/tmp/alignment';
    await fs.mkdir(tempDir, { recursive: true });
    
    const inputFile = path.join(tempDir, `train_input_${randomBytes(8).toString('hex')}.json`);
    const outputFile = path.join(tempDir, `train_output_${randomBytes(8).toString('hex')}.json`);
    
    try {
      // Write training data
      await fs.writeFile(inputFile, JSON.stringify({
        source_vectors: sourceVectors,
        target_vectors: targetVectors,
        standard_dim: standardDim,
        use_lora: options?.useLora ?? true,
        lora_rank: options?.loraRank ?? 64,
        action: 'train'
      }));
      
      // Call Python engine
      await this.executePython([
        '--input', inputFile,
        '--output', outputFile
      ]);
      
      // Read output
      const outputData = await fs.readFile(outputFile, 'utf-8');
      const output = JSON.parse(outputData);
      
      return {
        metadata: {
          version: output.version,
          standardDim: output.standard_dim,
          sourceModels: output.source_models || [],
          alignmentPairsCount: output.alignment_pairs_count,
          avgReconstructionError: output.avg_reconstruction_error
        },
        serializedMatrix: output.serialized_matrix,
        metrics: {
          epsilon: output.epsilon_final,
          fidelityScore: output.fidelity_score,
          improvementPct: output.improvement_pct,
          informationRetention: output.information_retention,
          computationTimeMs: output.computation_time_ms,
          wMatrixVersion: output.version
        }
      };
    } finally {
      // Cleanup
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
    }
  }
  
  /**
   * Transform vector using W-matrix
   * 
   * @param vectorData - Input vector
   * @param wMatrixVersion - W-matrix version to use
   * @returns Transformed vector
   */
  async transformVector(
    vectorData: number[],
    wMatrixVersion: string
  ): Promise<number[]> {
    const tempDir = '/tmp/alignment';
    await fs.mkdir(tempDir, { recursive: true });
    
    const inputFile = path.join(tempDir, `transform_input_${randomBytes(8).toString('hex')}.json`);
    const outputFile = path.join(tempDir, `transform_output_${randomBytes(8).toString('hex')}.json`);
    
    try {
      await fs.writeFile(inputFile, JSON.stringify({
        vector_data: vectorData,
        w_matrix_version: wMatrixVersion,
        action: 'transform'
      }));
      
      await this.executePython([
        '--input', inputFile,
        '--output', outputFile
      ]);
      
      const outputData = await fs.readFile(outputFile, 'utf-8');
      const output = JSON.parse(outputData);
      
      return output.transformed_vector;
    } finally {
      await fs.unlink(inputFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
    }
  }
  
  /**
   * Execute Python script with arguments
   */
  private executePython(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [this.enginePath, ...args]);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    });
  }
}

// Singleton instance
export const alignmentService = new AlignmentService();
