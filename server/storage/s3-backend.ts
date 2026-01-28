/**
 * AWS S3 Storage Backend
 * 
 * High-performance, high-availability storage for user uploads
 * Cost: $0.023/GB/month + $0.09/GB egress
 */

import { StorageBackend } from './storage-backend';
import { storagePut, storageGet, storageDelete } from '../storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('Storage');

export class S3Backend implements StorageBackend {
  name = 'S3';

  async put(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
    const result = await storagePut(key, data, contentType);
    return {
      url: result.url,
      key: result.key,
    };
  }

  async get(key: string, expiresIn: number = 3600): Promise<{ url: string }> {
    const result = await storageGet(key, expiresIn);
    return { url: result.url };
  }

  async delete(key: string): Promise<void> {
    await storageDelete(key);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to generate a presigned URL
      await storageGet('health-check-test', 60);
      return true;
    } catch (error) {
      // If the error is just "key not found", that's fine - S3 is working
      const errorMessage = (error as Error).message || '';
      if (errorMessage.includes('NoSuchKey') || errorMessage.includes('AccessDenied')) {
        return true; // S3 is reachable
      }
      logger.error('[S3Backend] Health check failed:', error);
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
