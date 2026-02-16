#!/usr/bin/env node

/**
 * AI Collaboration Project Manager
 *
 * Manages multiple client projects with isolated collaboration spaces
 * - Each client has separate projects
 * - Each project has isolated memory space
 * - Each project has unique MCP token
 * - Support multiple AI agents per project
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Types
interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  mcpToken: string;
  memoryKey: string;
  agents: Agent[];
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
}

interface Agent {
  id: string;
  name: string;
  role: string; // frontend, backend, testing, devops, etc.
  model: string; // manus, claude, gpt-4, etc.
  description?: string;
}

interface ProjectConfig {
  projects: Project[];
}

// Configuration file path
const CONFIG_DIR = path.join(process.cwd(), '.ai-collaboration');
const CONFIG_FILE = path.join(CONFIG_DIR, 'projects.json');

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Load projects
function loadProjects(): ProjectConfig {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    const initialConfig: ProjectConfig = { projects: [] };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2));
    return initialConfig;
  }

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  return JSON.parse(content);
}

// Save projects
function saveProjects(config: ProjectConfig) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Generate unique token
function generateToken(prefix: string = 'mcp'): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${randomBytes}`;
}

// Generate memory key
function generateMemoryKey(clientId: string, projectId: string): string {
  return `client:${clientId}:project:${projectId}`;
}

// Create new project
export function createProject(params: {
  projectName: string;
  clientId: string;
  clientName: string;
  agents: Array<{ name: string; role: string; model: string; description?: string }>;
}): Project {
  const config = loadProjects();

  // Generate unique project ID
  const projectId = `proj_${crypto.randomBytes(8).toString('hex')}`;
  const mcpToken = generateToken('mcp_collab');
  const memoryKey = generateMemoryKey(params.clientId, projectId);

  const project: Project = {
    id: projectId,
    name: params.projectName,
    clientId: params.clientId,
    clientName: params.clientName,
    mcpToken,
    memoryKey,
    agents: params.agents.map(a => ({
      id: `agent_${crypto.randomBytes(4).toString('hex')}`,
      ...a
    })),
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  config.projects.push(project);
  saveProjects(config);

  return project;
}

// List all projects
export function listProjects(clientId?: string): Project[] {
  const config = loadProjects();

  if (clientId) {
    return config.projects.filter(p => p.clientId === clientId);
  }

  return config.projects;
}

// Get project by ID
export function getProject(projectId: string): Project | null {
  const config = loadProjects();
  return config.projects.find(p => p.id === projectId) || null;
}

// Update project status
export function updateProjectStatus(projectId: string, status: 'active' | 'paused' | 'completed'): boolean {
  const config = loadProjects();
  const project = config.projects.find(p => p.id === projectId);

  if (!project) {
    return false;
  }

  project.status = status;
  saveProjects(config);
  return true;
}

// Add agent to project
export function addAgent(projectId: string, agent: { name: string; role: string; model: string; description?: string }): boolean {
  const config = loadProjects();
  const project = config.projects.find(p => p.id === projectId);

  if (!project) {
    return false;
  }

  project.agents.push({
    id: `agent_${crypto.randomBytes(4).toString('hex')}`,
    ...agent
  });

  saveProjects(config);
  return true;
}

// Generate MCP config for an agent
export function generateAgentConfig(projectId: string, agentRole: string): any {
  const project = getProject(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const agent = project.agents.find(a => a.role === agentRole);

  if (!agent) {
    throw new Error(`Agent with role ${agentRole} not found in project ${projectId}`);
  }

  return {
    mcpServers: {
      [`awareness-collab-${project.id}`]: {
        command: 'node',
        args: ['./mcp-server/dist/index-collaboration.js'],
        env: {
          VITE_APP_URL: process.env.VITE_APP_URL || 'https://awareness.market',
          MCP_COLLABORATION_TOKEN: project.mcpToken,
          AGENT_ROLE: agent.role,
          PROJECT_ID: project.id,
          PROJECT_NAME: project.name,
          MEMORY_KEY: project.memoryKey
        },
        description: `${project.clientName} - ${project.name} (${agent.name})`,
        autoApprove: [
          'share_reasoning',
          'get_other_agent_context',
          'sync_progress'
        ]
      }
    }
  };
}

// CLI Commands
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'create':
      {
        const projectName = args[1];
        const clientId = args[2];
        const clientName = args[3];

        if (!projectName || !clientId || !clientName) {
          console.error('Usage: project-manager create <project-name> <client-id> <client-name>');
          process.exit(1);
        }

        const project = createProject({
          projectName,
          clientId,
          clientName,
          agents: [
            { name: 'Manus', role: 'frontend', model: 'manus', description: 'Frontend development' },
            { name: 'Claude', role: 'backend', model: 'claude-sonnet-4.5', description: 'Backend development' }
          ]
        });

        console.log('✅ Project created successfully!\n');
        console.log('Project Details:');
        console.log(`  ID: ${project.id}`);
        console.log(`  Name: ${project.name}`);
        console.log(`  Client: ${project.clientName} (${project.clientId})`);
        console.log(`  MCP Token: ${project.mcpToken}`);
        console.log(`  Memory Key: ${project.memoryKey}`);
        console.log(`\nAgents:`);
        project.agents.forEach(a => {
          console.log(`  - ${a.name} (${a.role}) - ${a.model}`);
        });
      }
      break;

    case 'list':
      {
        const clientId = args[1];
        const projects = listProjects(clientId);

        console.log(`\n📋 Projects ${clientId ? `for client ${clientId}` : '(all clients)'}\n`);

        if (projects.length === 0) {
          console.log('No projects found.');
        } else {
          projects.forEach(p => {
            console.log(`${p.status === 'active' ? '🟢' : p.status === 'paused' ? '🟡' : '✅'} ${p.id}`);
            console.log(`   Name: ${p.name}`);
            console.log(`   Client: ${p.clientName} (${p.clientId})`);
            console.log(`   Agents: ${p.agents.map(a => `${a.name}(${a.role})`).join(', ')}`);
            console.log(`   Created: ${new Date(p.createdAt).toLocaleDateString()}`);
            console.log('');
          });
        }
      }
      break;

    case 'show':
      {
        const projectId = args[1];

        if (!projectId) {
          console.error('Usage: project-manager show <project-id>');
          process.exit(1);
        }

        const project = getProject(projectId);

        if (!project) {
          console.error(`Project ${projectId} not found`);
          process.exit(1);
        }

        console.log('\n📦 Project Details\n');
        console.log(`ID: ${project.id}`);
        console.log(`Name: ${project.name}`);
        console.log(`Client: ${project.clientName} (${project.clientId})`);
        console.log(`Status: ${project.status}`);
        console.log(`MCP Token: ${project.mcpToken}`);
        console.log(`Memory Key: ${project.memoryKey}`);
        console.log(`Created: ${project.createdAt}`);
        console.log(`\nAgents (${project.agents.length}):`);
        project.agents.forEach(a => {
          console.log(`  ${a.id}`);
          console.log(`    Name: ${a.name}`);
          console.log(`    Role: ${a.role}`);
          console.log(`    Model: ${a.model}`);
          if (a.description) {
            console.log(`    Description: ${a.description}`);
          }
        });
      }
      break;

    case 'config':
      {
        const projectId = args[1];
        const agentRole = args[2];

        if (!projectId || !agentRole) {
          console.error('Usage: project-manager config <project-id> <agent-role>');
          process.exit(1);
        }

        try {
          const config = generateAgentConfig(projectId, agentRole);
          console.log('\n🔧 MCP Configuration\n');
          console.log(JSON.stringify(config, null, 2));
        } catch (error: any) {
          console.error(`Error: ${error.message}`);
          process.exit(1);
        }
      }
      break;

    case 'add-agent':
      {
        const projectId = args[1];
        const name = args[2];
        const role = args[3];
        const model = args[4];

        if (!projectId || !name || !role || !model) {
          console.error('Usage: project-manager add-agent <project-id> <name> <role> <model>');
          process.exit(1);
        }

        const success = addAgent(projectId, { name, role, model });

        if (success) {
          console.log(`✅ Agent ${name} (${role}) added to project ${projectId}`);
        } else {
          console.error(`❌ Project ${projectId} not found`);
          process.exit(1);
        }
      }
      break;

    case 'status':
      {
        const projectId = args[1];
        const status = args[2] as 'active' | 'paused' | 'completed';

        if (!projectId || !status || !['active', 'paused', 'completed'].includes(status)) {
          console.error('Usage: project-manager status <project-id> <active|paused|completed>');
          process.exit(1);
        }

        const success = updateProjectStatus(projectId, status);

        if (success) {
          console.log(`✅ Project ${projectId} status updated to ${status}`);
        } else {
          console.error(`❌ Project ${projectId} not found`);
          process.exit(1);
        }
      }
      break;

    default:
      console.log(`
AI Collaboration Project Manager

Usage:
  project-manager <command> [options]

Commands:
  create <name> <client-id> <client-name>     Create a new project
  list [client-id]                            List all projects (or for specific client)
  show <project-id>                           Show project details
  config <project-id> <agent-role>            Generate MCP config for an agent
  add-agent <project-id> <name> <role> <model> Add an agent to project
  status <project-id> <active|paused|completed> Update project status

Examples:
  # Create new project
  project-manager create "E-commerce Platform" client_001 "Acme Corp"

  # List all projects
  project-manager list

  # Show project details
  project-manager show proj_abc123

  # Generate config for frontend agent
  project-manager config proj_abc123 frontend

  # Add testing agent
  project-manager add-agent proj_abc123 "QA Bot" testing gpt-4

  # Pause project
  project-manager status proj_abc123 paused
      `);
      break;
  }
}
