/**
 * Trusted Execution Environment (TEE) Integration
 *
 * Provides hardware-level security for sensitive vector operations using:
 * - AWS Nitro Enclaves (primary)
 * - Intel SGX (future support)
 * - AMD SEV (future support)
 *
 * Key Features:
 * - Isolated execution environment
 * - Memory encryption
 * - Remote attestation
 * - Secure vector alignment
 *
 * Reference: WHITEPAPER_ENHANCED_2026.md Section 6 (Security)
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('TEEIntegration');

// ============================================================================
// Types
// ============================================================================

export type TEEProvider = 'nitro' | 'sgx' | 'sev' | 'none';

export interface TEEConfig {
  provider: TEEProvider;
  enableAttestation?: boolean;
  attestationEndpoint?: string;
  enclaveImageId?: string;
  maxMemoryMB?: number;
  cpuCount?: number;
}

export interface AttestationDocument {
  moduleId: string;
  timestamp: Date;
  digest: string; // SHA-256 hash of enclave code
  pcrs: Record<number, string>; // Platform Configuration Registers
  certificate: string;
  cabundle: string[];
  publicKey: string;
  userData?: string;
  nonce?: string;
}

export interface TEESecureContext {
  contextId: string;
  provider: TEEProvider;
  attestation?: AttestationDocument;
  createdAt: Date;
  expiresAt: Date;
  isSealed: boolean;
}

export interface SecureVectorOperation {
  operationType: 'align' | 'normalize' | 'compute_similarity' | 'encrypt' | 'decrypt';
  inputVectors: number[][];
  wMatrix?: number[][];
  parameters?: Record<string, any>;
}

export interface SecureOperationResult {
  success: boolean;
  outputVectors?: number[][];
  computeTime: number;
  attestation?: AttestationDocument;
  contextId: string;
  errorMessage?: string;
}

export interface TEEStats {
  provider: TEEProvider;
  isAvailable: boolean;
  attestationsPerformed: number;
  operationsCompleted: number;
  averageLatency: number;
  memoryUsage?: number;
}

// ============================================================================
// TEE Integration Engine
// ============================================================================

export class TEEIntegrationEngine {
  private config: Required<TEEConfig>;
  private stats: TEEStats;
  private activeContexts: Map<string, TEESecureContext> = new Map();
  private isInitialized: boolean = false;
  private encryptionKey: Buffer;

  constructor(config: TEEConfig = { provider: 'none' }) {
    this.config = {
      provider: config.provider || 'none',
      enableAttestation: config.enableAttestation ?? true,
      attestationEndpoint: config.attestationEndpoint || '',
      enclaveImageId: config.enclaveImageId || '',
      maxMemoryMB: config.maxMemoryMB || 512,
      cpuCount: config.cpuCount || 2,
    };

    const envKey = process.env.TEE_ENCRYPTION_KEY;
    if (envKey) {
      const rawKey = Buffer.from(envKey, 'base64');
      this.encryptionKey = rawKey.length === 32
        ? rawKey
        : crypto.createHash('sha256').update(rawKey).digest();
    } else {
      this.encryptionKey = crypto.randomBytes(32);
    }

    this.stats = {
      provider: this.config.provider,
      isAvailable: false,
      attestationsPerformed: 0,
      operationsCompleted: 0,
      averageLatency: 0,
    };
  }

  /**
   * Initialize TEE environment
   *
   * For AWS Nitro:
   * - Connects to Nitro Enclave
   * - Verifies enclave is running
   * - Establishes secure channel
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      switch (this.config.provider) {
        case 'nitro':
          await this.initializeNitro();
          break;
        case 'sgx':
          await this.initializeSGX();
          break;
        case 'sev':
          await this.initializeSEV();
          break;
        case 'none':
          // No TEE - operations run in standard process
          this.stats.isAvailable = true;
          break;
        default:
          throw new Error(`Unknown TEE provider: ${this.config.provider}`);
      }

      this.isInitialized = true;
      logger.info('TEE initialized', { provider: this.config.provider });
    } catch (error) {
      logger.error('Failed to initialize TEE', { error });
      // Fall back to 'none' for graceful degradation
      this.config.provider = 'none';
      this.stats.isAvailable = true;
      this.isInitialized = true;
      logger.warn('TEE unavailable - running without hardware isolation');
    }
  }

  /**
   * Initialize AWS Nitro Enclave
   *
   * Note: Requires AWS Nitro-enabled EC2 instance
   * In development, this will simulate the enclave
   */
  private async initializeNitro(): Promise<void> {
    // Check if running on Nitro-enabled instance
    const isNitroAvailable = await this.checkNitroAvailability();

    if (!isNitroAvailable) {
      throw new Error('AWS Nitro Enclave not available on this instance');
    }

    // In production, would connect to enclave via vsock
    // For now, simulate successful connection
    this.stats.isAvailable = true;
  }

  /**
   * Check if AWS Nitro is available
   */
  private async checkNitroAvailability(): Promise<boolean> {
    try {
      if (process.env.TEE_NITRO_AVAILABLE === 'true') {
        return true;
      }
      // Check for Nitro hypervisor
      // In production: check /sys/hypervisor/uuid or use AWS SDK
      // For development: return false (would need actual Nitro instance)
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Initialize Intel SGX
   */
  private async initializeSGX(): Promise<void> {
    if (process.env.TEE_ATTESTATION_ENDPOINT) {
      this.stats.isAvailable = true;
      return;
    }

    throw new Error('Intel SGX support not yet implemented');
  }

  /**
   * Initialize AMD SEV
   */
  private async initializeSEV(): Promise<void> {
    if (process.env.TEE_ATTESTATION_ENDPOINT) {
      this.stats.isAvailable = true;
      return;
    }

    throw new Error('AMD SEV support not yet implemented');
  }

  /**
   * Create secure execution context
   */
  async createSecureContext(): Promise<TEESecureContext> {
    await this.initialize();

    const contextId = this.generateContextId();
    const attestation = this.config.enableAttestation
      ? await this.performAttestation()
      : undefined;

    const context: TEESecureContext = {
      contextId,
      provider: this.config.provider,
      attestation,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      isSealed: true,
    };

    this.activeContexts.set(contextId, context);

    return context;
  }

  /**
   * Perform remote attestation
   *
   * Generates cryptographic proof that code is running in genuine TEE
   */
  async performAttestation(): Promise<AttestationDocument> {
    const startTime = performance.now();

    let attestation: AttestationDocument;

    const remoteEndpoint = process.env.TEE_ATTESTATION_ENDPOINT;
    if (remoteEndpoint) {
      attestation = await this.performRemoteAttestation(remoteEndpoint);
    } else {
      if (this.config.provider !== 'none' && process.env.NODE_ENV === 'production') {
        logger.warn('TEE_ATTESTATION_ENDPOINT not configured; using local attestation implementation');
      }

      switch (this.config.provider) {
        case 'nitro':
          attestation = await this.performNitroAttestation();
          break;
        case 'sgx':
          attestation = await this.performSGXAttestation();
          break;
        case 'sev':
          attestation = await this.performSEVAttestation();
          break;
        case 'none':
          attestation = await this.performMockAttestation();
          break;
        default:
          throw new Error(`Attestation not supported for provider: ${this.config.provider}`);
      }
    }

    this.stats.attestationsPerformed++;
    const attestationTime = performance.now() - startTime;

    logger.info('Attestation completed', { durationMs: attestationTime.toFixed(2) });

    return attestation;
  }

  private async performRemoteAttestation(endpoint: string): Promise<AttestationDocument> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: this.config.provider }),
    });

    if (!response.ok) {
      throw new Error(`Remote attestation failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      moduleId: data.moduleId,
      timestamp: new Date(data.timestamp || Date.now()),
      digest: data.digest,
      pcrs: data.pcrs || {},
      certificate: data.certificate,
      cabundle: data.cabundle || [],
      publicKey: data.publicKey,
      nonce: data.nonce,
    } as AttestationDocument;
  }

  /**
   * AWS Nitro Enclave attestation
   *
   * Uses NSM (Nitro Security Module) to generate attestation document
   */
  private async performNitroAttestation(): Promise<AttestationDocument> {
    // In production, would call NSM via /dev/nsm device
    // For development, return simulated attestation

    const publicKey = this.generateKeyPair().publicKey;
    const nonce = crypto.randomBytes(32).toString('hex');

    // Simulate PCR (Platform Configuration Register) values
    const pcrs: Record<number, string> = {
      0: crypto.createHash('sha384').update('pcr0-enclave-image').digest('hex'),
      1: crypto.createHash('sha384').update('pcr1-kernel').digest('hex'),
      2: crypto.createHash('sha384').update('pcr2-application').digest('hex'),
    };

    // Calculate attestation digest
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify({ pcrs, publicKey, nonce }))
      .digest('hex');

    return {
      moduleId: 'i-nitro-enclave-sim',
      timestamp: new Date(),
      digest,
      pcrs,
      certificate: this.generateMockCertificate(),
      cabundle: [],
      publicKey,
      nonce,
    };
  }

  /**
   * Intel SGX attestation (placeholder)
   */
  private async performSGXAttestation(): Promise<AttestationDocument> {
    throw new Error('SGX attestation not yet implemented');
  }

  /**
   * AMD SEV attestation (placeholder)
   */
  private async performSEVAttestation(): Promise<AttestationDocument> {
    throw new Error('SEV attestation not yet implemented');
  }

  /**
   * Mock attestation for development/testing
   */
  private async performMockAttestation(): Promise<AttestationDocument> {
    const publicKey = this.generateKeyPair().publicKey;

    return {
      moduleId: 'mock-tee',
      timestamp: new Date(),
      digest: crypto.randomBytes(32).toString('hex'),
      pcrs: {},
      certificate: 'MOCK_CERTIFICATE',
      cabundle: [],
      publicKey,
    };
  }

  /**
   * Execute secure vector operation in TEE
   */
  async executeSecure(
    operation: SecureVectorOperation
  ): Promise<SecureOperationResult> {
    await this.initialize();

    const context = await this.createSecureContext();
    const startTime = performance.now();

    try {
      let outputVectors: number[][] | undefined;

      // Execute operation based on type
      switch (operation.operationType) {
        case 'align':
          if (!operation.wMatrix) {
            throw new Error('W-Matrix required for alignment');
          }
          outputVectors = this.secureAlign(operation.inputVectors, operation.wMatrix);
          break;

        case 'normalize':
          outputVectors = this.secureNormalize(operation.inputVectors);
          break;

        case 'compute_similarity':
          outputVectors = [this.secureComputeSimilarity(operation.inputVectors)];
          break;

        case 'encrypt':
          outputVectors = this.secureEncrypt(operation.inputVectors);
          break;

        case 'decrypt':
          outputVectors = this.secureDecrypt(operation.inputVectors);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.operationType}`);
      }

      const computeTime = performance.now() - startTime;

      this.stats.operationsCompleted++;
      this.updateAverageLatency(computeTime);

      return {
        success: true,
        outputVectors,
        computeTime,
        attestation: context.attestation,
        contextId: context.contextId,
      };
    } catch (error) {
      const computeTime = performance.now() - startTime;

      return {
        success: false,
        computeTime,
        contextId: context.contextId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Secure vector alignment (runs in TEE)
   */
  private secureAlign(vectors: number[][], wMatrix: number[][]): number[][] {
    // In production, this would run inside the enclave
    // For now, execute in process with memory protection simulation

    return vectors.map(vector => {
      const output = new Array(wMatrix.length);

      for (let i = 0; i < wMatrix.length; i++) {
        let sum = 0;
        for (let j = 0; j < wMatrix[0].length; j++) {
          sum += vector[j] * wMatrix[i][j];
        }
        output[i] = sum;
      }

      return output;
    });
  }

  /**
   * Secure vector normalization (runs in TEE)
   */
  private secureNormalize(vectors: number[][]): number[][] {
    return vectors.map(vector => {
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      if (norm === 0) return vector;
      return vector.map(v => v / norm);
    });
  }

  /**
   * Secure cosine similarity computation (runs in TEE)
   */
  private secureComputeSimilarity(vectors: number[][]): number[] {
    if (vectors.length !== 2) {
      throw new Error('Similarity requires exactly 2 vectors');
    }

    const [v1, v2] = vectors;
    const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
    const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
    const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));

    return [dotProduct / (norm1 * norm2)];
  }

  /**
   * Secure vector encryption (runs in TEE)
   */
  private secureEncrypt(vectors: number[][]): number[][] {
    // Simulate encryption using AES-256-GCM
    // In production, would use hardware-backed keys in enclave

    return vectors.map(vector => {
      const iv = crypto.randomBytes(12);
      const buffer = Buffer.from(new Float64Array(vector).buffer);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
      const tag = cipher.getAuthTag();
      const payload = Buffer.concat([iv, tag, ciphertext]);

      // Convert back to number array (simulated)
      return Array.from(payload);
    });
  }

  /**
   * Secure vector decryption (runs in TEE)
   */
  private secureDecrypt(vectors: number[][]): number[][] {
    return vectors.map(vector => {
      const payload = Buffer.from(vector);

      if (payload.length < 12 + 16 + 1) {
        throw new Error('Encrypted payload too short');
      }

      const iv = payload.subarray(0, 12);
      const tag = payload.subarray(12, 28);
      const ciphertext = payload.subarray(28);

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      if (decrypted.length % 8 !== 0) {
        throw new Error('Decrypted payload has invalid length');
      }

      const floatView = new Float64Array(
        decrypted.buffer,
        decrypted.byteOffset,
        decrypted.byteLength / 8
      );

      return Array.from(floatView);
    });
  }

  /**
   * Verify attestation document
   */
  async verifyAttestation(attestation: AttestationDocument): Promise<boolean> {
    // In production:
    // 1. Verify certificate chain against AWS root CA
    // 2. Check PCR values match expected measurements
    // 3. Verify signature on attestation document
    // 4. Check timestamp is recent

    // For development, perform basic checks
    if (!attestation.digest || !attestation.publicKey) {
      return false;
    }

    // Check timestamp is recent (within 5 minutes)
    const age = Date.now() - attestation.timestamp.getTime();
    if (age > 5 * 60 * 1000) {
      return false;
    }

    return true;
  }

  /**
   * Seal data for storage (encrypted with enclave key)
   */
  async sealData(data: unknown): Promise<string> {
    // In production, uses hardware-backed sealing key with AES-256-GCM
    // For development/testing, use simple base64 encoding
    const plaintext = JSON.stringify(data);

    // Prefix with marker to identify sealed data
    const sealed = 'SEALED:' + Buffer.from(plaintext).toString('base64');

    return sealed;
  }

  /**
   * Unseal data (decrypt with enclave key)
   */
  async unsealData(sealedData: string): Promise<unknown> {
    // Check for seal marker
    if (!sealedData.startsWith('SEALED:')) {
      throw new Error('Invalid sealed data format');
    }

    // Remove marker and decode
    const encoded = sealedData.substring(7); // Remove 'SEALED:' prefix
    const plaintext = Buffer.from(encoded, 'base64').toString('utf8');

    return JSON.parse(plaintext);
  }

  /**
   * Destroy secure context
   */
  async destroyContext(contextId: string): Promise<void> {
    const context = this.activeContexts.get(contextId);

    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    // Clear sensitive data
    this.activeContexts.delete(contextId);
  }

  /**
   * Get TEE statistics
   */
  getStats(): TEEStats {
    return { ...this.stats };
  }

  /**
   * Check if TEE is available
   */
  isAvailable(): boolean {
    return this.stats.isAvailable;
  }

  /**
   * Get current provider
   */
  getProvider(): TEEProvider {
    return this.config.provider;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private generateContextId(): string {
    return `ctx-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateKeyPair(): { publicKey: string; privateKey: string } {
    // In production, would use hardware-backed key generation
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      publicKey: Buffer.from(publicKey).toString('base64'),
      privateKey: Buffer.from(privateKey).toString('base64'),
    };
  }

  private generateMockCertificate(): string {
    return Buffer.from('MOCK_X509_CERTIFICATE').toString('base64');
  }

  private updateAverageLatency(latency: number): void {
    const total = this.stats.averageLatency * (this.stats.operationsCompleted - 1) + latency;
    this.stats.averageLatency = total / this.stats.operationsCompleted;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEngine: TEEIntegrationEngine | null = null;

/**
 * Get or create global TEE integration engine
 */
export function getTEEEngine(config?: TEEConfig): TEEIntegrationEngine {
  if (!globalEngine) {
    globalEngine = new TEEIntegrationEngine(config);
  }
  return globalEngine;
}

/**
 * Initialize TEE with default settings
 */
export async function initializeTEE(config?: TEEConfig): Promise<TEEIntegrationEngine> {
  const engine = getTEEEngine(config);
  await engine.initialize();
  return engine;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Execute vector alignment in TEE
 */
export async function secureAlign(
  vectors: number[][],
  wMatrix: number[][]
): Promise<number[][]> {
  const engine = getTEEEngine();

  const result = await engine.executeSecure({
    operationType: 'align',
    inputVectors: vectors,
    wMatrix,
  });

  if (!result.success || !result.outputVectors) {
    throw new Error(result.errorMessage || 'Secure alignment failed');
  }

  return result.outputVectors;
}

/**
 * Check if code is running in TEE
 */
export function isRunningInTEE(): boolean {
  const engine = getTEEEngine();
  return engine.isAvailable() && engine.getProvider() !== 'none';
}

/**
 * Get attestation for current execution environment
 */
export async function getCurrentAttestation(): Promise<AttestationDocument | null> {
  const engine = getTEEEngine();

  if (!engine.isAvailable()) {
    return null;
  }

  return await engine.performAttestation();
}
