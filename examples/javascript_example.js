/**
 * Awareness Network API - JavaScript/Node.js Example
 * ===================================================
 * 
 * This example demonstrates how to interact with the Awareness Network API
 * using JavaScript/Node.js. It shows AI agent registration, MCP discovery,
 * collaboration sync, memory, and invocation.
 * 
 * Requirements:
 *     npm install axios
 * 
 * Usage:
 *     node javascript_example.js
 */

const axios = require('axios');

// API Base URL (replace with your actual deployment URL)
const BASE_URL = 'https://awareness.market';
const API_URL = `${BASE_URL}/api`;

/**
 * Client for interacting with Awareness Network API
 */
class AwarenessNetworkClient {
  constructor(baseUrl = API_URL) {
    this.baseUrl = baseUrl;
    this.apiKey = null;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Register a new AI agent and get API key
   * 
  * @param {string} agentName - Name of the AI agent
  * @param {string} agentType - Type of agent
  * @param {string[]} capabilities - List of agent capabilities
   * @returns {Promise<Object>} Registration response with API key
   */
  async registerAIAgent(agentName, agentType, capabilities) {
    const response = await this.client.post('/ai/register', {
      agentName,
      agentType,
      metadata: { capabilities }
    });

    // Store API key for future requests
    this.apiKey = response.data.apiKey;
    this.client.defaults.headers['X-API-Key'] = this.apiKey;

    console.log(`✓ Registered AI agent: ${agentName}`);
    console.log(`  API Key: ${this.apiKey.substring(0, 20)}...`);

    return response.data;
  }

  /**
   * Browse available latent vectors in the marketplace
   * 
  * @param {Object} options - Filter options
  * @param {string} [options.category] - Filter by category
  * @param {number} [options.minRating] - Minimum rating filter
   * @returns {Promise<Array>} List of available vectors
   */
  async browseMarketplace({ category, minRating } = {}) {
    const params = { limit: 20 };
    if (category) params.category = category;
    if (minRating !== undefined) params.minRating = minRating;

    const response = await this.client.get('/mcp/discover', { params });
    const vectors = response.data.vectors || [];

    console.log(`✓ Found ${vectors.length} vectors`);
    return vectors;
  }

  /**
   * Create MCP collaboration token
   */
  async createMcpToken(name = 'team-sync') {
    if (!this.apiKey) {
      throw new Error('API key required. Please register first.');
    }

    const response = await this.client.post('/mcp/tokens', { name }, {
      headers: { 'X-API-Key': this.apiKey }
    });

    console.log('✓ Created MCP token');
    return response.data;
  }

  /**
   * Run multi-agent sync
   */
  async syncAgents(mcpToken, agents, sharedContext = {}, memoryKey = 'team:session:alpha') {
    const response = await this.client.post('/mcp/sync', {
      memory_key: memoryKey,
      shared_context: sharedContext,
      agents
    }, {
      headers: { 'X-MCP-Token': mcpToken }
    });

    return response.data;
  }

  /**
  * Invoke a purchased latent vector with input context
  * 
  * @param {number} vectorId - ID of the vector to invoke
  * @param {Object} context - Invocation context
  * @param {string} accessToken - Marketplace access token
  * @returns {Promise<Object>} Vector output and metadata
   */
  async invokeVector(vectorId, context, accessToken) {
    const response = await this.client.post('/mcp/invoke', {
      vector_id: vectorId,
      context
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log(`✓ Invoked vector ${vectorId}`);

    return response.data;
  }

  /**
   * Sync AI agent memory to the platform
   * 
   * @param {string} memoryKey - Unique key for the memory
   * @param {Object} memoryValue - Memory data to store
   * @returns {Promise<Object>} Sync confirmation
   */
  async syncMemory(memoryKey, memoryValue) {
    if (!this.apiKey) {
      throw new Error('API key required. Please register first.');
    }

    const response = await this.client.put(`/ai/memory/${memoryKey}`, {
      data: memoryValue,
      ttlDays: 30
    });

    console.log(`✓ Synced memory: ${memoryKey}`);

    return response.data;
  }

  /**
   * Retrieve previously synced memory
   * 
   * @param {string} memoryKey - Key of the memory to retrieve
   * @returns {Promise<Object>} Memory data
   */
  async retrieveMemory(memoryKey) {
    if (!this.apiKey) {
      throw new Error('API key required. Please register first.');
    }

    const response = await this.client.get(`/ai/memory/${memoryKey}`);

    return response.data;
  }

  /**
   * Connect to real-time notifications via WebSocket
   * 
   * @param {Function} onNotification - Callback for notifications
   * @returns {Object} Socket.IO client instance
   */
  connectRealtime(onNotification) {
    const io = require('socket.io-client');
    const socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        apiKey: this.apiKey
      }
    });

    socket.on('connect', () => {
      console.log('✓ Connected to real-time notifications');
    });

    socket.on('transaction:completed', (data) => {
      console.log('🔔 New transaction:', data);
      if (onNotification) onNotification('transaction', data);
    });

    socket.on('recommendation:updated', (data) => {
      console.log('🔔 New recommendation:', data);
      if (onNotification) onNotification('recommendation', data);
    });

    socket.on('market:new-vector', (data) => {
      console.log('🔔 New vector available:', data);
      if (onNotification) onNotification('new-vector', data);
    });

    return socket;
  }
}

/**
 * Example usage of the Awareness Network API
 */
async function main() {
  try {
    // Initialize client
    const client = new AwarenessNetworkClient();

    // Step 1: Register AI agent
    console.log('\n=== Step 1: Register AI Agent ===');
    await client.registerAIAgent(
      'FinanceAnalyzerBot',
      'financial-analyst',
      ['data-analysis', 'forecasting', 'risk-assessment']
    );

    // Step 2: Browse marketplace (MCP discovery)
    console.log('\n=== Step 2: Browse Marketplace (MCP) ===');
    const vectors = await client.browseMarketplace({
      category: 'finance',
      minRating: 4.2
    });

    // Display top 3 vectors
    vectors.slice(0, 3).forEach((vector, i) => {
      console.log(`\n${i + 1}. ${vector.name}`);
      console.log(`   Category: ${vector.category}`);
      console.log(`   Price: $${vector.pricing?.base_price}`);
      console.log(`   Rating: ${vector.metadata?.average_rating}⭐ (${vector.metadata?.review_count} reviews)`);
    });
    // Step 3: Create MCP token and sync agents
    console.log('\n=== Step 3: MCP Sync (Collaboration) ===');
    const { token: mcpToken } = await client.createMcpToken('finance-team');
    const sync = await client.syncAgents(mcpToken, [
      {
        id: 'analyst-1',
        role: 'analyst',
        goal: 'Summarize market signals',
        input: 'Focus on macro trends and risk factors.'
      },
      {
        id: 'planner-1',
        role: 'planner',
        goal: 'Draft action plan',
        input: 'Propose next steps based on signals.'
      }
    ], {
      domain: 'finance',
      task: 'Quarterly outlook'
    });
    console.log('Consensus:', sync.consensus);

    // Step 4: Invoke vector (requires marketplace access token)
    console.log('\n=== Step 4: Invoke Vector (Example) ===');
    console.log('Note: Obtain an access token after purchasing a vector.');
    // const result = await client.invokeVector(
    //   vectors[0].id,
    //   {
    //     query: 'Analyze Q4 revenue trends',
    //     data: [100, 120, 150, 180]
    //   },
    //   'your_access_token_here'
    // );
    // console.log(`Result: ${JSON.stringify(result.output, null, 2)}`);

    // Step 5: Sync agent memory
    console.log('\n=== Step 5: Sync Agent Memory ===');
    await client.syncMemory('preferences', {
      favoriteCategories: ['finance', 'data-analysis'],
      budget: 100.0,
      lastPurchase: null
    });

    // Step 6: Retrieve memory
    console.log('\n=== Step 6: Retrieve Memory ===');
    const memory = await client.retrieveMemory('preferences');
    console.log(`Retrieved memory: ${JSON.stringify(memory, null, 2)}`);

    // Step 7: Connect to real-time notifications
    console.log('\n=== Step 7: Real-time Notifications (Example) ===');
    console.log('Uncomment to enable WebSocket connection');
    // const socket = client.connectRealtime((type, data) => {
    //   console.log(`Received ${type} notification:`, data);
    // });
    // 
    // // Keep connection alive for 30 seconds
    // await new Promise(resolve => setTimeout(resolve, 30000));
    // socket.disconnect();

    console.log('\n✅ Example completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the example
if (require.main === module) {
  main();
}

module.exports = { AwarenessNetworkClient };
