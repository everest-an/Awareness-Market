/**
 * Go 服务代理层
 * 
 * 此文件实现了 Node.js 后端与 Go 微服务之间的反向代理。
 * 将来自前端的请求转发到相应的 Go 微服务。
 */

import { Router, Request, Response, NextFunction, type Express } from 'express';
import proxy from 'express-http-proxy';
import type { IncomingHttpHeaders } from 'http';
import { createLogger } from '../utils/logger';

const logger = createLogger('Middleware:GoServiceProxy');

interface ProxyReqOpts {
  headers?: IncomingHttpHeaders;
  [key: string]: unknown;
}

function createServiceProxy(target: string, errorLabel: string) {
  return proxy(target, {
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: Request) => {
      proxyReqOpts.headers = proxyReqOpts.headers || {};
      if (srcReq.headers.authorization) {
        proxyReqOpts.headers['Authorization'] = srcReq.headers.authorization;
      }
      if (process.env.API_KEY_SECRET) {
        proxyReqOpts.headers['X-API-Key'] = process.env.API_KEY_SECRET;
      }
      return proxyReqOpts;
    },
    proxyErrorHandler: (err: Error, res: Response, _next: NextFunction) => {
      logger.error(`[${errorLabel} Proxy Error]`, { message: err.message });
      res.status(503).json({
        error: `${errorLabel} service unavailable`,
        message: err.message,
      });
    },
  });
}

/**
 * 设置 Go 服务代理
 *
 * @param app Express 应用实例
 */
export function setupGoServiceProxies(app: Express): void {
  // ==========================================
  // Vector Operations 代理
  // ==========================================
  app.use(
    '/api/v1/vectors',
    createServiceProxy(
      process.env.VECTOR_SERVICE_URL || 'http://localhost:8083',
      'Vector service'
    )
  );

  // ==========================================
  // Memory Exchange 代理
  // ==========================================
  app.use(
    '/api/v1/memory',
    createServiceProxy(
      process.env.MEMORY_SERVICE_URL || 'http://localhost:8080',
      'Memory service'
    )
  );

  // ==========================================
  // Reasoning Chain 代理
  // ==========================================
  app.use(
    '/api/v1/reasoning-chain',
    createServiceProxy(
      process.env.MEMORY_SERVICE_URL || 'http://localhost:8080',
      'Reasoning chain service'
    )
  );

  // ==========================================
  // W-Matrix Marketplace 代理
  // ==========================================
  app.use(
    '/api/v1/w-matrix',
    createServiceProxy(
      process.env.WMATRIX_SERVICE_URL || 'http://localhost:8081',
      'W-Matrix service'
    )
  );

  // ==========================================
  // Admin Analytics 代理
  // ==========================================
  app.use(
    '/api/v1/admin',
    createServiceProxy(
      process.env.ADMIN_SERVICE_URL || 'http://localhost:8082',
      'Admin service'
    )
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
    logger.warn('Vector Operations health check failed:', { error: err });
  }

  try {
    // 检查 Memory Exchange
    const memoryRes = await fetch(
      (process.env.MEMORY_SERVICE_URL || 'http://localhost:8080') + '/health'
    );
    results.memoryExchange = memoryRes.ok;
  } catch (err) {
    logger.warn('Memory Exchange health check failed:', { error: err });
  }

  try {
    // 检查 W-Matrix
    const wMatrixRes = await fetch(
      (process.env.WMATRIX_SERVICE_URL || 'http://localhost:8081') + '/health'
    );
    results.wMatrix = wMatrixRes.ok;
  } catch (err) {
    logger.warn('W-Matrix Marketplace health check failed:', { error: err });
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
