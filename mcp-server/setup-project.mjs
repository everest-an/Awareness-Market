#!/usr/bin/env node

/**
 * Quick setup script for AI collaboration
 */

import {
  createProject,
  listProjects,
  getProject,
  generateAgentConfig
} from './dist/project-manager.js';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║     AI Collaboration System - Quick Setup                 ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

// Create example project
console.log('Creating example project...');
const project = createProject({
  projectName: 'Awareness Platform Development',
  clientId: 'client_awareness',
  clientName: 'Awareness Market Team',
  agents: [
    { name: 'Manus', role: 'frontend', model: 'manus', description: 'Frontend development with React/Vue' },
    { name: 'Claude', role: 'backend', model: 'claude-sonnet-4.5', description: 'Backend development with Node.js/tRPC' }
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

console.log('\n' + '='.repeat(60));
console.log('\n📝 Configuration for Manus (Frontend):\n');
const manusConfig = generateAgentConfig(project.id, 'frontend');
console.log(JSON.stringify(manusConfig, null, 2));

console.log('\n' + '='.repeat(60));
console.log('\n📝 Configuration for Claude (Backend):\n');
const claudeConfig = generateAgentConfig(project.id, 'backend');
console.log(JSON.stringify(claudeConfig, null, 2));

console.log('\n' + '='.repeat(60));
console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('  1. Copy the Manus config to your Manus configuration file');
console.log('  2. Copy the Claude config to .claude-code/settings.json');
console.log('  3. Restart both AI agents');
console.log('  4. Start collaborating!');
console.log('\nProject ID:', project.id);
console.log('Save this ID to create more projects or manage agents.\n');
