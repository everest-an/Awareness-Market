/**
 * PM2 Ecosystem Configuration for Awareness Market
 *
 * 功能：
 * - 集群模式充分利用多核CPU
 * - 自动重启和故障恢复
 * - 日志管理和轮转
 * - 内存和CPU监控
 * - 优雅关闭
 *
 * 使用方法：
 * - 启动: pm2 start ecosystem.config.js --env production
 * - 重启: pm2 reload ecosystem.config.js
 * - 停止: pm2 stop ecosystem.config.js
 * - 监控: pm2 monit
 * - 日志: pm2 logs awareness-market-api
 *
 * 文档: 查看 PM2_GUIDE.md
 */

module.exports = {
  apps: [
    {
      name: 'awareness-market-api',
      script: './dist/index.js',  // 确保指向正确的入口文件
      cwd: './',

      // ==========================================
      // 集群配置
      // ==========================================
      instances: process.env.PM2_INSTANCES || 'max', // 默认max，可通过环境变量覆盖
      exec_mode: 'cluster', // 集群模式

      // ==========================================
      // 环境配置 - 从.env文件读取
      // ==========================================
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3001,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: process.env.PORT || 3001,
      },
      
      // ==========================================
      // 内存和资源限制
      // ==========================================
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1G', // 默认1GB，可配置
      max_restarts: 10, // 10分钟内最多重启次数
      min_uptime: '10s', // 最小运行时间，避免重启循环
      restart_delay: 4000, // 重启延迟4秒
      
      // ==========================================
      // 监听和重启策略
      // ==========================================
      watch: false, // 生产环境不启用文件监听
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        'dist/public',
        'coverage',
      ],
      
      // ==========================================
      // 错误和输出日志
      // ==========================================
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true, // 为日志添加时间戳
      
      // ==========================================
      // 优雅关闭
      // ==========================================
      kill_timeout: 5000, // 给应用 5 秒时间优雅关闭
      listen_timeout: 3000,
      
      // ==========================================
      // 自定义钩子
      // ==========================================
      merge_logs: false,
      autorestart: true, // 自动重启崩溃的进程
      max_sequential_restarts: 5, // 如果快速重启超过 5 次则停止
      stop_exit_codes: [0], // 正常退出码
      
      // ==========================================
      // 性能优化
      // ==========================================
      node_args: [
        '--max-old-space-size=2048', // 设置最大堆内存为 2GB
        '--enable-source-maps', // 启用 source map
      ],

      // ==========================================
      // 健康检查（PM2 Plus功能，可选）
      // ==========================================
      // 取消注释以启用健康检查
      // health_check: {
      //   enabled: true,
      //   endpoint: '/health',
      //   interval: 30000, // 30秒检查一次
      //   timeout: 5000,
      // },

      // ==========================================
      // 日志轮转（推荐使用pm2-logrotate模块）
      // ==========================================
      // 安装: pm2 install pm2-logrotate
      // 配置: pm2 set pm2-logrotate:max_size 10M
      //       pm2 set pm2-logrotate:retain 30
      //       pm2 set pm2-logrotate:compress true
    },
  ],

  // ==========================================
  // PM2部署配置（可选）
  // ==========================================
  // 使用方法: pm2 deploy ecosystem.config.js production setup
  //          pm2 deploy ecosystem.config.js production
  // ==========================================
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-production-server.com'], // 支持多主机部署
      ssh_options: 'StrictHostKeyChecking=no',
      key: process.env.PM2_DEPLOY_KEY || '~/.ssh/id_rsa',
      ref: 'origin/main',
      repo: 'https://github.com/everest-an/Awareness-Market.git',
      path: '/var/www/awareness-market',

      // 部署前检查
      'pre-deploy-local': [
        'echo "🚀 Starting production deployment..."',
        'git status',
        'echo "检查环境变量配置..."',
        'npx tsx scripts/check-env-config.ts || true',
      ].join(' && '),

      // 服务器上执行的部署命令
      'post-deploy': [
        'echo "📦 Installing dependencies..."',
        'pnpm install --prod',
        'echo "🏗️  Building application..."',
        'pnpm run build',
        'echo "🗄️  Running database migrations..."',
        'pnpm run db:push',
        'echo "♻️  Reloading PM2..."',
        'pm2 reload ecosystem.config.js --env production',
        'echo "✅ Deployment complete!"',
      ].join(' && '),

      // 部署后清理
      'post-setup': [
        'pnpm install',
        'cp .env.example .env',
        'echo "⚠️  请配置 .env 文件"',
      ].join(' && '),
    },

    staging: {
      user: 'ubuntu',
      host: 'your-staging-server.com',
      ssh_options: 'StrictHostKeyChecking=no',
      key: process.env.PM2_DEPLOY_KEY || '~/.ssh/id_rsa',
      ref: 'origin/develop',
      repo: 'https://github.com/everest-an/Awareness-Market.git',
      path: '/var/www/awareness-market-staging',
      'post-deploy': [
        'pnpm install',
        'pnpm run build',
        'pnpm run db:push',
        'pm2 reload ecosystem.config.js --env staging',
      ].join(' && '),
    },
  },
};
