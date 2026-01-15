/**
 * Unified Storage API
 * 
 * Drop-in replacement for the original storagePut function
 * Automatically routes to the most cost-effective backend
 */

import { getStorageRouter } from './storage-router';
import { UploadContext } from './storage-backend';

/**
 * Upload file with automatic backend selection
 * 
 * @param key - Storage key (path)
 * @param data - File data
 * @param contentType - MIME type
 * @param context - Upload context for routing (optional)
 * @returns Object with url and key
 */
export async function storagePutSmart(
  key: string,
  data: Buffer,
  contentType: string,
  context?: Partial<UploadContext>
): Promise<{ url: string; key: string; backend: string; estimatedCost: number }> {
  const router = getStorageRouter();

  // Build upload context
  const uploadContext: UploadContext = {
    uploadSource: context?.uploadSource || 'user',
    packageType: context?.packageType || 'vector',
    fileSize: data.length,
    userId: context?.userId || 0,
    isTest: context?.isTest || process.env.NODE_ENV === 'development',
  };

  // Route to appropriate backend
  const route = router.route(uploadContext);

  console.log(`[Unified Storage] Routing to ${route.backend.name}: ${route.reason}`);
  console.log(`[Unified Storage] Estimated monthly cost: $${route.estimatedCost.toFixed(4)}`);

  // Upload to selected backend
  const result = await route.backend.put(key, data, contentType);

  return {
    ...result,
    backend: route.backend.name,
    estimatedCost: route.estimatedCost,
  };
}

/**
 * Get download URL from any backend
 * 
 * @param key - Storage key
 * @param backend - Backend name (optional, will try all if not specified)
 * @param expiresIn - URL expiry in seconds
 */
export async function storageGetSmart(
  key: string,
  backend?: string,
  expiresIn: number = 3600
): Promise<{ url: string }> {
  const router = getStorageRouter();

  if (backend) {
    const backendInstance = router.getBackend(backend);
    if (!backendInstance) {
      throw new Error(`Backend ${backend} not available`);
    }
    return await backendInstance.get(key, expiresIn);
  }

  // Try all backends until one succeeds
  const backends = router.getAvailableBackends();
  let lastError: Error | null = null;

  for (const backendName of backends) {
    try {
      const backendInstance = router.getBackend(backendName);
      if (backendInstance) {
        return await backendInstance.get(key, expiresIn);
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Unified Storage] Failed to get from ${backendName}:`, error);
    }
  }

  throw new Error(`Failed to get file from any backend: ${lastError?.message}`);
}

/**
 * Delete file from backend
 */
export async function storageDeleteSmart(key: string, backend: string): Promise<void> {
  const router = getStorageRouter();
  const backendInstance = router.getBackend(backend);

  if (!backendInstance) {
    throw new Error(`Backend ${backend} not available`);
  }

  await backendInstance.delete(key);
}

/**
 * Get cost comparison for a file
 */
export function getStorageCostComparison(fileSize: number, monthlyDownloads: number = 10) {
  const router = getStorageRouter();
  return router.getCostComparison(fileSize, monthlyDownloads);
}

/**
 * Health check all storage backends
 */
export async function storageHealthCheck() {
  const router = getStorageRouter();
  return await router.healthCheckAll();
}
