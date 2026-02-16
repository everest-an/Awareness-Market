/**
 * Agent Type System (P0)
 *
 * Defines a strong typing system for AI agents in the collaboration space.
 * Solves the "who should catch this ball" problem.
 *
 * Roles:
 * - Router (Manus): Task decomposition, highest authority
 * - Architect (Claude): Deep reasoning, core logic generation
 * - Visualizer (v0): Transform architect output to UI components
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('Collaboration:AgentTypes');

// ============================================================================
// Agent Type Definitions
// ============================================================================

/**
 * Base agent types supported in the system
 */
export enum AgentType {
  // LLM-based agents
  ROUTER = 'router',           // Manus: Task planning and orchestration
  ARCHITECT = 'architect',     // Claude: Deep reasoning and architecture
  VISUALIZER = 'visualizer',   // v0: UI/UX generation

  // Specialized agents (future expansion)
  BACKEND_SPECIALIST = 'backend-specialist',
  DATABASE_SPECIALIST = 'database-specialist',
  SECURITY_AUDITOR = 'security-auditor',

  // Tool agents (non-LLM)
  CODE_EXECUTOR = 'code-executor',
  TEST_RUNNER = 'test-runner',
  DEPLOYER = 'deployer',
}

/**
 * Capability domains that agents can handle
 */
export enum CapabilityDomain {
  // Frontend
  UI_DESIGN = 'ui-design',
  REACT_DEVELOPMENT = 'react',
  CSS_STYLING = 'css',
  FRONTEND_STATE = 'state-management',

  // Backend
  API_DESIGN = 'api-design',
  DATABASE_DESIGN = 'database',
  AUTHENTICATION = 'auth',
  BACKEND_LOGIC = 'backend-logic',

  // Architecture
  SYSTEM_DESIGN = 'system-design',
  ALGORITHM_DESIGN = 'algorithms',
  PERFORMANCE_OPT = 'performance',
  SECURITY = 'security',

  // Operations
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
}

/**
 * Task types that can be assigned to agents
 */
export enum TaskType {
  // Planning
  TASK_DECOMPOSITION = 'task-decomposition',
  REQUIREMENT_ANALYSIS = 'requirement-analysis',

  // Design
  UI_DESIGN = 'ui-design',
  API_DESIGN = 'api-design',
  DATABASE_SCHEMA = 'database-schema',
  ARCHITECTURE = 'architecture',

  // Implementation
  FRONTEND_CODE = 'frontend-code',
  BACKEND_CODE = 'backend-code',
  SQL_QUERY = 'sql-query',

  // Quality
  CODE_REVIEW = 'code-review',
  TESTING = 'testing',
  DEBUGGING = 'debugging',

  // Deployment
  BUILD = 'build',
  DEPLOY = 'deploy',
}

// ============================================================================
// Agent Profile
// ============================================================================

/**
 * Agent profile defining capabilities and constraints
 */
export interface AgentProfile {
  type: AgentType;
  name: string;
  description: string;
  capabilities: CapabilityDomain[];
  canHandle: TaskType[];
  authority: number; // 1-10, higher = more authority
  specialties: string[];
  constraints: string[];
}

/**
 * Predefined agent profiles
 */
export const AGENT_PROFILES: Record<AgentType, AgentProfile> = {
  [AgentType.ROUTER]: {
    type: AgentType.ROUTER,
    name: 'Manus (Router)',
    description: 'Task decomposition and orchestration. Highest authority in collaboration.',
    capabilities: [
      CapabilityDomain.SYSTEM_DESIGN,
      CapabilityDomain.ALGORITHM_DESIGN,
    ],
    canHandle: [
      TaskType.TASK_DECOMPOSITION,
      TaskType.REQUIREMENT_ANALYSIS,
      TaskType.ARCHITECTURE,
    ],
    authority: 10,
    specialties: [
      'Task planning and breakdown',
      'Agentic workflow orchestration',
      'Decision making and conflict resolution',
      'Resource allocation',
    ],
    constraints: [
      'Should not write detailed code implementation',
      'Should not handle low-level UI design',
      'Focuses on high-level strategy',
    ],
  },

  [AgentType.ARCHITECT]: {
    type: AgentType.ARCHITECT,
    name: 'Claude (Architect)',
    description: 'Deep reasoning and core logic generation. Handles complex architectural decisions.',
    capabilities: [
      CapabilityDomain.SYSTEM_DESIGN,
      CapabilityDomain.API_DESIGN,
      CapabilityDomain.DATABASE_DESIGN,
      CapabilityDomain.BACKEND_LOGIC,
      CapabilityDomain.SECURITY,
      CapabilityDomain.ALGORITHM_DESIGN,
      CapabilityDomain.PERFORMANCE_OPT,
    ],
    canHandle: [
      TaskType.ARCHITECTURE,
      TaskType.API_DESIGN,
      TaskType.DATABASE_SCHEMA,
      TaskType.BACKEND_CODE,
      TaskType.CODE_REVIEW,
      TaskType.DEBUGGING,
    ],
    authority: 8,
    specialties: [
      'Complex problem solving',
      'System architecture design',
      'Backend logic implementation',
      'API design and optimization',
      'Security best practices',
      'Performance optimization',
    ],
    constraints: [
      'Not specialized in visual design',
      'Should not handle UI component styling',
      'Focuses on logic and architecture',
    ],
  },

  [AgentType.VISUALIZER]: {
    type: AgentType.VISUALIZER,
    name: 'v0 (Visualizer)',
    description: 'UI/UX generation specialist. Transforms designs into React components.',
    capabilities: [
      CapabilityDomain.UI_DESIGN,
      CapabilityDomain.REACT_DEVELOPMENT,
      CapabilityDomain.CSS_STYLING,
      CapabilityDomain.FRONTEND_STATE,
    ],
    canHandle: [
      TaskType.UI_DESIGN,
      TaskType.FRONTEND_CODE,
    ],
    authority: 6,
    specialties: [
      'React component generation',
      'Tailwind CSS styling',
      'Responsive design',
      'Component composition',
      'UI/UX best practices',
    ],
    constraints: [
      'Should not write SQL queries',
      'Should not handle backend logic',
      'Should not make architectural decisions',
      'Focuses on visual presentation',
    ],
  },

  [AgentType.BACKEND_SPECIALIST]: {
    type: AgentType.BACKEND_SPECIALIST,
    name: 'Backend Specialist',
    description: 'Specialized backend development agent.',
    capabilities: [
      CapabilityDomain.API_DESIGN,
      CapabilityDomain.DATABASE_DESIGN,
      CapabilityDomain.BACKEND_LOGIC,
      CapabilityDomain.AUTHENTICATION,
    ],
    canHandle: [
      TaskType.API_DESIGN,
      TaskType.BACKEND_CODE,
      TaskType.DATABASE_SCHEMA,
      TaskType.SQL_QUERY,
    ],
    authority: 7,
    specialties: [
      'RESTful API design',
      'Database optimization',
      'Authentication flows',
      'Server-side logic',
    ],
    constraints: [
      'Should not handle frontend',
      'Focuses on server-side',
    ],
  },

  [AgentType.DATABASE_SPECIALIST]: {
    type: AgentType.DATABASE_SPECIALIST,
    name: 'Database Specialist',
    description: 'Database design and optimization expert.',
    capabilities: [
      CapabilityDomain.DATABASE_DESIGN,
    ],
    canHandle: [
      TaskType.DATABASE_SCHEMA,
      TaskType.SQL_QUERY,
    ],
    authority: 7,
    specialties: [
      'Schema design',
      'Query optimization',
      'Indexing strategies',
      'Data modeling',
    ],
    constraints: [
      'Only handles database-related tasks',
    ],
  },

  [AgentType.SECURITY_AUDITOR]: {
    type: AgentType.SECURITY_AUDITOR,
    name: 'Security Auditor',
    description: 'Security review and vulnerability detection.',
    capabilities: [
      CapabilityDomain.SECURITY,
    ],
    canHandle: [
      TaskType.CODE_REVIEW,
    ],
    authority: 8,
    specialties: [
      'Security vulnerability detection',
      'Code security audit',
      'Best practices enforcement',
    ],
    constraints: [
      'Review only, does not implement',
    ],
  },

  [AgentType.CODE_EXECUTOR]: {
    type: AgentType.CODE_EXECUTOR,
    name: 'Code Executor',
    description: 'Executes code in sandboxed environment.',
    capabilities: [],
    canHandle: [],
    authority: 5,
    specialties: ['Code execution', 'Runtime testing'],
    constraints: ['Non-LLM tool agent'],
  },

  [AgentType.TEST_RUNNER]: {
    type: AgentType.TEST_RUNNER,
    name: 'Test Runner',
    description: 'Automated test execution.',
    capabilities: [
      CapabilityDomain.TESTING,
    ],
    canHandle: [
      TaskType.TESTING,
    ],
    authority: 5,
    specialties: ['Unit testing', 'Integration testing', 'E2E testing'],
    constraints: ['Non-LLM tool agent'],
  },

  [AgentType.DEPLOYER]: {
    type: AgentType.DEPLOYER,
    name: 'Deployer',
    description: 'Automated deployment and CI/CD.',
    capabilities: [
      CapabilityDomain.DEPLOYMENT,
    ],
    canHandle: [
      TaskType.BUILD,
      TaskType.DEPLOY,
    ],
    authority: 5,
    specialties: ['Build automation', 'Deployment pipelines', 'Environment management'],
    constraints: ['Non-LLM tool agent'],
  },
};

// ============================================================================
// Task Routing System
// ============================================================================

/**
 * Task routing engine that determines which agent should handle a task
 */
export class TaskRouter {
  /**
   * Route a task to the most appropriate agent
   */
  static routeTask(taskType: TaskType, availableAgents: AgentType[]): AgentType | null {
    // Get profiles for available agents
    const profiles = availableAgents
      .map(type => AGENT_PROFILES[type])
      .filter(profile => profile.canHandle.includes(taskType));

    if (profiles.length === 0) {
      logger.warn('No agent can handle task', { taskType, availableAgents });
      return null;
    }

    // Sort by authority (highest first)
    profiles.sort((a, b) => b.authority - a.authority);

    const selected = profiles[0];
    logger.info('Task routed', {
      taskType,
      selectedAgent: selected.type,
      authority: selected.authority,
    });

    return selected.type;
  }

  /**
   * Check if an agent can handle a specific task
   */
  static canHandle(agentType: AgentType, taskType: TaskType): boolean {
    const profile = AGENT_PROFILES[agentType];
    return profile.canHandle.includes(taskType);
  }

  /**
   * Get recommended agent for a task description (AI-powered routing)
   */
  static async recommendAgent(
    taskDescription: string,
    availableAgents: AgentType[]
  ): Promise<{ agentType: AgentType; reasoning: string } | null> {
    // Analyze task description and match with agent capabilities
    const keywords = this.extractKeywords(taskDescription.toLowerCase());

    // Score each available agent
    const scores = availableAgents.map(type => {
      const profile = AGENT_PROFILES[type];
      let score = 0;

      // Check specialties
      profile.specialties.forEach(specialty => {
        if (keywords.some(kw => specialty.toLowerCase().includes(kw))) {
          score += 2;
        }
      });

      // Check capabilities
      profile.capabilities.forEach(cap => {
        if (keywords.some(kw => cap.includes(kw))) {
          score += 1;
        }
      });

      // Boost Router for planning tasks
      if (keywords.some(kw => ['plan', 'organize', 'coordinate'].includes(kw))) {
        if (type === AgentType.ROUTER) score += 5;
      }

      // Boost Architect for complex logic
      if (keywords.some(kw => ['api', 'database', 'backend', 'logic'].includes(kw))) {
        if (type === AgentType.ARCHITECT) score += 5;
      }

      // Boost Visualizer for UI tasks
      if (keywords.some(kw => ['ui', 'component', 'design', 'react', 'css'].includes(kw))) {
        if (type === AgentType.VISUALIZER) score += 5;
      }

      return { type, score, profile };
    });

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (best.score === 0) {
      // Default to Router if no match
      return {
        agentType: AgentType.ROUTER,
        reasoning: 'No specific match found. Routing to Router for task decomposition.',
      };
    }

    return {
      agentType: best.type,
      reasoning: `Matched keywords: ${keywords.join(', ')}. Best suited for: ${best.profile.specialties.join(', ')}`,
    };
  }

  /**
   * Extract keywords from task description
   */
  private static extractKeywords(text: string): string[] {
    const keywords = [
      'ui', 'component', 'design', 'react', 'css', 'tailwind', 'frontend',
      'api', 'backend', 'database', 'sql', 'server', 'endpoint',
      'plan', 'organize', 'coordinate', 'strategy', 'architecture',
      'test', 'deploy', 'build', 'ci/cd',
      'security', 'auth', 'performance', 'optimize',
    ];

    return keywords.filter(kw => text.includes(kw));
  }

  /**
   * Validate if a task assignment makes sense
   */
  static validateAssignment(agentType: AgentType, taskType: TaskType): {
    valid: boolean;
    warning?: string;
  } {
    const profile = AGENT_PROFILES[agentType];

    if (!profile.canHandle.includes(taskType)) {
      return {
        valid: false,
        warning: `${profile.name} cannot handle ${taskType}. Consider routing to ${this.routeTask(taskType, Object.values(AgentType))}`,
      };
    }

    // Check constraints
    for (const constraint of profile.constraints) {
      const lowerConstraint = constraint.toLowerCase();
      const lowerTaskType = taskType.toLowerCase();

      if (
        (lowerConstraint.includes('not') || lowerConstraint.includes("shouldn't")) &&
        lowerTaskType.includes(lowerConstraint.split(' ').pop() || '')
      ) {
        return {
          valid: true,
          warning: `Warning: ${profile.name} has constraint: "${constraint}"`,
        };
      }
    }

    return { valid: true };
  }
}

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * Agent registry for managing active agents in a collaboration session
 */
export class AgentRegistry {
  private agents: Map<string, AgentProfile> = new Map();

  /**
   * Register an agent in the session
   */
  register(agentId: string, agentType: AgentType): void {
    const profile = AGENT_PROFILES[agentType];
    this.agents.set(agentId, profile);
    logger.info('Agent registered', { agentId, type: agentType });
  }

  /**
   * Get agent profile
   */
  getProfile(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Map<string, AgentProfile> {
    return this.agents;
  }

  /**
   * Check if agent can handle task
   */
  canAgentHandle(agentId: string, taskType: TaskType): boolean {
    const profile = this.agents.get(agentId);
    if (!profile) return false;
    return profile.canHandle.includes(taskType);
  }

  /**
   * Find best agent for a task
   */
  findBestAgent(taskType: TaskType): string | null {
    const candidates = Array.from(this.agents.entries())
      .filter(([_, profile]) => profile.canHandle.includes(taskType))
      .sort(([_, a], [__, b]) => b.authority - a.authority);

    return candidates.length > 0 ? candidates[0][0] : null;
  }
}

// ============================================================================
// Custom Agent Profiles (User-defined)
// ============================================================================

/**
 * Builder for creating custom agent profiles
 */
export class AgentProfileBuilder {
  private profile: Partial<AgentProfile> = {
    capabilities: [],
    canHandle: [],
    specialties: [],
    constraints: [],
  };

  setType(type: AgentType): this {
    this.profile.type = type;
    return this;
  }

  setName(name: string): this {
    this.profile.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.profile.description = description;
    return this;
  }

  addCapability(capability: CapabilityDomain): this {
    this.profile.capabilities!.push(capability);
    return this;
  }

  addTaskType(taskType: TaskType): this {
    this.profile.canHandle!.push(taskType);
    return this;
  }

  setAuthority(authority: number): this {
    this.profile.authority = authority;
    return this;
  }

  addSpecialty(specialty: string): this {
    this.profile.specialties!.push(specialty);
    return this;
  }

  addConstraint(constraint: string): this {
    this.profile.constraints!.push(constraint);
    return this;
  }

  build(): AgentProfile {
    if (!this.profile.type || !this.profile.name || !this.profile.description) {
      throw new Error('Type, name, and description are required');
    }

    return this.profile as AgentProfile;
  }
}
