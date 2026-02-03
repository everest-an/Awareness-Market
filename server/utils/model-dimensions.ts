/**
 * Model Dimension Mapping
 *
 * Centralized mapping of AI model names to their hidden state dimensions.
 * Used for W-Matrix alignment and vector processing.
 *
 * Sources:
 * - Official model documentation
 * - Research papers
 * - API specifications
 */

export interface ModelInfo {
  name: string;
  provider: string;
  dimension: number;
  releaseDate?: string;
  isDeprecated?: boolean;
  aliases?: string[];
}

/**
 * Comprehensive model dimension mapping
 */
export const MODEL_DIMENSIONS: Record<string, ModelInfo> = {
  // ============================================================================
  // OpenAI Models
  // ============================================================================

  // GPT-5 Series (2025+)
  'gpt-5.2': {
    name: 'GPT-5.2',
    provider: 'OpenAI',
    dimension: 12288,
    releaseDate: '2025-Q4',
  },
  'gpt-5': {
    name: 'GPT-5',
    provider: 'OpenAI',
    dimension: 10240,
    releaseDate: '2025-Q2',
  },
  'gpt-5-mini': {
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    dimension: 6144,
    releaseDate: '2025-Q2',
  },
  'gpt-5-nano': {
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    dimension: 3072,
    releaseDate: '2025-Q3',
  },

  // GPT-4.1 Series
  'gpt-4.1': {
    name: 'GPT-4.1',
    provider: 'OpenAI',
    dimension: 8192,
    releaseDate: '2024-Q4',
  },
  'gpt-4.1-mini': {
    name: 'GPT-4.1 Mini',
    provider: 'OpenAI',
    dimension: 5120,
    releaseDate: '2024-Q4',
  },
  'gpt-4.1-nano': {
    name: 'GPT-4.1 Nano',
    provider: 'OpenAI',
    dimension: 2560,
    releaseDate: '2025-Q1',
  },

  // GPT-4 Series (Current)
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'OpenAI',
    dimension: 8192,
    releaseDate: '2024-05',
    aliases: ['gpt-4-omni'],
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    dimension: 5120,
    releaseDate: '2024-07',
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    dimension: 8192,
    releaseDate: '2024-04',
    aliases: ['gpt-4-turbo-2024-04-09'],
  },
  'gpt-4': {
    name: 'GPT-4',
    provider: 'OpenAI',
    dimension: 8192,
    releaseDate: '2023-03',
  },

  // GPT-3.5 Series (Legacy)
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    dimension: 4096,
    releaseDate: '2023-03',
    isDeprecated: false, // Still supported but legacy
  },
  'gpt-3.5-turbo-16k': {
    name: 'GPT-3.5 Turbo 16k',
    provider: 'OpenAI',
    dimension: 4096,
    releaseDate: '2023-06',
    isDeprecated: true,
  },

  // ============================================================================
  // Anthropic (Claude) Models
  // ============================================================================

  // Claude 4 Series (Current)
  'claude-opus-4-1-20250514': {
    name: 'Claude Opus 4.1',
    provider: 'Anthropic',
    dimension: 10240,
    releaseDate: '2025-05',
  },
  'claude-sonnet-4-5-20250929': {
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    dimension: 8192,
    releaseDate: '2025-09',
  },
  'claude-haiku-4-5-20251001': {
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    dimension: 6144,
    releaseDate: '2025-10',
  },

  // Claude 3.5 Series
  'claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    dimension: 8192,
    releaseDate: '2024-06',
    aliases: ['claude-3-5-sonnet-20240620'],
  },

  // Claude 3 Series (Legacy)
  'claude-3-opus': {
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    dimension: 8192,
    releaseDate: '2024-03',
  },
  'claude-3-sonnet': {
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    dimension: 6144,
    releaseDate: '2024-03',
  },
  'claude-3-haiku': {
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    dimension: 4096,
    releaseDate: '2024-03',
  },

  // Claude 2 Series (Deprecated)
  'claude-2.1': {
    name: 'Claude 2.1',
    provider: 'Anthropic',
    dimension: 4096,
    releaseDate: '2023-11',
    isDeprecated: true,
  },
  'claude-2': {
    name: 'Claude 2',
    provider: 'Anthropic',
    dimension: 4096,
    releaseDate: '2023-07',
    isDeprecated: true,
  },

  // ============================================================================
  // Meta (Llama) Models
  // ============================================================================

  'llama-3.3-70b': {
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    dimension: 8192,
    releaseDate: '2024-12',
  },
  'llama-3.1-405b': {
    name: 'Llama 3.1 405B',
    provider: 'Meta',
    dimension: 16384,
    releaseDate: '2024-07',
  },
  'llama-3.1-70b': {
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    dimension: 8192,
    releaseDate: '2024-07',
  },
  'llama-3.1-8b': {
    name: 'Llama 3.1 8B',
    provider: 'Meta',
    dimension: 4096,
    releaseDate: '2024-07',
  },
  'llama-3-70b': {
    name: 'Llama 3 70B',
    provider: 'Meta',
    dimension: 8192,
    releaseDate: '2024-04',
  },
  'llama-3-8b': {
    name: 'Llama 3 8B',
    provider: 'Meta',
    dimension: 4096,
    releaseDate: '2024-04',
  },

  // ============================================================================
  // Google (Gemini) Models
  // ============================================================================

  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    dimension: 8192,
    releaseDate: '2024-12',
  },
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    dimension: 10240,
    releaseDate: '2024-02',
  },
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    dimension: 6144,
    releaseDate: '2024-05',
  },
  'gemini-1.0-pro': {
    name: 'Gemini 1.0 Pro',
    provider: 'Google',
    dimension: 8192,
    releaseDate: '2023-12',
  },

  // ============================================================================
  // Mistral Models
  // ============================================================================

  'mistral-large-2': {
    name: 'Mistral Large 2',
    provider: 'Mistral',
    dimension: 8192,
    releaseDate: '2024-07',
  },
  'mistral-medium': {
    name: 'Mistral Medium',
    provider: 'Mistral',
    dimension: 6144,
    releaseDate: '2023-12',
  },
  'mistral-small': {
    name: 'Mistral Small',
    provider: 'Mistral',
    dimension: 4096,
    releaseDate: '2024-02',
  },
  'mixtral-8x7b': {
    name: 'Mixtral 8x7B',
    provider: 'Mistral',
    dimension: 4096,
    releaseDate: '2023-12',
  },
  'mixtral-8x22b': {
    name: 'Mixtral 8x22B',
    provider: 'Mistral',
    dimension: 6144,
    releaseDate: '2024-04',
  },

  // ============================================================================
  // OpenAI Embedding Models
  // ============================================================================

  'text-embedding-3-large': {
    name: 'Text Embedding 3 Large',
    provider: 'OpenAI',
    dimension: 3072,
    releaseDate: '2024-01',
  },
  'text-embedding-3-small': {
    name: 'Text Embedding 3 Small',
    provider: 'OpenAI',
    dimension: 1536,
    releaseDate: '2024-01',
  },
  'text-embedding-ada-002': {
    name: 'Text Embedding Ada 002',
    provider: 'OpenAI',
    dimension: 1536,
    releaseDate: '2022-12',
  },

  // ============================================================================
  // Default/Fallback
  // ============================================================================

  'default': {
    name: 'Default Model',
    provider: 'Unknown',
    dimension: 4096,
  },
};

/**
 * Get model dimension by model name
 * Supports fuzzy matching and aliases
 */
export function getModelDimension(modelName: string): number {
  const normalizedName = modelName.toLowerCase().trim();

  // Direct match
  if (MODEL_DIMENSIONS[normalizedName]) {
    return MODEL_DIMENSIONS[normalizedName].dimension;
  }

  // Check aliases
  for (const [key, info] of Object.entries(MODEL_DIMENSIONS)) {
    if (info.aliases?.some((alias) => alias.toLowerCase() === normalizedName)) {
      return info.dimension;
    }
  }

  // Fuzzy match - check if model name contains known model
  for (const [key, info] of Object.entries(MODEL_DIMENSIONS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return info.dimension;
    }
  }

  // Provider-based fallback
  if (normalizedName.includes('gpt-5')) return 10240;
  if (normalizedName.includes('gpt-4')) return 8192;
  if (normalizedName.includes('gpt-3')) return 4096;
  if (normalizedName.includes('claude-4')) return 8192;
  if (normalizedName.includes('claude-3')) return 6144;
  if (normalizedName.includes('llama-3')) return 8192;
  if (normalizedName.includes('gemini')) return 8192;
  if (normalizedName.includes('mistral')) return 6144;

  // Default fallback
  return MODEL_DIMENSIONS['default'].dimension;
}

/**
 * Get full model information
 */
export function getModelInfo(modelName: string): ModelInfo | null {
  const normalizedName = modelName.toLowerCase().trim();

  // Direct match
  if (MODEL_DIMENSIONS[normalizedName]) {
    return MODEL_DIMENSIONS[normalizedName];
  }

  // Check aliases
  for (const [key, info] of Object.entries(MODEL_DIMENSIONS)) {
    if (info.aliases?.some((alias) => alias.toLowerCase() === normalizedName)) {
      return info;
    }
  }

  return null;
}

/**
 * List all supported models
 */
export function getAllModels(): ModelInfo[] {
  return Object.values(MODEL_DIMENSIONS).filter((info) => info.name !== 'Default Model');
}

/**
 * List models by provider
 */
export function getModelsByProvider(provider: string): ModelInfo[] {
  return Object.values(MODEL_DIMENSIONS).filter(
    (info) => info.provider.toLowerCase() === provider.toLowerCase()
  );
}

/**
 * Check if a model is deprecated
 */
export function isModelDeprecated(modelName: string): boolean {
  const info = getModelInfo(modelName);
  return info?.isDeprecated === true;
}
