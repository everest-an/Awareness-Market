/**
 * AI Agent API Endpoints
 * 
 * Simplified, AI-friendly endpoints for autonomous agents:
 * - /api/ai/upload-package - Upload any package type
 * - /api/ai/package-status/:uploadId - Check upload status
 * - /api/ai/batch-upload - Batch upload up to 10 packages
 * - /api/ai/search-packages - Natural language search
 * - /api/ai/purchase-package - Purchase a package
 * - /api/ai/download-package - Download purchased package
 * 
 * Features:
 * - JSON-only responses (no HTML)
 * - API Key authentication
 * - Async processing with status tracking
 * - Webhook notifications
 * - OpenAPI 3.0 specification
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { VectorPackageBuilder } from '../latentmas/vector-package-builder';
import { MemoryPackageBuilder } from '../latentmas/memory-package-builder';
import { ChainPackageBuilder } from '../latentmas/chain-package-builder';
import { storagePut } from '../storage';
import { storagePutSmart } from '../storage/unified-storage';
import { uploadPackageTransaction, purchasePackageTransaction } from '../db-transactions';
import { getDb } from '../db-connection';
import { vectorPackages, memoryPackages, chainPackages, packagePurchases } from '../../drizzle/schema';
import { eq, and, like, or } from 'drizzle-orm';
import { workflowManager } from '../workflow-manager';

// Upload status tracking (in-memory, should use Redis in production)
const uploadStatuses = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  packageId?: string;
  error?: string;
  createdAt: Date;
}>();

/**
 * AI Agent API Router
 */
export const aiAgentRouter = router({
  /**
   * Upload a package (Vector/Memory/Chain)
   * Supports multipart/form-data or base64 encoded data
   */
  uploadPackage: protectedProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      name: z.string().min(3).max(100),
      description: z.string().min(10).max(1000),
      version: z.string().default('1.0.0'),
      category: z.string().optional(),
      sourceModel: z.string(),
      targetModel: z.string(),
      dimension: z.number().optional(),
      epsilon: z.number().min(0).max(1),
      price: z.number().min(0),
      tags: z.array(z.string()).optional(),
      // File data (base64 encoded)
      vectorData: z.string().optional(), // For vector packages
      wMatrixData: z.string(),
      kvCacheData: z.string().optional(), // For memory packages
      chainData: z.string().optional(), // For chain packages
      // Webhook URL for completion notification
      webhookUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Initialize upload status
      uploadStatuses.set(uploadId, {
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
      });

      // Process upload asynchronously
      processUpload(uploadId, input, ctx.user.id).catch((error) => {
        console.error('[AI Agent API] Upload failed:', error);
        uploadStatuses.set(uploadId, {
          status: 'failed',
          progress: 0,
          error: error.message,
          createdAt: new Date(),
        });
      });

      return {
        success: true,
        data: {
          uploadId,
          statusUrl: `/api/ai/package-status/${uploadId}`,
          message: 'Upload initiated. Check status URL for progress.',
        },
      };
    }),

  /**
   * Get upload status
   */
  getPackageStatus: publicProcedure
    .input(z.object({
      uploadId: z.string(),
    }))
    .query(async ({ input }) => {
      const status = uploadStatuses.get(input.uploadId);

      if (!status) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Upload ID not found',
        });
      }

      return {
        success: true,
        data: status,
      };
    }),

  /**
   * Batch upload packages (up to 10)
   */
  batchUpload: protectedProcedure
    .input(z.object({
      packages: z.array(z.object({
        packageType: z.enum(['vector', 'memory', 'chain']),
        name: z.string(),
        description: z.string(),
        sourceModel: z.string(),
        targetModel: z.string(),
        epsilon: z.number(),
        price: z.number(),
        vectorData: z.string().optional(),
        wMatrixData: z.string(),
        kvCacheData: z.string().optional(),
        chainData: z.string().optional(),
      })).max(10),
      webhookUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const uploadIds: string[] = [];

      // Create upload tasks for each package
      for (const pkg of input.packages) {
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        uploadIds.push(uploadId);

        uploadStatuses.set(uploadId, {
          status: 'pending',
          progress: 0,
          createdAt: new Date(),
        });

        // Process each upload asynchronously
        processUpload(uploadId, pkg as any, ctx.user.id).catch((error) => {
          uploadStatuses.set(uploadId, {
            status: 'failed',
            progress: 0,
            error: error.message,
            createdAt: new Date(),
          });
        });
      }

      return {
        success: true,
        data: {
          batchId,
          uploadIds,
          statusUrls: uploadIds.map(id => `/api/ai/package-status/${id}`),
          message: `Batch upload initiated for ${input.packages.length} packages.`,
        },
      };
    }),

  /**
   * Search packages with natural language query
   */
  searchPackages: publicProcedure
    .input(z.object({
      query: z.string().min(3),
      packageType: z.enum(['vector', 'memory', 'chain', 'all']).default('all'),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const { query, packageType, limit } = input;

      // Simple keyword search (can be enhanced with LLM-powered semantic search)
      const searchPattern = `%${query}%`;
      const results: any[] = [];

      if (packageType === 'vector' || packageType === 'all') {
        const vectors = await db
          .select()
          .from(vectorPackages)
          .where(
            or(
              like(vectorPackages.name, searchPattern),
              like(vectorPackages.description, searchPattern),
              like(vectorPackages.category, searchPattern)
            )
          )
          .limit(limit);
        results.push(...vectors.map(v => ({ ...v, packageType: 'vector' })));
      }

      if (packageType === 'memory' || packageType === 'all') {
        const memories = await db
          .select()
          .from(memoryPackages)
          .where(
            or(
              like(memoryPackages.name, searchPattern),
              like(memoryPackages.description, searchPattern)
            )
          )
          .limit(limit);
        results.push(...memories.map(m => ({ ...m, packageType: 'memory' })));
      }

      if (packageType === 'chain' || packageType === 'all') {
        const chains = await db
          .select()
          .from(chainPackages)
          .where(
            or(
              like(chainPackages.name, searchPattern),
              like(chainPackages.description, searchPattern)
            )
          )
          .limit(limit);
        results.push(...chains.map(c => ({ ...c, packageType: 'chain' })));
      }

      return {
        success: true,
        data: {
          query,
          results: results.slice(0, limit),
          count: results.length,
        },
      };
    }),

  /**
   * Purchase a package
   */
  purchasePackage: protectedProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      packageId: z.string(),
      paymentMethod: z.enum(['stripe', 'crypto']).default('stripe'),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const { packageType, packageId, paymentMethod } = input;

      // Get package details
      const packageTable = getPackageTable(packageType);
      const [pkg] = await db
        .select()
        .from(packageTable)
        .where(eq((packageTable as any).packageId, packageId))
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      // Create purchase transaction
      const result = await purchasePackageTransaction({
        userId: ctx.user.id,
        packageType,
        packageId,
        price: (pkg as any).price,
        stripePaymentId: `pi_${Date.now()}`, // Mock payment ID (integrate with Stripe in production)
      });

      return {
        success: true,
        data: {
          purchaseId: result.purchaseId,
          downloadUrl: result.downloadUrl,
          expiresAt: result.expiresAt,
          message: 'Package purchased successfully. Download link is valid for 7 days.',
        },
      };
    }),

  /**
   * Download a purchased package
   */
  downloadPackage: protectedProcedure
    .input(z.object({
      packageType: z.enum(['vector', 'memory', 'chain']),
      packageId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const { packageType, packageId } = input;

      // Verify purchase
      const [purchase] = await db
        .select()
        .from(packagePurchases)
        .where(
          and(
            eq(packagePurchases.buyerId, ctx.user.id),
            eq(packagePurchases.packageType, packageType),
            eq(packagePurchases.packageId, packageId)
          )
        )
        .limit(1);

      if (!purchase) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You have not purchased this package',
        });
      }

      // Get package URL
      const packageTable = getPackageTable(packageType);
      const [pkg] = await db
        .select()
        .from(packageTable)
        .where(eq((packageTable as any).packageId, packageId))
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Package not found',
        });
      }

      return {
        success: true,
        data: {
          packageUrl: (pkg as any).packageUrl,
          wMatrixUrl: (pkg as any).wMatrixUrl,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      };
    }),
});

/**
 * Process upload asynchronously
 */
async function processUpload(uploadId: string, input: any, userId: number) {
  // Create workflow session for visualization
  const session = workflowManager.createSession({
    userId,
    type: 'package_processing',
    title: `Package Upload: ${input.name}`,
    description: `Processing ${input.packageType} package upload`,
    tags: [input.packageType, 'upload'],
  });
  const workflowId = session.id;

  try {
    // Track: User initiated upload
    const uploadEvent = workflowManager.addEvent(workflowId, {
      type: 'user_input',
      title: 'Upload Package',
      input: {
        packageType: input.packageType,
        name: input.name,
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        epsilon: input.epsilon,
        price: input.price,
      },
      metadata: { uploadId },
    });

    // Update status: processing
    uploadStatuses.set(uploadId, {
      status: 'processing',
      progress: 10,
      createdAt: new Date(),
    });

    workflowManager.updateEvent(workflowId, uploadEvent.id, {
      status: 'completed',
      output: { message: 'Upload initiated' },
    });

    // Track: Decode and validate data
    const decodeEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Decode Package Data',
      input: { packageType: input.packageType },
      metadata: { step: 'decode' },
    });

    // Decode base64 data
    const wMatrixBuffer = Buffer.from(input.wMatrixData, 'base64');
    let packageBuffer: Buffer;

    if (input.packageType === 'vector' && input.vectorData) {
      packageBuffer = Buffer.from(input.vectorData, 'base64');
    } else if (input.packageType === 'memory' && input.kvCacheData) {
      packageBuffer = Buffer.from(input.kvCacheData, 'base64');
    } else if (input.packageType === 'chain' && input.chainData) {
      packageBuffer = Buffer.from(input.chainData, 'base64');
    } else {
      throw new Error('Missing package data');
    }

    workflowManager.updateEvent(workflowId, decodeEvent.id, {
      status: 'completed',
      output: {
        packageSize: packageBuffer.length,
        wMatrixSize: wMatrixBuffer.length,
      },
    });

    // Update progress: 30%
    uploadStatuses.set(uploadId, {
      status: 'processing',
      progress: 30,
      createdAt: new Date(),
    });

    // Track: Upload to storage
    const storageEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Upload to S3',
      input: {
        packageSize: packageBuffer.length,
        wMatrixSize: wMatrixBuffer.length,
      },
      metadata: { step: 'storage' },
    });

    // Upload to S3
    const packageKey = `packages/${input.packageType}/${userId}/${Date.now()}.pkg`;
    const wMatrixKey = `w-matrices/${userId}/${Date.now()}.safetensors`;

    // Use smart storage routing - AI uploads go to R2 (cheaper)
    const packageResult = await storagePutSmart(packageKey, packageBuffer, 'application/octet-stream', {
      uploadSource: 'ai_agent',
      packageType: input.packageType,
      fileSize: packageBuffer.length,
      userId,
    });
    const wMatrixResult = await storagePutSmart(wMatrixKey, wMatrixBuffer, 'application/octet-stream', {
      uploadSource: 'ai_agent',
      packageType: input.packageType,
      fileSize: wMatrixBuffer.length,
      userId,
    });
    
    const packageUrl = packageResult.url;
    const wMatrixUrl = wMatrixResult.url;
    
    console.log(`[AI Upload] Package stored in ${packageResult.backend}, W-Matrix in ${wMatrixResult.backend}`);
    console.log(`[AI Upload] Estimated cost: $${(packageResult.estimatedCost + wMatrixResult.estimatedCost).toFixed(4)}/month`);

    workflowManager.updateEvent(workflowId, storageEvent.id, {
      status: 'completed',
      output: {
        packageUrl,
        wMatrixUrl,
        backend: packageResult.backend,
        estimatedCost: (packageResult.estimatedCost + wMatrixResult.estimatedCost).toFixed(4),
      },
    });

    // Update progress: 60%
    uploadStatuses.set(uploadId, {
      status: 'processing',
      progress: 60,
      createdAt: new Date(),
    });

    // Track: Create database record
    const dbEvent = workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Store Package Metadata',
      input: {
        packageType: input.packageType,
        name: input.name,
        price: input.price,
      },
      metadata: { step: 'database' },
    });

    // Create database record
    const result = await uploadPackageTransaction({
      userId,
      packageType: input.packageType,
      packageData: {
        packageId: `pkg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: input.name,
        description: input.description,
        version: input.version || '1.0.0',
        category: input.category,
        sourceModel: input.sourceModel,
        targetModel: input.targetModel,
        dimension: input.dimension,
        epsilon: input.epsilon,
        price: input.price,
        tags: input.tags?.join(',') || '',
      },
      s3Urls: {
        packageUrl,
        wMatrixUrl,
      },
    });

    workflowManager.updateEvent(workflowId, dbEvent.id, {
      status: 'completed',
      output: {
        packageId: result.packageId,
        packageUrl: result.packageUrl,
      },
    });

    // Update status: completed
    uploadStatuses.set(uploadId, {
      status: 'completed',
      progress: 100,
      packageId: result.packageId.toString(),
      createdAt: new Date(),
    });

    // End workflow session
    workflowManager.completeSession(workflowId, 'completed');

    // Send webhook notification if provided
    if (input.webhookUrl) {
      await sendWebhook(input.webhookUrl, {
        event: 'upload.completed',
        uploadId,
        packageId: result.packageId,
        packageUrl: result.packageUrl,
      });
    }
  } catch (error) {
    console.error('[Process Upload] Error:', error);
    
    // Track error in workflow
    workflowManager.addEvent(workflowId, {
      type: 'tool_call',
      title: 'Upload Failed',
      input: { error: (error as Error).message },
      metadata: { status: 'error' },
    });
    
    workflowManager.completeSession(workflowId, 'failed');
    
    uploadStatuses.set(uploadId, {
      status: 'failed',
      progress: 0,
      error: (error as Error).message,
      createdAt: new Date(),
    });

    // Send webhook notification for failure
    if (input.webhookUrl) {
      await sendWebhook(input.webhookUrl, {
        event: 'upload.failed',
        uploadId,
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Send webhook notification
 */
async function sendWebhook(url: string, data: any) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Awareness-Webhook/1.0',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('[Webhook] Failed to send:', error);
  }
}

/**
 * Helper: Get package table by type
 */
function getPackageTable(packageType: 'vector' | 'memory' | 'chain') {
  switch (packageType) {
    case 'vector':
      return vectorPackages;
    case 'memory':
      return memoryPackages;
    case 'chain':
      return chainPackages;
    default:
      throw new Error(`Invalid package type: ${packageType}`);
  }
}
