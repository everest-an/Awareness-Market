/**
 * All routes extracted from client/src/App.tsx
 * Used across test files for comprehensive route coverage.
 */

/** Public routes — accessible without authentication */
export const PUBLIC_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/robotics', name: 'Robotics' },
  { path: '/auth', name: 'Auth' },
  { path: '/marketplace', name: 'Marketplace' },
  { path: '/pricing', name: 'Pricing' },
  { path: '/privacy', name: 'Privacy' },
  { path: '/terms', name: 'Terms' },
  { path: '/about', name: 'About' },
  { path: '/blog', name: 'Blog' },
  { path: '/docs', name: 'Docs / SDK' },
  { path: '/docs/sdk', name: 'SDK Docs' },
  { path: '/sdk', name: 'SDK Page' },
  { path: '/agents', name: 'Agent Registry' },
  { path: '/reasoning-chains', name: 'Reasoning Chains' },
  { path: '/vector-packages', name: 'Vector Packages' },
  { path: '/memory-marketplace', name: 'Memory Marketplace' },
  { path: '/chain-packages', name: 'Chain Packages' },
  { path: '/documentation', name: 'Documentation' },
  { path: '/service-health', name: 'Service Health' },
  { path: '/404', name: '404 Page' },
] as const;

/** Auth-required routes — redirect to /auth if not logged in */
export const AUTH_REQUIRED_ROUTES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/dashboard/creator', name: 'Creator Dashboard' },
  { path: '/dashboard/consumer', name: 'Consumer Dashboard' },
  { path: '/profile', name: 'Profile' },
  { path: '/upload', name: 'Upload Vector' },
  { path: '/creator/publish', name: 'Creator Publish' },
  { path: '/upload-vector-package', name: 'Upload Vector Package' },
  { path: '/upload-memory-package', name: 'Upload Memory Package' },
  { path: '/upload-chain-package', name: 'Upload Chain Package' },
  { path: '/upload-multimodal-package', name: 'Upload Multimodal Package' },
  { path: '/subscriptions', name: 'Subscriptions' },
  { path: '/wallet', name: 'Wallet' },
  { path: '/credits', name: 'Credits & Payments' },
  { path: '/provider-keys', name: 'Provider Keys' },
  { path: '/privacy-settings', name: 'Privacy Settings' },
  { path: '/memory-management', name: 'Memory Management' },
  { path: '/ai-collaboration', name: 'AI Collaboration Hub' },
  { path: '/ai-collaboration/new', name: 'New Collaboration' },
  { path: '/ai-collaboration/sessions', name: 'Collaboration Sessions' },
  { path: '/workspace', name: 'Workspace List' },
  { path: '/workspace/new', name: 'New Workspace' },
  { path: '/org/setup', name: 'Organization Setup' },
  { path: '/org/dashboard', name: 'Organization Dashboard' },
  { path: '/org/decisions', name: 'Decision Audit' },
  { path: '/org/verification', name: 'Verification Dashboard' },
  { path: '/org/analytics', name: 'Organization Analytics' },
  { path: '/org/billing', name: 'Billing Dashboard' },
  { path: '/admin', name: 'Admin Panel' },
  { path: '/usage-analytics', name: 'Usage Analytics' },
  { path: '/zkp-dashboard', name: 'ZKP Dashboard' },
  { path: '/dev', name: 'Dev Dashboard' },
] as const;

/** Routes that redirect to other paths */
export const REDIRECT_ROUTES = [
  { from: '/hive-mind', to: '/neural-cortex', name: 'HiveMind → NeuralCortex' },
  { from: '/network', to: '/neural-cortex', name: 'Network → NeuralCortex' },
  { from: '/golem-visualizer', to: '/neural-cortex', name: 'Golem → NeuralCortex' },
  { from: '/inference', to: '/neural-cortex', name: 'Inference → NeuralCortex' },
  { from: '/inference-dashboard', to: '/neural-cortex', name: 'InferenceDash → NeuralCortex' },
  { from: '/w-matrix-marketplace', to: '/w-matrix', name: 'WMatrixMarketplace → WMatrix' },
  { from: '/w-matrix/tester', to: '/latent-test', name: 'WMatrixTester → LatentTest' },
  { from: '/api-keys', to: '/profile', name: 'ApiKeys → Profile' },
] as const;

/** Feature pages that need authenticated access */
export const FEATURE_PAGES = [
  { path: '/latent-test', name: 'Latent Test / W-Matrix' },
  { path: '/w-matrix', name: 'W-Matrix' },
  { path: '/neural-bridge-v2-demo', name: 'Neural Bridge V2 Demo' },
  { path: '/kv-cache-demo', name: 'KV-Cache Demo' },
  { path: '/neural-cortex', name: 'Neural Cortex' },
  { path: '/cortex', name: 'Cortex' },
  { path: '/visualizer', name: 'Visualizer' },
  { path: '/cross-modal-search', name: 'Cross-Modal Search' },
  { path: '/agent-discovery', name: 'Agent Discovery' },
  { path: '/w-matrix-market', name: 'W-Matrix Market' },
  { path: '/neural-bridge-market', name: 'Neural Bridge Market' },
  { path: '/w-matrix-tools', name: 'W-Matrix Tools' },
  { path: '/conflicts', name: 'Conflict Resolution' },
  { path: '/workflow-demo', name: 'Workflow Demo' },
  { path: '/workflow-history', name: 'Workflow History' },
  { path: '/workflow-performance', name: 'Workflow Performance' },
] as const;

/** All marketplace sub-routes */
export const MARKETPLACE_ROUTES = [
  { path: '/marketplace', name: 'All Marketplace' },
  { path: '/vector-packages', name: 'Vector Packages' },
  { path: '/memory-marketplace', name: 'Memory Marketplace' },
  { path: '/memory-packages', name: 'Memory Packages (alias)' },
  { path: '/chain-packages', name: 'Chain Packages' },
  { path: '/reasoning-chains', name: 'Reasoning Chains' },
] as const;
