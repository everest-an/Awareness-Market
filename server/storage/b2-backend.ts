/**
 * Backblaze B2 Storage Backend
 * 
 * Cheapest storage option for large AI uploads
 * Cost: $0.005/GB/month + $0.01/GB egress (first 3x storage is free)
 * 
 * B2 is also S3-compatible
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageBackend } from './storage-backend';
import { createLogger } from '../utils/logger';

const logger = createLogger('Storage');

export class B2Backend implements StorageBackend {
  name = 'B2';
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    // Backblaze B2 credentials from environment
    const keyId = process.env.B2_KEY_ID;
    const applicationKey = process.env.B2_APPLICATION_KEY;
    const endpoint = process.env.B2_ENDPOINT; // e.g., s3.us-west-004.backblazeb2.com
    this.bucket = process.env.B2_BUCKET_NAME || 'awareness-ai-large-files';
    this.publicUrl = process.env.B2_PUBLIC_URL || `https://f004.backblazeb2.com/file/${this.bucket}`;

    if (!keyId || !applicationKey || !endpoint) {
      logger.warn('[B2Backend] Missing B2 credentials, backend will not work');
    }

    this.client = new S3Client({
      region: 'us-west-004', // B2 region
      endpoint: `https://${endpoint}`,
      credentials: {
        accessKeyId: keyId || '',
        secretAccessKey: applicationKey || '',
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
      
      logger.info(`[B2Backend] Uploaded ${key} (${data.length} bytes)`);
      
      return { url, key };
    } catch (error) {
      logger.error('[B2Backend] Upload failed:', error);
      throw new Error(`B2 upload failed: ${(error as Error).message}`);
    }
  }

  async get(key: string, expiresIn: number = 3600): Promise<{ url: string }> {
    try {
      // Generate presigned URL
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      
      return { url };
    } catch (error) {
      logger.error('[B2Backend] Get URL failed:', error);
      throw new Error(`B2 get failed: ${(error as Error).message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      
      logger.info(`[B2Backend] Deleted ${key}`);
    } catch (error) {
      logger.error('[B2Backend] Delete failed:', error);
      throw new Error(`B2 delete failed: ${(error as Error).message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      logger.error('[B2Backend] Health check failed:', error);
      return false;
    }
  }

  getCostMetrics() {
    return {
      storageCostPerGB: 0.005, // $0.005 per GB per month (cheapest!)
      bandwidthCostPerGB: 0.01, // $0.01 per GB egress (first 3x storage is free)
      apiCostPer1000: 0.004, // $0.004 per 1000 Class B transactions
    };
  }
}
