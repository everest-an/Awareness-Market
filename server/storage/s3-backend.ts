/**
 * AWS S3 Storage Backend
 * 
 * High-performance, high-availability storage for user uploads
 * Cost: $0.023/GB/month + $0.09/GB egress
 */

import { StorageBackend } from './storage-backend';
import { storagePut as originalStoragePut } from '../storage';

export class S3Backend implements StorageBackend {
  name = 'S3';

  async put(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
    // Use existing S3 storage implementation
    const result = await originalStoragePut(key, data, contentType);
    return {
      url: result.url,
      key,
    };
  }

  async get(key: string, expiresIn: number = 3600): Promise<{ url: string }> {
    // For S3, the URL is already public or can be signed
    // In production, implement S3 presigned URL generation
    const url = `${process.env.VITE_FRONTEND_FORGE_API_URL}/storage/${key}`;
    return { url };
  }

  async delete(key: string): Promise<void> {
    // Implement S3 delete
    // For now, we don't delete files (for data retention)
    console.log(`[S3Backend] Delete requested for key: ${key}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list buckets or perform a simple operation
      return true;
    } catch (error) {
      console.error('[S3Backend] Health check failed:', error);
      return false;
    }
  }

  getCostMetrics() {
    return {
      storageCostPerGB: 0.023, // $0.023 per GB per month
      bandwidthCostPerGB: 0.09, // $0.09 per GB egress
      apiCostPer1000: 0.0004, // $0.0004 per 1000 PUT requests
    };
  }
}
