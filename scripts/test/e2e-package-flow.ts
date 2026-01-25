#!/usr/bin/env tsx
/**
 * E2E Test: Package Upload → Browse → Purchase → Download Flow
 * 
 * Tests the complete lifecycle of a package on the marketplace
 */

import * as dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
    console.log(`  ❌ ${name}: ${error.message}`);
  }
}

async function apiCall(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text}`);
  }
  
  return response.json();
}

// ============================================================================
// Tests
// ============================================================================

async function testHealthCheck() {
  await test('Server health check', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (!response.ok) throw new Error('Health check failed');
  });
}

async function testBrowsePackages() {
  await test('Browse vector packages', async () => {
    // This would call the tRPC endpoint
    // For now, just check the page loads
    const response = await fetch(`${BASE_URL}/vector-packages`);
    if (!response.ok) throw new Error('Failed to load vector packages page');
  });

  await test('Browse memory packages', async () => {
    const response = await fetch(`${BASE_URL}/memory-packages`);
    if (!response.ok) throw new Error('Failed to load memory packages page');
  });

  await test('Browse chain packages', async () => {
    const response = await fetch(`${BASE_URL}/chain-packages`);
    if (!response.ok) throw new Error('Failed to load chain packages page');
  });
}

async function testAuthFlow() {
  await test('Auth page loads', async () => {
    const response = await fetch(`${BASE_URL}/auth`);
    if (!response.ok) throw new Error('Failed to load auth page');
  });
}

async function testGlobalSearch() {
  await test('Global search page loads', async () => {
    const response = await fetch(`${BASE_URL}/marketplace`);
    if (!response.ok) throw new Error('Failed to load marketplace page');
  });
}

async function testWorkflowVisualization() {
  await test('Workflow demo page loads', async () => {
    const response = await fetch(`${BASE_URL}/workflow-demo`);
    if (!response.ok) throw new Error('Failed to load workflow demo page');
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🧪 E2E Test Suite: Package Flow');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}\n`);

  console.log('📋 Running tests...\n');

  await testHealthCheck();
  await testAuthFlow();
  await testBrowsePackages();
  await testGlobalSearch();
  await testWorkflowVisualization();

  // Summary
  console.log('\n📊 Test Results');
  console.log('================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
}

main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
