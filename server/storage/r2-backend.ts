/**
 * Cloudflare R2 Storage Backend
 * 
 * Cost-effective storage for AI agent uploads
 * Cost: $0.015/GB/month + $0/GB egress (ZERO egress fees!)
 * 
 * R2 is S3-compatible, so we use AWS SDK
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageBackend } from './storage-backend';
import { createLogger } from '../utils/logger';

const logger = createLogger('Storage');

export class R2Backend implements StorageBackend {
  name = 'R2';
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    // Cloudflare R2 credentials from environment
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET_NAME || 'awareness-ai-uploads';
    
    if (!accountId || !accessKeyId || !secretAccessKey) {
      logger.warn('[R2Backend] Missing R2 credentials, backend will not work');
    }

    // R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    
    // Public URL format: https://pub-<hash>.r2.dev (if public bucket)
    // Or use custom domain: https://cdn.awareness.market
    this.publicUrl = process.env.R2_PUBLIC_URL || `https://${this.bucket}.r2.dev`;

    this.client = new S3Client({
      region: 'auto', // R2 uses 'auto' region
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      });

      await this.client.send(command);

      // Return public URL
      const url = `${this.publicUrl}/${key}`;
      
      logger.info(`[R2Backend] Uploaded ${key} (${data.length} bytes)`);
      
      return { url, key };
    } catch (error) {
      logger.error('[R2Backend] Upload failed:', { error });
      throw new Error(`R2 upload failed: ${(error as Error).message}`);
    }
  }

  async get(key: string, expiresIn: number = 3600): Promise<{ url: string }> {
    try {
      // Generate presigned URL for private access
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      
      return { url };
    } catch (error) {
      logger.error('[R2Backend] Get URL failed:', { error });
      throw new Error(`R2 get failed: ${(error as Error).message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      
      logger.info(`[R2Backend] Deleted ${key}`);
    } catch (error) {
      logger.error('[R2Backend] Delete failed:', { error });
      throw new Error(`R2 delete failed: ${(error as Error).message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list objects (limit 1)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('[R2Backend] Health check failed:', { error });
      return false;
    }
  }

  getCostMetrics() {
    return {
      storageCostPerGB: 0.015, // $0.015 per GB per month
      bandwidthCostPerGB: 0, // ZERO egress fees!
      apiCostPer1000: 0.0036, // $0.0036 per 1000 Class A operations (PUT)
    };
  }
}

// Singleton instance
let r2BackendInstance: R2Backend | null = null;

export function getR2Backend(): R2Backend {
  if (!r2BackendInstance) {
    r2BackendInstance = new R2Backend();
  }
  return r2BackendInstance;
}
