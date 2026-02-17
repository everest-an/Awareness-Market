import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Exclude legacy Drizzle-based integration tests (require live DB + old schema)
    exclude: [
      "server/blog.test.ts",
      "server/api-key.test.ts",
    ],
    env: {
      // Required by auth-standalone.ts on module load
      JWT_SECRET: "test-jwt-secret-for-vitest-do-not-use-in-production",
      NODE_ENV: "test",
    },
  },
});
