/**
 * Feature Flags Configuration for v3.0
 *
 * Controls which v3.0 features are enabled in the application.
 * Set environment variables to enable/disable features.
 *
 * Usage:
 *   import { featureFlags, isFeatureEnabled } from './config/feature-flags';
 *
 *   if (isFeatureEnabled('ORGANIZATIONS')) {
 *     // Organization feature code
 *   }
 */

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  envVar: string;
  dependencies?: string[]; // Other features that must be enabled
  phase?: number; // Which v3.0 phase this belongs to
}

// ============================================================================
// Feature Flag Definitions
// ============================================================================

export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Phase 1: Organization Foundation
  ORGANIZATIONS: {
    key: 'ORGANIZATIONS',
    name: 'Organizations',
    description: 'Enable multi-tenant organization structure',
    defaultEnabled: false,
    envVar: 'ENABLE_ORGANIZATIONS',
    phase: 1,
  },

  DEPARTMENTS: {
    key: 'DEPARTMENTS',
    name: 'Departments',
    description: 'Enable department hierarchy within organizations',
    defaultEnabled: false,
    envVar: 'ENABLE_DEPARTMENTS',
    dependencies: ['ORGANIZATIONS'],
    phase: 1,
  },

  MEMORY_TYPES: {
    key: 'MEMORY_TYPES',
    name: 'Memory Types',
    description: 'Enable memory type classification (episodic/semantic/strategic/procedural)',
    defaultEnabled: false,
    envVar: 'ENABLE_MEMORY_TYPES',
    phase: 1,
  },

  MEMORY_DECAY: {
    key: 'MEMORY_DECAY',
    name: 'Memory Decay',
    description: 'Enable type-specific memory decay system',
    defaultEnabled: false,
    envVar: 'ENABLE_MEMORY_DECAY',
    dependencies: ['MEMORY_TYPES'],
    phase: 1,
  },

  QUALITY_TIERS: {
    key: 'QUALITY_TIERS',
    name: 'Quality Tiers',
    description: 'Enable memory quality tier classification (platinum/gold/silver/bronze)',
    defaultEnabled: false,
    envVar: 'ENABLE_QUALITY_TIERS',
    phase: 1,
  },

  // Phase 2: Memory Pools + Conflict Resolution
  MEMORY_POOLS: {
    key: 'MEMORY_POOLS',
    name: 'Memory Pools',
    description: 'Enable multi-layer memory pools (Private/Domain/Global)',
    defaultEnabled: false,
    envVar: 'ENABLE_MEMORY_POOLS',
    dependencies: ['ORGANIZATIONS', 'DEPARTMENTS'],
    phase: 2,
  },

  MEMORY_PROMOTION: {
    key: 'MEMORY_PROMOTION',
    name: 'Memory Promotion',
    description: 'Enable automatic memory promotion from Domain to Global',
    defaultEnabled: false,
    envVar: 'ENABLE_MEMORY_PROMOTION',
    dependencies: ['MEMORY_POOLS'],
    phase: 2,
  },

  CONFLICT_SEVERITY: {
    key: 'CONFLICT_SEVERITY',
    name: 'Conflict Severity',
    description: 'Enable conflict severity classification (low/medium/high/critical)',
    defaultEnabled: false,
    envVar: 'ENABLE_CONFLICT_SEVERITY',
    phase: 2,
  },

  CONFLICT_ARBITRATION: {
    key: 'CONFLICT_ARBITRATION',
    name: 'Conflict Arbitration',
    description: 'Enable automated conflict arbitration for high-severity conflicts',
    defaultEnabled: false,
    envVar: 'ENABLE_CONFLICT_ARBITRATION',
    dependencies: ['CONFLICT_SEVERITY'],
    phase: 2,
  },

  // Phase 3: Decision Recording + Agent Reputation
  DECISIONS: {
    key: 'DECISIONS',
    name: 'Decision Recording',
    description: 'Enable decision recording and audit trail',
    defaultEnabled: false,
    envVar: 'ENABLE_DECISIONS',
    dependencies: ['ORGANIZATIONS'],
    phase: 3,
  },

  DECISION_REPLAY: {
    key: 'DECISION_REPLAY',
    name: 'Decision Replay',
    description: 'Enable historical decision replay with memory reconstruction',
    defaultEnabled: false,
    envVar: 'ENABLE_DECISION_REPLAY',
    dependencies: ['DECISIONS'],
    phase: 3,
  },

  AGENT_REPUTATION: {
    key: 'AGENT_REPUTATION',
    name: 'Agent Reputation',
    description: 'Enable multi-dimensional agent reputation system',
    defaultEnabled: false,
    envVar: 'ENABLE_AGENT_REPUTATION',
    dependencies: ['ORGANIZATIONS'],
    phase: 3,
  },

  REPUTATION_DECAY: {
    key: 'REPUTATION_DECAY',
    name: 'Reputation Decay',
    description: 'Enable reputation decay for inactive agents',
    defaultEnabled: false,
    envVar: 'ENABLE_REPUTATION_DECAY',
    dependencies: ['AGENT_REPUTATION'],
    phase: 3,
  },

  // Phase 4: Cross-Domain Verification + Evidence
  VERIFICATION: {
    key: 'VERIFICATION',
    name: 'Cross-Domain Verification',
    description: 'Enable cross-department peer review and verification',
    defaultEnabled: false,
    envVar: 'ENABLE_VERIFICATION',
    dependencies: ['ORGANIZATIONS', 'DEPARTMENTS'],
    phase: 4,
  },

  EVIDENCE_TRACKING: {
    key: 'EVIDENCE_TRACKING',
    name: 'Evidence Tracking',
    description: 'Enable evidence attachment and citation tracking',
    defaultEnabled: false,
    envVar: 'ENABLE_EVIDENCE_TRACKING',
    dependencies: ['VERIFICATION'],
    phase: 4,
  },

  DEPENDENCY_GRAPHS: {
    key: 'DEPENDENCY_GRAPHS',
    name: 'Dependency Graphs',
    description: 'Enable memory dependency tracking and cascade invalidation',
    defaultEnabled: false,
    envVar: 'ENABLE_DEPENDENCY_GRAPHS',
    phase: 4,
  },

  // Phase 5: Enterprise Dashboard + Analytics
  ORG_ANALYTICS: {
    key: 'ORG_ANALYTICS',
    name: 'Organization Analytics',
    description: 'Enable organization-level analytics and metrics',
    defaultEnabled: false,
    envVar: 'ENABLE_ORG_ANALYTICS',
    dependencies: ['ORGANIZATIONS'],
    phase: 5,
  },

  BILLING_TRACKER: {
    key: 'BILLING_TRACKER',
    name: 'Billing Tracker',
    description: 'Enable usage tracking for billing purposes',
    defaultEnabled: false,
    envVar: 'ENABLE_BILLING_TRACKER',
    dependencies: ['ORGANIZATIONS'],
    phase: 5,
  },

  REPORT_EXPORT: {
    key: 'REPORT_EXPORT',
    name: 'Report Export',
    description: 'Enable decision audit and analytics export (CSV/PDF)',
    defaultEnabled: false,
    envVar: 'ENABLE_REPORT_EXPORT',
    dependencies: ['DECISIONS', 'ORG_ANALYTICS'],
    phase: 5,
  },
};

// ============================================================================
// Feature Flag Utilities
// ============================================================================

/**
 * Get the current state of a feature flag
 */
export function isFeatureEnabled(flagKey: string): boolean {
  const flag = FEATURE_FLAGS[flagKey];
  if (!flag) {
    console.warn(`[FeatureFlags] Unknown feature flag: ${flagKey}`);
    return false;
  }

  // Check environment variable
  const envValue = process.env[flag.envVar];
  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }

  // Fall back to default
  return flag.defaultEnabled;
}

/**
 * Check if all dependencies for a feature are satisfied
 */
export function checkDependencies(flagKey: string): {
  satisfied: boolean;
  missing: string[];
} {
  const flag = FEATURE_FLAGS[flagKey];
  if (!flag || !flag.dependencies) {
    return { satisfied: true, missing: [] };
  }

  const missing: string[] = [];
  for (const depKey of flag.dependencies) {
    if (!isFeatureEnabled(depKey)) {
      missing.push(depKey);
    }
  }

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter((flag) => isFeatureEnabled(flag.key));
}

/**
 * Get features by phase
 */
export function getFeaturesByPhase(phase: number): FeatureFlag[] {
  return Object.values(FEATURE_FLAGS).filter((flag) => flag.phase === phase);
}

/**
 * Get all features with their current state
 */
export function getAllFeatureStates(): Record<
  string,
  {
    enabled: boolean;
    dependenciesSatisfied: boolean;
    missingDependencies: string[];
  }
> {
  const states: Record<string, any> = {};

  for (const [key, flag] of Object.entries(FEATURE_FLAGS)) {
    const enabled = isFeatureEnabled(key);
    const deps = checkDependencies(key);

    states[key] = {
      enabled,
      dependenciesSatisfied: deps.satisfied,
      missingDependencies: deps.missing,
    };
  }

  return states;
}

/**
 * Validate feature flag configuration
 * Returns warnings for misconfigured features
 */
export function validateFeatureFlags(): string[] {
  const warnings: string[] = [];

  for (const [key, flag] of Object.entries(FEATURE_FLAGS)) {
    const enabled = isFeatureEnabled(key);

    if (enabled) {
      const deps = checkDependencies(key);
      if (!deps.satisfied) {
        warnings.push(
          `Feature "${flag.name}" is enabled but requires: ${deps.missing.join(', ')}`
        );
      }
    }
  }

  return warnings;
}

/**
 * Middleware to check if a feature is enabled
 * Throws error if feature is disabled
 */
export function requireFeature(flagKey: string) {
  return (req: any, res: any, next: any) => {
    if (!isFeatureEnabled(flagKey)) {
      const flag = FEATURE_FLAGS[flagKey];
      return res.status(403).json({
        error: 'Feature not enabled',
        message: `The ${flag?.name || flagKey} feature is not enabled on this server`,
        featureKey: flagKey,
      });
    }

    // Check dependencies
    const deps = checkDependencies(flagKey);
    if (!deps.satisfied) {
      return res.status(503).json({
        error: 'Feature dependencies not met',
        message: `This feature requires: ${deps.missing.join(', ')}`,
        featureKey: flagKey,
        missingDependencies: deps.missing,
      });
    }

    next();
  };
}

/**
 * tRPC middleware to check feature flags
 */
export function createFeatureFlagMiddleware(flagKey: string) {
  return async ({ ctx, next }: any) => {
    if (!isFeatureEnabled(flagKey)) {
      throw new Error(`Feature not enabled: ${flagKey}`);
    }

    const deps = checkDependencies(flagKey);
    if (!deps.satisfied) {
      throw new Error(
        `Feature dependencies not met: ${deps.missing.join(', ')}`
      );
    }

    return next({ ctx });
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

export const featureFlags = {
  isEnabled: isFeatureEnabled,
  checkDependencies,
  getEnabled: getEnabledFeatures,
  getByPhase: getFeaturesByPhase,
  getAllStates: getAllFeatureStates,
  validate: validateFeatureFlags,
  require: requireFeature,
  createMiddleware: createFeatureFlagMiddleware,
};

// ============================================================================
// Startup Validation
// ============================================================================

// Validate on module load
const warnings = validateFeatureFlags();
if (warnings.length > 0) {
  console.warn('[FeatureFlags] Configuration warnings:');
  warnings.forEach((warning) => console.warn(`  - ${warning}`));
}

// Log enabled features
const enabled = getEnabledFeatures();
if (enabled.length > 0) {
  console.log('[FeatureFlags] Enabled features:');
  enabled.forEach((flag) => console.log(`  - ${flag.name} (${flag.key})`));
} else {
  console.log('[FeatureFlags] No v3.0 features enabled');
}
