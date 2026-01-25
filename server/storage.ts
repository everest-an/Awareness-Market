/**
 * AWS S3 Storage Module
 * 
 * Handles file uploads and downloads using AWS S3
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  } : undefined, // Use default credential chain if not explicitly set
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "awareness-storage";

/**
 * Upload file to S3
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = relKey.startsWith("/") ? relKey.slice(1) : relKey;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: typeof data === "string" ? Buffer.from(data) : data,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return the S3 URL
  const region = process.env.AWS_REGION || "us-east-1";
  const url = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;

  return { key, url };
}

/**
 * Get signed download URL from S3
 */
export async function storageGet(
  relKey: string,
  expiresIn: number = 3600 // Default 1 hour
): Promise<{ key: string; url: string }> {
  const key = relKey.startsWith("/") ? relKey.slice(1) : relKey;

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });

  return { key, url };
}

/**
 * Delete file from S3
 */
export async function storageDelete(relKey: string): Promise<void> {
  const key = relKey.startsWith("/") ? relKey.slice(1) : relKey;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Generate presigned upload URL (for direct client uploads)
 */
export async function getPresignedUploadUrl(
  relKey: string,
  contentType: string = "application/octet-stream",
  expiresIn: number = 3600
): Promise<{ key: string; uploadUrl: string }> {
  const key = relKey.startsWith("/") ? relKey.slice(1) : relKey;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return { key, uploadUrl };
}
