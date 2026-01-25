/**
 * PM2 生态系统配置文件
 * 启用集群模式以充分利用多核处理器
 * 支持自动重启、监控和日志管理
 */

module.exports = {
  apps: [
    {
      name: 'awareness-market-api',
      script: './dist/server.js',
      instances: 'max', // 自动创建与 CPU 核心数相同的实例
      exec_mode: 'cluster', // 启用集群模式
      
      // ==========================================
      // 环境配置
      // ==========================================
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      
      // ==========================================
      // 内存和 CPU 限制
      // ==========================================
      max_memory_restart: '500M', // 超过 500MB 时自动重启
      max_restarts: 10,
      min_uptime: '10s',
      
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
    },
    
    // ==========================================
    // Go 服务代理（可选）
    // ==========================================
    {
      name: 'awareness-vector-service',
      script: './dist/services/vector-service.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8083,
      },
      max_memory_restart: '300M',
      error_file: './logs/vector-service-error.log',
      out_file: './logs/vector-service-out.log',
      autorestart: true,
    },
    
    {
      name: 'awareness-memory-service',
      script: './dist/services/memory-service.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      max_memory_restart: '300M',
      error_file: './logs/memory-service-error.log',
      out_file: './logs/memory-service-out.log',
      autorestart: true,
    },
  ],

  // ==========================================
  // 全局配置
  // ==========================================
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-production-server.com',
      key: '/path/to/ssh/key.pem',
      ref: 'origin/main',
      repo: 'https://github.com/everest-an/Awareness-Market.git',
      path: '/var/www/awareness-market',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "部署前检查..."',
    },
    staging: {
      user: 'ubuntu',
      host: 'your-staging-server.com',
      key: '/path/to/ssh/key.pem',
      ref: 'origin/develop',
      repo: 'https://github.com/everest-an/Awareness-Market.git',
      path: '/var/www/awareness-market-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env development',
    },
  },
};
