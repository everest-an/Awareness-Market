import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig, Plugin } from "vite";
// import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

/**
 * 自定义插件：确保正确的模块加载顺序
 *
 * 问题：Vite 的 manualChunks 不保证加载顺序
 * 解决：通过修改 HTML 中的 script 标签顺序来确保 React 最先加载
 */
function ensureReactLoadOrder(): Plugin {
  return {
    name: 'ensure-react-load-order',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      // 只在生产构建时处理
      if (!ctx.bundle) return html;

      // 提取所有 script 和 modulepreload 标签
      const scripts: Array<{ tag: string; attrs: Record<string, string>; isPreload: boolean }> = [];

      // 查找所有相关标签
      const scriptRegex = /<script[^>]*>/g;
      const linkRegex = /<link[^>]*rel="modulepreload"[^>]*>/g;

      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const tag = match[0];
        const srcMatch = tag.match(/src="([^"]+)"/);
        const typeMatch = tag.match(/type="([^"]+)"/);
        if (srcMatch) {
          scripts.push({
            tag,
            attrs: { src: srcMatch[1], type: typeMatch?.[1] || 'module' },
            isPreload: false
          });
        }
      }

      while ((match = linkRegex.exec(html)) !== null) {
        const tag = match[0];
        const hrefMatch = tag.match(/href="([^"]+)"/);
        if (hrefMatch) {
          scripts.push({
            tag,
            attrs: { href: hrefMatch[1] },
            isPreload: true
          });
        }
      }

      // 按优先级排序
      const sortedScripts = scripts.sort((a, b) => {
        const aPath = a.attrs.src || a.attrs.href || '';
        const bPath = b.attrs.src || b.attrs.href || '';

        // 优先级：react-core > react-router > react-ecosystem > ui-components > 其他
        const getPriority = (path: string): number => {
          if (path.includes('react-core')) return 1;
          if (path.includes('react-router')) return 2;
          if (path.includes('react-ecosystem')) return 3;
          if (path.includes('ui-components')) return 4;
          if (path.includes('charts')) return 5;
          if (path.includes('utils')) return 6;
          if (path.includes('vendor')) return 7;
          return 10;
        };

        return getPriority(aPath) - getPriority(bPath);
      });

      // 重建 HTML
      let newHtml = html;

      // 移除所有现有的 script 和 modulepreload
      newHtml = newHtml.replace(scriptRegex, '');
      newHtml = newHtml.replace(linkRegex, '');

      // 在 head 中插入排序后的 modulepreload
      const preloads = sortedScripts
        .filter(s => s.isPreload)
        .map(s => s.tag)
        .join('\n    ');

      newHtml = newHtml.replace('</head>', `  ${preloads}\n  </head>`);

      // 在 body 结束前插入排序后的 scripts
      const scriptTags = sortedScripts
        .filter(s => !s.isPreload)
        .map(s => {
          // 确保 script 标签正确闭合
          if (s.tag.endsWith('>') && !s.tag.endsWith('</script>')) {
            return s.tag.replace('>', '></script>');
          }
          return s.tag;
        })
        .join('\n    ');

      newHtml = newHtml.replace('</body>', `  ${scriptTags}\n  </body>`);

      return newHtml;
    }
  };
}

const plugins = [
  react(),
  tailwindcss(),
  // vitePluginManusRuntime(), // Disabled for Vercel deployment
  // ensureReactLoadOrder() // Disabled - causes HTML corruption to fix module loading order
];

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
    // 智能代码分割策略
    // ==========================================
    rollupOptions: {
      output: {
        // 精确的手动分块逻辑：按依赖族拆分，降低大包体积
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          if (/react|scheduler|use-sync-external-store/.test(id)) return 'react-core';
          if (/react-router/.test(id)) return 'react-router';
          if (/(@tanstack|@trpc|superjson)/.test(id)) return 'trpc-query';
          if (/(@radix-ui|@floating-ui|@headlessui)/.test(id)) return 'ui-kit';
          if (/lucide-react/.test(id)) return 'icons';
          if (/(d3|chart|echarts)/.test(id)) return 'charts';
          if (/(three|@react-three)/.test(id)) return 'three';
          if (/axios/.test(id)) return 'axios';
          if (/(lodash|date-fns)/.test(id)) return 'utils';

          return 'vendor';
        },

        // ============================================
        // 模块预加载配置（关键！）
        // ============================================
        // 这确保了正确的加载顺序
        // Note: manualChunksMeta is not supported in current Vite version
        // manualChunksMeta: {
        //   'react-core': {
        //     // React 核心总是预加载
        //     isEntry: false,
        //     implicitlyLoadedBefore: [
        //       'react-router',
        //       'react-ecosystem',
        //       'ui-components',
        //       'charts',
        //       'vendor'
        //     ]
        //   }
        // },

        // 优化文件名
        chunkFileNames: (chunkInfo) => {
          // 使用确定性的文件名，便于调试
          const name = chunkInfo.name;
          return `chunks/${name}-[hash].js`;
        },

        entryFileNames: 'js/[name]-[hash].js',

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
    // 压缩和优化选项
    // ==========================================
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      mangle: {
        toplevel: true,
        keep_classnames: false,
        // 保留 React 相关的类名（有助于调试）
        reserved: ['React', 'ReactDOM'],
      },
      format: {
        comments: false,
        preamble: '/* Awareness Market - Optimized Build */',
      },
    },

    // ==========================================
    // 其他优化
    // ==========================================
    reportCompressedSize: true,
    chunkSizeWarningLimit: 2500,
    sourcemap: false, // Do NOT ship sourcemaps to production (exposes source code)

    // ==========================================
    // 模块预加载策略
    // ==========================================
    modulePreload: {
      // 自定义预加载逻辑
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        // React 核心必须最先预加载
        const sortedDeps = deps.sort((a, b) => {
          const getPriority = (path: string): number => {
            if (path.includes('react-core')) return 1;
            if (path.includes('react-router')) return 2;
            if (path.includes('react-ecosystem')) return 3;
            if (path.includes('ui-components')) return 4;
            if (path.includes('charts')) return 5;
            if (path.includes('utils')) return 6;
            if (path.includes('vendor')) return 7;
            return 10;
          };

          return getPriority(a) - getPriority(b);
        });

        return sortedDeps;
      },
    },
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
