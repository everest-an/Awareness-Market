/**
 * WebMCP Resources for Awareness Market
 *
 * Exposes data and content from Awareness Market for AI context
 */

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: (uri: string, apiBaseUrl: string, mcpToken: string) => Promise<{
    contents: Array<{
      uri: string;
      mimeType: string;
      text?: string;
      blob?: Blob;
    }>;
  }>;
}

/**
 * Resource 1: memory://graph/{memoryId}
 * Retrieve the full relationship graph for a memory
 */
const memoryGraphResource: MCPResource = {
  uri: 'memory://graph/{memoryId}',
  name: 'Memory Relationship Graph',
  description: `Get the relationship graph for a specific memory.

Returns a JSON structure containing:
- Central memory node with full content
- Related memories (via relationships)
- Relationship types and strengths
- Entities mentioned in each memory
- Inference paths (optional)

URI format: memory://graph/{memoryId}?depth=2&includeInferencePaths=true

Query parameters:
- depth: Graph traversal depth (1-5, default: 2)
- includeInferencePaths: Include reasoning chains (default: false)
- relationTypes: Comma-separated list of relation types to include`,

  mimeType: 'application/json',

  handler: async (uri, apiBaseUrl, mcpToken) => {
    // Parse URI to extract memoryId and query params
    const url = new URL(uri.replace('memory://graph/', 'http://dummy/'));
    const memoryId = url.pathname.substring(1); // Remove leading '/'
    const depth = parseInt(url.searchParams.get('depth') || '2');
    const includeInferencePaths = url.searchParams.get('includeInferencePaths') === 'true';
    const relationTypes = url.searchParams.get('relationTypes')?.split(',');

    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.getMemoryGraph`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          memoryId,
          maxDepth: depth,
          includeInferencePaths,
          relationTypes,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch memory graph: ${response.statusText}`);
    }

    const data = await response.json();
    const graphData = data.result?.data?.json || data;

    return {
      contents: [
        {
          uri: `memory://graph/${memoryId}`,
          mimeType: 'application/json',
          text: JSON.stringify(graphData, null, 2),
        },
      ],
    };
  },
};

/**
 * Resource 2: vectors://marketplace/trending
 * Get currently trending latent vectors
 */
const trendingVectorsResource: MCPResource = {
  uri: 'vectors://marketplace/trending',
  name: 'Trending Latent Vectors',
  description: `Get the most popular and trending latent vectors in the marketplace.

Returns vectors sorted by:
- Recent activity (calls in last 7 days)
- Rating improvements
- New reviews
- Community interest

URI format: vectors://marketplace/trending?limit=20&category=computer_vision

Query parameters:
- limit: Number of results (default: 20, max: 100)
- category: Filter by category
- timeframe: Trending timeframe ("24h", "7d", "30d", default: "7d")`,

  mimeType: 'application/json',

  handler: async (uri, apiBaseUrl, mcpToken) => {
    const url = new URL(uri.replace('vectors://marketplace/trending', 'http://dummy/'));
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const category = url.searchParams.get('category');
    const timeframe = url.searchParams.get('timeframe') || '7d';

    const response = await fetch(
      `${apiBaseUrl}/api/mcp/discover?sortBy=trending&limit=${limit}${category ? `&category=${category}` : ''}`,
      {
        headers: {
          'Authorization': `Bearer ${mcpToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trending vectors: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      contents: [
        {
          uri: 'vectors://marketplace/trending',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              timeframe,
              total: data.vectors?.length || 0,
              vectors: data.vectors || [],
              updated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

/**
 * Resource 3: entities://hot
 * Get most frequently mentioned entities in memory graph
 */
const hotEntitiesResource: MCPResource = {
  uri: 'entities://hot',
  name: 'Hot Entities',
  description: `Get the most frequently mentioned entities across all memories.

Returns entities ranked by:
- Mention count (how many times referenced)
- Relationship count (how many connections)
- Recent activity (mentions in last 7 days)

Useful for:
- Discovering trending topics
- Identifying key people/companies/products
- Understanding what the AI community is focusing on

URI format: entities://hot?limit=50&type=PERSON

Query parameters:
- limit: Number of results (default: 50, max: 200)
- type: Entity type filter (PERSON, COMPANY, PRODUCT, TECHNOLOGY, etc.)
- minMentions: Minimum mention count (default: 5)`,

  mimeType: 'application/json',

  handler: async (uri, apiBaseUrl, mcpToken) => {
    const url = new URL(uri.replace('entities://hot', 'http://dummy/'));
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const type = url.searchParams.get('type');
    const minMentions = parseInt(url.searchParams.get('minMentions') || '5');

    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.getHotEntities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          limit,
          entityType: type,
          minMentions,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch hot entities: ${response.statusText}`);
    }

    const data = await response.json();
    const entities = data.result?.data?.json || data;

    return {
      contents: [
        {
          uri: 'entities://hot',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              total: entities.length,
              filters: { type, minMentions },
              entities: entities.map((e: any) => ({
                id: e.id,
                name: e.name,
                type: e.type,
                normalizedName: e.normalizedName,
                mentionCount: e.mentionCount,
                confidence: e.confidence,
                aliases: e.aliases || [],
              })),
              updated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

/**
 * Resource 4: memories://search/{query}
 * Search memories by text query
 */
const memorySearchResource: MCPResource = {
  uri: 'memories://search/{query}',
  name: 'Memory Search Results',
  description: `Search memories by text query using vector similarity.

Returns semantically similar memories ranked by relevance.

URI format: memories://search/{query}?limit=10&namespace=shared

Query parameters:
- limit: Number of results (default: 10, max: 100)
- namespace: Filter by namespace
- minConfidence: Minimum confidence threshold (0-1)`,

  mimeType: 'application/json',

  handler: async (uri, apiBaseUrl, mcpToken) => {
    const url = new URL(uri.replace('memories://search/', 'http://dummy/'));
    const query = decodeURIComponent(url.pathname.substring(1));
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const namespace = url.searchParams.get('namespace');
    const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0.5');

    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          org_id: 'default',
          namespace,
          query_text: query,
          top_k: limit,
          min_confidence: minConfidence,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to search memories: ${response.statusText}`);
    }

    const data = await response.json();
    const memories = data.result?.data?.json || data;

    return {
      contents: [
        {
          uri: `memories://search/${encodeURIComponent(query)}`,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              query,
              total: memories.length,
              filters: { namespace, minConfidence },
              memories,
              updated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

/**
 * Resource 5: vectors://vector/{vectorId}
 * Get detailed information about a specific vector
 */
const vectorDetailsResource: MCPResource = {
  uri: 'vectors://vector/{vectorId}',
  name: 'Vector Details',
  description: `Get comprehensive information about a specific latent vector.

Returns:
- Full vector metadata
- Performance metrics
- Pricing details
- Creator information
- Reviews and ratings
- Usage statistics

URI format: vectors://vector/{vectorId}`,

  mimeType: 'application/json',

  handler: async (uri, apiBaseUrl, mcpToken) => {
    const vectorId = uri.replace('vectors://vector/', '');

    const response = await fetch(`${apiBaseUrl}/api/mcp/vectors/${vectorId}`, {
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch vector details: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      contents: [
        {
          uri: `vectors://vector/${vectorId}`,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  },
};

/**
 * Resource 6: rmc://inference-paths/{memoryId}
 * Get inference paths starting from a specific memory
 */
const inferencePathsResource: MCPResource = {
  uri: 'rmc://inference-paths/{memoryId}',
  name: 'RMC Inference Paths',
  description: `Get all inference paths (reasoning chains) starting from a memory.

Returns:
- Causal chains (A → B → C)
- Contradiction resolutions
- Multi-hop support paths
- Temporal sequences

URI format: rmc://inference-paths/{memoryId}?maxDepth=3&pathType=causal

Query parameters:
- maxDepth: Maximum path length (default: 3, max: 5)
- pathType: Filter by path type ("causal", "contradiction", "support", "temporal")`,

  mimeType: 'application/json',

  handler: async (uri, apiBaseUrl, mcpToken) => {
    const url = new URL(uri.replace('rmc://inference-paths/', 'http://dummy/'));
    const memoryId = url.pathname.substring(1);
    const maxDepth = parseInt(url.searchParams.get('maxDepth') || '3');
    const pathType = url.searchParams.get('pathType');

    const response = await fetch(`${apiBaseUrl}/api/trpc/memory.getMemoryGraph`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mcpToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          memoryId,
          maxDepth,
          includeInferencePaths: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch inference paths: ${response.statusText}`);
    }

    const data = await response.json();
    const graphData = data.result?.data?.json || data;

    // Extract inference paths
    let inferencePaths = graphData.inferencePaths || [];

    // Filter by path type if specified
    if (pathType) {
      inferencePaths = inferencePaths.filter((path: any) => path.type === pathType);
    }

    return {
      contents: [
        {
          uri: `rmc://inference-paths/${memoryId}`,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              memoryId,
              maxDepth,
              pathType: pathType || 'all',
              total: inferencePaths.length,
              paths: inferencePaths,
              updated_at: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};

/**
 * Export all resources
 */
export const webMCPResources: MCPResource[] = [
  memoryGraphResource,
  trendingVectorsResource,
  hotEntitiesResource,
  memorySearchResource,
  vectorDetailsResource,
  inferencePathsResource,
];
