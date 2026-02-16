#!/usr/bin/env node

/**
 * Test MCP Collaboration Server
 */

import { spawn } from 'child_process';

console.log('🧪 Testing MCP Collaboration Server...\n');

// Get project info from .ai-collaboration/projects.json
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), '.ai-collaboration', 'projects.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ No projects found. Run setup-project.mjs first.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const project = config.projects[0];

if (!project) {
  console.error('❌ No projects found.');
  process.exit(1);
}

console.log('📦 Using project:');
console.log(`   ID: ${project.id}`);
console.log(`   Name: ${project.name}`);
console.log(`   Token: ${project.mcpToken}`);
console.log('');

// Test 1: Start server with frontend role
console.log('Test 1: Starting MCP server (frontend role)...');

const env = {
  ...process.env,
  VITE_APP_URL: 'https://awareness.market',
  MCP_COLLABORATION_TOKEN: project.mcpToken,
  AGENT_ROLE: 'frontend',
  PROJECT_ID: project.id,
  PROJECT_NAME: project.name,
  MEMORY_KEY: project.memoryKey
};

const server = spawn('node', ['dist/index-collaboration.js'], {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

server.stderr.on('data', (data) => {
  output += data.toString();
});

server.stdout.on('data', (data) => {
  output += data.toString();
});

setTimeout(() => {
  server.kill();

  console.log('\n📋 Server Output:');
  console.log(output);

  // Check for success indicators
  const checks = {
    'Server started': output.includes('Server is running'),
    'Project loaded': output.includes(project.name),
    'Agent role set': output.includes('frontend'),
    'Memory key set': output.includes(project.memoryKey)
  };

  console.log('\n✅ Test Results:');
  Object.entries(checks).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✓' : '✗'} ${test}`);
  });

  const allPassed = Object.values(checks).every(v => v);

  if (allPassed) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed.');
    process.exit(1);
  }
}, 2000);
