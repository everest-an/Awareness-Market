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
import swaggerUi from "swagger-ui-express";
import { Server as SocketIOServer } from "socket.io";
import fs from "fs";
import path from "path";

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

// Export app creation for Vercel or other serverless envs
export async function createExpressApp() {
  const app = express();
  const server = createServer(app);

  // Stripe webhook MUST be registered BEFORE express.json() middleware
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  app.use("/api/mcp", mcpRouter);
  app.use("/api/latentmas", latentmasRouter);
  app.use("/api/ai", aiAuthRouter);
  app.use("/api/ai", aiMemoryRouter);
  app.use("/api/trial", trialRouter);

  // Swagger UI
  try {
    const openApiPath = path.join(process.cwd(), "client/public/openapi.json");
    if (fs.existsSync(openApiPath)) {
      const openApiDocument = JSON.parse(fs.readFileSync(openApiPath, "utf-8"));
      app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
        customSiteTitle: "Awareness Network API Documentation",
        customCss: ".swagger-ui .topbar { display: none }",
      }));
    }
  } catch (error) {
    console.warn("[API Docs] Failed to load OpenAPI spec:", error);
  }

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Socket.IO
  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });
  io.on("connection", (socket) => {
    socket.on("join", (userId: string) => socket.join(`user_${userId}`));
  });
  (app as any).io = io;

  return { app, server };
}

async function startServer() {
  const { app, server } = await createExpressApp();

  // Only setup Vite/Static serving in standalone mode
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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// Only start server if run directly (not imported as module)
// In ES modules we check import.meta.url
// But for simplicty we just call it if we are in the main execution context 
// (Checking if this file is the entry point in ESM is tricky without specific flags)
if (process.argv[1] === import.meta.filename || process.argv[1].endsWith('index.ts')) {
  startServer().catch(console.error);
}
