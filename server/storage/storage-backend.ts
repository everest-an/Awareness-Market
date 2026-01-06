/**
 * Storage Backend Interface
 * 
 * Defines a common interface for different storage providers:
 * - AWS S3 (current)
 * - Cloudflare R2 (cost-effective for AI uploads)
 * - Backblaze B2 (cheapest option)
 * - Wasabi (no egress fees)
 */

export interface StorageBackend {
  /** Backend name for identification */
  name: string;

  /**
   * Upload data to storage
   * @param key - Storage key (path)
   * @param data - File data as Buffer
   * @param contentType - MIME type
   * @returns Public URL to access the file
   */
  put(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }>;

  /**
   * Get signed URL for downloading
   * @param key - Storage key
   * @param expiresIn - URL expiry in seconds (optional)
   * @returns Signed URL
   */
  get(key: string, expiresIn?: number): Promise<{ url: string }>;

  /**
   * Delete file from storage
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Check if backend is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get cost metrics for this backend
   */
  getCostMetrics(): {
    storageCostPerGB: number; // USD per GB per month
    bandwidthCostPerGB: number; // USD per GB egress
    apiCostPer1000: number; // USD per 1000 API calls
  };
}

/**
 * Upload context for routing decisions
 */
export interface UploadContext {
  /** Source of upload: AI agent or human user */
  uploadSource: 'ai_agent' | 'user';
  
  /** Package type */
  packageType: 'vector' | 'memory' | 'chain';
  
  /** File size in bytes */
  fileSize: number;
  
  /** User ID */
  userId: number;
  
  /** Is this a test/development upload? */
  isTest?: boolean;
}

/**
 * Storage routing decision
 */
export interface StorageRoute {
  /** Selected backend */
  backend: StorageBackend;
  
  /** Reason for selection */
  reason: string;
  
  /** Estimated monthly cost for this file */
  estimatedCost: number;
}
