import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";

// Extracted inline routers
import { authRouter } from "./routers/auth";
import { vectorsRouter } from "./routers/vectors";
import { transactionsRouter } from "./routers/transactions";
import { accessRouter } from "./routers/access";
import { reviewsRouter } from "./routers/reviews";
import { notificationsRouter } from "./routers/notifications";
import { recommendationsRouter } from "./routers/recommendations";
import { blogRouter } from "./routers/blog";
import { analyticsRouter } from "./routers/analytics";
import { subscriptionsRouter } from "./routers/subscriptions";
import { wMatrixRouter } from "./routers/w-matrix";
import { semanticIndexRouter } from "./routers/semantic-index";
import { agentRegistryRouter } from "./routers/agent-registry";
import { alignmentRouter } from "./routers/alignment";
import { adminAnalyticsRouter } from "./routers/admin-analytics-router";

// Imported routers (already in separate files)
import { latentmasRouter } from "./routers/latentmas";
import { wMatrixMarketplaceRouter } from "./routers/w-matrix-marketplace";
import { kvCacheApiRouter } from "./routers/kv-cache-api";
import { memoryNFTRouter } from "./routers/memory-nft-api";
import { agentCreditRouter } from './routers/agent-credit-api';
import { latentmasMarketplaceRouter } from './routers/latentmas-marketplace';
import { packagesApiRouter } from './routers/packages-api';
import { aiAgentRouter } from './api/ai-agent-api';
import { workflowRouter } from './routers/workflow';
import { workflowHistoryRouter } from './routers/workflow-history';
import { workflowPerformanceRouter } from './routers/workflow-performance';
import { userRouter } from './routers/user';
import { authUnifiedRouter } from './routers/auth-unified';
import { apiAnalyticsRouter } from './routers/api-analytics';
import { agentDiscoveryRouter } from './routers/agent-discovery';
import { agentCollaborationRouter } from './routers/agent-collaboration';
import { memoryRouter } from './routers/memory';
import { memoryPolicyRouter } from './routers/memory-policy';
import { providerKeysRouter } from './routers/provider-keys';
import { neuralBridgeRouter } from './routers/neural-bridge-api';
import { zkpRouter } from './routers/zkp-api';
import { multimodalRouter } from './routers/multimodal-api';
import { phantomAuthRouter } from './auth-phantom';
import { latentUploadRouter } from './latentmas-upload';
import { resonanceRouter } from './latentmas-resonance';
import { embeddingRouter } from './routers/embedding-api';
import { stablecoinPaymentRouter } from './routers/stablecoin-payment';
import { creditPaymentRouter } from './routers/credit-payment-api';
import { mcpRouter } from './routers/mcp';
import { reasoningChainsRouter } from './routers/reasoning-chains';
import { roboticsRouter } from './routers/robotics';
import { organizationRouter } from './routers/organization';
import { decisionRouter } from './routers/decision';
import { verificationRouter } from './routers/verification';
import { orgAnalyticsRouter } from './routers/org-analytics';
import { apiKeyRouter } from './routers/api-key';
import { ipWhitelistRouter } from './routers/ip-whitelist';
import { sessionManagementRouter } from './routers/session-management';
import { workspaceRouter } from './routers/workspace';

export const appRouter = router({
  system: systemRouter,

  // Auth
  auth: authRouter,
  authUnified: authUnifiedRouter,
  phantomAuth: phantomAuthRouter,

  // Security
  apiKeys: apiKeyRouter,
  ipWhitelist: ipWhitelistRouter,
  sessionManagement: sessionManagementRouter,

  // Legacy marketplace (vectors, transactions, access, reviews)
  vectors: vectorsRouter,
  transactions: transactionsRouter,
  access: accessRouter,
  reviews: reviewsRouter,

  // Unified packages API (Vector/Memory/Chain packages)
  packages: packagesApiRouter,

  // Content & discovery
  notifications: notificationsRouter,
  recommendations: recommendationsRouter,
  blog: blogRouter,
  subscriptions: subscriptionsRouter,

  // Analytics
  analytics: analyticsRouter,
  apiAnalytics: apiAnalyticsRouter,
  adminAnalytics: adminAnalyticsRouter,

  // LatentMAS core
  latentmasV2: latentmasRouter,
  kvCacheApi: kvCacheApiRouter,
  latentmasMarketplace: latentmasMarketplaceRouter,
  latentUpload: latentUploadRouter,
  resonance: resonanceRouter,
  embedding: embeddingRouter,

  // W-Matrix
  wMatrix: wMatrixRouter,
  wMatrixMarketplace: wMatrixMarketplaceRouter,
  alignment: alignmentRouter,

  // Agents
  agentRegistry: agentRegistryRouter,
  agentDiscovery: agentDiscoveryRouter,
  agentCollaboration: agentCollaborationRouter,
  agentCredit: agentCreditRouter,
  aiAgent: aiAgentRouter,

  // Semantic index
  semanticIndex: semanticIndexRouter,

  // Memory
  memory: memoryRouter,
  memoryPolicy: memoryPolicyRouter,
  memoryNFT: memoryNFTRouter,

  // Neural bridge & ZKP
  neuralBridge: neuralBridgeRouter,
  zkp: zkpRouter,
  multimodal: multimodalRouter,

  // Workspace & MCP
  workspace: workspaceRouter,
  mcp: mcpRouter,

  // User
  user: userRouter,
  providerKeys: providerKeysRouter,

  // Payments
  stablecoinPayment: stablecoinPaymentRouter,
  creditPayment: creditPaymentRouter,

  // Workflows
  workflow: workflowRouter,
  workflowHistory: workflowHistoryRouter,
  workflowPerformance: workflowPerformanceRouter,

  // Enterprise (org governance)
  organization: organizationRouter,
  orgAnalytics: orgAnalyticsRouter,
  decision: decisionRouter,
  verification: verificationRouter,

  // Reasoning chains (compatibility for ReasoningChainPublish page)
  reasoningChains: reasoningChainsRouter,

  // Robotics
  robotics: roboticsRouter,
});

export type AppRouter = typeof appRouter;
