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
import { Server as SocketIOServer } from "socket.io";
import fs from "fs";
import path from "path";
import { initializeWorkflowWebSocket } from "../workflow-websocket";
import { setupGoServiceProxies, createHealthCheckRouter } from "../middleware/go-service-proxy";
import communityRouter from "../community-assistant";

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
  
  // Stripe webhook MUST be registered BEFORE express.json() middleware
  // to preserve raw body for signature verification
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // MCP Protocol API
  app.use("/api/mcp", mcpRouter);
  
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
      console.log("[API Docs] Swagger UI available at /api-docs");
    }
  } catch (error) {
    console.warn("[API Docs] Failed to load OpenAPI spec:", error);
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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  
  // Socket.IO for real-time communication
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  
  // Socket.IO connection handler
  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
    
    // Join user-specific room for targeted notifications
    socket.on("join", (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`[Socket.IO] User ${userId} joined room`);
    });
    
    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
  
  // Attach io to app for use in other modules
  (app as any).io = io;
  
  // Initialize workflow WebSocket server
  initializeWorkflowWebSocket(server);

  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
  });
}

startServer().catch(console.error);
