import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";


const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

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
    // 代码分割优化
    // ==========================================
    rollupOptions: {
      output: {
        // 手动分割代码
        manualChunks: {
          // React 生态
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // UI 库
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-dropdown-menu'],
          
          // 工具库
          'vendor-utils': ['axios', 'lodash-es', 'date-fns'],
          
          // Web3 相关
          'vendor-web3': ['ethers', '@ethersproject/providers'],
          
          // 页面组件 - 按路由分割
          'page-marketplace': [
            'src/pages/Marketplace.tsx',
            'src/pages/VectorDetail.tsx',
          ],
          'page-dashboard': [
            'src/pages/Dashboard.tsx',
            'src/pages/CreatorDashboard.tsx',
            'src/pages/ConsumerDashboard.tsx',
          ],
          'page-memory': [
            'src/pages/MemoryMarketplace.tsx',
            'src/pages/MemoryNFTDetail.tsx',
            'src/pages/MemoryProvenance.tsx',
          ],
          'page-reasoning': [
            'src/pages/ReasoningChainMarket.tsx',
            'src/pages/ReasoningChainPublish.tsx',
            'src/pages/WMatrixTester.tsx',
          ],
          'page-docs': [
            'src/pages/SdkDocs.tsx',
            'src/pages/ApiKeys.tsx',
            'src/pages/Blog.tsx',
            'src/pages/BlogPost.tsx',
          ],
        },
        
        // 优化文件大小和加载时间
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()
            : 'chunk';
          return `chunks/[name]-[hash].js`;
        },
        
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
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
    // 压缩和优化选项
    // ==========================================
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 3, // 多次压缩
      },
      mangle: {
        toplevel: true,
        keep_classnames: false,
      },
      format: {
        comments: false,
        preamble: '/* Awareness Market - Optimized Build */',
      },
    },
    
    // ==========================================
    // 其他优化
    // ==========================================
    reportCompressedSize: true, // 显示压缩后的大小
    chunkSizeWarningLimit: 500, // 警告阈值 500KB
    sourcemap: true, // 生产环境保留 sourcemap 便于调试
    assetsInclude: ['**/*.wasm'], // 包含 WebAssembly 文件
  },
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
