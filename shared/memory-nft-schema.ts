/**
 * Awareness Memory NFT JSON-LD Metadata Schema
 * 
 * This schema enables AI crawlers and RAG systems to precisely identify
 * and understand memory assets in the Awareness marketplace.
 * 
 * Based on: https://awareness.market/ns#
 */

// JSON-LD Context
export const AWARENESS_CONTEXT = {
  "@context": {
    "awareness": "https://awareness.market/ns#",
    "schema": "https://schema.org/",
    "dc": "http://purl.org/dc/elements/1.1/"
  }
};

// Supported model origins for W-Matrix alignment
export type ModelOrigin = 
  // OpenAI
  | 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o' | 'o1' | 'o1-mini'
  // Anthropic
  | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-3.5-sonnet'
  // Meta LLaMA
  | 'llama-2-7b' | 'llama-2-13b' | 'llama-2-70b' | 'llama-3-8b' | 'llama-3-70b' 
  | 'llama-3.1-8b' | 'llama-3.1-70b' | 'llama-3.1-405b'
  // Google
  | 'gemini-pro' | 'gemini-ultra' | 'gemini-1.5-pro' | 'gemini-1.5-flash'
  // Mistral
  | 'mistral-7b' | 'mixtral-8x7b' | 'mixtral-8x22b' | 'mistral-large'
  // Chinese Models
  | 'qwen-7b' | 'qwen-14b' | 'qwen-72b' | 'qwen-2-7b' | 'qwen-2-72b' | 'qwen-2.5-7b' | 'qwen-2.5-72b'
  | 'deepseek-7b' | 'deepseek-67b' | 'deepseek-coder-7b' | 'deepseek-coder-33b' | 'deepseek-v2' | 'deepseek-v2.5' | 'deepseek-v3'
  | 'yi-6b' | 'yi-34b' | 'yi-1.5-9b' | 'yi-1.5-34b'
  | 'baichuan-7b' | 'baichuan-13b' | 'baichuan2-7b' | 'baichuan2-13b'
  | 'chatglm-6b' | 'chatglm2-6b' | 'chatglm3-6b' | 'glm-4'
  | 'internlm-7b' | 'internlm-20b' | 'internlm2-7b' | 'internlm2-20b'
  // Others
  | 'phi-2' | 'phi-3-mini' | 'phi-3-small' | 'phi-3-medium'
  | 'command-r' | 'command-r-plus'
  | 'grok-1' | 'grok-2';

// W-Matrix version identifiers
export type WMatrixVersion = 
  | 'v1.0-standard'
  | 'v1.1-optimized'
  | 'v2.0-hybrid';

// Compression types for latent vectors
export type CompressionType = 'none' | 'quantized-8bit' | 'quantized-4bit' | 'sparse';

// Domain categories for semantic indexing
export type DomainCategory = 
  | 'blockchain_security'
  | 'smart_contract_development'
  | 'defi_protocols'
  | 'machine_learning'
  | 'natural_language_processing'
  | 'computer_vision'
  | 'code_generation'
  | 'code_review'
  | 'legal_analysis'
  | 'medical_reasoning'
  | 'scientific_research'
  | 'creative_writing'
  | 'general_reasoning'
  | 'mathematics'
  | 'data_analysis';

// Task types for memory classification
export type TaskType = 
  | 'reasoning_and_analysis'
  | 'code_generation'
  | 'code_review'
  | 'classification'
  | 'summarization'
  | 'translation'
  | 'question_answering'
  | 'creative_generation'
  | 'data_extraction'
  | 'planning_and_execution';

/**
 * Technical specification for latent memory
 */
export interface LatentSpec {
  "@type": "awareness:LatentSpec";
  /** The model that generated this memory */
  model_origin: ModelOrigin;
  /** Dimension of the latent vector */
  latent_dimension: number;
  /** W-Matrix version used for alignment */
  w_matrix_version: WMatrixVersion;
  /** Alignment loss epsilon (lower is better, typically < 0.01) */
  alignment_loss_epsilon: number;
  /** Compression type applied to the vector */
  compression_type: CompressionType;
  /** Number of KV-cache layers (for reasoning chains) */
  kv_cache_layers?: number;
  /** Token count in the original context */
  original_token_count?: number;
}

/**
 * Semantic context for AI discovery
 */
export interface SemanticContext {
  /** Keywords for search indexing */
  keywords: string[];
  /** Primary domain category */
  domain: DomainCategory;
  /** Type of task this memory excels at */
  task_type: TaskType;
  /** Additional semantic tags */
  tags?: string[];
  /** Natural language description for RAG systems */
  ai_description?: string;
}

/**
 * Access control and pricing
 */
export interface AccessControl {
  /** Whether this memory is publicly accessible */
  is_public: boolean;
  /** IPFS CID of the encrypted latent vector */
  encrypted_cid: string;
  /** Price per API call in $AMEM tokens */
  price_per_call: string;
  /** ERC-6551 Token Bound Account of the owner */
  owner_agent_tba: string;
  /** Optional: Subscription tier for bulk access */
  subscription_tier?: 'free' | 'basic' | 'pro' | 'enterprise';
}

/**
 * Provenance tracking for memory lineage
 */
export interface Provenance {
  /** Parent memory this was derived from (null if original) */
  parent_memory: string | null;
  /** ISO 8601 timestamp of creation */
  created_at: string;
  /** Total number of times this memory has been used */
  usage_count: number;
  /** Average rating from users (0-5) */
  average_rating?: number;
  /** Number of ratings received */
  rating_count?: number;
}

/**
 * Complete Awareness Memory Asset metadata (JSON-LD format)
 */
export interface AwarenessMemoryAsset {
  "@context": typeof AWARENESS_CONTEXT["@context"];
  "@type": "awareness:MemoryAsset";
  
  /** Identification information */
  identification: {
    /** Human-readable name */
    name: string;
    /** Detailed description */
    description: string;
    /** Semantic version */
    version: string;
    /** Unique identifier (NFT token ID or UUID) */
    id?: string;
  };
  
  /** Technical specifications */
  technical_spec: LatentSpec;
  
  /** Semantic context for discovery */
  semantic_context: SemanticContext;
  
  /** Access control and pricing */
  access_control: AccessControl;
  
  /** Provenance and usage tracking */
  provenance: Provenance;
}

/**
 * Create a new Memory Asset metadata object
 */
export function createMemoryAssetMetadata(
  params: Omit<AwarenessMemoryAsset, "@context" | "@type">
): AwarenessMemoryAsset {
  return {
    "@context": AWARENESS_CONTEXT["@context"],
    "@type": "awareness:MemoryAsset",
    ...params
  };
}

/**
 * Validate Memory Asset metadata
 */
export function validateMemoryAsset(asset: AwarenessMemoryAsset): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!asset.identification?.name) errors.push("Missing identification.name");
  if (!asset.identification?.description) errors.push("Missing identification.description");
  if (!asset.identification?.version) errors.push("Missing identification.version");
  
  // Validate technical spec
  if (!asset.technical_spec?.model_origin) errors.push("Missing technical_spec.model_origin");
  if (!asset.technical_spec?.latent_dimension || asset.technical_spec.latent_dimension <= 0) {
    errors.push("Invalid technical_spec.latent_dimension");
  }
  if (!asset.technical_spec?.w_matrix_version) errors.push("Missing technical_spec.w_matrix_version");
  if (asset.technical_spec?.alignment_loss_epsilon === undefined || 
      asset.technical_spec.alignment_loss_epsilon < 0 || 
      asset.technical_spec.alignment_loss_epsilon > 1) {
    errors.push("Invalid technical_spec.alignment_loss_epsilon (must be 0-1)");
  }
  
  // Validate semantic context
  if (!asset.semantic_context?.keywords?.length) errors.push("Missing semantic_context.keywords");
  if (!asset.semantic_context?.domain) errors.push("Missing semantic_context.domain");
  if (!asset.semantic_context?.task_type) errors.push("Missing semantic_context.task_type");
  
  // Validate access control
  if (!asset.access_control?.encrypted_cid) errors.push("Missing access_control.encrypted_cid");
  if (!asset.access_control?.price_per_call) errors.push("Missing access_control.price_per_call");
  if (!asset.access_control?.owner_agent_tba) errors.push("Missing access_control.owner_agent_tba");
  
  // Validate provenance
  if (!asset.provenance?.created_at) errors.push("Missing provenance.created_at");
  if (asset.provenance?.usage_count === undefined || asset.provenance.usage_count < 0) {
    errors.push("Invalid provenance.usage_count");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Example: Golden Memory Capsule for Solidity Audit
 */
export const EXAMPLE_MEMORY_ASSET: AwarenessMemoryAsset = {
  "@context": AWARENESS_CONTEXT["@context"],
  "@type": "awareness:MemoryAsset",
  identification: {
    name: "Expert Solidity Audit Patterns - Reentrancy",
    description: "High-fidelity latent memory for detecting complex reentrancy patterns in EVM smart contracts. Trained on 10,000+ audited contracts.",
    version: "1.0.2",
    id: "memory-001"
  },
  technical_spec: {
    "@type": "awareness:LatentSpec",
    model_origin: "llama-3-70b",
    latent_dimension: 4096,
    w_matrix_version: "v1.0-standard",
    alignment_loss_epsilon: 0.0042,
    compression_type: "none",
    kv_cache_layers: 80,
    original_token_count: 128000
  },
  semantic_context: {
    keywords: ["solidity", "security", "audit", "reentrancy", "smart-contract", "evm", "vulnerability"],
    domain: "blockchain_security",
    task_type: "reasoning_and_analysis",
    tags: ["defi", "ethereum", "layer2"],
    ai_description: "This memory capsule contains expert-level reasoning patterns for identifying reentrancy vulnerabilities in Solidity smart contracts. It can detect both classic and cross-function reentrancy attacks."
  },
  access_control: {
    is_public: false,
    encrypted_cid: "ipfs://QmXoyp1234567890abcdef",
    price_per_call: "0.5 AMEM",
    owner_agent_tba: "0x742d35Cc6634C0532925a3b844Bc9e7595f5e123",
    subscription_tier: "pro"
  },
  provenance: {
    parent_memory: null,
    created_at: "2026-01-02T10:00:00Z",
    usage_count: 1240,
    average_rating: 4.8,
    rating_count: 156
  }
};
