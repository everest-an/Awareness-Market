/**
 * Go 服务代理层
 * 
 * 此文件实现了 Node.js 后端与 Go 微服务之间的反向代理。
 * 将来自前端的请求转发到相应的 Go 微服务。
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'express-http-proxy';

/**
 * 设置 Go 服务代理
 * 
 * @param app Express 应用实例
 */
export function setupGoServiceProxies(app: any): void {
  // ==========================================
  // Vector Operations 代理
  // ==========================================
  app.use(
    '/api/v1/vectors',
    createProxyMiddleware({
      target: process.env.VECTOR_SERVICE_URL || 'http://localhost:8083',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/vectors': '/api/v1/vectors',
      },
      logLevel: 'warn',
      onError: (err: any, req: Request, res: Response) => {
        console.error('[Vector Service Proxy Error]', err.message);
        res.status(503).json({ 
          error: 'Vector service unavailable',
          message: err.message 
        });
      },
      onProxyReq: (proxyReq: any, req: Request, res: Response) => {
        // 添加认证头
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        if (process.env.API_KEY_SECRET) {
          proxyReq.setHeader('X-API-Key', process.env.API_KEY_SECRET);
        }
      },
    })
  );

  // ==========================================
  // Memory Exchange 代理
  // ==========================================
  app.use(
    '/api/v1/memory',
    createProxyMiddleware({
      target: process.env.MEMORY_SERVICE_URL || 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/memory': '/api/v1/memory',
      },
      logLevel: 'warn',
      onError: (err: any, req: Request, res: Response) => {
        console.error('[Memory Service Proxy Error]', err.message);
        res.status(503).json({ 
          error: 'Memory service unavailable',
          message: err.message 
        });
      },
      onProxyReq: (proxyReq: any, req: Request, res: Response) => {
        // 添加认证头
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        if (process.env.API_KEY_SECRET) {
          proxyReq.setHeader('X-API-Key', process.env.API_KEY_SECRET);
        }
      },
    })
  );

  // ==========================================
  // Reasoning Chain 代理
  // ==========================================
  app.use(
    '/api/v1/reasoning-chain',
    createProxyMiddleware({
      target: process.env.MEMORY_SERVICE_URL || 'http://localhost:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/reasoning-chain': '/api/v1/reasoning-chain',
      },
      logLevel: 'warn',
      onError: (err: any, req: Request, res: Response) => {
        console.error('[Reasoning Chain Proxy Error]', err.message);
        res.status(503).json({ 
          error: 'Reasoning chain service unavailable',
          message: err.message 
        });
      },
      onProxyReq: (proxyReq: any, req: Request, res: Response) => {
        // 添加认证头
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        if (process.env.API_KEY_SECRET) {
          proxyReq.setHeader('X-API-Key', process.env.API_KEY_SECRET);
        }
      },
    })
  );

  // ==========================================
  // W-Matrix Marketplace 代理
  // ==========================================
  app.use(
    '/api/v1/w-matrix',
    createProxyMiddleware({
      target: process.env.WMATRIX_SERVICE_URL || 'http://localhost:8081',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/w-matrix': '/api/v1/w-matrix',
      },
      logLevel: 'warn',
      onError: (err: any, req: Request, res: Response) => {
        console.error('[W-Matrix Service Proxy Error]', err.message);
        res.status(503).json({ 
          error: 'W-Matrix service unavailable',
          message: err.message 
        });
      },
      onProxyReq: (proxyReq: any, req: Request, res: Response) => {
        // 添加认证头
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
        if (process.env.API_KEY_SECRET) {
          proxyReq.setHeader('X-API-Key', process.env.API_KEY_SECRET);
        }
      },
    })
  );

  // ==========================================
  // Admin Analytics 代理
  // ==========================================
  app.use(
    '/api/v1/admin',
    createProxyMiddleware({
      target: process.env.ADMIN_SERVICE_URL || 'http://localhost:8082',
      changeOrigin: true,
      pathRewrite: {
        '^/api/v1/admin': '/api/v1/admin',
      },
      logLevel: 'warn',
      onError: (err: any, req: Request, res: Response) => {
        console.error('[Admin Service Proxy Error]', err.message);
        res.status(503).json({ 
          error: 'Admin service unavailable',
          message: err.message 
        });
      },
    })
  );
}

/**
 * 健康检查中间件
 * 验证所有 Go 微服务的连接状态
 */
export async function checkGoServicesHealth(): Promise<{
  vectorOperations: boolean;
  memoryExchange: boolean;
  wMatrix: boolean;
  allHealthy: boolean;
}> {
  const results = {
    vectorOperations: false,
    memoryExchange: false,
    wMatrix: false,
    allHealthy: false,
  };

  try {
    // 检查 Vector Operations
    const vectorRes = await fetch(
      (process.env.VECTOR_SERVICE_URL || 'http://localhost:8083') + '/health'
    );
    results.vectorOperations = vectorRes.ok;
  } catch (err) {
    console.warn('Vector Operations health check failed:', err);
  }

  try {
    // 检查 Memory Exchange
    const memoryRes = await fetch(
      (process.env.MEMORY_SERVICE_URL || 'http://localhost:8080') + '/health'
    );
    results.memoryExchange = memoryRes.ok;
  } catch (err) {
    console.warn('Memory Exchange health check failed:', err);
  }

  try {
    // 检查 W-Matrix
    const wMatrixRes = await fetch(
      (process.env.WMATRIX_SERVICE_URL || 'http://localhost:8081') + '/health'
    );
    results.wMatrix = wMatrixRes.ok;
  } catch (err) {
    console.warn('W-Matrix Marketplace health check failed:', err);
  }

  results.allHealthy = results.vectorOperations && results.memoryExchange && results.wMatrix;
  return results;
}

/**
 * 创建健康检查端点
 */
export function createHealthCheckRouter(): Router {
  const router = Router();

  router.get('/health', async (req: Request, res: Response) => {
    const health = await checkGoServicesHealth();
    
    const statusCode = health.allHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: health.allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        vectorOperations: health.vectorOperations ? 'up' : 'down',
        memoryExchange: health.memoryExchange ? 'up' : 'down',
        wMatrix: health.wMatrix ? 'up' : 'down',
      },
    });
  });

  router.get('/health/detailed', async (req: Request, res: Response) => {
    const health = await checkGoServicesHealth();
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      services: {
        vectorOperations: {
          url: process.env.VECTOR_SERVICE_URL || 'http://localhost:8083',
          healthy: health.vectorOperations,
        },
        memoryExchange: {
          url: process.env.MEMORY_SERVICE_URL || 'http://localhost:8080',
          healthy: health.memoryExchange,
        },
        wMatrix: {
          url: process.env.WMATRIX_SERVICE_URL || 'http://localhost:8081',
          healthy: health.wMatrix,
        },
      },
      allHealthy: health.allHealthy,
    });
  });

  return router;
}
