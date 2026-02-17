import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleStripeWebhook } from "../stripe-webhook";
import { serveStatic, setupVite } from "./vite";
import mcpRouter from "../mcp-api";
import latentmasRouter from "../latentmas-api";
import { aiAuthRouter } from "../ai-auth-api";
import { aiMemoryRouter } from "../ai-memory-api";
import trialRouter from "../trial-api";
import purchaseRouter from "../purchase-api";
import streamingRouter from "../streaming-api";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { initializeWorkflowWebSocket } from "../workflow-websocket";
import { setupGoServiceProxies, createHealthCheckRouter } from "../middleware/go-service-proxy";
import communityRouter from "../community-assistant";
import collabRouter from "../routers/workspace-collab";
import { erc8004Router } from "../erc8004-api";
import inferenceRouter from "../inference-api";
import { createLogger } from "../utils/logger";
import { initializeSocketIO } from "../socket-events";
import { securityHeaders, getSecurityConfig } from "../middleware/security-headers";
import { httpsRedirect, getHttpsConfig } from "../middleware/https-redirect";
import { globalLimiter, uploadLimiter, purchaseLimiter, browseLimiter, aiAgentLimiter } from "../rate-limiter";
import { planAwareAgentLimiter, planAwareGlobalLimiter } from "../middleware/plan-rate-limiter";
import { ddosShield, ddosStatsHandler } from "../middleware/ddos-shield";
import { ghostTrapMiddleware, ghostTrapStatsHandler } from "../middleware/ghost-trap";
import { cryptoAssetGuard, getCryptoGuardStats, CRYPTO_HONEYPOT_PATHS } from "../middleware/crypto-asset-guard";
import { initializeWorkers, shutdownWorkers } from "../workers";
import { prisma } from "../db-prisma";

const logger = createLogger('Server');

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust reverse proxies (required for secure cookies behind HTTPS proxies)
  app.set("trust proxy", 1);

  // ─── Security Middleware ────────────────────────────────────────────
  // DDoS Shield — network-level defense (blacklist, flood, slowloris)
  app.use(ddosShield());
  
  // GhostTrap — behavioral threat detection (fingerprint, honeypot, PoW)
  app.use(ghostTrapMiddleware());
  
  // CryptoAssetGuard — token theft, credential harvesting, key exfiltration defense
  app.use(cryptoAssetGuard());
  
  // HTTPS redirect (production only)
  app.use(httpsRedirect(getHttpsConfig()));
  
  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(securityHeaders(getSecurityConfig()));
  
  // Global rate limiter — plan-aware (100-3000 req/min based on org tier)
  app.use('/api', planAwareGlobalLimiter);
  
  // Browse rate limiter (200 req/min per user for listing endpoints)
  app.use('/api/trpc/vectors', browseLimiter);
  app.use('/api/trpc/marketplace', browseLimiter);
  
  // Stripe webhook MUST be registered BEFORE express.json() middleware
  // to preserve raw body for signature verification
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Default body parser — 1MB limit for most routes (defense against memory DoS)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Larger body limit ONLY for file upload routes
  app.use("/api/vectors", express.json({ limit: "50mb" }));
  app.use("/api/ai", express.json({ limit: "10mb" }));

  // AI agent rate limiter — plan-aware (200-5000 req/min based on org tier)
  app.use("/api/ai", planAwareAgentLimiter);
  app.use("/api/mcp", planAwareAgentLimiter);
  app.use("/api/inference", planAwareAgentLimiter);
  app.use("/api/latentmas", planAwareAgentLimiter);
  
  // Upload rate limiter (10/hour per user)
  app.use("/api/vectors/upload", uploadLimiter);
  app.use("/api/vectors/publish", uploadLimiter);
  
  // Purchase rate limiter (50/hour per user)
  app.use("/api/vectors/purchase", purchaseLimiter);
  app.use("/api/stripe", purchaseLimiter);
  
  // Security monitoring endpoint (internal only)
  app.get('/api/security/stats', (req, res) => {
    // Only allow from loopback or trusted proxy
    const ip = req.ip || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.')) {
      const ghostStats = require('../middleware/ghost-trap').ghostTrap.getStats();
      const cryptoStats = getCryptoGuardStats();
      res.json({
        ghostTrap: { ...ghostStats, uptime: process.uptime(), timestamp: new Date().toISOString() },
        cryptoAssetGuard: cryptoStats,
      });
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // MCP Protocol API
  app.use("/api/mcp", mcpRouter);

  // Workspace Collaboration REST API (for v0, browser clients, etc.)
  app.use("/api/collab", collabRouter);
  
  // LatentMAS Transformer API
  app.use("/api/latentmas", latentmasRouter);
  
  // AI Authentication and Memory APIs
  app.use("/api/ai", aiAuthRouter);
  app.use("/api/ai", aiMemoryRouter);
  
  // Trial API
  app.use("/api/trial", trialRouter);

  // Purchase API (AI-native purchasing)
  app.use("/api/vectors", purchaseRouter);

  // Streaming and Batch API
  app.use("/api/vectors", streamingRouter);

  // Community assistant API
  app.use("/community", communityRouter);

  // ERC-8004 Trustless Agents API
  app.use("/api/erc8004", erc8004Router);

  // AI Inference Visualization API
  app.use("/api/inference", inferenceRouter);

  // 🎯 Register Go Service Proxies (API Gateway Pattern)
  // Must be registered BEFORE tRPC middleware
  setupGoServiceProxies(app);
  app.use(createHealthCheckRouter());

  // Swagger UI for API Documentation
  try {
    const openApiPath = path.join(process.cwd(), "client/public/openapi.json");
    if (fs.existsSync(openApiPath)) {
      const openApiDocument = JSON.parse(fs.readFileSync(openApiPath, "utf-8"));
      app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
        customSiteTitle: "Awareness Network API Documentation",
        customCss: ".swagger-ui .topbar { display: none }",
      }));
      logger.info("Swagger UI available at /api-docs");
    }
  } catch (error) {
    logger.warn("Failed to load OpenAPI spec", { error });
  }
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn("Port unavailable, using alternative", {
      preferredPort,
      actualPort: port
    });
  }
  
  // Initialize comprehensive Socket.IO with Hive Mind events
  const io = initializeSocketIO(server);

  // Attach io to app for use in other modules
  (app as any).io = io;
  
  // Initialize workflow WebSocket server
  initializeWorkflowWebSocket(server);

  // Initialize BullMQ background workers (decay, arbitration, reputation, verification)
  await initializeWorkers();

  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    logger.info("Server started successfully", {
      host,
      port,
      environment: process.env.NODE_ENV || 'development',
      url: `http://${host}:${port}/`
    });

    // ✅ P0-5: Setup graceful shutdown handlers
    setupGracefulShutdown(server);
  });

  return server;
}

/**
 * ✅ P0-5: Graceful shutdown handler for production deployments
 * Handles SIGTERM/SIGINT signals from Kubernetes/Docker
 */
function setupGracefulShutdown(server: any) {
  let shuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // 2. Close database connections
        await prisma.$disconnect();
        logger.info('Database disconnected');

        // 3. Shutdown workers
        try {
          await shutdownWorkers();
        } catch (workerError) {
          logger.warn('Worker shutdown error (non-critical)', { error: workerError });
        }

        // 4. Close Redis connections if configured
        try {
          if (process.env.REDIS_HOST) {
            // Redis connection is managed by BullMQ, already closed above
            logger.info('Redis connections closed via workers');
          }
        } catch (redisError) {
          logger.warn('Redis shutdown error (non-critical)', { error: redisError });
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forcefully shutting down after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.info('Graceful shutdown handlers registered (SIGTERM, SIGINT)');
}

startServer().catch((error) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});
