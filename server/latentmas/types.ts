/**
 * LatentMAS V2.0 - Type Definitions
 * W-Matrix Standardization and KV-Cache Exchange Protocol
 */

/**
 * Supported AI model types for W-Matrix alignment
 */
export type ModelType = 
  // OpenAI GPT Series
  | "gpt-3.5"
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-4o"
  | "o1"
  | "o1-mini"
  // Anthropic Claude Series
  | "claude-3-opus"
  | "claude-3-sonnet"
  | "claude-3-haiku"
  | "claude-3.5-sonnet"
  // Meta LLaMA Series
  | "llama-2-7b"
  | "llama-2-13b"
  | "llama-2-70b"
  | "llama-3-8b"
  | "llama-3-70b"
  | "llama-3.1-8b"
  | "llama-3.1-70b"
  | "llama-3.1-405b"
  // Mistral Series
  | "mistral-7b"
  | "mixtral-8x7b"
  | "mixtral-8x22b"
  | "mistral-large"
  // Google Gemini Series
  | "gemini-pro"
  | "gemini-ultra"
  | "gemini-1.5-pro"
  | "gemini-1.5-flash"
  | "gemini-2.0-flash"
  | "gemini-2.0-pro"
  // Alibaba Qwen Series
  | "qwen-7b"
  | "qwen-14b"
  | "qwen-72b"
  | "qwen-2-7b"
  | "qwen-2-72b"
  | "qwen-2.5-7b"
  | "qwen-2.5-72b"
  // DeepSeek Series
  | "deepseek-7b"
  | "deepseek-67b"
  | "deepseek-coder-7b"
  | "deepseek-coder-33b"
  | "deepseek-v2"
  | "deepseek-v2.5"
  | "deepseek-v3"
  // 01.AI Yi Series
  | "yi-6b"
  | "yi-34b"
  | "yi-1.5-9b"
  | "yi-1.5-34b"
  // Baichuan Series
  | "baichuan-7b"
  | "baichuan-13b"
  | "baichuan2-7b"
  | "baichuan2-13b"
  // Microsoft Phi Series
  | "phi-2"
  | "phi-3-mini"
  | "phi-3-small"
  | "phi-3-medium"
  // Shanghai AI Lab InternLM Series
  | "internlm-7b"
  | "internlm-20b"
  | "internlm2-7b"
  | "internlm2-20b"
  // Tsinghua ChatGLM Series
  | "chatglm-6b"
  | "chatglm2-6b"
  | "chatglm3-6b"
  | "glm-4"
  // Cohere Series
  | "command-r"
  | "command-r-plus"
  // xAI Grok Series
  | "grok-1"
  | "grok-1.5"
  | "grok-2"
  | "grok-3";

/**
 * W-Matrix generation method
 */
export type WMatrixMethod = 
  | "orthogonal"      // Orthogonal transformation (lossless)
  | "learned"         // Learned lightweight parameters
  | "hybrid";         // Combination of both

/**
 * KV-Cache structure specification
 */
export interface KVCacheSpec {
  /** Key dimension */
  keyDimension: number;
  /** Value dimension */
  valueDimension: number;
  /** Number of attention heads */
  headCount: number;
  /** Number of layers */
  layerCount: number;
  /** Sequence length */
  sequenceLength: number;
}

/**
 * Standardized W-Matrix definition
 */
export interface WMatrixStandard {
  /** Version identifier (e.g., "1.0.0") */
  version: string;
  
  /** Source model type */
  sourceModel: ModelType;
  
  /** Target model type */
  targetModel: ModelType;
  
  /** Unified dimension for alignment */
  unifiedDimension: number;
  
  /** Matrix generation method */
  method: WMatrixMethod;
  
  /** KV-Cache compatibility specification */
  kvCacheCompatibility: KVCacheSpec;
  
  /** Transformation rules */
  transformationRules: {
    /** Orthogonal matrix for lossless transformation */
    orthogonalMatrix?: number[][];
    
    /** Lightweight shared parameters (if using learned method) */
    sharedParameters?: number[];
    
    /** Scaling factors */
    scalingFactors?: number[];
  };
  
  /** Quality metrics */
  qualityMetrics: {
    /** Expected alignment quality (0-1) */
    expectedQuality: number;
    
    /** Information retention rate (0-1) */
    informationRetention: number;
    
    /** Computational complexity (FLOPs) */
    computationalCost: number;
  };
  
  /** Metadata */
  metadata: {
    createdAt: Date;
    createdBy: string;
    description: string;
    isActive: boolean;
  };
}

/**
 * KV-Cache data structure
 */
export interface KVCache {
  /** Model that generated this KV-Cache */
  sourceModel: ModelType;
  
  /** Key tensors [layers][heads][sequence][key_dim] */
  keys: number[][][][];
  
  /** Value tensors [layers][heads][sequence][value_dim] */
  values: number[][][][];
  
  /** Attention mask */
  attentionMask?: number[][];
  
  /** Position encodings */
  positionEncodings?: number[][];
  
  /** Metadata */
  metadata: {
    sequenceLength: number;
    contextDescription: string;
    tokenCount: number;
    generatedAt: Date;
  };
}

/**
 * Aligned KV-Cache result
 */
export interface AlignedKVCache extends KVCache {
  /** Target model for this aligned cache */
  targetModel: ModelType;
  
  /** W-Matrix version used for alignment */
  wMatrixVersion: string;
  
  /** Alignment quality metrics */
  alignmentQuality: {
    /** Cosine similarity between original and aligned */
    cosineSimilarity: number;
    
    /** Euclidean distance */
    euclideanDistance: number;
    
    /** Information retention rate */
    informationRetention: number;
    
    /** Confidence score */
    confidence: number;
  };
}

/**
 * Memory exchange record
 */
export interface MemoryExchange {
  id: number;
  sellerId: number;
  buyerId: number;
  memoryType: "kv_cache" | "reasoning_chain" | "long_term_memory";
  kvCacheData: KVCache;
  wMatrixVersion: string;
  contextLength: number;
  tokenCount: number;
  price: number;
  qualityScore: number;
  createdAt: Date;
}

/**
 * Reasoning chain definition
 */
export interface ReasoningChain {
  id: number;
  creatorId: number;
  chainName: string;
  description: string;
  
  /** Example input that triggers this reasoning chain */
  inputExample: any;
  
  /** Example output produced by this chain */
  outputExample: any;
  
  /** KV-Cache snapshot of the reasoning process */
  kvCacheSnapshot: KVCache;
  
  /** Number of reasoning steps */
  stepCount: number;
  
  /** Average quality score from users */
  avgQuality: number;
  
  /** Price per use */
  pricePerUse: number;
  
  /** Total usage count */
  usageCount: number;
  
  createdAt: Date;
}

/**
 * Agent specification for compatibility checking
 */
export interface AgentSpec {
  modelType: ModelType;
  kvCacheSpec: KVCacheSpec;
  supportedWMatrixVersions: string[];
}

/**
 * W-Matrix alignment request
 */
export interface AlignmentRequest {
  kvCache: KVCache;
  sourceModel: ModelType;
  targetModel: ModelType;
  wMatrixVersion?: string; // Optional, will use latest if not specified
}

/**
 * W-Matrix alignment response
 */
export interface AlignmentResponse {
  alignedKVCache: AlignedKVCache;
  wMatrixVersion: string;
  processingTimeMs: number;
  success: boolean;
  error?: string;
}
