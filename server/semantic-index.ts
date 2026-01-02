/**
 * Semantic Index Service
 * 
 * Provides semantic search capabilities for AI agents to discover
 * relevant memory assets based on topic, domain, or natural language queries.
 * 
 * This is the core API that enables Agent-to-Agent discovery.
 */

import { GENESIS_MEMORIES, searchGenesisMemories, getGenesisByCategory, GenesisCategory } from '../shared/genesis-memories';
import { AwarenessMemoryAsset, DomainCategory, TaskType } from '../shared/memory-nft-schema';

/**
 * Search result with relevance score
 */
export interface SearchResult {
  memory: AwarenessMemoryAsset;
  relevance_score: number;
  match_type: 'keyword' | 'domain' | 'task' | 'semantic';
}

/**
 * Agent registration entry
 */
export interface RegisteredAgent {
  id: string;
  name: string;
  description: string;
  model_type: string;
  capabilities: string[];
  tba_address: string; // ERC-6551 Token Bound Account
  registered_at: string;
  last_active: string;
  memories_published: number;
  memories_consumed: number;
  reputation_score: number;
}

// In-memory agent registry (would be database in production)
const agentRegistry: Map<string, RegisteredAgent> = new Map();

/**
 * Calculate keyword relevance score
 */
function calculateKeywordScore(query: string, memory: AwarenessMemoryAsset): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const keywords = memory.semantic_context.keywords.map(k => k.toLowerCase());
  const name = memory.identification.name.toLowerCase();
  const description = memory.identification.description.toLowerCase();
  
  let score = 0;
  for (const term of queryTerms) {
    // Exact keyword match: high score
    if (keywords.includes(term)) {
      score += 0.4;
    }
    // Partial keyword match
    else if (keywords.some(k => k.includes(term) || term.includes(k))) {
      score += 0.2;
    }
    // Name match
    if (name.includes(term)) {
      score += 0.3;
    }
    // Description match
    if (description.includes(term)) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
}

/**
 * Search memories by topic/keyword
 */
export function findMemoryByTopic(topic: string, limit: number = 10): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const memory of GENESIS_MEMORIES) {
    const score = calculateKeywordScore(topic, memory);
    if (score > 0.1) {
      results.push({
        memory,
        relevance_score: score,
        match_type: 'keyword'
      });
    }
  }
  
  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}

/**
 * Search memories by domain category
 */
export function findMemoryByDomain(domain: DomainCategory, limit: number = 10): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const memory of GENESIS_MEMORIES) {
    if (memory.semantic_context.domain === domain) {
      results.push({
        memory,
        relevance_score: 1.0,
        match_type: 'domain'
      });
    }
  }
  
  return results.slice(0, limit);
}

/**
 * Search memories by task type
 */
export function findMemoryByTask(taskType: TaskType, limit: number = 10): SearchResult[] {
  const results: SearchResult[] = [];
  
  for (const memory of GENESIS_MEMORIES) {
    if (memory.semantic_context.task_type === taskType) {
      results.push({
        memory,
        relevance_score: 1.0,
        match_type: 'task'
      });
    }
  }
  
  return results.slice(0, limit);
}

/**
 * Combined semantic search (topic + domain + task)
 */
export function semanticSearch(params: {
  query?: string;
  domain?: DomainCategory;
  task_type?: TaskType;
  model_origin?: string;
  is_public?: boolean;
  limit?: number;
}): SearchResult[] {
  const { query, domain, task_type, model_origin, is_public, limit = 20 } = params;
  
  let candidates = [...GENESIS_MEMORIES];
  
  // Filter by domain
  if (domain) {
    candidates = candidates.filter(m => m.semantic_context.domain === domain);
  }
  
  // Filter by task type
  if (task_type) {
    candidates = candidates.filter(m => m.semantic_context.task_type === task_type);
  }
  
  // Filter by model origin
  if (model_origin) {
    candidates = candidates.filter(m => m.technical_spec.model_origin === model_origin);
  }
  
  // Filter by public access
  if (is_public !== undefined) {
    candidates = candidates.filter(m => m.access_control.is_public === is_public);
  }
  
  // Score by query if provided
  const results: SearchResult[] = candidates.map(memory => {
    let score = 0.5; // Base score for matching filters
    
    if (query) {
      score = calculateKeywordScore(query, memory);
    }
    
    return {
      memory,
      relevance_score: score,
      match_type: 'semantic' as const
    };
  });
  
  return results
    .filter(r => r.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}

/**
 * Register a new agent in the network
 */
export function registerAgent(params: {
  name: string;
  description: string;
  model_type: string;
  capabilities: string[];
  tba_address: string;
}): RegisteredAgent {
  const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const agent: RegisteredAgent = {
    id,
    name: params.name,
    description: params.description,
    model_type: params.model_type,
    capabilities: params.capabilities,
    tba_address: params.tba_address,
    registered_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    memories_published: 0,
    memories_consumed: 0,
    reputation_score: 0
  };
  
  agentRegistry.set(id, agent);
  return agent;
}

/**
 * Get agent by ID
 */
export function getAgent(id: string): RegisteredAgent | null {
  return agentRegistry.get(id) || null;
}

/**
 * List all registered agents
 */
export function listAgents(params?: {
  model_type?: string;
  capability?: string;
  limit?: number;
}): RegisteredAgent[] {
  let agents = Array.from(agentRegistry.values());
  
  if (params?.model_type) {
    agents = agents.filter(a => a.model_type === params.model_type);
  }
  
  if (params?.capability) {
    agents = agents.filter(a => a.capabilities.includes(params.capability!));
  }
  
  // Sort by reputation
  agents.sort((a, b) => b.reputation_score - a.reputation_score);
  
  if (params?.limit) {
    agents = agents.slice(0, params.limit);
  }
  
  return agents;
}

/**
 * Update agent activity
 */
export function updateAgentActivity(id: string, action: 'publish' | 'consume'): void {
  const agent = agentRegistry.get(id);
  if (agent) {
    agent.last_active = new Date().toISOString();
    if (action === 'publish') {
      agent.memories_published++;
      agent.reputation_score += 10;
    } else {
      agent.memories_consumed++;
      agent.reputation_score += 1;
    }
    agentRegistry.set(id, agent);
  }
}

/**
 * Get memory leaderboard (most used memories)
 */
export function getMemoryLeaderboard(limit: number = 10): AwarenessMemoryAsset[] {
  return [...GENESIS_MEMORIES]
    .sort((a, b) => b.provenance.usage_count - a.provenance.usage_count)
    .slice(0, limit);
}

/**
 * Get statistics about the memory network
 */
export function getNetworkStats(): {
  total_memories: number;
  public_memories: number;
  total_agents: number;
  active_agents_24h: number;
  new_agents_7d: number;
  total_domains: number;
  total_task_types: number;
  supported_models: number;
  total_memory_calls: number;
  avg_quality_score: number;
} {
  const domains = new Set(GENESIS_MEMORIES.map(m => m.semantic_context.domain));
  const taskTypes = new Set(GENESIS_MEMORIES.map(m => m.semantic_context.task_type));
  const models = new Set(GENESIS_MEMORIES.map(m => m.technical_spec.model_origin));
  
  // Calculate active agents in last 24 hours
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const agents = Array.from(agentRegistry.values());
  const activeAgents24h = agents.filter(a => new Date(a.last_active) > oneDayAgo).length;
  const newAgents7d = agents.filter(a => new Date(a.registered_at) > sevenDaysAgo).length;
  
  // Calculate total memory calls and average quality
  const totalCalls = GENESIS_MEMORIES.reduce((sum, m) => sum + m.provenance.usage_count, 0);
  const avgQuality = GENESIS_MEMORIES.reduce((sum, m) => sum + (m.provenance.average_rating || 0), 0) / GENESIS_MEMORIES.length;
  
  return {
    total_memories: GENESIS_MEMORIES.length,
    public_memories: GENESIS_MEMORIES.filter(m => m.access_control.is_public).length,
    total_agents: agentRegistry.size,
    active_agents_24h: activeAgents24h,
    new_agents_7d: newAgents7d,
    total_domains: domains.size,
    total_task_types: taskTypes.size,
    supported_models: models.size,
    total_memory_calls: totalCalls,
    avg_quality_score: avgQuality
  };
}

/**
 * Get all available domains
 */
export function getAvailableDomains(): DomainCategory[] {
  return [
    'blockchain_security',
    'smart_contract_development',
    'defi_protocols',
    'machine_learning',
    'natural_language_processing',
    'computer_vision',
    'code_generation',
    'code_review',
    'legal_analysis',
    'medical_reasoning',
    'scientific_research',
    'creative_writing',
    'general_reasoning',
    'mathematics',
    'data_analysis'
  ];
}

/**
 * Get all available task types
 */
export function getAvailableTaskTypes(): TaskType[] {
  return [
    'reasoning_and_analysis',
    'code_generation',
    'code_review',
    'classification',
    'summarization',
    'translation',
    'question_answering',
    'creative_generation',
    'data_extraction',
    'planning_and_execution'
  ];
}

/**
 * Get recently registered agents
 */
export function getRecentAgents(limit: number = 10): RegisteredAgent[] {
  return Array.from(agentRegistry.values())
    .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
    .slice(0, limit);
}

/**
 * Get top agents by reputation
 */
export function getTopAgents(limit: number = 10): RegisteredAgent[] {
  return Array.from(agentRegistry.values())
    .sort((a, b) => b.reputation_score - a.reputation_score)
    .slice(0, limit);
}

/**
 * Search agents by capability
 */
export function searchAgentsByCapability(capability: string, limit: number = 20): RegisteredAgent[] {
  const lowerCap = capability.toLowerCase();
  return Array.from(agentRegistry.values())
    .filter(a => 
      a.capabilities.some(c => c.toLowerCase().includes(lowerCap)) ||
      a.name.toLowerCase().includes(lowerCap) ||
      a.description.toLowerCase().includes(lowerCap)
    )
    .sort((a, b) => b.reputation_score - a.reputation_score)
    .slice(0, limit);
}

/**
 * Get agent activity timeline (last 7 days)
 */
export function getAgentActivityTimeline(): { date: string; registrations: number; active: number }[] {
  const timeline: { date: string; registrations: number; active: number }[] = [];
  const agents = Array.from(agentRegistry.values());
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const registrations = agents.filter(a => 
      a.registered_at.startsWith(dateStr)
    ).length;
    
    const active = agents.filter(a => 
      a.last_active.startsWith(dateStr)
    ).length;
    
    timeline.push({ date: dateStr, registrations, active });
  }
  
  return timeline;
}

/**
 * Get memory usage by domain
 */
export function getMemoryUsageByDomain(): { domain: string; count: number; totalCalls: number }[] {
  const domainStats = new Map<string, { count: number; totalCalls: number }>();
  
  for (const memory of GENESIS_MEMORIES) {
    const domain = memory.semantic_context.domain;
    const existing = domainStats.get(domain) || { count: 0, totalCalls: 0 };
    existing.count++;
    existing.totalCalls += memory.provenance.usage_count;
    domainStats.set(domain, existing);
  }
  
  return Array.from(domainStats.entries())
    .map(([domain, stats]) => ({ domain, ...stats }))
    .sort((a, b) => b.totalCalls - a.totalCalls);
}
