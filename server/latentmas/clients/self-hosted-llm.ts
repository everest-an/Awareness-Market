/**
 * Self-Hosted LLM Client for vLLM/TGI Hidden State Extraction
 * Optimized for RunPod Spot GPU deployment
 */

import axios, { AxiosInstance } from 'axios';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SelfHostedLLM');

export interface HiddenStateRequest {
  prompts: string[];
  layer: number;
}

export interface HiddenStateResponse {
  prompt: string;
  hidden_state: number[];
  dimension: number;
  layer: number;
}

export interface HealthCheckResponse {
  status: string;
  model: string;
  gpu?: string;
  memory?: string;
}

export interface ExtractHiddenStatesResult {
  prompt: string;
  hiddenState: number[];
  dimension: number;
  layer: number;
  metadata: {
    model: string;
    provider: string;
    timestamp: Date;
    processingTime: number;
  };
}

/**
 * Client for self-hosted LLM inference server (vLLM/TGI)
 */
export class SelfHostedLLMClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private modelName: string;
  private healthCheckCache: {
    data: HealthCheckResponse | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };
  private readonly HEALTH_CACHE_TTL = 60000; // 1 minute

  constructor(baseUrl?: string, apiKey?: string, modelName: string = 'llama-3.1-8b') {
    this.baseUrl = baseUrl || process.env.VLLM_BASE_URL || 'http://localhost:8000';
    this.modelName = modelName;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000, // 2 minutes for large batch processing
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    });

    logger.info('Initialized SelfHostedLLMClient', {
      baseUrl: this.baseUrl,
      modelName: this.modelName,
    });
  }

  /**
   * Extract hidden states from self-hosted LLM
   */
  async extractHiddenStates(
    prompts: string[],
    layer: number = -2
  ): Promise<ExtractHiddenStatesResult[]> {
    const startTime = Date.now();

    try {
      logger.info('Extracting hidden states', {
        baseUrl: this.baseUrl,
        promptCount: prompts.length,
        layer,
      });

      const response = await this.client.post<{ results: HiddenStateResponse[] }>(
        '/v1/hidden_states',
        { prompts, layer }
      );

      const processingTime = Date.now() - startTime;

      logger.info('Successfully extracted hidden states', {
        resultCount: response.data.results.length,
        processingTime: `${processingTime}ms`,
        avgPerPrompt: `${(processingTime / prompts.length).toFixed(2)}ms`,
      });

      // Convert to standard format
      return response.data.results.map(result => ({
        prompt: result.prompt,
        hiddenState: result.hidden_state,
        dimension: result.dimension,
        layer: result.layer,
        metadata: {
          model: this.modelName,
          provider: 'SelfHosted-vLLM',
          timestamp: new Date(),
          processingTime: processingTime / prompts.length,
        },
      }));
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      logger.error('Failed to extract hidden states', {
        error: error.message,
        baseUrl: this.baseUrl,
        promptCount: prompts.length,
        processingTime: `${processingTime}ms`,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });

      // Provide more detailed error messages
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to vLLM server at ${this.baseUrl}. ` +
          'Please ensure the server is running and accessible.'
        );
      }

      if (error.response?.status === 404) {
        throw new Error(
          `Endpoint /v1/hidden_states not found. ` +
          'Please verify your vLLM server supports hidden state extraction.'
        );
      }

      if (error.response?.status === 500) {
        throw new Error(
          `vLLM server error: ${error.response.data?.detail || 'Internal server error'}. ` +
          'Check server logs for details.'
        );
      }

      throw new Error(`Hidden state extraction failed: ${error.message}`);
    }
  }

  /**
   * Check if the server is healthy and ready
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    // Check cache first
    const now = Date.now();
    if (
      this.healthCheckCache.data &&
      now - this.healthCheckCache.timestamp < this.HEALTH_CACHE_TTL
    ) {
      return this.healthCheckCache.data;
    }

    try {
      const response = await this.client.get<HealthCheckResponse>('/health', {
        timeout: 5000, // Quick health check
      });

      // Update cache
      this.healthCheckCache = {
        data: response.data,
        timestamp: now,
      };

      logger.debug('Health check successful', {
        status: response.data.status,
        model: response.data.model,
        gpu: response.data.gpu,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Health check failed', {
        error: error.message,
        baseUrl: this.baseUrl,
      });

      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Check if server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get server information
   */
  getServerInfo(): {
    baseUrl: string;
    modelName: string;
  } {
    return {
      baseUrl: this.baseUrl,
      modelName: this.modelName,
    };
  }

  /**
   * Clear health check cache (useful after server restart)
   */
  clearHealthCache(): void {
    this.healthCheckCache = { data: null, timestamp: 0 };
  }
}

// ============================================================================
// Global Client Management
// ============================================================================

let globalClient: SelfHostedLLMClient | null = null;

/**
 * Get or create global self-hosted LLM client
 */
export function getGlobalSelfHostedClient(): SelfHostedLLMClient {
  if (!globalClient) {
    const baseUrl = process.env.VLLM_BASE_URL;
    const apiKey = process.env.VLLM_API_KEY;
    const modelName = process.env.VLLM_MODEL_NAME || 'llama-3.1-8b';

    if (!baseUrl) {
      logger.warn(
        'VLLM_BASE_URL not set in environment. Using default: http://localhost:8000'
      );
    }

    globalClient = new SelfHostedLLMClient(baseUrl, apiKey, modelName);
  }

  return globalClient;
}

/**
 * Reset global client (useful for testing or reconfiguration)
 */
export function resetGlobalClient(): void {
  globalClient = null;
}

/**
 * Check if self-hosted LLM is enabled
 */
export function isSelfHostedEnabled(): boolean {
  return process.env.USE_SELF_HOSTED_LLM === 'true';
}
