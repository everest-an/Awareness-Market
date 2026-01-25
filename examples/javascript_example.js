/**
 * Awareness Network API - JavaScript/Node.js Example
 * ===================================================
 * 
 * This example demonstrates how to interact with the Awareness Network API
 * using JavaScript/Node.js. It shows AI agent registration, vector browsing,
 * purchasing, and invocation.
 * 
 * Requirements:
 *     npm install axios
 * 
 * Usage:
 *     node javascript_example.js
 */

const axios = require('axios');

// API Base URL (replace with your actual deployment URL)
const BASE_URL = 'https://your-awareness-network.manus.space';
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
   * @param {string} agentDescription - Description of agent's purpose
   * @param {string[]} capabilities - List of agent capabilities
   * @returns {Promise<Object>} Registration response with API key
   */
  async registerAIAgent(agentName, agentDescription, capabilities) {
    const response = await this.client.post('/ai-auth/register', {
      name: agentName,
      description: agentDescription,
      capabilities
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
   * @param {Object} options - Filter and sort options
   * @param {string} [options.category] - Filter by category
   * @param {number} [options.minPrice] - Minimum price filter
   * @param {number} [options.maxPrice] - Maximum price filter
   * @param {string} [options.sortBy='newest'] - Sort order
   * @returns {Promise<Array>} List of available vectors
   */
  async browseMarketplace({ category, minPrice, maxPrice, sortBy = 'newest' } = {}) {
    const params = { sortBy, limit: 20 };
    if (category) params.category = category;
    if (minPrice !== undefined) params.minPrice = minPrice;
    if (maxPrice !== undefined) params.maxPrice = maxPrice;

    const response = await this.client.get('/ai-memory/vectors', { params });
    const vectors = response.data;

    console.log(`✓ Found ${vectors.length} vectors`);
    return vectors;
  }

  /**
   * Get AI-powered recommendations based on browsing history
   * 
   * @returns {Promise<Array>} List of recommended vectors with match scores
   */
  async getRecommendations() {
    if (!this.apiKey) {
      throw new Error('API key required. Please register first.');
    }

    const response = await this.client.get('/ai-memory/recommendations');
    const recommendations = response.data;

    console.log(`✓ Got ${recommendations.length} recommendations`);
    return recommendations;
  }

  /**
   * Purchase access to a latent vector
   * 
   * @param {number} vectorId - ID of the vector to purchase
   * @param {string} paymentMethodId - Stripe payment method ID
   * @returns {Promise<Object>} Purchase confirmation with access token
   */
  async purchaseVector(vectorId, paymentMethodId) {
    if (!this.apiKey) {
      throw new Error('API key required. Please register first.');
    }

    const response = await this.client.post('/ai-auth/purchase', {
      vectorId,
      paymentMethodId
    });

    console.log(`✓ Purchased vector ${vectorId}`);
    console.log(`  Access Token: ${response.data.accessToken.substring(0, 20)}...`);

    return response.data;
  }

  /**
   * Invoke a purchased latent vector with input data
   * 
   * @param {number} vectorId - ID of the vector to invoke
   * @param {Object} inputData - Input data for the vector
   * @returns {Promise<Object>} Vector output and metadata
   */
  async invokeVector(vectorId, inputData) {
    if (!this.apiKey) {
      throw new Error('API key required. Please register first.');
    }

    const response = await this.client.post('/mcp/invoke', {
      vectorId,
      input: inputData
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

    const response = await this.client.post('/ai-memory/sync', {
      key: memoryKey,
      value: memoryValue
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

    const response = await this.client.get(`/ai-memory/retrieve/${memoryKey}`);

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
      'AI agent specialized in financial data analysis',
      ['data-analysis', 'forecasting', 'risk-assessment']
    );

    // Step 2: Browse marketplace
    console.log('\n=== Step 2: Browse Marketplace ===');
    const vectors = await client.browseMarketplace({
      category: 'finance',
      maxPrice: 50.0,
      sortBy: 'rating'
    });

    // Display top 3 vectors
    vectors.slice(0, 3).forEach((vector, i) => {
      console.log(`\n${i + 1}. ${vector.title}`);
      console.log(`   Category: ${vector.category}`);
      console.log(`   Price: $${vector.basePrice}`);
      console.log(`   Rating: ${vector.averageRating}⭐ (${vector.reviewCount} reviews)`);
    });

    // Step 3: Get AI recommendations
    console.log('\n=== Step 3: Get AI Recommendations ===');
    const recommendations = await client.getRecommendations();

    recommendations.slice(0, 2).forEach((rec) => {
      console.log(`\n• ${rec.vectorName}`);
      console.log(`  Match Score: ${rec.matchScore}%`);
      console.log(`  Reason: ${rec.reason}`);
    });

    // Step 4: Purchase a vector (example - requires valid payment method)
    console.log('\n=== Step 4: Purchase Vector (Example) ===');
    console.log('Note: This requires a valid Stripe payment method ID');
    // const purchase = await client.purchaseVector(
    //   vectors[0].id,
    //   'pm_card_visa'  // Replace with actual payment method
    // );

    // Step 5: Invoke vector (after purchase)
    console.log('\n=== Step 5: Invoke Vector (Example) ===');
    console.log('Note: This requires purchasing the vector first');
    // const result = await client.invokeVector(
    //   vectors[0].id,
    //   {
    //     query: 'Analyze Q4 revenue trends',
    //     data: [100, 120, 150, 180]
    //   }
    // );
    // console.log(`Result: ${JSON.stringify(result.output, null, 2)}`);

    // Step 6: Sync agent memory
    console.log('\n=== Step 6: Sync Agent Memory ===');
    await client.syncMemory('preferences', {
      favoriteCategories: ['finance', 'data-analysis'],
      budget: 100.0,
      lastPurchase: null
    });

    // Step 7: Retrieve memory
    console.log('\n=== Step 7: Retrieve Memory ===');
    const memory = await client.retrieveMemory('preferences');
    console.log(`Retrieved memory: ${JSON.stringify(memory, null, 2)}`);

    // Step 8: Connect to real-time notifications
    console.log('\n=== Step 8: Real-time Notifications (Example) ===');
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
