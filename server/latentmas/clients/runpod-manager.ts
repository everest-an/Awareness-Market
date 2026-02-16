/**
 * RunPod Pod Manager
 * Automatically start/stop GPU pods to minimize costs
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger';
import { getGlobalSelfHostedClient } from './self-hosted-llm';

const logger = createLogger('RunPodManager');

export interface PodStatus {
  id: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'STARTING' | 'STOPPING';
  gpu: string;
  costPerHour: number;
}

/**
 * Manager for RunPod GPU pods
 * Provides automatic start/stop functionality to minimize costs
 */
export class RunPodManager {
  private client: AxiosInstance;
  private podId: string;
  private readonly MAX_WAIT_TIME = 120000; // 2 minutes
  private readonly HEALTH_CHECK_INTERVAL = 2000; // 2 seconds

  constructor(podId?: string, apiKey?: string) {
    this.podId = podId || process.env.RUNPOD_POD_ID || '';
    const runpodApiKey = apiKey || process.env.RUNPOD_API_KEY || '';

    if (!this.podId) {
      throw new Error('RUNPOD_POD_ID is required. Set it in your .env file.');
    }

    if (!runpodApiKey) {
      throw new Error('RUNPOD_API_KEY is required. Set it in your .env file.');
    }

    this.client = axios.create({
      baseURL: 'https://api.runpod.io/graphql',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runpodApiKey}`,
      },
      timeout: 30000,
    });

    logger.info('Initialized RunPodManager', {
      podId: this.podId,
    });
  }

  /**
   * Start the GPU pod
   */
  async startPod(): Promise<void> {
    logger.info('Starting RunPod pod', { podId: this.podId });

    try {
      const response = await this.client.post('', {
        query: `
          mutation {
            podResume(input: {podId: "${this.podId}"}) {
              id
              desiredStatus
              lastStatusChange
            }
          }
        `,
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      logger.info('Pod start command sent successfully', {
        podId: this.podId,
        desiredStatus: response.data.data?.podResume?.desiredStatus,
      });

      // Wait for pod to be ready
      await this.waitForReady();
    } catch (error: any) {
      logger.error('Failed to start pod', {
        error: error.message,
        podId: this.podId,
      });
      throw new Error(`Failed to start RunPod pod: ${error.message}`);
    }
  }

  /**
   * Stop the GPU pod
   */
  async stopPod(): Promise<void> {
    logger.info('Stopping RunPod pod', { podId: this.podId });

    try {
      const response = await this.client.post('', {
        query: `
          mutation {
            podStop(input: {podId: "${this.podId}"}) {
              id
              desiredStatus
              lastStatusChange
            }
          }
        `,
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      logger.info('Pod stop command sent successfully', {
        podId: this.podId,
        desiredStatus: response.data.data?.podStop?.desiredStatus,
      });
    } catch (error: any) {
      logger.error('Failed to stop pod', {
        error: error.message,
        podId: this.podId,
      });
      throw new Error(`Failed to stop RunPod pod: ${error.message}`);
    }
  }

  /**
   * Get current pod status
   */
  async getPodStatus(): Promise<PodStatus> {
    try {
      const response = await this.client.post('', {
        query: `
          query {
            pod(input: {podId: "${this.podId}"}) {
              id
              name
              desiredStatus
              runtime {
                gpus {
                  id
                  gpuTypeId
                }
              }
              costPerHr
            }
          }
        `,
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      const pod = response.data.data?.pod;

      return {
        id: pod.id,
        name: pod.name,
        status: pod.desiredStatus,
        gpu: pod.runtime?.gpus?.[0]?.gpuTypeId || 'Unknown',
        costPerHour: pod.costPerHr,
      };
    } catch (error: any) {
      logger.error('Failed to get pod status', {
        error: error.message,
        podId: this.podId,
      });
      throw new Error(`Failed to get pod status: ${error.message}`);
    }
  }

  /**
   * Wait for pod to be ready and serving requests
   */
  private async waitForReady(): Promise<void> {
    const startTime = Date.now();
    const client = getGlobalSelfHostedClient();

    logger.info('Waiting for pod to be ready', {
      maxWaitTime: `${this.MAX_WAIT_TIME / 1000}s`,
    });

    while (Date.now() - startTime < this.MAX_WAIT_TIME) {
      try {
        // Try to health check the vLLM server
        await client.healthCheck();
        const elapsedTime = Date.now() - startTime;

        logger.info('Pod is ready and serving requests', {
          elapsedTime: `${(elapsedTime / 1000).toFixed(1)}s`,
        });

        return;
      } catch (error) {
        // Pod not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, this.HEALTH_CHECK_INTERVAL));
      }
    }

    throw new Error(`Pod failed to become ready within ${this.MAX_WAIT_TIME / 1000} seconds`);
  }

  /**
   * Check if pod is currently running
   */
  async isRunning(): Promise<boolean> {
    try {
      const status = await this.getPodStatus();
      return status.status === 'RUNNING';
    } catch {
      return false;
    }
  }

  /**
   * Execute a function with automatic pod management
   * Starts the pod, executes the function, then stops the pod
   */
  async withAutoManage<T>(fn: () => Promise<T>): Promise<T> {
    const isAlreadyRunning = await this.isRunning();

    logger.info('Executing with auto-managed pod', {
      podId: this.podId,
      alreadyRunning: isAlreadyRunning,
    });

    try {
      // Start pod if not already running
      if (!isAlreadyRunning) {
        await this.startPod();
      }

      // Execute function
      const startTime = Date.now();
      const result = await fn();
      const executionTime = Date.now() - startTime;

      logger.info('Function execution complete', {
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        estimatedCost: `$${((executionTime / 3600000) * 0.44).toFixed(4)}`,
      });

      return result;
    } finally {
      // Stop pod only if we started it
      if (!isAlreadyRunning) {
        try {
          await this.stopPod();
        } catch (error: any) {
          logger.error('Failed to stop pod during cleanup', {
            error: error.message,
          });
          // Don't throw - the main operation succeeded
        }
      }
    }
  }

  /**
   * Execute a function with pod start only (manual stop required)
   */
  async withManagedStart<T>(fn: () => Promise<T>): Promise<T> {
    const isAlreadyRunning = await this.isRunning();

    if (!isAlreadyRunning) {
      await this.startPod();
    }

    return await fn();
  }
}

// ============================================================================
// Global Manager
// ============================================================================

let globalManager: RunPodManager | null = null;

/**
 * Get or create global RunPod manager
 */
export function getGlobalRunPodManager(): RunPodManager {
  if (!globalManager) {
    try {
      globalManager = new RunPodManager();
    } catch (error: any) {
      logger.warn('Failed to initialize RunPodManager. Pod management disabled.', {
        error: error.message,
      });
      // Return a no-op manager
      return {
        startPod: async () => {},
        stopPod: async () => {},
        getPodStatus: async () => ({
          id: 'N/A',
          name: 'N/A',
          status: 'STOPPED',
          gpu: 'N/A',
          costPerHour: 0,
        }),
        isRunning: async () => false,
        withAutoManage: async <T>(fn: () => Promise<T>) => await fn(),
        withManagedStart: async <T>(fn: () => Promise<T>) => await fn(),
      } as any;
    }
  }

  return globalManager;
}

/**
 * Check if RunPod management is enabled
 */
export function isRunPodEnabled(): boolean {
  return !!(process.env.RUNPOD_POD_ID && process.env.RUNPOD_API_KEY);
}
