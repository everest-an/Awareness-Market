/**
 * Chain Package Builder
 *
 * Builds .chainpkg files containing:
 * - Reasoning Chain (multiple KV-Cache snapshots)
 * - W-Matrix (for cross-model transformation)
 * - Metadata
 * - Provenance
 */

import {
  BasePackageBuilder,
  type WMatrixData,
  type PackageMetadata,
  type PackageProvenance,
  type ValidationResult,
} from './base-package-builder';
import type { KVCache } from './types';
import {
  ChainVerificationEngine,
  type VerificationResult,
  type VerificationStatus,
} from './chain-verification';

// ============================================================================
// Chain Package Types
// ============================================================================

export interface ReasoningStep {
  stepIndex: number;
  description: string;
  kvSnapshot: KVCache;
  confidence?: number;
  timestamp?: string;
}

export interface ReasoningChainData {
  steps: ReasoningStep[];
  problemType: string;
  solutionQuality: number;
  totalSteps: number;
  initialContext?: string;
  finalOutput?: string;
}

export interface ChainPackageData {
  chain: ReasoningChainData;
  wMatrix: WMatrixData;
  metadata: PackageMetadata;
  provenance: PackageProvenance;
  verification?: VerificationResult; // Optional verification result
}

export interface ChainPackageFiles {
  'reasoning_chain/chain_metadata.json': Buffer;
  'reasoning_chain/step_*.json': Buffer; // Multiple files
  'w_matrix/weights.json': Buffer;
  'w_matrix/biases.json': Buffer;
  'w_matrix/config.json': Buffer;
  'metadata.json': Buffer;
  'provenance.json': Buffer;
}

// ============================================================================
// Chain Package Builder
// ============================================================================

export class ChainPackageBuilder extends BasePackageBuilder {
  private verificationEngine: ChainVerificationEngine;

  constructor() {
    super('chain');
    this.verificationEngine = new ChainVerificationEngine();
  }

  /**
   * Create a complete Chain Package with verification
   */
  async createPackage(
    data: ChainPackageData,
    options: {
      skipVerification?: boolean;
      strictVerification?: boolean;
    } = {}
  ): Promise<{
    packageBuffer: Buffer;
    packageUrl: string;
    chainUrl: string;
    wMatrixUrl: string;
    verification?: VerificationResult;
  }> {
    // Validate all components
    const chainValidation = this.validateChain(data.chain);
    if (!chainValidation.valid) {
      throw new Error(`Chain validation failed: ${chainValidation.errors.join(', ')}`);
    }

    // Perform automated verification unless skipped
    let verification: VerificationResult | undefined;
    if (!options.skipVerification) {
      if (options.strictVerification) {
        this.verificationEngine.updateConfig({
          minOverallScore: 0.8,
          minLogicalConsistency: 0.85,
          strictMode: true,
        });
      }

      verification = await this.verificationEngine.verifyChain(data.chain);

      // Reject package if verification fails
      if (verification.status === 'rejected') {
        throw new Error(
          `Chain verification failed (score: ${verification.overallScore.toFixed(2)}): ` +
          verification.errors.map(e => e.message).join('; ')
        );
      }

      // Store verification result in package data
      data.verification = verification;
    }

    const wMatrixValidation = this.validateWMatrix(data.wMatrix);
    if (!wMatrixValidation.valid) {
      throw new Error(`W-Matrix validation failed: ${wMatrixValidation.errors.join(', ')}`);
    }

    const metadataValidation = this.validateMetadata(data.metadata);
    if (!metadataValidation.valid) {
      throw new Error(`Metadata validation failed: ${metadataValidation.errors.join(', ')}`);
    }

    // Get package files
    const files = await this.getPackageFiles(data);

    // Pack into ZIP
    const packageBuffer = await this.packToZip(files);

    // Upload to S3
    const packageId = data.metadata.packageId;
    const packageUrl = await this.uploadToS3(packageId, packageBuffer, 'chainpkg');

    // Upload individual components
    const chainBuffer = Buffer.from(JSON.stringify({
      steps: data.chain.steps.map(step => ({
        stepIndex: step.stepIndex,
        description: step.description,
        confidence: step.confidence,
        timestamp: step.timestamp,
      })),
      problemType: data.chain.problemType,
      solutionQuality: data.chain.solutionQuality,
      totalSteps: data.chain.totalSteps,
      initialContext: data.chain.initialContext,
      finalOutput: data.chain.finalOutput,
    }));
    const chainUrl = await this.uploadFileToS3(
      packageId,
      'chain_summary.json',
      chainBuffer,
      'application/json'
    );

    const wMatrixBuffer = Buffer.from(this.serializeWMatrix(data.wMatrix));
    const wMatrixUrl = await this.uploadFileToS3(
      packageId,
      'w_matrix.json',
      wMatrixBuffer,
      'application/json'
    );

    return {
      packageBuffer,
      packageUrl,
      chainUrl,
      wMatrixUrl,
      verification,
    };
  }

  /**
   * Extract Chain Package from buffer
   */
  async extractPackage(buffer: Buffer): Promise<ChainPackageData> {
    const files = await this.unpackFromZip(buffer);
    return await this.extractPackageData(files);
  }

  // ========================================================================
  // Protected Methods (BasePackageBuilder implementation)
  // ========================================================================

  protected validatePackageData(data: ChainPackageData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate chain
    const chainValidation = this.validateChain(data.chain);
    errors.push(...chainValidation.errors);
    warnings.push(...chainValidation.warnings);

    // Validate W-Matrix
    const wMatrixValidation = this.validateWMatrix(data.wMatrix);
    errors.push(...wMatrixValidation.errors);
    warnings.push(...wMatrixValidation.warnings);

    // Validate metadata
    const metadataValidation = this.validateMetadata(data.metadata);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  protected async getPackageFiles(data: ChainPackageData): Promise<Record<string, Buffer>> {
    const files: Record<string, Buffer> = {};

    // Chain metadata
    files['reasoning_chain/chain_metadata.json'] = Buffer.from(JSON.stringify({
      problemType: data.chain.problemType,
      solutionQuality: data.chain.solutionQuality,
      totalSteps: data.chain.totalSteps,
      initialContext: data.chain.initialContext,
      finalOutput: data.chain.finalOutput,
    }, null, 2));

    // Individual step files
    for (const step of data.chain.steps) {
      const stepFileName = `reasoning_chain/step_${step.stepIndex.toString().padStart(3, '0')}.json`;
      files[stepFileName] = Buffer.from(JSON.stringify({
        stepIndex: step.stepIndex,
        description: step.description,
        kvSnapshot: step.kvSnapshot,
        confidence: step.confidence,
        timestamp: step.timestamp,
      }, null, 2));
    }

    // W-Matrix files
    files['w_matrix/weights.json'] = Buffer.from(JSON.stringify(data.wMatrix.weights, null, 2));
    files['w_matrix/biases.json'] = Buffer.from(JSON.stringify(data.wMatrix.biases, null, 2));
    files['w_matrix/config.json'] = Buffer.from(this.serializeWMatrix(data.wMatrix));

    // Metadata and provenance
    files['metadata.json'] = Buffer.from(this.serializeMetadata(data.metadata));
    files['provenance.json'] = Buffer.from(this.serializeProvenance(data.provenance));

    // Verification result (if exists)
    if (data.verification) {
      files['verification.json'] = Buffer.from(JSON.stringify(data.verification, null, 2));
    }

    return files;
  }

  protected async extractPackageData(files: Record<string, Buffer>): Promise<ChainPackageData> {
    // Extract chain metadata
    const chainMetadata = JSON.parse(files['reasoning_chain/chain_metadata.json'].toString());

    // Extract steps
    const steps: ReasoningStep[] = [];
    for (const [filename, buffer] of Object.entries(files)) {
      if (filename.startsWith('reasoning_chain/step_') && filename.endsWith('.json')) {
        const stepData = JSON.parse(buffer.toString());
        steps.push(stepData);
      }
    }

    // Sort steps by index
    steps.sort((a, b) => a.stepIndex - b.stepIndex);

    const chain: ReasoningChainData = {
      steps,
      problemType: chainMetadata.problemType,
      solutionQuality: chainMetadata.solutionQuality,
      totalSteps: chainMetadata.totalSteps,
      initialContext: chainMetadata.initialContext,
      finalOutput: chainMetadata.finalOutput,
    };

    // Extract W-Matrix
    const wMatrix = this.deserializeWMatrix(files['w_matrix/config.json'].toString());

    // Extract metadata and provenance
    const metadata = this.deserializeMetadata(files['metadata.json'].toString());
    const provenance = this.deserializeProvenance(files['provenance.json'].toString());

    // Extract verification result (if exists)
    const verification = files['verification.json']
      ? JSON.parse(files['verification.json'].toString())
      : undefined;

    return {
      chain,
      wMatrix,
      metadata,
      provenance,
      verification,
    };
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Validate reasoning chain
   */
  private validateChain(chain: ReasoningChainData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!chain.steps || !Array.isArray(chain.steps)) {
      errors.push('Chain steps must be an array');
      return { valid: false, errors, warnings };
    }

    if (chain.steps.length === 0) {
      errors.push('Chain must have at least one step');
      return { valid: false, errors, warnings };
    }

    if (chain.totalSteps !== chain.steps.length) {
      errors.push(`Total steps (${chain.totalSteps}) must match actual step count (${chain.steps.length})`);
    }

    // Check solution quality
    if (chain.solutionQuality < 0 || chain.solutionQuality > 1) {
      errors.push('Solution quality must be between 0 and 1');
    } else if (chain.solutionQuality < 0.5) {
      warnings.push(`Low solution quality (${chain.solutionQuality.toFixed(2)}) - consider improving the chain`);
    }

    // Validate each step
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];

      if (step.stepIndex !== i) {
        errors.push(`Step ${i}: index mismatch (expected ${i}, got ${step.stepIndex})`);
      }

      if (!step.description || step.description.length < 10) {
        warnings.push(`Step ${i}: description should be at least 10 characters`);
      }

      if (!step.kvSnapshot) {
        errors.push(`Step ${i}: missing KV snapshot`);
      } else {
        // Validate KV snapshot structure
        if (!step.kvSnapshot.keys || !Array.isArray(step.kvSnapshot.keys)) {
          errors.push(`Step ${i}: invalid KV snapshot keys`);
        }
        if (!step.kvSnapshot.values || !Array.isArray(step.kvSnapshot.values)) {
          errors.push(`Step ${i}: invalid KV snapshot values`);
        }
      }

      if (step.confidence !== undefined && (step.confidence < 0 || step.confidence > 1)) {
        warnings.push(`Step ${i}: confidence should be between 0 and 1`);
      }
    }

    // Check problem type
    if (!chain.problemType || chain.problemType.length === 0) {
      warnings.push('Problem type should be specified for better discoverability');
    }

    // Warnings for large chains
    if (chain.steps.length > 50) {
      warnings.push(`Large reasoning chain (${chain.steps.length} steps) - consider breaking into smaller chains`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Verify a reasoning chain independently
   */
  async verifyChainOnly(chain: ReasoningChainData): Promise<VerificationResult> {
    return await this.verificationEngine.verifyChain(chain);
  }

  /**
   * Verify with human review
   */
  async verifyChainWithHuman(
    chain: ReasoningChainData,
    humanReview: {
      approved: boolean;
      comments: string;
      verifierId: string;
    }
  ): Promise<VerificationResult> {
    return await this.verificationEngine.verifyWithHuman(chain, humanReview);
  }

  /**
   * Get verification engine configuration
   */
  getVerificationConfig() {
    return this.verificationEngine.getConfig();
  }

  /**
   * Update verification engine configuration
   */
  updateVerificationConfig(config: Partial<Parameters<ChainVerificationEngine['updateConfig']>[0]>) {
    this.verificationEngine.updateConfig(config);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a Chain Package from components with automatic verification
 */
export async function createChainPackage(
  chain: ReasoningChainData,
  wMatrix: WMatrixData,
  options: {
    name: string;
    description: string;
    version: string;
    creator: { id: number; name: string };
    trainingDataset: string;
    skipVerification?: boolean;
    strictVerification?: boolean;
  }
): Promise<{
  packageBuffer: Buffer;
  packageUrl: string;
  chainUrl: string;
  wMatrixUrl: string;
  packageId: string;
  verification?: VerificationResult;
}> {
  const builder = new ChainPackageBuilder();
  const packageId = builder['generatePackageId']();

  const metadata: PackageMetadata = {
    packageId,
    packageType: 'chain',
    name: options.name,
    description: options.description,
    version: options.version,
    createdAt: new Date().toISOString(),
    creator: options.creator,
  };

  const certificationLevel = builder['createCertification'](wMatrix);

  const provenance: PackageProvenance = {
    trainingDataset: options.trainingDataset,
    certificationLevel,
    qualityMetrics: {
      epsilon: wMatrix.epsilon,
      informationRetention: 1 - wMatrix.epsilon,
    },
  };

  const packageData: ChainPackageData = {
    chain,
    wMatrix,
    metadata,
    provenance,
  };

  const result = await builder.createPackage(packageData, {
    skipVerification: options.skipVerification,
    strictVerification: options.strictVerification,
  });

  return {
    ...result,
    packageId,
  };
}

/**
 * Extract a Chain Package
 */
export async function extractChainPackage(buffer: Buffer): Promise<ChainPackageData> {
  const builder = new ChainPackageBuilder();
  return await builder.extractPackage(buffer);
}
