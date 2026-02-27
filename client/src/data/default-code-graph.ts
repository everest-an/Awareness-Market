/**
 * Default Code Graph — Hardcoded Awareness Market project structure
 *
 * Displayed when no GitHub repo is connected.
 * Represents the actual codebase architecture: server, client, prisma layers.
 */

import type { CodeGraph } from '../../../server/code-graph/types';

export const DEFAULT_CODE_GRAPH: CodeGraph = {
  repoOwner: 'awareness-market',
  repoName: 'awareness-network',
  branch: 'main',
  fetchedAt: '2026-02-27T00:00:00.000Z',
  nodes: [
    // ═══ Server Core ═══
    { id: 'file:server/_core/index.ts', type: 'file', label: 'index.ts', filePath: 'server/_core/index.ts', directory: 'server/_core/', language: 'typescript' },
    { id: 'file:server/_core/trpc.ts', type: 'file', label: 'trpc.ts', filePath: 'server/_core/trpc.ts', directory: 'server/_core/', language: 'typescript' },
    { id: 'file:server/_core/email.ts', type: 'file', label: 'email.ts', filePath: 'server/_core/email.ts', directory: 'server/_core/', language: 'typescript' },
    { id: 'file:server/_core/llm.ts', type: 'file', label: 'llm.ts', filePath: 'server/_core/llm.ts', directory: 'server/_core/', language: 'typescript' },
    { id: 'file:server/routers.ts', type: 'file', label: 'routers.ts', filePath: 'server/routers.ts', directory: 'server/', language: 'typescript' },
    { id: 'file:server/db-prisma.ts', type: 'file', label: 'db-prisma.ts', filePath: 'server/db-prisma.ts', directory: 'server/', language: 'typescript' },
    { id: 'fn:server/routers.ts::appRouter', type: 'function', label: 'appRouter', filePath: 'server/routers.ts', directory: 'server/', language: 'typescript', lineStart: 63 },
    { id: 'fn:server/_core/trpc.ts::protectedProcedure', type: 'function', label: 'protectedProcedure', filePath: 'server/_core/trpc.ts', directory: 'server/_core/', language: 'typescript', lineStart: 28 },
    { id: 'fn:server/_core/trpc.ts::publicProcedure', type: 'function', label: 'publicProcedure', filePath: 'server/_core/trpc.ts', directory: 'server/_core/', language: 'typescript', lineStart: 11 },

    // ═══ Server Auth ═══
    { id: 'file:server/auth-oauth.ts', type: 'file', label: 'auth-oauth.ts', filePath: 'server/auth-oauth.ts', directory: 'server/', language: 'typescript' },
    { id: 'file:server/auth-standalone.ts', type: 'file', label: 'auth-standalone.ts', filePath: 'server/auth-standalone.ts', directory: 'server/', language: 'typescript' },
    { id: 'file:server/auth-phantom.ts', type: 'file', label: 'auth-phantom.ts', filePath: 'server/auth-phantom.ts', directory: 'server/', language: 'typescript' },
    { id: 'fn:server/auth-oauth.ts::handleOAuthCallback', type: 'function', label: 'handleOAuthCallback()', filePath: 'server/auth-oauth.ts', directory: 'server/', language: 'typescript', lineStart: 267 },
    { id: 'fn:server/auth-oauth.ts::getOAuthAuthorizeUrl', type: 'function', label: 'getOAuthAuthorizeUrl()', filePath: 'server/auth-oauth.ts', directory: 'server/', language: 'typescript', lineStart: 128 },

    // ═══ Server Routers ═══
    { id: 'file:server/routers/auth.ts', type: 'file', label: 'auth.ts', filePath: 'server/routers/auth.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/workspace.ts', type: 'file', label: 'workspace.ts', filePath: 'server/routers/workspace.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/workflow.ts', type: 'file', label: 'workflow.ts', filePath: 'server/routers/workflow.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/provider-keys.ts', type: 'file', label: 'provider-keys.ts', filePath: 'server/routers/provider-keys.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/agent-collaboration.ts', type: 'file', label: 'agent-collaboration.ts', filePath: 'server/routers/agent-collaboration.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/agent-registry.ts', type: 'file', label: 'agent-registry.ts', filePath: 'server/routers/agent-registry.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/memory.ts', type: 'file', label: 'memory.ts', filePath: 'server/routers/memory.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/memory-policy.ts', type: 'file', label: 'memory-policy.ts', filePath: 'server/routers/memory-policy.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/neural-bridge-api.ts', type: 'file', label: 'neural-bridge-api.ts', filePath: 'server/routers/neural-bridge-api.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/code-graph.ts', type: 'file', label: 'code-graph.ts', filePath: 'server/routers/code-graph.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/vectors.ts', type: 'file', label: 'vectors.ts', filePath: 'server/routers/vectors.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/latentmas.ts', type: 'file', label: 'latentmas.ts', filePath: 'server/routers/latentmas.ts', directory: 'server/routers/', language: 'typescript' },
    { id: 'file:server/routers/mcp.ts', type: 'file', label: 'mcp.ts', filePath: 'server/routers/mcp.ts', directory: 'server/routers/', language: 'typescript' },

    // ═══ Server Services ═══
    { id: 'file:server/provider-keys-service.ts', type: 'file', label: 'provider-keys-service.ts', filePath: 'server/provider-keys-service.ts', directory: 'server/', language: 'typescript' },
    { id: 'file:server/socket-events.ts', type: 'file', label: 'socket-events.ts', filePath: 'server/socket-events.ts', directory: 'server/', language: 'typescript' },
    { id: 'file:server/semantic-index.ts', type: 'file', label: 'semantic-index.ts', filePath: 'server/semantic-index.ts', directory: 'server/', language: 'typescript' },
    { id: 'fn:server/provider-keys-service.ts::encryptKey', type: 'function', label: 'encryptKey()', filePath: 'server/provider-keys-service.ts', directory: 'server/', language: 'typescript', lineStart: 36 },
    { id: 'fn:server/provider-keys-service.ts::decryptKey', type: 'function', label: 'decryptKey()', filePath: 'server/provider-keys-service.ts', directory: 'server/', language: 'typescript', lineStart: 50 },
    { id: 'fn:server/socket-events.ts::initializeSocketIO', type: 'function', label: 'initializeSocketIO()', filePath: 'server/socket-events.ts', directory: 'server/', language: 'typescript', lineStart: 69 },
    { id: 'fn:server/socket-events.ts::broadcastCodeChange', type: 'function', label: 'broadcastCodeChange()', filePath: 'server/socket-events.ts', directory: 'server/', language: 'typescript', lineStart: 312 },

    // ═══ Code Graph Module ═══
    { id: 'file:server/code-graph/types.ts', type: 'file', label: 'types.ts', filePath: 'server/code-graph/types.ts', directory: 'server/code-graph/', language: 'typescript' },
    { id: 'file:server/code-graph/github-service.ts', type: 'file', label: 'github-service.ts', filePath: 'server/code-graph/github-service.ts', directory: 'server/code-graph/', language: 'typescript' },
    { id: 'file:server/code-graph/code-parser.ts', type: 'file', label: 'code-parser.ts', filePath: 'server/code-graph/code-parser.ts', directory: 'server/code-graph/', language: 'typescript' },
    { id: 'file:server/code-graph/graph-builder.ts', type: 'file', label: 'graph-builder.ts', filePath: 'server/code-graph/graph-builder.ts', directory: 'server/code-graph/', language: 'typescript' },
    { id: 'fn:server/code-graph/graph-builder.ts::buildCodeGraph', type: 'function', label: 'buildCodeGraph()', filePath: 'server/code-graph/graph-builder.ts', directory: 'server/code-graph/', language: 'typescript', lineStart: 25 },
    { id: 'fn:server/code-graph/code-parser.ts::parseFile', type: 'function', label: 'parseFile()', filePath: 'server/code-graph/code-parser.ts', directory: 'server/code-graph/', language: 'typescript', lineStart: 28 },

    // ═══ Memory Core ═══
    { id: 'file:server/memory-core/memory-governance.ts', type: 'file', label: 'memory-governance.ts', filePath: 'server/memory-core/memory-governance.ts', directory: 'server/memory-core/', language: 'typescript' },
    { id: 'file:server/memory-core/rmc-retriever.ts', type: 'file', label: 'rmc-retriever.ts', filePath: 'server/memory-core/rmc-retriever.ts', directory: 'server/memory-core/', language: 'typescript' },

    // ═══ LatentMAS ═══
    { id: 'file:server/latentmas/index.ts', type: 'file', label: 'index.ts', filePath: 'server/latentmas/index.ts', directory: 'server/latentmas/', language: 'typescript' },
    { id: 'file:server/latentmas/kv-cache-compressor.ts', type: 'file', label: 'kv-cache-compressor.ts', filePath: 'server/latentmas/kv-cache-compressor.ts', directory: 'server/latentmas/', language: 'typescript' },
    { id: 'file:server/latentmas/w-matrix-protocol.ts', type: 'file', label: 'w-matrix-protocol.ts', filePath: 'server/latentmas/w-matrix-protocol.ts', directory: 'server/latentmas/', language: 'typescript' },
    { id: 'file:server/latentmas/embedding-service.ts', type: 'file', label: 'embedding-service.ts', filePath: 'server/latentmas/embedding-service.ts', directory: 'server/latentmas/', language: 'typescript' },

    // ═══ Client Core ═══
    { id: 'file:client/src/App.tsx', type: 'file', label: 'App.tsx', filePath: 'client/src/App.tsx', directory: 'client/src/', language: 'typescript' },
    { id: 'file:client/src/lib/trpc.ts', type: 'file', label: 'trpc.ts', filePath: 'client/src/lib/trpc.ts', directory: 'client/src/lib/', language: 'typescript' },
    { id: 'file:client/src/lib/utils.ts', type: 'file', label: 'utils.ts', filePath: 'client/src/lib/utils.ts', directory: 'client/src/lib/', language: 'typescript' },

    // ═══ Client Pages ═══
    { id: 'file:client/src/pages/NeuralCortex.tsx', type: 'file', label: 'NeuralCortex.tsx', filePath: 'client/src/pages/NeuralCortex.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/Home.tsx', type: 'file', label: 'Home.tsx', filePath: 'client/src/pages/Home.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/Marketplace.tsx', type: 'file', label: 'Marketplace.tsx', filePath: 'client/src/pages/Marketplace.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/Dashboard.tsx', type: 'file', label: 'Dashboard.tsx', filePath: 'client/src/pages/Dashboard.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/WorkspaceList.tsx', type: 'file', label: 'WorkspaceList.tsx', filePath: 'client/src/pages/WorkspaceList.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/WorkspaceDetail.tsx', type: 'file', label: 'WorkspaceDetail.tsx', filePath: 'client/src/pages/WorkspaceDetail.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/ProviderKeys.tsx', type: 'file', label: 'ProviderKeys.tsx', filePath: 'client/src/pages/ProviderKeys.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/AuthPage.tsx', type: 'file', label: 'AuthPage.tsx', filePath: 'client/src/pages/AuthPage.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/AgentDiscovery.tsx', type: 'file', label: 'AgentDiscovery.tsx', filePath: 'client/src/pages/AgentDiscovery.tsx', directory: 'client/src/pages/', language: 'typescript' },
    { id: 'file:client/src/pages/LandingPage.tsx', type: 'file', label: 'LandingPage.tsx', filePath: 'client/src/pages/LandingPage.tsx', directory: 'client/src/pages/', language: 'typescript' },

    // ═══ Client Components ═══
    { id: 'file:client/src/components/NeuralCortexVisualizer.tsx', type: 'file', label: 'NeuralCortexVisualizer.tsx', filePath: 'client/src/components/NeuralCortexVisualizer.tsx', directory: 'client/src/components/', language: 'typescript' },
    { id: 'file:client/src/components/Navbar.tsx', type: 'file', label: 'Navbar.tsx', filePath: 'client/src/components/Navbar.tsx', directory: 'client/src/components/', language: 'typescript' },
    { id: 'file:client/src/components/NetworkBrain.tsx', type: 'file', label: 'NetworkBrain.tsx', filePath: 'client/src/components/NetworkBrain.tsx', directory: 'client/src/components/', language: 'typescript' },
    { id: 'file:client/src/components/HeroSection.tsx', type: 'file', label: 'HeroSection.tsx', filePath: 'client/src/components/HeroSection.tsx', directory: 'client/src/components/', language: 'typescript' },
    { id: 'file:client/src/components/GitHubConnectPanel.tsx', type: 'file', label: 'GitHubConnectPanel.tsx', filePath: 'client/src/components/GitHubConnectPanel.tsx', directory: 'client/src/components/', language: 'typescript' },
    { id: 'file:client/src/components/SEO.tsx', type: 'file', label: 'SEO.tsx', filePath: 'client/src/components/SEO.tsx', directory: 'client/src/components/', language: 'typescript' },

    // ═══ Client Hooks ═══
    { id: 'file:client/src/hooks/useCodeGraph.ts', type: 'file', label: 'useCodeGraph.ts', filePath: 'client/src/hooks/useCodeGraph.ts', directory: 'client/src/hooks/', language: 'typescript' },
    { id: 'file:client/src/hooks/useAuth.ts', type: 'file', label: 'useAuth.ts', filePath: 'client/src/hooks/useAuth.ts', directory: 'client/src/hooks/', language: 'typescript' },

    // ═══ Prisma ═══
    { id: 'file:prisma/schema.prisma', type: 'file', label: 'schema.prisma', filePath: 'prisma/schema.prisma', directory: 'prisma/', language: 'prisma' },

    // ═══ Key Interfaces ═══
    { id: 'interface:server/code-graph/types.ts::CodeNode', type: 'interface', label: 'CodeNode', filePath: 'server/code-graph/types.ts', directory: 'server/code-graph/', language: 'typescript', lineStart: 12 },
    { id: 'interface:server/code-graph/types.ts::CodeEdge', type: 'interface', label: 'CodeEdge', filePath: 'server/code-graph/types.ts', directory: 'server/code-graph/', language: 'typescript', lineStart: 25 },
    { id: 'interface:server/code-graph/types.ts::CodeGraph', type: 'interface', label: 'CodeGraph', filePath: 'server/code-graph/types.ts', directory: 'server/code-graph/', language: 'typescript', lineStart: 33 },
    { id: 'interface:client/src/components/NeuralCortexVisualizer.tsx::CortexNode', type: 'interface', label: 'CortexNode', filePath: 'client/src/components/NeuralCortexVisualizer.tsx', directory: 'client/src/components/', language: 'typescript', lineStart: 19 },
  ],
  edges: [
    // ═══ Server Core Imports ═══
    { id: 'edge:file:server/_core/index.ts->imports:file:server/routers.ts', source: 'file:server/_core/index.ts', target: 'file:server/routers.ts', type: 'imports', weight: 0.7 },
    { id: 'edge:file:server/_core/index.ts->imports:file:server/socket-events.ts', source: 'file:server/_core/index.ts', target: 'file:server/socket-events.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/_core/index.ts->imports:file:server/db-prisma.ts', source: 'file:server/_core/index.ts', target: 'file:server/db-prisma.ts', type: 'imports', weight: 0.5 },

    // ═══ Router Registration ═══
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/auth.ts', source: 'file:server/routers.ts', target: 'file:server/routers/auth.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/workspace.ts', source: 'file:server/routers.ts', target: 'file:server/routers/workspace.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/workflow.ts', source: 'file:server/routers.ts', target: 'file:server/routers/workflow.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/provider-keys.ts', source: 'file:server/routers.ts', target: 'file:server/routers/provider-keys.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/agent-collaboration.ts', source: 'file:server/routers.ts', target: 'file:server/routers/agent-collaboration.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/agent-registry.ts', source: 'file:server/routers.ts', target: 'file:server/routers/agent-registry.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/memory.ts', source: 'file:server/routers.ts', target: 'file:server/routers/memory.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/memory-policy.ts', source: 'file:server/routers.ts', target: 'file:server/routers/memory-policy.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/neural-bridge-api.ts', source: 'file:server/routers.ts', target: 'file:server/routers/neural-bridge-api.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/code-graph.ts', source: 'file:server/routers.ts', target: 'file:server/routers/code-graph.ts', type: 'imports', weight: 0.6 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/vectors.ts', source: 'file:server/routers.ts', target: 'file:server/routers/vectors.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/latentmas.ts', source: 'file:server/routers.ts', target: 'file:server/routers/latentmas.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/routers/mcp.ts', source: 'file:server/routers.ts', target: 'file:server/routers/mcp.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/routers.ts->imports:file:server/_core/trpc.ts', source: 'file:server/routers.ts', target: 'file:server/_core/trpc.ts', type: 'imports', weight: 0.6 },

    // ═══ Router → Service Dependencies ═══
    { id: 'edge:file:server/routers/provider-keys.ts->imports:file:server/provider-keys-service.ts', source: 'file:server/routers/provider-keys.ts', target: 'file:server/provider-keys-service.ts', type: 'imports', weight: 0.7 },
    { id: 'edge:file:server/routers/code-graph.ts->imports:file:server/code-graph/github-service.ts', source: 'file:server/routers/code-graph.ts', target: 'file:server/code-graph/github-service.ts', type: 'imports', weight: 0.7 },
    { id: 'edge:file:server/routers/code-graph.ts->imports:file:server/code-graph/graph-builder.ts', source: 'file:server/routers/code-graph.ts', target: 'file:server/code-graph/graph-builder.ts', type: 'imports', weight: 0.7 },

    // ═══ Code Graph Internal ═══
    { id: 'edge:file:server/code-graph/github-service.ts->imports:file:server/provider-keys-service.ts', source: 'file:server/code-graph/github-service.ts', target: 'file:server/provider-keys-service.ts', type: 'imports', weight: 0.6 },
    { id: 'edge:file:server/code-graph/github-service.ts->imports:file:server/code-graph/types.ts', source: 'file:server/code-graph/github-service.ts', target: 'file:server/code-graph/types.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/code-graph/graph-builder.ts->imports:file:server/code-graph/github-service.ts', source: 'file:server/code-graph/graph-builder.ts', target: 'file:server/code-graph/github-service.ts', type: 'imports', weight: 0.7 },
    { id: 'edge:file:server/code-graph/graph-builder.ts->imports:file:server/code-graph/code-parser.ts', source: 'file:server/code-graph/graph-builder.ts', target: 'file:server/code-graph/code-parser.ts', type: 'imports', weight: 0.7 },
    { id: 'edge:file:server/code-graph/graph-builder.ts->imports:file:server/code-graph/types.ts', source: 'file:server/code-graph/graph-builder.ts', target: 'file:server/code-graph/types.ts', type: 'imports', weight: 0.5 },

    // ═══ Auth Chain ═══
    { id: 'edge:file:server/auth-oauth.ts->imports:file:server/auth-standalone.ts', source: 'file:server/auth-oauth.ts', target: 'file:server/auth-standalone.ts', type: 'imports', weight: 0.6 },
    { id: 'edge:file:server/routers/auth.ts->imports:file:server/auth-oauth.ts', source: 'file:server/routers/auth.ts', target: 'file:server/auth-oauth.ts', type: 'imports', weight: 0.6 },

    // ═══ Memory ═══
    { id: 'edge:file:server/routers/memory.ts->imports:file:server/memory-core/rmc-retriever.ts', source: 'file:server/routers/memory.ts', target: 'file:server/memory-core/rmc-retriever.ts', type: 'imports', weight: 0.6 },
    { id: 'edge:file:server/routers/memory-policy.ts->imports:file:server/memory-core/memory-governance.ts', source: 'file:server/routers/memory-policy.ts', target: 'file:server/memory-core/memory-governance.ts', type: 'imports', weight: 0.6 },

    // ═══ LatentMAS ═══
    { id: 'edge:file:server/routers/latentmas.ts->imports:file:server/latentmas/index.ts', source: 'file:server/routers/latentmas.ts', target: 'file:server/latentmas/index.ts', type: 'imports', weight: 0.6 },
    { id: 'edge:file:server/latentmas/index.ts->imports:file:server/latentmas/kv-cache-compressor.ts', source: 'file:server/latentmas/index.ts', target: 'file:server/latentmas/kv-cache-compressor.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/latentmas/index.ts->imports:file:server/latentmas/w-matrix-protocol.ts', source: 'file:server/latentmas/index.ts', target: 'file:server/latentmas/w-matrix-protocol.ts', type: 'imports', weight: 0.5 },
    { id: 'edge:file:server/latentmas/index.ts->imports:file:server/latentmas/embedding-service.ts', source: 'file:server/latentmas/index.ts', target: 'file:server/latentmas/embedding-service.ts', type: 'imports', weight: 0.5 },

    // ═══ Client Imports ═══
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/pages/NeuralCortex.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/pages/NeuralCortex.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/pages/Home.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/pages/Home.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/pages/Marketplace.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/pages/Marketplace.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/pages/Dashboard.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/pages/Dashboard.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/pages/WorkspaceList.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/pages/WorkspaceList.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/pages/AuthPage.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/pages/AuthPage.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/App.tsx->imports:file:client/src/components/Navbar.tsx', source: 'file:client/src/App.tsx', target: 'file:client/src/components/Navbar.tsx', type: 'imports', weight: 0.5 },

    // ═══ Neural Cortex Dependencies ═══
    { id: 'edge:file:client/src/pages/NeuralCortex.tsx->imports:file:client/src/components/NeuralCortexVisualizer.tsx', source: 'file:client/src/pages/NeuralCortex.tsx', target: 'file:client/src/components/NeuralCortexVisualizer.tsx', type: 'imports', weight: 0.8 },
    { id: 'edge:file:client/src/pages/NeuralCortex.tsx->imports:file:client/src/hooks/useCodeGraph.ts', source: 'file:client/src/pages/NeuralCortex.tsx', target: 'file:client/src/hooks/useCodeGraph.ts', type: 'imports', weight: 0.7 },
    { id: 'edge:file:client/src/pages/NeuralCortex.tsx->imports:file:client/src/components/GitHubConnectPanel.tsx', source: 'file:client/src/pages/NeuralCortex.tsx', target: 'file:client/src/components/GitHubConnectPanel.tsx', type: 'imports', weight: 0.7 },
    { id: 'edge:file:client/src/pages/NeuralCortex.tsx->imports:file:client/src/components/Navbar.tsx', source: 'file:client/src/pages/NeuralCortex.tsx', target: 'file:client/src/components/Navbar.tsx', type: 'imports', weight: 0.5 },
    { id: 'edge:file:client/src/pages/NeuralCortex.tsx->imports:file:client/src/components/SEO.tsx', source: 'file:client/src/pages/NeuralCortex.tsx', target: 'file:client/src/components/SEO.tsx', type: 'imports', weight: 0.3 },

    // ═══ Defined-in Edges ═══
    { id: 'edge:fn:server/routers.ts::appRouter->file:server/routers.ts', source: 'fn:server/routers.ts::appRouter', target: 'file:server/routers.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/_core/trpc.ts::protectedProcedure->file:server/_core/trpc.ts', source: 'fn:server/_core/trpc.ts::protectedProcedure', target: 'file:server/_core/trpc.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/_core/trpc.ts::publicProcedure->file:server/_core/trpc.ts', source: 'fn:server/_core/trpc.ts::publicProcedure', target: 'file:server/_core/trpc.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/auth-oauth.ts::handleOAuthCallback->file:server/auth-oauth.ts', source: 'fn:server/auth-oauth.ts::handleOAuthCallback', target: 'file:server/auth-oauth.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/auth-oauth.ts::getOAuthAuthorizeUrl->file:server/auth-oauth.ts', source: 'fn:server/auth-oauth.ts::getOAuthAuthorizeUrl', target: 'file:server/auth-oauth.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/provider-keys-service.ts::encryptKey->file:server/provider-keys-service.ts', source: 'fn:server/provider-keys-service.ts::encryptKey', target: 'file:server/provider-keys-service.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/provider-keys-service.ts::decryptKey->file:server/provider-keys-service.ts', source: 'fn:server/provider-keys-service.ts::decryptKey', target: 'file:server/provider-keys-service.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/socket-events.ts::initializeSocketIO->file:server/socket-events.ts', source: 'fn:server/socket-events.ts::initializeSocketIO', target: 'file:server/socket-events.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/socket-events.ts::broadcastCodeChange->file:server/socket-events.ts', source: 'fn:server/socket-events.ts::broadcastCodeChange', target: 'file:server/socket-events.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/code-graph/graph-builder.ts::buildCodeGraph->file:server/code-graph/graph-builder.ts', source: 'fn:server/code-graph/graph-builder.ts::buildCodeGraph', target: 'file:server/code-graph/graph-builder.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:fn:server/code-graph/code-parser.ts::parseFile->file:server/code-graph/code-parser.ts', source: 'fn:server/code-graph/code-parser.ts::parseFile', target: 'file:server/code-graph/code-parser.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:interface:server/code-graph/types.ts::CodeNode->file:server/code-graph/types.ts', source: 'interface:server/code-graph/types.ts::CodeNode', target: 'file:server/code-graph/types.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:interface:server/code-graph/types.ts::CodeEdge->file:server/code-graph/types.ts', source: 'interface:server/code-graph/types.ts::CodeEdge', target: 'file:server/code-graph/types.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:interface:server/code-graph/types.ts::CodeGraph->file:server/code-graph/types.ts', source: 'interface:server/code-graph/types.ts::CodeGraph', target: 'file:server/code-graph/types.ts', type: 'defined_in', weight: 0.3 },
    { id: 'edge:interface:client/src/components/NeuralCortexVisualizer.tsx::CortexNode->file:client/src/components/NeuralCortexVisualizer.tsx', source: 'interface:client/src/components/NeuralCortexVisualizer.tsx::CortexNode', target: 'file:client/src/components/NeuralCortexVisualizer.tsx', type: 'defined_in', weight: 0.3 },
  ],

  communities: [
    { id: 'community:0', name: 'core/server', keywords: ['router', 'trpc', 'express'], cohesion: 0.72, symbolCount: 8, memberIds: [] },
    { id: 'community:1', name: 'code-graph/engine', keywords: ['graph', 'parse', 'build'], cohesion: 0.85, symbolCount: 6, memberIds: [] },
    { id: 'community:2', name: 'auth/security', keywords: ['auth', 'token', 'encrypt'], cohesion: 0.68, symbolCount: 5, memberIds: [] },
    { id: 'community:3', name: 'client/visualization', keywords: ['cortex', 'visualizer', 'three'], cohesion: 0.78, symbolCount: 4, memberIds: [] },
    { id: 'community:4', name: 'memory/latentmas', keywords: ['memory', 'embedding', 'semantic'], cohesion: 0.65, symbolCount: 4, memberIds: [] },
  ],

  processes: [
    { id: 'process:0', name: 'buildCodeGraph → parseFile', entryPoint: 'fn:server/code-graph/graph-builder.ts::buildCodeGraph', terminalPoint: 'fn:server/code-graph/code-parser.ts::parseFile', steps: ['fn:server/code-graph/graph-builder.ts::buildCodeGraph', 'fn:server/code-graph/code-parser.ts::parseFile'], stepCount: 2, crossCommunity: false },
    { id: 'process:1', name: 'initializeSocketIO → broadcastCodeChange', entryPoint: 'fn:server/socket-events.ts::initializeSocketIO', terminalPoint: 'fn:server/socket-events.ts::broadcastCodeChange', steps: ['fn:server/socket-events.ts::initializeSocketIO', 'fn:server/socket-events.ts::broadcastCodeChange'], stepCount: 2, crossCommunity: false },
    { id: 'process:2', name: 'encryptKey → decryptKey', entryPoint: 'fn:server/provider-keys-service.ts::encryptKey', terminalPoint: 'fn:server/provider-keys-service.ts::decryptKey', steps: ['fn:server/provider-keys-service.ts::encryptKey', 'fn:server/provider-keys-service.ts::decryptKey'], stepCount: 2, crossCommunity: false },
  ],
};
