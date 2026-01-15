/**
 * Storage Router
 * 
 * Automatically routes uploads to the most cost-effective backend
 * based on upload source, file size, and package type.
 * 
 * Routing Rules:
 * 1. AI Agent uploads → R2 (zero egress fees)
 * 2. Large files (>100MB) → B2 (cheapest storage)
 * 3. User uploads → S3 (high availability)
 * 4. Test uploads → Local/S3 (development)
 */

import { StorageBackend, UploadContext, StorageRoute } from './storage-backend';
import { S3Backend } from './s3-backend';
import { R2Backend } from './r2-backend';
import { B2Backend } from './b2-backend';
import { WasabiBackend } from './wasabi-backend';

export class StorageRouter {
  private backends: Map<string, StorageBackend>;
  private largeFileThreshold: number;

  constructor() {
    this.backends = new Map();
    
    // Initialize backends
    this.backends.set('s3', new S3Backend());
    
    // Only initialize R2 if credentials are provided
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
      this.backends.set('r2', new R2Backend());
    }
    
    // Only initialize B2 if credentials are provided
    if (process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY) {
      this.backends.set('b2', new B2Backend());
    }
    
    // Only initialize Wasabi if credentials are provided
    if (process.env.WASABI_ACCESS_KEY_ID && process.env.WASABI_SECRET_ACCESS_KEY) {
      this.backends.set('wasabi', new WasabiBackend());
    }

    // Large file threshold (default: 100MB)
    this.largeFileThreshold = parseInt(process.env.STORAGE_LARGE_FILE_THRESHOLD || '104857600');
  }

  /**
   * Route upload to appropriate backend
   */
  route(context: UploadContext): StorageRoute {
    const { uploadSource, fileSize, packageType, isTest } = context;

    // Rule 1: Test uploads → S3 (default)
    if (isTest || process.env.NODE_ENV === 'development') {
      return this.createRoute('s3', 'Development/test upload', fileSize);
    }

    // Rule 2: AI Agent uploads → R2 (if available)
    if (uploadSource === 'ai_agent' && this.backends.has('r2')) {
      return this.createRoute('r2', 'AI agent upload - zero egress fees', fileSize);
    }

    // Rule 3: Very large files (>500MB) → Wasabi (if available)
    const wasabiThreshold = parseInt(process.env.STORAGE_WASABI_THRESHOLD || '524288000'); // 500MB
    if (fileSize > wasabiThreshold && this.backends.has('wasabi')) {
      return this.createRoute('wasabi', `Very large file (${this.formatBytes(fileSize)}) - cheapest storage + free egress`, fileSize);
    }

    // Rule 4: Large files (>100MB) → B2 (if available)
    if (fileSize > this.largeFileThreshold && this.backends.has('b2')) {
      return this.createRoute('b2', `Large file (${this.formatBytes(fileSize)}) - cheap storage`, fileSize);
    }

    // Rule 5: User uploads → S3 (high availability)
    if (uploadSource === 'user') {
      return this.createRoute('s3', 'User upload - high availability', fileSize);
    }

    // Fallback: S3
    return this.createRoute('s3', 'Fallback to S3', fileSize);
  }

  /**
   * Get backend by name
   */
  getBackend(name: string): StorageBackend | undefined {
    return this.backends.get(name);
  }

  /**
   * Get all available backends
   */
  getAvailableBackends(): string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * Health check all backends
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, backend] of this.backends.entries()) {
      results[name] = await backend.healthCheck();
    }
    
    return results;
  }

  /**
   * Get cost comparison for a file
   */
  getCostComparison(fileSize: number, monthlyDownloads: number = 10): Array<{
    backend: string;
    storageCost: number;
    bandwidthCost: number;
    totalCost: number;
  }> {
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);
    const downloadGB = (fileSize * monthlyDownloads) / (1024 * 1024 * 1024);

    return Array.from(this.backends.entries()).map(([name, backend]) => {
      const metrics = backend.getCostMetrics();
      const storageCost = fileSizeGB * metrics.storageCostPerGB;
      const bandwidthCost = downloadGB * metrics.bandwidthCostPerGB;
      const totalCost = storageCost + bandwidthCost;

      return {
        backend: name,
        storageCost: parseFloat(storageCost.toFixed(4)),
        bandwidthCost: parseFloat(bandwidthCost.toFixed(4)),
        totalCost: parseFloat(totalCost.toFixed(4)),
      };
    }).sort((a, b) => a.totalCost - b.totalCost);
  }

  /**
   * Create storage route
   */
  private createRoute(backendName: string, reason: string, fileSize: number): StorageRoute {
    const backend = this.backends.get(backendName);
    
    if (!backend) {
      throw new Error(`Backend ${backendName} not available`);
    }

    // Estimate monthly cost (assuming 10 downloads per month)
    const comparison = this.getCostComparison(fileSize, 10);
    const selectedBackend = comparison.find(c => c.backend === backendName);
    const estimatedCost = selectedBackend?.totalCost || 0;

    return {
      backend,
      reason,
      estimatedCost,
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

// Singleton instance
let routerInstance: StorageRouter | null = null;

export function getStorageRouter(): StorageRouter {
  if (!routerInstance) {
    routerInstance = new StorageRouter();
  }
  return routerInstance;
}
