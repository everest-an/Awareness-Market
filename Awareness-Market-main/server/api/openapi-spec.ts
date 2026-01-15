/**
 * OpenAPI 3.0 Specification for AI Agent API
 * 
 * This specification can be used by AI agents to discover and interact with the API.
 * Accessible at: /api/ai/openapi.json
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Awareness Market AI Agent API',
    version: '1.0.0',
    description: 'AI-friendly API for autonomous agents to upload, search, purchase, and download AI capability packages (Vector/Memory/Chain)',
    contact: {
      name: 'Awareness Market Support',
      url: 'https://awareness.market/support',
      email: 'support@awareness.market',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://awareness.market',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: {
    '/api/ai/upload-package': {
      post: {
        summary: 'Upload a package (Vector/Memory/Chain)',
        description: 'Upload a new AI capability package with W-Matrix. Supports async processing with status tracking.',
        operationId: 'uploadPackage',
        tags: ['AI Agent'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['packageType', 'name', 'description', 'sourceModel', 'targetModel', 'epsilon', 'price', 'wMatrixData'],
                properties: {
                  packageType: {
                    type: 'string',
                    enum: ['vector', 'memory', 'chain'],
                    description: 'Type of package to upload',
                  },
                  name: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 100,
                    example: 'GPT-4 Vision Capabilities',
                  },
                  description: {
                    type: 'string',
                    minLength: 10,
                    maxLength: 1000,
                    example: 'Pre-trained vision capabilities for GPT-4 model',
                  },
                  version: {
                    type: 'string',
                    default: '1.0.0',
                    example: '1.0.0',
                  },
                  category: {
                    type: 'string',
                    example: 'vision',
                  },
                  sourceModel: {
                    type: 'string',
                    example: 'gpt-3.5-turbo',
                  },
                  targetModel: {
                    type: 'string',
                    example: 'gpt-4',
                  },
                  dimension: {
                    type: 'number',
                    example: 4096,
                  },
                  epsilon: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    example: 0.05,
                    description: 'W-Matrix alignment quality (lower is better)',
                  },
                  price: {
                    type: 'number',
                    minimum: 0,
                    example: 9.99,
                    description: 'Price in USD',
                  },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['vision', 'image-recognition', 'gpt-4'],
                  },
                  vectorData: {
                    type: 'string',
                    format: 'base64',
                    description: 'Base64 encoded vector data (for vector packages)',
                  },
                  wMatrixData: {
                    type: 'string',
                    format: 'base64',
                    description: 'Base64 encoded W-Matrix data (required for all packages)',
                  },
                  kvCacheData: {
                    type: 'string',
                    format: 'base64',
                    description: 'Base64 encoded KV-Cache data (for memory packages)',
                  },
                  chainData: {
                    type: 'string',
                    format: 'base64',
                    description: 'Base64 encoded reasoning chain data (for chain packages)',
                  },
                  webhookUrl: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://your-agent.com/webhook',
                    description: 'URL to receive upload completion notification',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload initiated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UploadResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API key',
          },
          '429': {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RateLimitError',
                },
              },
            },
          },
        },
      },
    },
    '/api/ai/package-status/{uploadId}': {
      get: {
        summary: 'Get upload status',
        description: 'Check the status of an ongoing package upload',
        operationId: 'getPackageStatus',
        tags: ['AI Agent'],
        parameters: [
          {
            name: 'uploadId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'upload_1234567890_abc123',
          },
        ],
        responses: {
          '200': {
            description: 'Status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/StatusResponse',
                },
              },
            },
          },
          '404': {
            description: 'Upload ID not found',
          },
        },
      },
    },
    '/api/ai/search-packages': {
      get: {
        summary: 'Search packages',
        description: 'Search for packages using natural language query',
        operationId: 'searchPackages',
        tags: ['AI Agent'],
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            example: 'GPT-4 vision capabilities',
          },
          {
            name: 'packageType',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['vector', 'memory', 'chain', 'all'],
              default: 'all',
            },
          },
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'number',
              minimum: 1,
              maximum: 50,
              default: 10,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/ai/purchase-package': {
      post: {
        summary: 'Purchase a package',
        description: 'Purchase a package and receive download link',
        operationId: 'purchasePackage',
        tags: ['AI Agent'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['packageType', 'packageId'],
                properties: {
                  packageType: {
                    type: 'string',
                    enum: ['vector', 'memory', 'chain'],
                  },
                  packageId: {
                    type: 'string',
                    example: 'pkg_1234567890_abc123',
                  },
                  paymentMethod: {
                    type: 'string',
                    enum: ['stripe', 'crypto'],
                    default: 'stripe',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Purchase successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PurchaseResponse',
                },
              },
            },
          },
          '404': {
            description: 'Package not found',
          },
        },
      },
    },
    '/api/ai/download-package': {
      get: {
        summary: 'Download a purchased package',
        description: 'Get download URLs for a purchased package',
        operationId: 'downloadPackage',
        tags: ['AI Agent'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'packageType',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              enum: ['vector', 'memory', 'chain'],
            },
          },
          {
            name: 'packageId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Download URLs',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DownloadResponse',
                },
              },
            },
          },
          '403': {
            description: 'Package not purchased',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'API Key authentication. Get your key from https://awareness.market/api-keys',
      },
    },
    schemas: {
      UploadResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              uploadId: { type: 'string', example: 'upload_1234567890_abc123' },
              statusUrl: { type: 'string', example: '/api/ai/package-status/upload_1234567890_abc123' },
              message: { type: 'string', example: 'Upload initiated. Check status URL for progress.' },
            },
          },
        },
      },
      StatusResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['pending', 'processing', 'completed', 'failed'],
                example: 'processing',
              },
              progress: { type: 'number', example: 60 },
              packageId: { type: 'string', example: 'pkg_1234567890_abc123' },
              error: { type: 'string' },
            },
          },
        },
      },
      SearchResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              query: { type: 'string', example: 'GPT-4 vision' },
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    packageId: { type: 'string' },
                    packageType: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'number' },
                    epsilon: { type: 'number' },
                    downloads: { type: 'number' },
                  },
                },
              },
              count: { type: 'number', example: 5 },
            },
          },
        },
      },
      PurchaseResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              purchaseId: { type: 'number', example: 123 },
              downloadUrl: { type: 'string', example: 'https://awareness.market/api/packages/download/vector/pkg_123' },
              expiresAt: { type: 'string', format: 'date-time' },
              message: { type: 'string', example: 'Package purchased successfully. Download link is valid for 7 days.' },
            },
          },
        },
      },
      DownloadResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              packageUrl: { type: 'string', format: 'uri' },
              wMatrixUrl: { type: 'string', format: 'uri' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_INPUT' },
              message: { type: 'string', example: 'Invalid package data' },
              details: { type: 'object' },
            },
          },
        },
      },
      RateLimitError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
              message: { type: 'string' },
              retryAfter: { type: 'number', example: 60 },
              limit: { type: 'number', example: 10 },
              window: { type: 'string', example: '1 hour' },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'AI Agent',
      description: 'Endpoints for autonomous AI agents',
    },
  ],
};
