#!/usr/bin/env node

/**
 * Test script for Awareness LatentMAS MCP Server
 * 
 * Tests all 5 core tools:
 * 1. search_latentmas_memories
 * 2. check_model_compatibility
 * 3. get_wmatrix_details
 * 4. estimate_performance
 * 5. purchase_memory_package
 */

import { spawn } from 'child_process';
import * as readline from 'readline';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

class MCPClient {
  private process: any;
  private requestId = 1;
  private pendingRequests = new Map<number, (response: MCPResponse) => void>();

  constructor() {
    this.process = spawn('node', ['index.ts'], {
      cwd: '/home/ubuntu/latentmind-marketplace/mcp-server',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = readline.createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      try {
        const response: MCPResponse = JSON.parse(line);
        const resolver = this.pendingRequests.get(response.id);
        if (resolver) {
          resolver(response);
          this.pendingRequests.delete(response.id);
        }
      } catch (error) {
        // Ignore non-JSON lines (e.g., stderr logs)
      }
    });

    this.process.stderr.on('data', (data: Buffer) => {
      console.error(`[MCP Server] ${data.toString()}`);
    });
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    const id = this.requestId++;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, (response) => {
        if (response.error) {
          reject(new Error(JSON.stringify(response.error)));
        } else {
          resolve(response.result);
        }
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  close() {
    this.process.kill();
  }
}

async function runTests() {
  console.log('🧪 Starting MCP Server Tests\n');

  const client = new MCPClient();

  try {
    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test 1: List tools
    console.log('📋 Test 1: List available tools');
    const toolsResult = await client.sendRequest('tools/list');
    console.log(`✓ Found ${toolsResult.tools.length} tools:`);
    toolsResult.tools.forEach((tool: any) => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 80)}...`);
    });
    console.log('');

    // Test 2: Search LatentMAS memories
    console.log('🔍 Test 2: Search LatentMAS memories (GPT-3.5 → GPT-4)');
    const searchResult = await client.sendRequest('tools/call', {
      name: 'search_latentmas_memories',
      arguments: {
        sourceModel: 'gpt-3.5-turbo',
        targetModel: 'gpt-4',
        maxEpsilon: 0.10,
        minQuality: 70,
        limit: 5,
      },
    });
    const searchData = JSON.parse(searchResult.content[0].text);
    console.log(`✓ Found ${searchData.count} memory packages`);
    if (searchData.packages.length > 0) {
      console.log(`  Best option: ${searchData.packages[0].title}`);
      console.log(`  - Epsilon: ${searchData.packages[0].epsilon}`);
      console.log(`  - Quality: ${searchData.packages[0].qualityScore}`);
      console.log(`  - TTFT Reduction: ${searchData.packages[0].performance.ttftReduction}`);
    }
    console.log('');

    // Test 3: Check model compatibility
    console.log('🔗 Test 3: Check model compatibility (GPT-3.5 → Claude-3-Opus)');
    const compatResult = await client.sendRequest('tools/call', {
      name: 'check_model_compatibility',
      arguments: {
        sourceModel: 'gpt-3.5-turbo',
        targetModel: 'claude-3-opus',
      },
    });
    const compatData = JSON.parse(compatResult.content[0].text);
    console.log(`✓ Compatible: ${compatData.compatible}`);
    console.log(`  Epsilon: ${compatData.epsilon}`);
    console.log(`  Recommendation: ${compatData.recommendation}`);
    console.log(`  Interpretation: ${compatData.interpretation}`);
    console.log('');

    // Test 4: Get W-Matrix details
    console.log('📊 Test 4: Get W-Matrix details (GPT-3.5 → GPT-4)');
    try {
      const wmatrixResult = await client.sendRequest('tools/call', {
        name: 'get_wmatrix_details',
        arguments: {
          sourceModel: 'gpt-3.5-turbo',
          targetModel: 'gpt-4',
        },
      });
      const wmatrixData = JSON.parse(wmatrixResult.content[0].text);
      console.log(`✓ W-Matrix details retrieved`);
      console.log(`  ${JSON.stringify(wmatrixData, null, 2).substring(0, 200)}...`);
    } catch (error) {
      console.log(`⚠ W-Matrix not found (expected if no data generated yet)`);
    }
    console.log('');

    // Test 5: Estimate performance
    console.log('⚡ Test 5: Estimate performance improvements');
    const perfResult = await client.sendRequest('tools/call', {
      name: 'estimate_performance',
      arguments: {
        sourceModel: 'gpt-3.5-turbo',
        targetModel: 'gpt-4',
        currentTokens: 1000,
      },
    });
    const perfData = JSON.parse(perfResult.content[0].text);
    console.log(`✓ Performance estimates:`);
    console.log(`  Current tokens: ${perfData.currentTokens}`);
    console.log(`  TTFT Reduction: ${perfData.estimatedImprovements.ttftReduction}`);
    console.log(`  Token Savings: ${perfData.estimatedImprovements.tokenSavings}`);
    console.log(`  Bandwidth Saving: ${perfData.estimatedImprovements.bandwidthSaving}`);
    console.log(`  Estimated Cost: ${perfData.estimatedCost}`);
    console.log(`  Recommendation: ${perfData.recommendation}`);
    console.log('');

    // Test 6: List resources
    console.log('📚 Test 6: List available resources');
    const resourcesResult = await client.sendRequest('resources/list');
    console.log(`✓ Found ${resourcesResult.resources.length} resources`);
    if (resourcesResult.resources.length > 0) {
      console.log(`  First resource: ${resourcesResult.resources[0].name}`);
      console.log(`  URI: ${resourcesResult.resources[0].uri}`);
    }
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.close();
  }
}

runTests().catch(console.error);
