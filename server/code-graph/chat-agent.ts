/**
 * Graph RAG Chat Agent
 *
 * AI agent that queries the code knowledge graph using tools.
 * Uses the existing LLM infrastructure (server/_core/llm.ts) with tool calling.
 *
 * Tools:
 *   1. search(query)       — Hybrid search graph nodes
 *   2. context(symbolId)   — 360-degree node context
 *   3. impact(symbolIds)   — Blast radius analysis
 *   4. overview()          — Graph stats overview
 */

import { invokeLLM } from '../_core/llm';
import type { Tool, Message, ToolCall as LLMToolCall } from '../_core/llm';
import { CodeSearchEngine } from './search-engine';
import { analyzeImpact } from './impact-analyzer';
import type { CodeGraph, ChatMessage, ChatToolCall, NodeContext } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChatAgent');

const SYSTEM_PROMPT = `You are a code knowledge graph analysis assistant. You help developers understand codebases by querying an interactive knowledge graph.

You have access to the following tools:
- **search**: Find code symbols (functions, classes, files) by keyword or semantic meaning
- **context**: Get 360-degree context for a specific symbol (who calls it, what it calls, which community/process it belongs to)
- **impact**: Analyze the blast radius of changes to specific symbols
- **overview**: Get a high-level overview of the codebase structure

Guidelines:
- Always cite specific files and line numbers when referencing code
- Use the search tool first to find relevant symbols, then context for details
- When analyzing changes, use impact to understand the blast radius
- Be concise but thorough in your analysis
- Format responses in markdown for readability`;

const TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search the code knowledge graph for symbols matching a query. Returns functions, classes, files, and other code elements.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (e.g., "authentication", "database connection", "API router")' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'context',
      description: 'Get 360-degree context for a specific code symbol. Shows callers, callees, community membership, and process participation.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'The node ID of the symbol to inspect (e.g., "function:server/routers.ts::appRouter")' },
        },
        required: ['nodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'impact',
      description: 'Analyze the blast radius of changes to specific symbols. Shows direct callers (depth 1), indirect callers (depth 2), and secondary chain (depth 3).',
      parameters: {
        type: 'object',
        properties: {
          symbolIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of symbol node IDs to analyze impact for',
          },
        },
        required: ['symbolIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'overview',
      description: 'Get a high-level overview of the codebase structure including node counts, edge counts, communities, and key entry points.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

function getNodeContext(nodeId: string, graph: CodeGraph): NodeContext | null {
  const node = graph.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  // Find callers (who calls this)
  const callerEdges = graph.edges.filter(e => e.type === 'calls' && e.target === nodeId);
  const callers = callerEdges
    .map(e => {
      const callerNode = graph.nodes.find(n => n.id === e.source);
      return callerNode ? { node: callerNode, confidence: e.confidence ?? 0.5 } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Find callees (what this calls)
  const calleeEdges = graph.edges.filter(e => e.type === 'calls' && e.source === nodeId);
  const callees = calleeEdges
    .map(e => {
      const calleeNode = graph.nodes.find(n => n.id === e.target);
      return calleeNode ? { node: calleeNode, confidence: e.confidence ?? 0.5 } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Community
  const community = node.communityId
    ? graph.communities.find(c => c.id === node.communityId) ?? null
    : null;

  // Processes this node participates in
  const processes = graph.processes.filter(p => p.steps.includes(nodeId));

  // Import relationships
  const fileNodeId = graph.edges.find(
    e => e.type === 'defined_in' && e.source === nodeId,
  )?.target;

  const imports = fileNodeId
    ? graph.edges
        .filter(e => e.type === 'imports' && e.source === fileNodeId)
        .map(e => graph.nodes.find(n => n.id === e.target))
        .filter((n): n is NonNullable<typeof n> => n !== null)
    : [];

  const importedBy = fileNodeId
    ? graph.edges
        .filter(e => e.type === 'imports' && e.target === fileNodeId)
        .map(e => graph.nodes.find(n => n.id === e.source))
        .filter((n): n is NonNullable<typeof n> => n !== null)
    : [];

  return { node, callers, callees, community, processes, imports, importedBy };
}

function executeTool(
  name: string,
  args: Record<string, any>,
  graph: CodeGraph,
  searchEngine: CodeSearchEngine,
): string {
  switch (name) {
    case 'search': {
      // Synchronous version — searchBM25 is sync, semantic is sync
      const bm25 = searchEngine.searchBM25(args.query, 15);
      const results = bm25.map(r => {
        const node = graph.nodes.find(n => n.id === r.nodeId);
        return node
          ? `- **${node.label}** (${node.type}) — ${node.filePath}${node.lineStart ? `:${node.lineStart}` : ''} [score: ${r.score.toFixed(2)}]`
          : null;
      }).filter(Boolean);
      return results.length > 0
        ? `Found ${results.length} results:\n${results.join('\n')}`
        : 'No results found.';
    }

    case 'context': {
      const ctx = getNodeContext(args.nodeId, graph);
      if (!ctx) return `Node "${args.nodeId}" not found in the graph.`;

      const lines = [
        `## ${ctx.node.label}`,
        `**Type:** ${ctx.node.type} | **File:** ${ctx.node.filePath}${ctx.node.lineStart ? `:${ctx.node.lineStart}` : ''} | **Language:** ${ctx.node.language}`,
        '',
      ];

      if (ctx.callers.length > 0) {
        lines.push(`### Called by (${ctx.callers.length})`);
        for (const c of ctx.callers) {
          lines.push(`- ${c.node.label} (${c.node.filePath}) — confidence: ${c.confidence}`);
        }
      }

      if (ctx.callees.length > 0) {
        lines.push(`### Calls (${ctx.callees.length})`);
        for (const c of ctx.callees) {
          lines.push(`- ${c.node.label} (${c.node.filePath}) — confidence: ${c.confidence}`);
        }
      }

      if (ctx.community) {
        lines.push(`### Community: ${ctx.community.name} (cohesion: ${ctx.community.cohesion})`);
        lines.push(`Keywords: ${ctx.community.keywords.join(', ')}`);
      }

      if (ctx.processes.length > 0) {
        lines.push(`### In ${ctx.processes.length} execution flows`);
        for (const p of ctx.processes) {
          lines.push(`- ${p.name} (${p.stepCount} steps${p.crossCommunity ? ', cross-community' : ''})`);
        }
      }

      if (ctx.imports.length > 0) {
        lines.push(`### Imports (${ctx.imports.length} files)`);
        for (const imp of ctx.imports.slice(0, 10)) {
          lines.push(`- ${imp.label} (${imp.filePath})`);
        }
      }

      return lines.join('\n');
    }

    case 'impact': {
      const result = analyzeImpact(args.symbolIds, graph.nodes, graph.edges, graph.processes);
      const lines = [
        `## Impact Analysis — Risk: **${result.riskLevel}**`,
        '',
        `### Depth 1 — Direct impact (${result.depth1.length})`,
        ...result.depth1.map(n => `- ${n.label} (${n.filePath}) — ${n.reason}`),
        '',
        `### Depth 2 — Needs testing (${result.depth2.length})`,
        ...result.depth2.slice(0, 10).map(n => `- ${n.label} (${n.filePath})`),
        '',
        `### Depth 3 — Investigate (${result.depth3.length})`,
        ...result.depth3.slice(0, 10).map(n => `- ${n.label} (${n.filePath})`),
      ];

      if (result.affectedProcesses.length > 0) {
        lines.push('', `### Affected Flows (${result.affectedProcesses.length})`);
        for (const p of result.affectedProcesses) {
          lines.push(`- ${p}`);
        }
      }

      return lines.join('\n');
    }

    case 'overview': {
      const nodesByType = new Map<string, number>();
      for (const n of graph.nodes) {
        nodesByType.set(n.type, (nodesByType.get(n.type) || 0) + 1);
      }

      const edgesByType = new Map<string, number>();
      for (const e of graph.edges) {
        edgesByType.set(e.type, (edgesByType.get(e.type) || 0) + 1);
      }

      const dirs = new Set(graph.nodes.map(n => n.directory));

      const lines = [
        `## Codebase Overview: ${graph.repoOwner}/${graph.repoName}`,
        `**Branch:** ${graph.branch} | **Fetched:** ${graph.fetchedAt}`,
        '',
        `### Nodes (${graph.nodes.length})`,
        ...[...nodesByType.entries()].map(([type, count]) => `- ${type}: ${count}`),
        '',
        `### Edges (${graph.edges.length})`,
        ...[...edgesByType.entries()].map(([type, count]) => `- ${type}: ${count}`),
        '',
        `### Directories (${dirs.size})`,
        ...[...dirs].sort().map(d => `- ${d}`),
        '',
        `### Communities (${graph.communities.length})`,
        ...graph.communities.map(c => `- **${c.name}** — ${c.symbolCount} symbols, cohesion: ${c.cohesion}`),
        '',
        `### Execution Flows (${graph.processes.length})`,
        ...graph.processes.slice(0, 15).map(p => `- ${p.name} (${p.stepCount} steps)`),
      ];

      return lines.join('\n');
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Chat with the code knowledge graph using an AI agent with tools.
 * Returns the final assistant message with tool call history.
 */
export async function chatWithGraph(
  userMessages: ChatMessage[],
  graph: CodeGraph,
  searchEngine: CodeSearchEngine,
): Promise<ChatMessage> {
  // Build conversation messages for LLM
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  for (const msg of userMessages) {
    messages.push({ role: msg.role as any, content: msg.content });
  }

  const toolCallHistory: ChatToolCall[] = [];
  const MAX_TOOL_ROUNDS = 5;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await invokeLLM({
      messages,
      tools: TOOLS,
      toolChoice: round === 0 ? 'auto' : 'auto',
      maxTokens: 2000,
    });

    const choice = result.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const content = typeof assistantMessage.content === 'string'
        ? assistantMessage.content
        : '';

      return {
        role: 'assistant',
        content,
        toolCalls: toolCallHistory.length > 0 ? toolCallHistory : undefined,
      };
    }

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
    });

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      const toolResult = executeTool(toolCall.function.name, args, graph, searchEngine);

      toolCallHistory.push({
        name: toolCall.function.name,
        args,
        result: toolResult,
      });

      messages.push({
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id,
      });
    }
  }

  // If we exhausted rounds, return what we have
  return {
    role: 'assistant',
    content: 'I\'ve gathered the information above. Let me know if you need more details.',
    toolCalls: toolCallHistory,
  };
}

// Re-export for use in router
export { getNodeContext };
