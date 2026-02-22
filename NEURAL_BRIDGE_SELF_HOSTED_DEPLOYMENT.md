# Neural Bridge Self-Hosted LLM Deployment Guide

## Executive Summary

This document provides a complete deployment guide for self-hosting open-source LLMs to replace expensive API calls (OpenAI/Anthropic) in the Neural Bridge system. By deploying models like Llama 3.1, Qwen 2.5, or Mistral locally, we can:

- **Eliminate API costs**: Save $300-$1,500+/month on inference fees
- **Extract real hidden states**: Access intermediate layer activations directly
- **Improve latency**: 2-10x faster inference with local deployment
- **Ensure privacy**: Keep sensitive data on-premises
- **Enable customization**: Fine-tune models for specific use cases

Current implementation uses simulated hidden states via embeddings API. This guide enables **true hidden state extraction** from transformer layers.

---

## Table of Contents

1. [Model Selection](#1-model-selection)
2. [Deployment Architecture](#2-deployment-architecture)
3. [Hidden State Extraction Implementation](#3-hidden-state-extraction-implementation)
4. [Docker Deployment](#4-docker-deployment)
5. [Cost Analysis](#5-cost-analysis)
6. [Performance Optimization](#6-performance-optimization)
7. [Monitoring and Operations](#7-monitoring-and-operations)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Future Extensions](#10-future-extensions)

---

## 1. Model Selection

### 1.1 Recommended Open-Source Models

| Model | Size | VRAM | Inference Speed | Quality | Best For |
|-------|------|------|-----------------|---------|----------|
| **Llama 3.1 8B** | 16GB FP16 | 20GB | ~40 tok/s | High | General purpose, production |
| **Llama 3.1 70B** | 140GB FP16 | 160GB | ~10 tok/s | Very High | Complex reasoning |
| **Qwen 2.5 7B** | 14GB FP16 | 18GB | ~45 tok/s | High | Chinese + English |
| **Qwen 2.5 14B** | 28GB FP16 | 32GB | ~30 tok/s | Very High | Multilingual |
| **Mistral 7B v0.3** | 14GB FP16 | 18GB | ~50 tok/s | High | Lightweight, fast |
| **Mixtral 8x7B** | 96GB FP16 | 110GB | ~25 tok/s | Very High | MoE architecture |
| **DeepSeek-V2** | 236GB FP16 | 250GB | ~8 tok/s | Excellent | Research, math |

### 1.2 Hidden State Dimensions

```typescript
const MODEL_DIMENSIONS = {
  "llama-3.1-8b": 4096,
  "llama-3.1-70b": 8192,
  "qwen-2.5-7b": 3584,
  "qwen-2.5-14b": 5120,
  "mistral-7b-v0.3": 4096,
  "mixtral-8x7b": 4096,
  "deepseek-v2": 5120,
};
```

### 1.3 Layer Selection Strategy

For W-Matrix alignment, extract hidden states from:
- **Layer -2** (second-to-last): Contains rich semantic information before output projection
- **Layer -4 to -2**: Multiple layers for ensemble alignment
- **All layers**: For research and advanced cross-layer analysis

### 1.4 Quantization Options

Reduce VRAM usage while maintaining quality:

| Quantization | VRAM Reduction | Quality Loss | Recommendation |
|--------------|----------------|--------------|----------------|
| **FP16** (baseline) | 0% | 0% | Production default |
| **INT8** | 50% | <2% | High traffic |
| **INT4 (GPTQ)** | 75% | 3-5% | Resource-constrained |
| **INT4 (AWQ)** | 75% | 2-4% | Better than GPTQ |
| **INT2** | 87.5% | 8-15% | Not recommended |

**Recommendation**: Start with FP16, use INT8 if VRAM-constrained, avoid INT2.

---

## 2. Deployment Architecture

### 2.1 Option A: Single-Node GPU Deployment

**Best for**: Development, testing, small-scale production (<1000 requests/day)

```
┌─────────────────────────────────────────┐
│          Host Machine                   │
│  ┌───────────────────────────────────┐  │
│  │   Docker Container: vLLM          │  │
│  │                                   │  │
│  │   ┌─────────────────────────┐    │  │
│  │   │  Model: Llama 3.1 8B    │    │  │
│  │   │  GPU: RTX 4090 (24GB)   │    │  │
│  │   │  Port: 8000             │    │  │
│  │   └─────────────────────────┘    │  │
│  │                                   │  │
│  │   API Endpoints:                  │  │
│  │   - POST /v1/completions          │  │
│  │   - POST /v1/hidden_states        │  │
│  │   - GET  /health                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  TypeScript Backend (Port 3000)         │
│  - SelfHostedLLMClient                  │
│  - W-Matrix Trainer                     │
└─────────────────────────────────────────┘
```

**Hardware Requirements**:
- **GPU**: RTX 4090 (24GB), RTX 6000 Ada (48GB), or NVIDIA A100 (40/80GB)
- **CPU**: 8+ cores (for data preprocessing)
- **RAM**: 32GB+ system memory
- **Storage**: 500GB SSD (for model weights + cache)

**Pros**: Simple setup, low latency, full control
**Cons**: Limited scalability, single point of failure

---

### 2.2 Option B: Distributed Inference Cluster

**Best for**: Production, high traffic (>10K requests/day), multiple models

```
                     ┌──────────────────┐
                     │  Load Balancer   │
                     │   (nginx/HAProxy)│
                     └────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
    │ vLLM Node 1│      │ vLLM Node 2│      │ vLLM Node 3│
    │ Llama 8B   │      │ Qwen 7B    │      │ Mistral 7B │
    │ GPU: A100  │      │ GPU: A100  │      │ GPU: A100  │
    └────────────┘      └────────────┘      └────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                      ┌───────▼────────┐
                      │  Ray Cluster   │
                      │  (Orchestration)│
                      └────────────────┘
```

**Kubernetes Deployment**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: vllm-inference
spec:
  selector:
    app: vllm
  ports:
  - protocol: TCP
    port: 8000
    targetPort: 8000
  type: LoadBalancer
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-llama-8b
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vllm
      model: llama-8b
  template:
    metadata:
      labels:
        app: vllm
        model: llama-8b
    spec:
      containers:
      - name: vllm
        image: vllm/vllm-openai:latest
        args:
        - --model
        - meta-llama/Llama-3.1-8B-Instruct
        - --tensor-parallel-size
        - "1"
        - --enable-prefix-caching
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: 32Gi
          requests:
            nvidia.com/gpu: 1
            memory: 24Gi
        ports:
        - containerPort: 8000
```

**Pros**: Horizontal scaling, high availability, multi-model support
**Cons**: Complex setup, higher infrastructure cost

---

### 2.3 Option C: Hybrid Cloud Deployment

**Best for**: Cost optimization, variable workloads

**Architecture**:
- **Local**: Common models (Llama 8B) for 90% of requests
- **Cloud**: Large models (70B) for complex queries (10% of requests)
- **Fallback**: Cloud API when local capacity exceeded

```typescript
// server/neural-bridge/hybrid-inference-router.ts
export class HybridInferenceRouter {
  async route(request: InferenceRequest): Promise<InferenceProvider> {
    const complexity = await this.analyzeComplexity(request.prompt);

    // Route based on complexity and current load
    if (complexity < 0.5 && this.localCapacity > 0.3) {
      return 'local-llama-8b';
    } else if (complexity > 0.8) {
      return 'cloud-llama-70b'; // Use cloud for hard queries
    } else {
      return this.localCapacity > 0.1 ? 'local-llama-8b' : 'cloud-llama-8b';
    }
  }

  private async analyzeComplexity(prompt: string): Promise<number> {
    // Heuristics: length, special tokens, code blocks, math
    const factors = {
      length: Math.min(prompt.length / 2000, 1),
      hasCode: prompt.includes('```') ? 0.3 : 0,
      hasMath: /\$.*\$/.test(prompt) ? 0.2 : 0,
      multiStep: prompt.split('\n').length > 10 ? 0.2 : 0,
    };

    return Math.min(
      factors.length + factors.hasCode + factors.hasMath + factors.multiStep,
      1
    );
  }
}
```

**Cost Savings**: 60-80% vs pure cloud deployment

---

## 3. Hidden State Extraction Implementation

### 3.1 Python Inference Server with vLLM

Create `inference-server/vllm_hidden_states.py`:

```python
#!/usr/bin/env python3
"""
vLLM Hidden States Extraction Server
Provides OpenAI-compatible API with additional hidden state endpoints
"""

import asyncio
import json
from typing import List, Dict, Optional, Union
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from vllm import LLM, SamplingParams
from vllm.outputs import RequestOutput
import uvicorn

# ============================================================================
# Configuration
# ============================================================================

class Config:
    MODEL_NAME = "meta-llama/Llama-3.1-8B-Instruct"
    TENSOR_PARALLEL_SIZE = 1  # Number of GPUs for tensor parallelism
    MAX_MODEL_LEN = 8192
    GPU_MEMORY_UTILIZATION = 0.9
    ENABLE_PREFIX_CACHING = True
    DTYPE = "float16"  # or "bfloat16" for newer GPUs

# ============================================================================
# Request/Response Models
# ============================================================================

class HiddenStateRequest(BaseModel):
    prompts: List[str]
    layer: int = -2  # Default: second-to-last layer
    max_tokens: int = 1
    temperature: float = 0.0
    return_hidden_states: bool = True

class HiddenStateResponse(BaseModel):
    hidden_states: List[List[float]]
    layer: int
    model: str
    prompt_tokens: List[int]
    metadata: Dict[str, Union[str, int, float]]

class CompletionRequest(BaseModel):
    prompt: str
    max_tokens: int = 100
    temperature: float = 0.7
    top_p: float = 0.9
    output_hidden_states: bool = False
    hidden_state_layer: int = -2

# ============================================================================
# vLLM Hidden State Extractor
# ============================================================================

class VLLMHiddenStateExtractor:
    def __init__(self, model_name: str, config: Config):
        """Initialize vLLM engine with hidden state extraction support"""
        print(f"Loading model: {model_name}")

        self.model_name = model_name
        self.llm = LLM(
            model=model_name,
            tensor_parallel_size=config.TENSOR_PARALLEL_SIZE,
            max_model_len=config.MAX_MODEL_LEN,
            gpu_memory_utilization=config.GPU_MEMORY_UTILIZATION,
            enable_prefix_caching=config.ENABLE_PREFIX_CACHING,
            dtype=config.DTYPE,
            trust_remote_code=True,
        )

        # Get model configuration
        self.model_config = self.llm.llm_engine.model_config
        self.num_layers = self.model_config.hf_config.num_hidden_layers
        self.hidden_size = self.model_config.hf_config.hidden_size

        print(f"Model loaded successfully!")
        print(f"  Layers: {self.num_layers}")
        print(f"  Hidden size: {self.hidden_size}")
        print(f"  Dtype: {config.DTYPE}")

    def extract_hidden_states(
        self,
        prompts: List[str],
        layer: int = -2,
        max_tokens: int = 1,
    ) -> List[np.ndarray]:
        """
        Extract hidden states from specified layer

        Args:
            prompts: List of input prompts
            layer: Layer index (-1 = last, -2 = second-to-last)
            max_tokens: Number of tokens to generate (1 for encoding only)

        Returns:
            List of hidden state vectors (one per prompt)
        """
        # Convert negative layer index to positive
        if layer < 0:
            layer_idx = self.num_layers + layer
        else:
            layer_idx = layer

        if layer_idx < 0 or layer_idx >= self.num_layers:
            raise ValueError(f"Invalid layer {layer}. Model has {self.num_layers} layers.")

        # Configure sampling to minimize generation
        sampling_params = SamplingParams(
            temperature=0.0,
            max_tokens=max_tokens,
            top_p=1.0,
        )

        # Monkey-patch the model forward pass to capture hidden states
        hidden_states_cache = []

        def hook_fn(module, input, output):
            """Hook to capture layer outputs"""
            if isinstance(output, tuple):
                hidden_state = output[0]  # (batch, seq_len, hidden_size)
            else:
                hidden_state = output

            # Take the last token's hidden state
            last_token_state = hidden_state[:, -1, :]  # (batch, hidden_size)
            hidden_states_cache.append(last_token_state.cpu().numpy())

        # Register hook on target layer
        target_layer = self.llm.llm_engine.model_executor.driver_worker.model_runner.model.model.layers[layer_idx]
        hook_handle = target_layer.register_forward_hook(hook_fn)

        try:
            # Run inference
            outputs = self.llm.generate(prompts, sampling_params)

            # Extract and format hidden states
            result = []
            for i, output in enumerate(outputs):
                if i < len(hidden_states_cache):
                    hidden_state = hidden_states_cache[i][0]  # First item in batch
                    result.append(hidden_state.tolist())
                else:
                    # Fallback: zero vector
                    result.append([0.0] * self.hidden_size)

            return result

        finally:
            # Clean up hook
            hook_handle.remove()
            hidden_states_cache.clear()

    def generate(
        self,
        prompt: str,
        max_tokens: int = 100,
        temperature: float = 0.7,
        top_p: float = 0.9,
    ) -> str:
        """Standard text generation"""
        sampling_params = SamplingParams(
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
        )

        outputs = self.llm.generate([prompt], sampling_params)
        return outputs[0].outputs[0].text

# ============================================================================
# FastAPI Server
# ============================================================================

app = FastAPI(title="vLLM Hidden States Server", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global extractor instance
extractor: Optional[VLLMHiddenStateExtractor] = None

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    global extractor
    config = Config()
    extractor = VLLMHiddenStateExtractor(config.MODEL_NAME, config)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": Config.MODEL_NAME,
        "num_layers": extractor.num_layers if extractor else 0,
        "hidden_size": extractor.hidden_size if extractor else 0,
    }

@app.post("/v1/hidden_states", response_model=HiddenStateResponse)
async def extract_hidden_states(request: HiddenStateRequest):
    """Extract hidden states from prompts"""
    if not extractor:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        hidden_states = extractor.extract_hidden_states(
            prompts=request.prompts,
            layer=request.layer,
            max_tokens=request.max_tokens,
        )

        return HiddenStateResponse(
            hidden_states=hidden_states,
            layer=request.layer,
            model=Config.MODEL_NAME,
            prompt_tokens=[len(p.split()) for p in request.prompts],
            metadata={
                "num_prompts": len(request.prompts),
                "hidden_size": extractor.hidden_size,
                "dtype": Config.DTYPE,
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/completions")
async def create_completion(request: CompletionRequest):
    """OpenAI-compatible completion endpoint"""
    if not extractor:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        text = extractor.generate(
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
        )

        response = {
            "id": f"cmpl-{hash(request.prompt)}",
            "object": "text_completion",
            "model": Config.MODEL_NAME,
            "choices": [{
                "text": text,
                "index": 0,
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": len(request.prompt.split()),
                "completion_tokens": len(text.split()),
                "total_tokens": len(request.prompt.split()) + len(text.split()),
            }
        }

        # Optionally include hidden states
        if request.output_hidden_states:
            hidden_states = extractor.extract_hidden_states(
                prompts=[request.prompt],
                layer=request.hidden_state_layer,
                max_tokens=1,
            )
            response["hidden_states"] = hidden_states[0]

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Prometheus-compatible metrics endpoint"""
    # TODO: Implement actual metrics tracking
    return {
        "requests_total": 0,
        "requests_per_second": 0,
        "average_latency_ms": 0,
        "gpu_utilization_percent": 0,
    }

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--model", type=str, default=Config.MODEL_NAME)
    args = parser.parse_args()

    # Override config
    Config.MODEL_NAME = args.model

    # Run server
    uvicorn.run(app, host=args.host, port=args.port)
```

### 3.2 TypeScript Client Integration

Create `server/neural-bridge/self-hosted-llm-client.ts`:

```typescript
/**
 * Self-Hosted LLM Client for Neural Bridge
 * Connects to local vLLM server for hidden state extraction
 */

import { createLogger } from "../utils/logger";
import type { HiddenStateResult } from "./llm-adapters";

const logger = createLogger('Neural Bridge:SelfHostedClient');

// ============================================================================
// Types
// ============================================================================

export interface SelfHostedConfig {
  baseUrl: string;
  modelName: string;
  timeout?: number;
  maxRetries?: number;
}

export interface HiddenStateExtractionRequest {
  prompts: string[];
  layer?: number;
  maxTokens?: number;
  temperature?: number;
  returnHiddenStates?: boolean;
}

export interface HiddenStateExtractionResponse {
  hidden_states: number[][];
  layer: number;
  model: string;
  prompt_tokens: number[];
  metadata: {
    num_prompts: number;
    hidden_size: number;
    dtype: string;
  };
}

// ============================================================================
// Self-Hosted LLM Client
// ============================================================================

export class SelfHostedLLMClient {
  private baseUrl: string;
  private modelName: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: SelfHostedConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.modelName = config.modelName;
    this.timeout = config.timeout || 30000; // 30 seconds
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Check if the vLLM server is healthy and ready
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.error('Health check failed', { status: response.status });
        return false;
      }

      const data = await response.json();
      logger.info('vLLM server healthy', {
        model: data.model,
        numLayers: data.num_layers,
        hiddenSize: data.hidden_size,
      });

      return data.status === 'healthy';
    } catch (error) {
      logger.error('Health check error', { error });
      return false;
    }
  }

  /**
   * Extract hidden states from prompts
   */
  async extractHiddenStates(
    prompts: string[],
    layer: number = -2
  ): Promise<HiddenStateResult[]> {
    const startTime = Date.now();

    // Validate inputs
    if (!prompts || prompts.length === 0) {
      throw new Error('Prompts array cannot be empty');
    }

    if (prompts.length > 32) {
      logger.warn('Large batch size may cause timeout', { count: prompts.length });
    }

    // Prepare request
    const request: HiddenStateExtractionRequest = {
      prompts,
      layer,
      maxTokens: 1,
      temperature: 0.0,
      returnHiddenStates: true,
    };

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/v1/hidden_states`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data: HiddenStateExtractionResponse = await response.json();

        // Convert to HiddenStateResult format
        const results: HiddenStateResult[] = prompts.map((prompt, i) => ({
          prompt,
          hiddenState: data.hidden_states[i],
          layer: data.layer,
          tokenCount: data.prompt_tokens[i],
          metadata: {
            model: data.model,
            provider: 'SelfHosted-vLLM',
            timestamp: new Date(),
            processingTime: Date.now() - startTime,
          },
        }));

        logger.info('Successfully extracted hidden states', {
          count: results.length,
          layer: data.layer,
          hiddenSize: data.metadata.hidden_size,
          processingTime: Date.now() - startTime,
        });

        return results;
      } catch (error) {
        lastError = error as Error;

        logger.error('Hidden state extraction attempt failed', {
          attempt,
          maxRetries: this.maxRetries,
          error: lastError.message,
        });

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.info('Retrying extraction', { delayMs: delay });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to extract hidden states after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate text completion
   */
  async complete(
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      outputHiddenStates?: boolean;
      hiddenStateLayer?: number;
    } = {}
  ): Promise<{
    text: string;
    hiddenStates?: number[];
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        max_tokens: options.maxTokens || 100,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        output_hidden_states: options.outputHiddenStates || false,
        hidden_state_layer: options.hiddenStateLayer || -2,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Completion failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      text: data.choices[0].text,
      hiddenStates: data.hidden_states,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  /**
   * Batch extract hidden states with automatic chunking
   */
  async extractHiddenStatesBatch(
    prompts: string[],
    layer: number = -2,
    batchSize: number = 8
  ): Promise<HiddenStateResult[]> {
    const results: HiddenStateResult[] = [];

    // Process in batches
    for (let i = 0; i < prompts.length; i += batchSize) {
      const batch = prompts.slice(i, i + batchSize);

      logger.info('Processing batch', {
        batchIndex: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(prompts.length / batchSize),
        batchSize: batch.length,
      });

      const batchResults = await this.extractHiddenStates(batch, layer);
      results.push(...batchResults);
    }

    return results;
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let globalClient: SelfHostedLLMClient | null = null;

export function createSelfHostedClient(config: SelfHostedConfig): SelfHostedLLMClient {
  return new SelfHostedLLMClient(config);
}

export function getGlobalSelfHostedClient(): SelfHostedLLMClient {
  if (!globalClient) {
    // Default configuration (can be overridden via env vars)
    const baseUrl = process.env.VLLM_BASE_URL || 'http://localhost:8000';
    const modelName = process.env.VLLM_MODEL_NAME || 'llama-3.1-8b';

    globalClient = new SelfHostedLLMClient({
      baseUrl,
      modelName,
      timeout: 60000, // 60 seconds
      maxRetries: 3,
    });

    logger.info('Initialized global self-hosted client', { baseUrl, modelName });
  }

  return globalClient;
}
```

### 3.3 Integration with W-Matrix Trainer

Update `server/neural-bridge/w-matrix-trainer.ts`:

```typescript
import { getGlobalSelfHostedClient } from './self-hosted-llm-client';
import { extractHiddenStatesFromLLM } from './llm-adapters';

export async function trainWMatrix(
  sourceModel: string,
  targetModel: string,
  trainingExamples: string[]
): Promise<WMatrix> {
  const logger = createLogger('WMatrixTrainer');

  // Check if self-hosted client is available
  const useSelfHosted = process.env.USE_SELF_HOSTED_LLM === 'true';

  if (useSelfHosted) {
    logger.info('Using self-hosted LLM for hidden state extraction');
    const client = getGlobalSelfHostedClient();

    // Health check first
    const healthy = await client.healthCheck();
    if (!healthy) {
      logger.warn('Self-hosted server unhealthy, falling back to API');
    } else {
      // Extract hidden states from self-hosted model
      const sourceStates = await client.extractHiddenStatesBatch(
        trainingExamples,
        -2, // Layer -2
        8   // Batch size
      );

      // Continue with W-Matrix training...
      return await computeWMatrixFromStates(sourceStates, targetModel);
    }
  }

  // Fallback to API-based extraction
  logger.info('Using API-based hidden state extraction');
  const results = await extractHiddenStatesFromLLM({
    modelName: sourceModel,
    prompts: trainingExamples,
    layer: -2,
  });

  return await computeWMatrixFromStates(results, targetModel);
}
```

---

## 4. Docker Deployment

### 4.1 Dockerfile for vLLM Server

Create `inference-server/Dockerfile`:

```dockerfile
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    vllm==0.6.3 \
    torch==2.4.0 \
    transformers==4.45.0 \
    fastapi==0.115.0 \
    uvicorn==0.31.0 \
    pydantic==2.9.0 \
    numpy==1.26.0

# Copy server code
COPY vllm_hidden_states.py /app/server.py

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV VLLM_WORKER_MULTIPROC_METHOD=spawn

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3 -c "import requests; requests.get('http://localhost:8000/health').raise_for_status()"

# Default command
CMD ["python3", "server.py", "--host", "0.0.0.0", "--port", "8000"]
```

### 4.2 Docker Compose Configuration

Create `docker-compose.vllm.yml`:

```yaml
version: '3.8'

services:
  # Llama 3.1 8B - Primary model
  vllm-llama-8b:
    build:
      context: ./inference-server
      dockerfile: Dockerfile
    container_name: vllm-llama-8b
    ports:
      - "8000:8000"
    environment:
      - VLLM_MODEL=meta-llama/Llama-3.1-8B-Instruct
      - VLLM_TENSOR_PARALLEL_SIZE=1
      - VLLM_GPU_MEMORY_UTILIZATION=0.9
      - VLLM_MAX_MODEL_LEN=8192
    volumes:
      - ./models:/root/.cache/huggingface
      - ./logs:/app/logs
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s

  # Qwen 2.5 7B - Chinese support
  vllm-qwen-7b:
    build:
      context: ./inference-server
      dockerfile: Dockerfile
    container_name: vllm-qwen-7b
    ports:
      - "8001:8000"
    environment:
      - VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct
      - VLLM_TENSOR_PARALLEL_SIZE=1
      - VLLM_GPU_MEMORY_UTILIZATION=0.9
    volumes:
      - ./models:/root/.cache/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped

  # Nginx load balancer (optional)
  nginx-lb:
    image: nginx:alpine
    container_name: vllm-nginx
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - vllm-llama-8b
      - vllm-qwen-7b
    restart: unless-stopped

volumes:
  models:
    driver: local
```

### 4.3 Nginx Load Balancer Config

Create `nginx.conf`:

```nginx
upstream vllm_backend {
    least_conn;
    server vllm-llama-8b:8000 weight=2;
    server vllm-qwen-7b:8000 weight=1;
}

server {
    listen 80;
    server_name _;

    location /v1/ {
        proxy_pass http://vllm_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Increase timeouts for long-running inference
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /health {
        proxy_pass http://vllm_backend/health;
    }

    location /metrics {
        proxy_pass http://vllm_backend/metrics;
    }
}
```

### 4.4 Deployment Commands

```bash
# Build and start services
docker-compose -f docker-compose.vllm.yml up -d --build

# Check logs
docker-compose -f docker-compose.vllm.yml logs -f vllm-llama-8b

# Test health
curl http://localhost:8000/health

# Test hidden state extraction
curl -X POST http://localhost:8000/v1/hidden_states \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": ["What is the capital of France?", "Explain quantum computing"],
    "layer": -2,
    "max_tokens": 1
  }'

# Scale service
docker-compose -f docker-compose.vllm.yml up -d --scale vllm-llama-8b=3

# Stop services
docker-compose -f docker-compose.vllm.yml down
```

---

## 5. Cost Analysis

### 5.1 API-Based Costs (Current)

**Monthly Inference Costs** (Assuming 10M tokens/month):

| Provider | Model | Input Cost | Output Cost | Monthly Total |
|----------|-------|------------|-------------|---------------|
| **OpenAI** | GPT-4o | $2.50/M | $10/M | **$250-$500** |
| **OpenAI** | GPT-5-mini | $1.00/M | $4/M | **$100-$200** |
| **Anthropic** | Claude Opus 4.1 | $15/M | $75/M | **$1,500+** |
| **Anthropic** | Claude Sonnet 4.5 | $3/M | $15/M | **$300-$600** |
| **Anthropic** | Claude Haiku 4.5 | $0.25/M | $1.25/M | **$25-$50** |

**Hidden State Extraction**: APIs don't support this natively. Must use embeddings API:
- OpenAI text-embedding-3-large: $0.13/M tokens = **$13/month**
- Note: Embeddings ≠ true hidden states (approximation only)

**Total API Cost**: $300-$1,500+/month (depending on model usage)

### 5.2 Self-Hosted Costs

#### Option A: Purchase GPU Hardware

| Component | Model | Cost (One-time) |
|-----------|-------|-----------------|
| GPU | RTX 4090 24GB | $1,600 |
| GPU | RTX 6000 Ada 48GB | $6,800 |
| GPU | NVIDIA A100 40GB | $10,000 |
| GPU | NVIDIA H100 80GB | $30,000 |
| CPU | AMD Ryzen 9 5950X | $400 |
| RAM | 64GB DDR4 | $200 |
| Storage | 2TB NVMe SSD | $150 |
| PSU | 1200W 80+ Platinum | $200 |
| Case + Cooling | - | $300 |

**Total (RTX 4090 Build)**: $2,850 one-time

**Ongoing Costs**:
- Electricity: ~350W × 24h × 30d × $0.12/kWh = **$30/month**
- Maintenance: **$20/month** (average)
- **Total Ongoing**: $50/month

**Break-even vs API**: ~6-10 months

#### Option B: Cloud GPU Rental

| Provider | Instance Type | GPU | $/hour | $/month (24/7) | $/month (8h/day) |
|----------|---------------|-----|--------|----------------|------------------|
| AWS | g5.xlarge | A10G 24GB | $1.01 | $733 | $244 |
| AWS | g5.2xlarge | A10G 24GB | $1.21 | $878 | $293 |
| AWS | p4d.24xlarge | 8× A100 40GB | $32.77 | $23,768 | $7,923 |
| GCP | a2-highgpu-1g | A100 40GB | $3.67 | $2,662 | $887 |
| Azure | NC24ads_A100_v4 | A100 80GB | $3.67 | $2,662 | $887 |
| Lambda Labs | 1× A100 40GB | A100 40GB | $1.10 | $798 | $266 |
| RunPod | RTX 4090 | RTX 4090 24GB | $0.44 | $319 | $106 |

**Recommendation**:
- **Development**: RunPod RTX 4090 @ $0.44/hr (~$106/month for 8h/day)
- **Production**: AWS g5.2xlarge @ $1.21/hr (~$293/month for 8h/day)
- **High Traffic**: On-prem RTX 4090 ($2,850 upfront, $50/month ongoing)

### 5.3 ROI Comparison

**Scenario: 10M tokens/month, GPT-4o equivalent quality**

| Solution | Upfront | Monthly | 12-Month Total | 24-Month Total |
|----------|---------|---------|----------------|----------------|
| **OpenAI API** | $0 | $400 | $4,800 | $9,600 |
| **Cloud GPU (8h/day)** | $0 | $293 | $3,516 | $7,032 |
| **Cloud GPU (24/7)** | $0 | $878 | $10,536 | $21,072 |
| **On-Prem RTX 4090** | $2,850 | $50 | $3,450 | $4,050 |

**Key Insight**: On-prem becomes cheaper after 7 months vs API, 10 months vs cloud (8h/day).

### 5.4 Hidden Cost Savings

Self-hosting enables features impossible with APIs:

1. **True Hidden State Access**: Worth $50-$100/month (no API equivalent)
2. **Fine-tuning**: Save $500-$2,000 per training run
3. **Unlimited Experiments**: No per-token charges
4. **Data Privacy**: Priceless for sensitive applications
5. **Custom Modifications**: Model surgery, layer fusion, etc.

---

## 6. Performance Optimization

### 6.1 Quantization Strategies

```python
# inference-server/quantization_config.py

from vllm import LLM

# FP16 (Baseline)
llm_fp16 = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    dtype="float16",
)

# INT8 (50% VRAM reduction, <2% quality loss)
llm_int8 = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    quantization="bitsandbytes",  # or "awq"
    dtype="int8",
)

# INT4 AWQ (75% VRAM reduction, ~3% quality loss)
llm_int4_awq = LLM(
    model="TheBloke/Llama-3.1-8B-Instruct-AWQ",
    quantization="awq",
)

# INT4 GPTQ (75% VRAM reduction, ~4% quality loss)
llm_int4_gptq = LLM(
    model="TheBloke/Llama-3.1-8B-Instruct-GPTQ",
    quantization="gptq",
)
```

**Recommendation**: Use INT8 for production (best quality/VRAM trade-off).

### 6.2 Batching and Throughput

```python
# Optimal batch size configuration
class OptimizedConfig:
    # Dynamic batching
    MAX_NUM_SEQS = 256  # Max concurrent requests
    MAX_NUM_BATCHED_TOKENS = 8192  # Tokens per batch

    # KV-Cache optimization
    BLOCK_SIZE = 16
    GPU_MEMORY_UTILIZATION = 0.9

    # Prefix caching (huge speedup for common prompts)
    ENABLE_PREFIX_CACHING = True
```

**Performance Impact**:
- Batch size 1: ~20 tok/s
- Batch size 8: ~100 tok/s (5× speedup)
- Batch size 32: ~250 tok/s (12.5× speedup)
- With prefix caching: +50% speedup for repeated prompts

### 6.3 Tensor Parallelism (Multi-GPU)

```python
# For large models (70B+) across multiple GPUs
llm = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    tensor_parallel_size=4,  # Split across 4 GPUs
    pipeline_parallel_size=2,  # 2-stage pipeline
)
```

**Example: Llama 3.1 70B on 4× A100 40GB**:
- Memory per GPU: ~45GB
- Inference speed: ~15 tok/s
- Total cost: 4× A100 = $12/hr cloud or $40k upfront

### 6.4 PagedAttention (vLLM Special Feature)

vLLM's PagedAttention reduces memory fragmentation:

```
Traditional:         PagedAttention:
┌───────────┐       ┌─┬─┬─┬─┬─┐
│ KV Cache  │       │█│█│ │█│ │  (Blocks reused)
│ (Wasted)  │       └─┴─┴─┴─┴─┘
└───────────┘       23% less memory
50% utilization     90% utilization
```

**Result**: 2-3× higher throughput with same VRAM.

### 6.5 Speculative Decoding

```python
# Use small draft model + large target model
llm = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    speculative_model="meta-llama/Llama-3.1-8B-Instruct",
    num_speculative_tokens=5,
)
```

**Speedup**: 1.5-2× faster generation (especially for long outputs).

---

## 7. Monitoring and Operations

### 7.1 Health Monitoring

```typescript
// server/monitoring/llm-health-check.ts

export interface LLMHealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    qps: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  gpu: {
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
    temperature: number;
  };
}

export async function checkLLMHealth(
  baseUrl: string
): Promise<LLMHealthMetrics> {
  const healthResponse = await fetch(`${baseUrl}/health`);
  const metricsResponse = await fetch(`${baseUrl}/metrics`);

  const health = await healthResponse.json();
  const metrics = await metricsResponse.json();

  return {
    status: healthResponse.ok ? 'healthy' : 'unhealthy',
    uptime: metrics.uptime_seconds || 0,
    requests: {
      total: metrics.requests_total || 0,
      successful: metrics.requests_success || 0,
      failed: metrics.requests_failed || 0,
      qps: metrics.requests_per_second || 0,
    },
    latency: {
      p50: metrics.latency_p50_ms || 0,
      p95: metrics.latency_p95_ms || 0,
      p99: metrics.latency_p99_ms || 0,
    },
    gpu: {
      utilization: metrics.gpu_utilization_percent || 0,
      memoryUsed: metrics.gpu_memory_used_gb || 0,
      memoryTotal: metrics.gpu_memory_total_gb || 0,
      temperature: metrics.gpu_temperature_celsius || 0,
    },
  };
}

// Automated alerting
export async function monitorLLMHealth() {
  const metrics = await checkLLMHealth('http://localhost:8000');

  // Alert conditions
  if (metrics.status === 'unhealthy') {
    await sendAlert('LLM server is down!');
  }

  if (metrics.gpu.utilization > 95) {
    await sendAlert('GPU utilization critically high');
  }

  if (metrics.latency.p95 > 5000) {
    await sendAlert('High latency detected (P95 > 5s)');
  }

  if (metrics.gpu.temperature > 85) {
    await sendAlert('GPU temperature too high!');
  }
}

// Run every 30 seconds
setInterval(monitorLLMHealth, 30000);
```

### 7.2 Logging and Observability

```typescript
// server/monitoring/inference-logger.ts

import { createLogger } from '../utils/logger';

const logger = createLogger('InferenceMonitor');

export function logInferenceRequest(request: {
  prompts: string[];
  model: string;
  layer: number;
}) {
  logger.info('Inference request', {
    model: request.model,
    promptCount: request.prompts.length,
    avgPromptLength: request.prompts.reduce((sum, p) => sum + p.length, 0) / request.prompts.length,
    layer: request.layer,
    timestamp: new Date().toISOString(),
  });
}

export function logInferenceResponse(response: {
  hiddenStates: number[][];
  processingTime: number;
  success: boolean;
}) {
  logger.info('Inference response', {
    success: response.success,
    hiddenStateCount: response.hiddenStates.length,
    processingTime: response.processingTime,
    timestamp: new Date().toISOString(),
  });
}

export function logInferenceError(error: Error, context: any) {
  logger.error('Inference error', {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}
```

### 7.3 Grafana Dashboard

```yaml
# docker-compose.monitoring.yml

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-dashboards:/etc/grafana/provisioning/dashboards
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro

  nvidia-gpu-exporter:
    image: nvidia/dcgm-exporter:latest
    container_name: nvidia-gpu-exporter
    ports:
      - "9400:9400"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              capabilities: [gpu]

volumes:
  prometheus-data:
  grafana-data:
```

**Prometheus Config** (`prometheus.yml`):

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'vllm'
    static_configs:
      - targets: ['vllm-llama-8b:8000']
        labels:
          model: 'llama-8b'

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'nvidia-gpu'
    static_configs:
      - targets: ['nvidia-gpu-exporter:9400']
```

### 7.4 Auto-Scaling (Kubernetes)

```yaml
# k8s/hpa.yaml

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vllm-llama-8b-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vllm-llama-8b
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
```

---

## 8. Implementation Roadmap

### Week 1: Local Development Setup

#### Day 1-2: Environment Preparation
- [ ] Install CUDA Toolkit 12.1+
- [ ] Install PyTorch 2.4+ with CUDA support
- [ ] Install vLLM: `pip install vllm`
- [ ] Verify GPU: `nvidia-smi`

```bash
# Installation script
#!/bin/bash

# CUDA 12.1 (Ubuntu 22.04)
wget https://developer.download.nvidia.com/compute/cuda/12.1.0/local_installers/cuda_12.1.0_530.30.02_linux.run
sudo sh cuda_12.1.0_530.30.02_linux.run

# PyTorch + vLLM
pip install torch==2.4.0 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install vllm==0.6.3 transformers fastapi uvicorn

# Test GPU
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python3 -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0)}')"
```

#### Day 3-4: Model Download and Testing
- [ ] Download Llama 3.1 8B from Hugging Face
- [ ] Test basic inference
- [ ] Verify hidden state extraction works

```bash
# Download model
python3 << EOF
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="meta-llama/Llama-3.1-8B-Instruct",
    local_dir="./models/llama-3.1-8b",
    token="YOUR_HF_TOKEN"
)
EOF

# Test inference
python3 << EOF
from vllm import LLM, SamplingParams

llm = LLM(model="./models/llama-3.1-8b")
output = llm.generate(
    ["What is the capital of France?"],
    SamplingParams(max_tokens=20)
)
print(output[0].outputs[0].text)
EOF
```

#### Day 5: Hidden State Extraction Testing
- [ ] Implement `vllm_hidden_states.py` (from Section 3.1)
- [ ] Run server: `python3 vllm_hidden_states.py`
- [ ] Test API: `curl http://localhost:8000/health`
- [ ] Extract hidden states from sample prompts

### Week 2: TypeScript Integration

#### Day 1-2: Client Implementation
- [ ] Create `self-hosted-llm-client.ts` (from Section 3.2)
- [ ] Implement health checks
- [ ] Test extraction from TypeScript

```typescript
// test-self-hosted.ts
import { createSelfHostedClient } from './server/neural-bridge/self-hosted-llm-client';

async function test() {
  const client = createSelfHostedClient({
    baseUrl: 'http://localhost:8000',
    modelName: 'llama-3.1-8b',
  });

  // Health check
  const healthy = await client.healthCheck();
  console.log('Health:', healthy);

  // Extract hidden states
  const results = await client.extractHiddenStates(
    ['What is AI?', 'Explain quantum physics'],
    -2
  );

  console.log('Results:', results.length);
  console.log('Hidden state dimensions:', results[0].hiddenState.length);
}

test();
```

#### Day 3: W-Matrix Integration
- [ ] Update `w-matrix-trainer.ts` to use self-hosted client
- [ ] Add environment variable: `USE_SELF_HOSTED_LLM=true`
- [ ] Test W-Matrix training with real hidden states

```bash
# Set environment
export USE_SELF_HOSTED_LLM=true
export VLLM_BASE_URL=http://localhost:8000
export VLLM_MODEL_NAME=llama-3.1-8b

# Test W-Matrix training
npm run test:wmatrix
```

#### Day 4-5: End-to-End Testing
- [ ] Test full Neural Bridge package creation
- [ ] Verify alignment quality improves with real hidden states
- [ ] Benchmark: API vs self-hosted performance

```typescript
// Run end-to-end test
import { buildNeural BridgePackage } from './server/neural-bridge/embedding-service';
import { getGlobalSelfHostedClient } from './server/neural-bridge/self-hosted-llm-client';

async function e2eTest() {
  const client = getGlobalSelfHostedClient();

  // Extract hidden states
  const results = await client.extractHiddenStates(
    ['The future of AI is bright'],
    -2
  );

  // Build package
  const pkg = await buildNeural BridgePackage(
    {
      vector: results[0].hiddenState,
      sourceModel: 'llama-3.1-8b',
      targetModel: 'gpt-4o',
      alignmentMethod: 'orthogonal',
    },
    embeddingService,
    alignVectorWMatrix
  );

  console.log('Package quality:', pkg.package.quality);
  // Expected: cosineSimilarity > 0.9
}
```

### Week 3: Production Deployment

#### Day 1-2: Docker Setup
- [ ] Create Dockerfile (from Section 4.1)
- [ ] Create docker-compose.yml (from Section 4.2)
- [ ] Build and test containers

```bash
# Build
docker-compose -f docker-compose.vllm.yml build

# Start
docker-compose -f docker-compose.vllm.yml up -d

# Check logs
docker-compose -f docker-compose.vllm.yml logs -f

# Test
curl http://localhost:8000/health
```

#### Day 3: Load Balancing
- [ ] Configure Nginx (from Section 4.3)
- [ ] Test load distribution
- [ ] Benchmark throughput

```bash
# Stress test
ab -n 1000 -c 10 -p test-request.json \
   -T "application/json" \
   http://localhost:8080/v1/hidden_states
```

#### Day 4-5: Monitoring Setup
- [ ] Deploy Prometheus + Grafana (from Section 7.3)
- [ ] Create custom dashboards
- [ ] Set up alerting rules

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana
open http://localhost:3001  # Login: admin/admin
```

### Week 4: Optimization and Scaling

#### Day 1-2: Performance Tuning
- [ ] Test quantization (INT8 vs FP16)
- [ ] Optimize batch sizes
- [ ] Enable prefix caching

```python
# Benchmark different configs
configs = [
    {"dtype": "float16", "batch": 8},
    {"dtype": "int8", "batch": 16},
    {"dtype": "int8", "batch": 32},
]

for config in configs:
    benchmark(config)
```

#### Day 3: Multi-Model Deployment
- [ ] Deploy Qwen 2.5 7B (Chinese support)
- [ ] Deploy Mistral 7B (fast inference)
- [ ] Implement model routing logic

#### Day 4-5: Production Testing
- [ ] Load testing (1000+ req/min)
- [ ] Failover testing
- [ ] Cost analysis vs API baseline

---

## 9. Troubleshooting Guide

### 9.1 Common Issues

#### CUDA Out of Memory (OOM)

**Symptoms**: `torch.cuda.OutOfMemoryError`

**Solutions**:
1. Reduce batch size:
   ```python
   MAX_NUM_SEQS = 128  # Default: 256
   ```

2. Lower GPU memory utilization:
   ```python
   GPU_MEMORY_UTILIZATION = 0.8  # Default: 0.9
   ```

3. Use quantization:
   ```python
   quantization="int8"  # Reduces VRAM by 50%
   ```

4. Reduce max model length:
   ```python
   max_model_len=4096  # Default: 8192
   ```

#### Slow Inference

**Symptoms**: >5 seconds for simple prompts

**Solutions**:
1. Enable prefix caching:
   ```python
   ENABLE_PREFIX_CACHING = True
   ```

2. Increase batch size:
   ```python
   MAX_NUM_SEQS = 256
   ```

3. Check GPU utilization:
   ```bash
   nvidia-smi -l 1  # Should be >80%
   ```

4. Use faster model:
   - Llama 3.1 8B → Mistral 7B (25% faster)
   - Qwen 2.5 14B → Qwen 2.5 7B (2× faster)

#### Model Download Fails

**Symptoms**: `OSError: 401 Client Error`

**Solutions**:
1. Set Hugging Face token:
   ```bash
   export HF_TOKEN="hf_xxxxxxxxxxxxx"
   ```

2. Accept model license on Hugging Face website
3. Use mirror (for China):
   ```bash
   export HF_ENDPOINT="https://hf-mirror.com"
   ```

#### Hidden States Return Zeros

**Symptoms**: All hidden state values are 0.0

**Solutions**:
1. Check layer index:
   ```python
   layer = -2  # Must be valid: -num_layers <= layer < num_layers
   ```

2. Verify hook registration:
   ```python
   print(f"Target layer: {target_layer}")
   print(f"Hook registered: {hook_handle}")
   ```

3. Increase max_tokens:
   ```python
   max_tokens = 5  # Some models need generation to populate states
   ```

### 9.2 Performance Benchmarks

**Expected Performance** (RTX 4090, Llama 3.1 8B, FP16):

| Batch Size | Tokens/Second | Latency (P95) | GPU Util |
|------------|---------------|---------------|----------|
| 1 | 45 | 200ms | 30% |
| 8 | 280 | 350ms | 75% |
| 16 | 450 | 500ms | 90% |
| 32 | 520 | 800ms | 95% |

**If you see lower performance**:
- Check CUDA version: `nvcc --version` (should be 12.1+)
- Check PyTorch CUDA: `python -c "import torch; print(torch.version.cuda)"`
- Update GPU drivers: `nvidia-smi` (should be 530+)
- Check thermal throttling: GPU temp should be <85°C

### 9.3 Debugging Commands

```bash
# Check GPU memory
nvidia-smi --query-gpu=memory.used,memory.total --format=csv

# Monitor GPU utilization
watch -n 1 nvidia-smi

# Check vLLM logs
docker logs -f vllm-llama-8b

# Test connectivity
curl -X POST http://localhost:8000/v1/hidden_states \
  -H "Content-Type: application/json" \
  -d '{"prompts": ["test"], "layer": -2}'

# Profile inference
python3 -m cProfile -o profile.stats server.py
python3 -c "import pstats; pstats.Stats('profile.stats').sort_stats('cumtime').print_stats(20)"
```

---

## 10. Future Extensions

### 10.1 Multi-Model Ensemble

Deploy multiple models and ensemble their hidden states:

```typescript
export class EnsembleInferenceEngine {
  async extractEnsembleHiddenStates(
    prompts: string[]
  ): Promise<number[][]> {
    // Extract from multiple models
    const [llama, qwen, mistral] = await Promise.all([
      this.llamaClient.extractHiddenStates(prompts, -2),
      this.qwenClient.extractHiddenStates(prompts, -2),
      this.mistralClient.extractHiddenStates(prompts, -2),
    ]);

    // Ensemble via weighted average
    return prompts.map((_, i) => {
      const weights = [0.5, 0.3, 0.2]; // Llama > Qwen > Mistral
      const ensemble = llama[i].hiddenState.map((val, dim) =>
        val * weights[0] +
        qwen[i].hiddenState[dim] * weights[1] +
        mistral[i].hiddenState[dim] * weights[2]
      );
      return ensemble;
    });
  }
}
```

**Benefits**: 5-10% better alignment quality, more robust to model biases.

### 10.2 Fine-Tuning for Domain Adaptation

```python
# Fine-tune Llama 3.1 8B on your domain data
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")

# Apply LoRA (Low-Rank Adaptation)
lora_config = LoraConfig(
    r=16,  # Rank
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1,
)

model = get_peft_model(model, lora_config)

# Train on your data
# ... training loop ...

# Save fine-tuned weights
model.save_pretrained("./models/llama-3.1-8b-finetuned")
```

**Use Cases**:
- Medical AI: Fine-tune on medical literature
- Legal AI: Fine-tune on legal documents
- Code AI: Fine-tune on GitHub repositories

### 10.3 Model Hot-Swapping

```typescript
export class DynamicModelRouter {
  private models: Map<string, SelfHostedLLMClient> = new Map();

  async swapModel(oldModel: string, newModel: string): Promise<void> {
    // Load new model
    const newClient = createSelfHostedClient({
      baseUrl: 'http://localhost:8001',
      modelName: newModel,
    });

    await newClient.healthCheck();

    // Register new model
    this.models.set(newModel, newClient);

    // Wait for traffic to drain from old model
    await this.drainTraffic(oldModel, 30000); // 30 seconds

    // Remove old model
    this.models.delete(oldModel);

    logger.info('Model swapped successfully', { oldModel, newModel });
  }
}
```

**Benefits**: Zero-downtime model updates.

### 10.4 Cross-Layer Alignment

Extract hidden states from multiple layers:

```typescript
export async function extractMultiLayerStates(
  prompts: string[]
): Promise<Map<number, number[][]>> {
  const layers = [-1, -2, -3, -4]; // Last 4 layers
  const results = new Map<number, number[][]>();

  for (const layer of layers) {
    const states = await client.extractHiddenStates(prompts, layer);
    results.set(layer, states.map(s => s.hiddenState));
  }

  return results;
}

// Use ensemble of layers for W-Matrix
export function computeMultiLayerWMatrix(
  multiLayerStates: Map<number, number[][]>
): WMatrix {
  // Concatenate or average states from multiple layers
  const ensembled = averageAcrossLayers(multiLayerStates);
  return computeWMatrix(ensembled);
}
```

**Benefits**: 10-15% better alignment, captures both low-level and high-level semantics.

### 10.5 Automated Model Selection

```typescript
export class AdaptiveModelSelector {
  async selectOptimalModel(
    prompt: string,
    requirements: {
      maxLatency?: number;
      minQuality?: number;
      maxCost?: number;
    }
  ): Promise<string> {
    const complexity = await this.analyzeComplexity(prompt);

    // Decision tree
    if (requirements.maxLatency && requirements.maxLatency < 500) {
      return 'mistral-7b'; // Fastest
    }

    if (complexity > 0.8 && requirements.minQuality > 0.9) {
      return 'llama-3.1-70b'; // Highest quality
    }

    if (this.detectLanguage(prompt) === 'zh') {
      return 'qwen-2.5-7b'; // Best for Chinese
    }

    // Default
    return 'llama-3.1-8b';
  }
}
```

**Benefits**: Automatically optimize cost/latency/quality trade-offs.

---

## Conclusion

This deployment guide provides everything needed to self-host open-source LLMs for Neural Bridge:

1. **Model Selection**: Llama 3.1 8B recommended for general use
2. **Deployment**: Docker + vLLM for simplicity, Kubernetes for scale
3. **Cost Savings**: 60-80% cheaper than API after 6-12 months
4. **Performance**: 2-10× faster with local deployment
5. **True Hidden States**: Unlock capabilities impossible with APIs

**Next Steps**:
1. Follow Week 1 roadmap to set up local environment
2. Test hidden state extraction quality
3. Deploy to Docker for production
4. Monitor and optimize based on your workload

**Success Metrics**:
- [ ] Hidden state extraction working (<500ms latency)
- [ ] W-Matrix alignment quality >0.9
- [ ] Monthly costs <$100 (vs $300+ with APIs)
- [ ] Uptime >99.5%

For questions or issues, refer to the [Troubleshooting Guide](#9-troubleshooting-guide) or open an issue on GitHub.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-17
**Author**: Neural Bridge Development Team
**License**: MIT
