/**
 * Wasabi Storage Backend
 * 
 * Ultra-low-cost cloud storage with free egress
 * Perfect for cold data (90+ days without access)
 * 
 * Cost: $0.0059/GB storage + $0 egress
 * Note: 90-day minimum storage commitment
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageBackend } from './storage-backend';

export class WasabiBackend implements StorageBackend {
  name = 'wasabi';
  private client: S3Client;
  private bucketName: string;
  private region: string;
  private publicUrl: string;

  constructor() {
    const accessKeyId = process.env.WASABI_ACCESS_KEY_ID;
    const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;
    this.bucketName = process.env.WASABI_BUCKET_NAME || 'awareness-cold-storage';
    this.region = process.env.WASABI_REGION || 'us-east-1';
    
    // Wasabi endpoints by region
    const endpoints: Record<string, string> = {
      'us-east-1': 's3.wasabisys.com',
      'us-east-2': 's3.us-east-2.wasabisys.com',
      'us-west-1': 's3.us-west-1.wasabisys.com',
      'eu-central-1': 's3.eu-central-1.wasabisys.com',
      'ap-northeast-1': 's3.ap-northeast-1.wasabisys.com',
    };

    const endpoint = process.env.WASABI_ENDPOINT || endpoints[this.region] || endpoints['us-east-1'];
    this.publicUrl = `https://${this.bucketName}.${endpoint}`;

    if (!accessKeyId || !secretAccessKey) {
      console.warn('[WasabiBackend] Missing credentials, backend will not function');
    }

    this.client = new S3Client({
      region: this.region,
      endpoint: `https://${endpoint}`,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
      // Wasabi uses S3-compatible API
      forcePathStyle: false,
    });
  }

  /**
   * Upload file to Wasabi
   * Note: Files should stay for at least 90 days to avoid early deletion fees
   */
  async put(key: string, data: Buffer, contentType: string): Promise<{ url: string; key: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: contentType,
        // Add metadata to track upload date for 90-day policy
        Metadata: {
          'upload-date': new Date().toISOString(),
          'min-storage-date': new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      await this.client.send(command);
      const url = `${this.publicUrl}/${key}`;

      console.log(`[WasabiBackend] Uploaded ${key} (${(data.length / 1024 / 1024).toFixed(2)} MB)`);
      return { url, key };
    } catch (error) {
      console.error('[WasabiBackend] Upload failed:', error);
      throw new Error(`Wasabi upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get presigned download URL
   * Wasabi has free egress, so no cost for downloads
   */
  async get(key: string, expiresIn: number = 3600): Promise<{ url: string; key: string }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return { url, key };
    } catch (error) {
      console.error('[WasabiBackend] Get URL failed:', error);
      throw new Error(`Wasabi get failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from Wasabi
   * WARNING: Deleting before 90 days incurs early deletion fees
   */
  async delete(key: string): Promise<void> {
    try {
      // Check if file is older than 90 days
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      
      const metadata = await this.client.send(headCommand);
      const uploadDate = metadata.Metadata?.['upload-date'];
      
      if (uploadDate) {
        const daysSinceUpload = (Date.now() - new Date(uploadDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpload < 90) {
          console.warn(`[WasabiBackend] Deleting ${key} before 90 days (${daysSinceUpload.toFixed(0)} days old) - early deletion fees apply`);
        }
      }

      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(deleteCommand);
      console.log(`[WasabiBackend] Deleted ${key}`);
    } catch (error) {
      console.error('[WasabiBackend] Delete failed:', error);
      throw new Error(`Wasabi delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cost information
   * Wasabi: $0.0059/GB storage, $0 egress (free)
   * Note: 90-day minimum storage commitment
   */
  getCost(): { storage: number; bandwidth: number; notes: string } {
    return {
      storage: 0.0059, // $/GB/month
      bandwidth: 0,    // Free egress!
      notes: '90-day minimum storage commitment. Early deletion fees apply.',
    };
  }

  /**
   * Check if backend is properly configured
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Try to list bucket (lightweight operation)
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: '.health-check', // Non-existent key, just checking bucket access
      });

      try {
        await this.client.send(command);
      } catch (error: any) {
        // 404 is expected for non-existent key, means bucket is accessible
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          return { healthy: true, message: 'Wasabi backend is healthy' };
        }
        throw error;
      }

      return { healthy: true, message: 'Wasabi backend is healthy' };
    } catch (error) {
      console.error('[WasabiBackend] Health check failed:', error);
      return {
        healthy: false,
        message: `Wasabi backend unhealthy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
    // Wasabi doesn't provide easy stats API
    // Would need to list all objects which is expensive
    return { totalFiles: 0, totalSize: 0 };
  }
}

// Singleton instance
let wasabiBackendInstance: WasabiBackend | null = null;

export function getWasabiBackend(): WasabiBackend {
  if (!wasabiBackendInstance) {
    wasabiBackendInstance = new WasabiBackend();
  }
  return wasabiBackendInstance;
}
