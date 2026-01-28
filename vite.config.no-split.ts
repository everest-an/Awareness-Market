import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

/**
 * 备用配置：禁用代码分割
 *
 * 如果方案 1 仍然有问题，使用此配置
 *
 * 用法：
 *   1. 重命名 vite.config.ts 为 vite.config.original.ts
 *   2. 重命名此文件为 vite.config.ts
 *   3. 运行 npm run build
 *
 * 优点：
 *   - 没有模块加载顺序问题
 *   - 100% 可靠
 *
 * 缺点：
 *   - 单个大文件（可能 5-8 MB）
 *   - 首次加载较慢
 *   - 无法利用浏览器缓存优化
 */

const plugins = [react(), tailwindcss(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,

    // ==========================================
    // 禁用代码分割 - 所有代码打包成单个文件
    // ==========================================
    rollupOptions: {
      output: {
        // 完全禁用手动分块
        manualChunks: undefined,

        // 禁用动态导入分块
        inlineDynamicImports: true,

        // 简单的文件名
        entryFileNames: 'js/app-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset';
          const info = name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          } else if (/woff|woff2|ttf|otf|eot/.test(ext)) {
            return `fonts/[name]-[hash][extname]`;
          } else if (ext === 'css') {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },

    // ==========================================
    // 轻量压缩（提高构建速度）
    // ==========================================
    minify: 'esbuild', // 更快的压缩
    sourcemap: false, // 禁用 sourcemap 减小文件大小

    // ==========================================
    // 其他优化
    // ==========================================
    reportCompressedSize: true,
    chunkSizeWarningLimit: 5000, // 允许大文件（5MB）
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    hmr: {
      protocol: 'wss',
      host: process.env.VITE_HMR_HOST || undefined,
      port: process.env.VITE_HMR_PORT ? parseInt(process.env.VITE_HMR_PORT) : undefined,
      clientPort: process.env.VITE_HMR_CLIENT_PORT ? parseInt(process.env.VITE_HMR_CLIENT_PORT) : undefined,
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
