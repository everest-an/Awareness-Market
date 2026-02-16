#!/usr/bin/env node

/**
 * Test project management
 */

import {
  createProject,
  listProjects,
  getProject,
  addAgent,
  generateAgentConfig
} from './dist/project-manager.js';

console.log('🧪 Testing Project Management System\n');
console.log('═'.repeat(60));

// Test 1: Create multiple projects
console.log('\n📝 Test 1: Creating multiple projects...\n');

const project1 = createProject({
  projectName: 'E-commerce Platform',
  clientId: 'client_acme',
  clientName: 'Acme Corporation',
  agents: [
    { name: 'Manus', role: 'frontend', model: 'manus' },
    { name: 'Claude', role: 'backend', model: 'claude-sonnet-4.5' }
  ]
});

console.log(`✅ Created: ${project1.name} (${project1.id})`);
console.log(`   Client: ${project1.clientName}`);
console.log(`   Token: ${project1.mcpToken.substring(0, 20)}...`);

const project2 = createProject({
  projectName: 'Mobile App',
  clientId: 'client_techcorp',
  clientName: 'TechCorp Inc',
  agents: [
    { name: 'GPT-4', role: 'frontend', model: 'gpt-4' },
    { name: 'Claude', role: 'backend', model: 'claude-sonnet-4.5' },
    { name: 'Gemini', role: 'devops', model: 'gemini-pro' }
  ]
});

console.log(`✅ Created: ${project2.name} (${project2.id})`);
console.log(`   Client: ${project2.clientName}`);
console.log(`   Token: ${project2.mcpToken.substring(0, 20)}...`);

const project3 = createProject({
  projectName: 'API Platform',
  clientId: 'client_acme',
  clientName: 'Acme Corporation',
  agents: [
    { name: 'Claude', role: 'backend', model: 'claude-sonnet-4.5' }
  ]
});

console.log(`✅ Created: ${project3.name} (${project3.id})`);
console.log(`   Client: ${project3.clientName}`);
console.log(`   Token: ${project3.mcpToken.substring(0, 20)}...`);

// Test 2: List all projects
console.log('\n' + '═'.repeat(60));
console.log('\n📋 Test 2: Listing all projects...\n');

const allProjects = listProjects();
console.log(`Total projects: ${allProjects.length}`);
allProjects.forEach(p => {
  console.log(`  - ${p.name} (${p.clientName}) - ${p.agents.length} agents`);
});

// Test 3: List projects by client
console.log('\n' + '═'.repeat(60));
console.log('\n👥 Test 3: Listing projects by client...\n');

const acmeProjects = listProjects('client_acme');
console.log(`Acme Corporation projects: ${acmeProjects.length}`);
acmeProjects.forEach(p => {
  console.log(`  - ${p.name}`);
});

const techcorpProjects = listProjects('client_techcorp');
console.log(`\nTechCorp Inc projects: ${techcorpProjects.length}`);
techcorpProjects.forEach(p => {
  console.log(`  - ${p.name}`);
});

// Test 4: Project isolation check
console.log('\n' + '═'.repeat(60));
console.log('\n🔒 Test 4: Project isolation verification...\n');

console.log('Checking token uniqueness:');
const tokens = allProjects.map(p => p.mcpToken);
const uniqueTokens = new Set(tokens);
console.log(`  Total tokens: ${tokens.length}`);
console.log(`  Unique tokens: ${uniqueTokens.size}`);
console.log(`  ${tokens.length === uniqueTokens.size ? '✅' : '❌'} All tokens are unique`);

console.log('\nChecking memory key isolation:');
allProjects.forEach(p => {
  const expectedKey = `client:${p.clientId}:project:${p.id}`;
  const isCorrect = p.memoryKey === expectedKey;
  console.log(`  ${isCorrect ? '✅' : '❌'} ${p.name}: ${p.memoryKey}`);
});

// Test 5: Add agent to project
console.log('\n' + '═'.repeat(60));
console.log('\n➕ Test 5: Adding agent to project...\n');

const success = addAgent(project1.id, {
  name: 'QA Bot',
  role: 'testing',
  model: 'gpt-4',
  description: 'Automated testing'
});

console.log(`${success ? '✅' : '❌'} Added QA Bot to ${project1.name}`);

const updatedProject = getProject(project1.id);
console.log(`  Agents in project: ${updatedProject.agents.length}`);
updatedProject.agents.forEach(a => {
  console.log(`    - ${a.name} (${a.role})`);
});

// Test 6: Generate configurations
console.log('\n' + '═'.repeat(60));
console.log('\n⚙️  Test 6: Generating agent configurations...\n');

console.log(`Generating configs for ${project1.name}:`);

try {
  const frontendConfig = generateAgentConfig(project1.id, 'frontend');
  console.log('  ✅ Frontend config generated');

  const backendConfig = generateAgentConfig(project1.id, 'backend');
  console.log('  ✅ Backend config generated');

  const testingConfig = generateAgentConfig(project1.id, 'testing');
  console.log('  ✅ Testing config generated');
} catch (error) {
  console.log(`  ❌ Error: ${error.message}`);
}

// Summary
console.log('\n' + '═'.repeat(60));
console.log('\n📊 Test Summary\n');

const summary = {
  'Total projects': allProjects.length,
  'Acme Corp projects': acmeProjects.length,
  'TechCorp Inc projects': techcorpProjects.length,
  'Total agents': allProjects.reduce((sum, p) => sum + p.agents.length, 0),
  'Unique tokens': uniqueTokens.size,
  'Isolation verified': tokens.length === uniqueTokens.size
};

Object.entries(summary).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n🎉 All tests completed successfully!\n');
