/**
 * W-Matrix Standardized Distribution Protocol
 * 
 * Implements production-grade W-Matrix protocol with:
 * - Semantic versioning
 * - Model compatibility matrix
 * - Quality certification (based on epsilon)
 * - Integrity verification (SHA-256)
 * - CDN distribution
 * 
 * Reference: LatentMAS v2 Paper Section 3.3 - Dynamic Alignment Mechanism
 */

import crypto from 'crypto';

// ============================================================================
// Protocol Types
// ============================================================================

export type WMatrixStandard = '4096' | '8192' | '16384';
export type CertificationLevel = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AlignmentQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface WMatrixVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface ModelPair {
  sourceModel: string;
  targetModel: string;
  sourceDimension: number;
  targetDimension: number;
}

export interface QualityCertification {
  level: CertificationLevel;
  epsilon: number; // Alignment loss
  cosineSimilarity: number;
  euclideanDistance: number;
  testSamples: number;
  certifiedAt: Date;
  expiresAt: Date;
}

export interface WMatrixMetadata {
  // Identification
  id: string;
  version: WMatrixVersion;
  standard: WMatrixStandard;
  
  // Model compatibility
  modelPair: ModelPair;
  compatibleModels: string[];
  
  // Quality metrics
  certification: QualityCertification;
  qualityGrade: AlignmentQuality;
  
  // Distribution
  checksumSHA256: string;
  downloadUrl: string;
  cdnUrls: string[];
  sizeBytes: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  description?: string;
  tags: string[];
}

export interface WMatrixProtocol {
  metadata: WMatrixMetadata;
  weights: number[][];
  biases?: number[];
  config: {
    inputDim: number;
    outputDim: number;
    hiddenDims?: number[];
    activation?: string;
  };
}

// ============================================================================
// Quality Certification System
// ============================================================================

export class QualityCertifier {
  /**
   * Determine certification level based on epsilon (alignment loss)
   */
  static getCertificationLevel(epsilon: number): CertificationLevel {
    if (epsilon <= 0.01) return 'platinum'; // < 1% loss
    if (epsilon <= 0.05) return 'gold';     // < 5% loss
    if (epsilon <= 0.10) return 'silver';   // < 10% loss
    return 'bronze';                         // > 10% loss
  }
  
  /**
   * Determine quality grade
   */
  static getQualityGrade(epsilon: number): AlignmentQuality {
    if (epsilon <= 0.02) return 'excellent';
    if (epsilon <= 0.05) return 'good';
    if (epsilon <= 0.10) return 'fair';
    return 'poor';
  }
  
  /**
   * Create quality certification
   */
  static createCertification(
    epsilon: number,
    cosineSimilarity: number,
    euclideanDistance: number,
    testSamples: number
  ): QualityCertification {
    const level = this.getCertificationLevel(epsilon);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Valid for 1 year
    
    return {
      level,
      epsilon,
      cosineSimilarity,
      euclideanDistance,
      testSamples,
      certifiedAt: now,
      expiresAt,
    };
  }
  
  /**
   * Check if certification is still valid
   */
  static isValid(certification: QualityCertification): boolean {
    return new Date() < certification.expiresAt;
  }
  
  /**
   * Get certification expiry status
   */
  static getExpiryStatus(certification: QualityCertification): {
    isValid: boolean;
    daysRemaining: number;
    status: 'active' | 'expiring-soon' | 'expired';
  } {
    const now = new Date();
    const expiresAt = certification.expiresAt;
    const daysRemaining = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    let status: 'active' | 'expiring-soon' | 'expired';
    if (daysRemaining < 0) {
      status = 'expired';
    } else if (daysRemaining < 30) {
      status = 'expiring-soon';
    } else {
      status = 'active';
    }
    
    return {
      isValid: daysRemaining >= 0,
      daysRemaining: Math.max(0, daysRemaining),
      status,
    };
  }
}

// ============================================================================
// Version Management
// ============================================================================

export class WMatrixVersionManager {
  /**
   * Parse semantic version string
   */
  static parseVersion(versionString: string): WMatrixVersion {
    const parts = versionString.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`Invalid version string: ${versionString}`);
    }
    return {
      major: parts[0],
      minor: parts[1],
      patch: parts[2],
    };
  }
  
  /**
   * Format version to string
   */
  static formatVersion(version: WMatrixVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }
  
  /**
   * Compare two versions
   */
  static compareVersions(a: WMatrixVersion, b: WMatrixVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }
  
  /**
   * Check if version A is greater than version B
   */
  static isNewer(a: WMatrixVersion, b: WMatrixVersion): boolean {
    return this.compareVersions(a, b) > 0;
  }
  
  /**
   * Increment version
   */
  static incrementVersion(
    version: WMatrixVersion,
    type: 'major' | 'minor' | 'patch'
  ): WMatrixVersion {
    const newVersion = { ...version };
    
    switch (type) {
      case 'major':
        newVersion.major++;
        newVersion.minor = 0;
        newVersion.patch = 0;
        break;
      case 'minor':
        newVersion.minor++;
        newVersion.patch = 0;
        break;
      case 'patch':
        newVersion.patch++;
        break;
    }
    
    return newVersion;
  }
  
  /**
   * Check version compatibility
   */
  static isCompatible(
    required: WMatrixVersion,
    available: WMatrixVersion
  ): boolean {
    // Major version must match
    if (required.major !== available.major) return false;
    
    // Available minor version must be >= required
    if (available.minor < required.minor) return false;
    
    // If minor versions match, patch must be >= required
    if (available.minor === required.minor && available.patch < required.patch) {
      return false;
    }
    
    return true;
  }
}

// ============================================================================
// Integrity Verification
// ============================================================================

export class IntegrityVerifier {
  /**
   * Calculate SHA-256 checksum of W-Matrix data
   */
  static calculateChecksum(data: string | Buffer): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }
  
  /**
   * Verify W-Matrix integrity
   */
  static verifyIntegrity(
    data: string | Buffer,
    expectedChecksum: string
  ): boolean {
    const actualChecksum = this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }
  
  /**
   * Generate integrity report
   */
  static generateIntegrityReport(
    data: string | Buffer,
    expectedChecksum: string
  ): {
    valid: boolean;
    actualChecksum: string;
    expectedChecksum: string;
    sizeBytes: number;
  } {
    const actualChecksum = this.calculateChecksum(data);
    const sizeBytes = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    
    return {
      valid: actualChecksum === expectedChecksum,
      actualChecksum,
      expectedChecksum,
      sizeBytes,
    };
  }
}

// ============================================================================
// Model Compatibility Matrix
// ============================================================================

export interface CompatibilityEntry {
  sourceModel: string;
  targetModel: string;
  wMatrixId: string;
  version: WMatrixVersion;
  certification: CertificationLevel;
  epsilon: number;
  available: boolean;
}

export class ModelCompatibilityMatrix {
  private matrix: Map<string, CompatibilityEntry[]> = new Map();
  
  /**
   * Add compatibility entry
   */
  addEntry(entry: CompatibilityEntry): void {
    const key = this.getKey(entry.sourceModel, entry.targetModel);
    const entries = this.matrix.get(key) || [];
    entries.push(entry);
    
    // Sort by version (newest first)
    entries.sort((a, b) => 
      WMatrixVersionManager.compareVersions(b.version, a.version)
    );
    
    this.matrix.set(key, entries);
  }
  
  /**
   * Get compatible W-Matrices for model pair
   */
  getCompatibleMatrices(
    sourceModel: string,
    targetModel: string
  ): CompatibilityEntry[] {
    const key = this.getKey(sourceModel, targetModel);
    return this.matrix.get(key) || [];
  }
  
  /**
   * Get best W-Matrix for model pair
   */
  getBestMatrix(
    sourceModel: string,
    targetModel: string,
    minCertification?: CertificationLevel
  ): CompatibilityEntry | null {
    const entries = this.getCompatibleMatrices(sourceModel, targetModel);
    
    if (minCertification) {
      const certLevels: CertificationLevel[] = ['bronze', 'silver', 'gold', 'platinum'];
      const minLevel = certLevels.indexOf(minCertification);
      
      const filtered = entries.filter(e => 
        certLevels.indexOf(e.certification) >= minLevel && e.available
      );
      
      return filtered[0] || null;
    }
    
    return entries.find(e => e.available) || null;
  }
  
  /**
   * Get all supported source models
   */
  getSupportedSourceModels(): string[] {
    const models = new Set<string>();
    for (const entries of this.matrix.values()) {
      entries.forEach(e => models.add(e.sourceModel));
    }
    return Array.from(models).sort();
  }
  
  /**
   * Get all supported target models for a source
   */
  getSupportedTargetModels(sourceModel: string): string[] {
    const models = new Set<string>();
    for (const [key, entries] of this.matrix.entries()) {
      if (entries.some(e => e.sourceModel === sourceModel)) {
        entries.forEach(e => models.add(e.targetModel));
      }
    }
    return Array.from(models).sort();
  }
  
  /**
   * Get compatibility statistics
   */
  getStatistics(): {
    totalEntries: number;
    uniqueSourceModels: number;
    uniqueTargetModels: number;
    certificationDistribution: Record<CertificationLevel, number>;
    avgEpsilon: number;
  } {
    let totalEntries = 0;
    const sourceModels = new Set<string>();
    const targetModels = new Set<string>();
    const certDist: Record<CertificationLevel, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };
    let totalEpsilon = 0;
    
    for (const entries of this.matrix.values()) {
      totalEntries += entries.length;
      entries.forEach(e => {
        sourceModels.add(e.sourceModel);
        targetModels.add(e.targetModel);
        certDist[e.certification]++;
        totalEpsilon += e.epsilon;
      });
    }
    
    return {
      totalEntries,
      uniqueSourceModels: sourceModels.size,
      uniqueTargetModels: targetModels.size,
      certificationDistribution: certDist,
      avgEpsilon: totalEntries > 0 ? totalEpsilon / totalEntries : 0,
    };
  }
  
  private getKey(sourceModel: string, targetModel: string): string {
    return `${sourceModel}→${targetModel}`;
  }
}

// ============================================================================
// W-Matrix Protocol Builder
// ============================================================================

export class WMatrixProtocolBuilder {
  private metadata: Partial<WMatrixMetadata> = {};
  private weights: number[][] = [];
  private biases?: number[];
  private config: WMatrixProtocol['config'] = {
    inputDim: 0,
    outputDim: 0,
  };
  
  setVersion(version: string | WMatrixVersion): this {
    this.metadata.version = typeof version === 'string'
      ? WMatrixVersionManager.parseVersion(version)
      : version;
    return this;
  }
  
  setStandard(standard: WMatrixStandard): this {
    this.metadata.standard = standard;
    return this;
  }
  
  setModelPair(modelPair: ModelPair): this {
    this.metadata.modelPair = modelPair;
    this.config.inputDim = modelPair.sourceDimension;
    this.config.outputDim = modelPair.targetDimension;
    return this;
  }
  
  setWeights(weights: number[][], biases?: number[]): this {
    this.weights = weights;
    this.biases = biases;
    return this;
  }
  
  setCertification(certification: QualityCertification): this {
    this.metadata.certification = certification;
    this.metadata.qualityGrade = QualityCertifier.getQualityGrade(certification.epsilon);
    return this;
  }
  
  setDistribution(downloadUrl: string, cdnUrls: string[]): this {
    this.metadata.downloadUrl = downloadUrl;
    this.metadata.cdnUrls = cdnUrls;
    return this;
  }
  
  setMetadata(data: Partial<WMatrixMetadata>): this {
    Object.assign(this.metadata, data);
    return this;
  }
  
  build(): WMatrixProtocol {
    // Validate required fields
    if (!this.metadata.version) throw new Error('Version is required');
    if (!this.metadata.standard) throw new Error('Standard is required');
    if (!this.metadata.modelPair) throw new Error('Model pair is required');
    if (!this.metadata.certification) throw new Error('Certification is required');
    if (this.weights.length === 0) throw new Error('Weights are required');
    
    // Calculate checksum
    const dataStr = JSON.stringify({ weights: this.weights, biases: this.biases });
    const checksum = IntegrityVerifier.calculateChecksum(dataStr);
    const sizeBytes = Buffer.byteLength(dataStr);
    
    // Build metadata
    const now = new Date();
    const metadata: WMatrixMetadata = {
      id: this.metadata.id || crypto.randomUUID(),
      version: this.metadata.version,
      standard: this.metadata.standard,
      modelPair: this.metadata.modelPair,
      compatibleModels: this.metadata.compatibleModels || [],
      certification: this.metadata.certification,
      qualityGrade: this.metadata.qualityGrade || 'fair',
      checksumSHA256: checksum,
      downloadUrl: this.metadata.downloadUrl || '',
      cdnUrls: this.metadata.cdnUrls || [],
      sizeBytes,
      createdAt: this.metadata.createdAt || now,
      updatedAt: now,
      createdBy: this.metadata.createdBy || 'system',
      description: this.metadata.description,
      tags: this.metadata.tags || [],
    };
    
    return {
      metadata,
      weights: this.weights,
      biases: this.biases,
      config: this.config,
    };
  }
}

// All types and classes are already exported above
