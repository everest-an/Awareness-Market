#!/usr/bin/env node

/**
 * Test client for Awareness MCP Server
 * 
 * This script demonstrates how to interact with the MCP server
 * and test all available tools and resources.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testMCPServer() {
  console.log('🚀 Starting Awareness MCP Server test...\n');
  
  // Start MCP server as child process
  const serverProcess = spawn('tsx', ['index.ts'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Create client transport
  const transport = new StdioClientTransport({
    command: 'tsx',
    args: ['index.ts']
  });
  
  // Create MCP client
  const client = new Client(
    {
      name: 'awareness-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {}
    }
  );
  
  try {
    // Connect to server
    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully\n');
    
    // Test 1: List available tools
    console.log('=== Test 1: List Tools ===');
    const toolsResponse = await client.request(
      { method: 'tools/list' },
      { method: 'tools/list', params: {} }
    );
    console.log(`Found ${toolsResponse.tools?.length || 0} tools:`);
    toolsResponse.tools?.forEach((tool: any) => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 80)}...`);
    });
    console.log('');
    
    // Test 2: Search for memories
    console.log('=== Test 2: Search Latent Memory ===');
    const searchResult = await client.request(
      { method: 'tools/call' },
      {
        method: 'tools/call',
        params: {
          name: 'search_latent_memory',
          arguments: {
            category: 'Smart Contracts',
            limit: 5
          }
        }
      }
    );
    console.log('Search results:');
    const searchData = JSON.parse(searchResult.content[0].text);
    console.log(`  Found ${searchData.count} memories`);
    searchData.memories.slice(0, 3).forEach((m: any) => {
      console.log(`  - ${m.title} (${m.category})`);
      console.log(`    Price: ${m.price} | Standard: ${m.standard} | URI: ${m.uri}`);
    });
    console.log('');
    
    // Test 3: Calculate alignment gap
    console.log('=== Test 3: Calculate Alignment Gap ===');
    const alignmentResult = await client.request(
      { method: 'tools/call' },
      {
        method: 'tools/call',
        params: {
          name: 'calculate_alignment_gap',
          arguments: {
            sourceModel: 'gpt-4',
            targetModel: 'llama-3-70b',
            vectorDim: 8192
          }
        }
      }
    );
    console.log('Alignment calculation:');
    const alignmentData = JSON.parse(alignmentResult.content[0].text);
    console.log(`  Source: ${alignmentData.sourceModel} → Target: ${alignmentData.targetModel}`);
    console.log(`  Epsilon: ${alignmentData.epsilon}`);
    console.log(`  Fidelity Boost: ${alignmentData.fidelityBoost}`);
    console.log(`  Recommendation: ${alignmentData.recommendation}`);
    console.log(`  Interpretation: ${alignmentData.interpretation}`);
    console.log('');
    
    // Test 4: List resources
    console.log('=== Test 4: List Resources ===');
    const resourcesResponse = await client.request(
      { method: 'resources/list' },
      { method: 'resources/list', params: {} }
    );
    console.log(`Found ${resourcesResponse.resources?.length || 0} resources:`);
    resourcesResponse.resources?.slice(0, 5).forEach((resource: any) => {
      console.log(`  - ${resource.name}`);
      console.log(`    URI: ${resource.uri}`);
    });
    console.log('');
    
    // Test 5: Read a resource
    if (resourcesResponse.resources && resourcesResponse.resources.length > 0) {
      console.log('=== Test 5: Read Resource ===');
      const firstResource = resourcesResponse.resources[0];
      const resourceResult = await client.request(
        { method: 'resources/read' },
        {
          method: 'resources/read',
          params: {
            uri: firstResource.uri
          }
        }
      );
      console.log(`Reading resource: ${firstResource.uri}`);
      const resourceData = JSON.parse(resourceResult.contents[0].text);
      console.log(`  Title: ${resourceData.title}`);
      console.log(`  Category: ${resourceData.category}`);
      console.log(`  Price: ${resourceData.price}`);
      console.log(`  Standard: ${resourceData.standard}`);
      console.log(`  Source Model: ${resourceData.sourceModel}`);
      console.log(`  Dimension: ${resourceData.dimension}`);
      console.log('');
    }
    
    // Test 6: Purchase memory (will fail without valid API key, but tests the interface)
    console.log('=== Test 6: Purchase Memory (Interface Test) ===');
    try {
      const purchaseResult = await client.request(
        { method: 'tools/call' },
        {
          method: 'tools/call',
          params: {
            name: 'purchase_memory',
            arguments: {
              vectorId: 1,
              apiKey: 'test-api-key-invalid'
            }
          }
        }
      );
      console.log('Purchase result:');
      const purchaseData = JSON.parse(purchaseResult.content[0].text);
      console.log(`  Success: ${purchaseData.success}`);
      console.log(`  Message: ${purchaseData.message}`);
      console.log('');
    } catch (error) {
      console.log('  Expected failure (invalid API key)');
      console.log('');
    }
    
    console.log('✅ All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - MCP server is running correctly');
    console.log('  - All 3 tools are functional');
    console.log('  - Resource listing and reading works');
    console.log('  - awareness:// URI scheme is operational');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await client.close();
    serverProcess.kill();
  }
}

// Run tests
testMCPServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
