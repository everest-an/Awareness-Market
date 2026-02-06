# PM2 生产环境管理指南

## 概述

PM2是Node.js应用的生产级进程管理器，为Awareness Market提供：

- ✅ 集群模式（多核CPU利用）
- ✅ 自动重启（崩溃恢复）
- ✅ 日志管理
- ✅ 零停机重载
- ✅ 资源监控
- ✅ 负载均衡

**配置文件**: [ecosystem.config.js](ecosystem.config.js)

---

## 快速开始

### 安装PM2

```bash
# 全局安装
npm install -g pm2

# 验证安装
pm2 --version
```

### 启动应用

```bash
# 开发环境
pm2 start ecosystem.config.js --env development

# 生产环境
pm2 start ecosystem.config.js --env production

# 或使用npm脚本
pnpm run pm2:start
```

### 常用命令

```bash
# 查看状态
pm2 status
pm2 list

# 查看日志
pm2 logs                          # 所有应用
pm2 logs awareness-market-api     # 特定应用
pm2 logs --lines 100              # 最近100行

# 实时监控
pm2 monit

# 重启
pm2 restart awareness-market-api  # 重启
pm2 reload awareness-market-api   # 零停机重载

# 停止
pm2 stop awareness-market-api
pm2 delete awareness-market-api   # 停止并移除
```

---

## 生产环境配置

### 1. 配置集群数量

**默认**: 使用所有CPU核心 (`instances: 'max'`)

**自定义**:
```bash
# 设置环境变量
export PM2_INSTANCES=4

# 或修改ecosystem.config.js
instances: 4  # 使用4个实例
```

**建议**:
- 2核CPU: 2个实例
- 4核CPU: 4个实例
- 8核CPU: 6-8个实例（留1-2核给系统）

### 2. 配置内存限制

**默认**: 1GB (`max_memory_restart: '1G'`)

**自定义**:
```bash
# 环境变量
export PM2_MAX_MEMORY=2G

# 或修改ecosystem.config.js
max_memory_restart: '2G'
```

**建议**:
- 小型应用: 512M - 1G
- 中型应用: 1G - 2G
- 大型应用: 2G - 4G

### 3. 配置开机自启动

```bash
# 生成启动脚本
pm2 startup

# 执行输出的命令（类似下面）
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 保存当前PM2配置
pm2 save
```

**验证**:
```bash
# 重启服务器
sudo reboot

# SSH重新连接后检查
pm2 list  # 应该看到应用正在运行
```

### 4. 日志轮转

安装PM2日志轮转模块:

```bash
# 安装
pm2 install pm2-logrotate

# 配置
pm2 set pm2-logrotate:max_size 10M      # 单个日志文件最大10MB
pm2 set pm2-logrotate:retain 30         # 保留30个日志文件
pm2 set pm2-logrotate:compress true     # 压缩旧日志
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateModule true # 也轮转PM2自身日志

# 查看配置
pm2 conf pm2-logrotate
```

---

## 日志管理

### 查看日志

```bash
# 实时日志（所有应用）
pm2 logs

# 特定应用日志
pm2 logs awareness-market-api

# 仅错误日志
pm2 logs --err

# 仅标准输出
pm2 logs --out

# 最近N行
pm2 logs --lines 200

# 带时间戳
pm2 logs --timestamp

# 清空日志
pm2 flush
```

### 日志文件位置

**默认位置**:
```
./logs/pm2-error.log      # 错误日志
./logs/pm2-out.log        # 标准输出
./logs/pm2-combined.log   # 合并日志
```

**PM2系统日志**:
```
~/.pm2/logs/              # PM2系统日志目录
~/.pm2/pm2.log            # PM2守护进程日志
```

### 自定义日志格式

修改 `ecosystem.config.js`:

```javascript
{
  error_file: './logs/api-error.log',
  out_file: './logs/api-out.log',
  log_file: './logs/api-combined.log',
  time: true,  // 添加时间戳
  merge_logs: true,  // 合并集群日志
}
```

---

## 监控和诊断

### 实时监控

```bash
# 启动监控界面
pm2 monit
```

显示:
- CPU使用率
- 内存使用
- 日志流
- 自定义指标

### 查看详细信息

```bash
# 应用详情
pm2 show awareness-market-api

# 输出示例：
# ┌─────────────┬──────────────────────────┐
# │ status      │ online                   │
# │ name        │ awareness-market-api     │
# │ version     │ 1.0.0                    │
# │ restarts    │ 0                        │
# │ uptime      │ 5h                       │
# │ script path │ /var/www/.../dist/index.js│
# │ interpreter │ node                     │
# │ instances   │ 4                        │
# │ exec mode   │ cluster                  │
# └─────────────┴──────────────────────────┘
```

### 资源使用脚本

使用我们的自定义监控脚本:

```bash
# 单次检查
npx tsx scripts/monitor-resources.ts

# 持续监控（每5秒更新）
npx tsx scripts/monitor-resources.ts --watch

# 自定义间隔（每10秒）
npx tsx scripts/monitor-resources.ts --watch --interval=10000
```

输出:
```
🖥️  Server Resource Monitor
================================================================================
📅 Time: 2026-01-30 10:30:00

🟢 CPU (4 cores)
   Usage: 15.50%
   Load Average: 0.5, 0.6, 0.7

🟢 Memory
   Total: 8.00 GB
   Used:  3.2 GB (40.00%)
   Free:  4.8 GB

🟢 Disk
   Total: 100 GB
   Used:  45 GB (45.00%)
   Free:  55 GB

📊 PM2 Processes
   ----------------------------------------------------------------------------
   Name                      Status     CPU      Memory        Uptime     Restarts
   ----------------------------------------------------------------------------
   ✅ awareness-market-api    online     12%      256.5 MB      5h 30m     0
```

---

## 更新和部署

### 零停机更新

```bash
# 1. 拉取最新代码
cd /var/www/awareness-market
git pull origin main

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm run build

# 4. 零停机重载
pm2 reload ecosystem.config.js
```

**`reload` vs `restart`**:

| 命令 | 行为 | 停机时间 |
|------|------|----------|
| `pm2 restart` | 停止再启动 | 有短暂停机 |
| `pm2 reload` | 逐个重启实例 | 零停机 |

**原理**: `reload`在集群模式下逐个重启实例，确保始终有实例在运行。

### 使用PM2部署（可选）

配置好 `ecosystem.config.js` 后:

```bash
# 首次设置
pm2 deploy ecosystem.config.js production setup

# 部署更新
pm2 deploy ecosystem.config.js production

# 回滚
pm2 deploy ecosystem.config.js production revert 1
```

**要求**:
- 配置SSH密钥访问
- 服务器上安装PM2和Node.js

---

## 故障排查

### 应用无法启动

```bash
# 1. 查看错误日志
pm2 logs awareness-market-api --err --lines 50

# 2. 检查应用详情
pm2 show awareness-market-api

# 3. 检查环境变量
pm2 env awareness-market-api

# 4. 手动运行（调试）
NODE_ENV=production node dist/index.js
```

**常见原因**:
- 端口被占用
- 环境变量缺失（DATABASE_URL, JWT_SECRET等）
- 数据库无法连接
- 构建产物不存在（`dist/`目录）

### 频繁重启

```bash
# 查看重启原因
pm2 logs --lines 100

# 查看重启次数
pm2 list
```

**常见原因**:
- 内存泄漏（超过`max_memory_restart`）
- 未捕获的异常
- 数据库连接失败
- 端口冲突

**解决方法**:
```bash
# 增加内存限制
export PM2_MAX_MEMORY=2G
pm2 reload ecosystem.config.js

# 检查内存使用
pm2 monit

# 查找内存泄漏
node --inspect dist/index.js
```

### 端口占用

```bash
# 检查端口3001是否被占用
sudo lsof -i :3001

# 或
sudo netstat -tulpn | grep 3001

# 杀死占用进程
kill -9 <PID>
```

### PM2守护进程崩溃

```bash
# 重启PM2守护进程
pm2 kill
pm2 resurrect

# 重新加载所有应用
pm2 start ecosystem.config.js
```

---

## 性能优化

### 集群模式优化

```javascript
// ecosystem.config.js
{
  instances: 'max',  // 使用所有核心
  exec_mode: 'cluster',

  // Node.js优化参数
  node_args: [
    '--max-old-space-size=2048',  // 2GB堆内存
    '--enable-source-maps',       // 源码映射
    '--optimize_for_size',        // 内存优化
  ],
}
```

### 内存管理

```javascript
{
  max_memory_restart: '1G',  // 超过1GB重启
  restart_delay: 4000,       // 重启延迟4秒
  min_uptime: '10s',         // 最小运行10秒
  max_restarts: 10,          // 10分钟内最多重启10次
}
```

### 监听配置

```javascript
{
  listen_timeout: 3000,    // 监听超时3秒
  kill_timeout: 5000,      // 杀死进程超时5秒
  shutdown_with_message: true,  // 优雅关闭
}
```

---

## PM2 Plus（可选）

PM2 Plus提供高级监控功能（付费，但有免费额度）。

### 注册

```bash
# 注册并连接
pm2 link <secret> <public>

# 在https://app.pm2.io获取密钥
```

### 功能

- 📊 实时仪表板
- 🔔 告警通知（CPU、内存、异常）
- 📈 性能指标
- 🔍 分布式追踪
- 💾 日志存储（30天）
- 📱 移动App

---

## 安全最佳实践

### 1. 限制PM2权限

```bash
# 不要以root运行PM2
# 使用专用用户
sudo useradd -m pm2user
sudo -u pm2user pm2 start ecosystem.config.js
```

### 2. 保护日志文件

```bash
# 设置日志目录权限
chmod 750 logs/
chmod 640 logs/*.log
```

### 3. 环境变量安全

```bash
# 不要在ecosystem.config.js中硬编码敏感信息
# 使用.env文件（在.gitignore中）

# ecosystem.config.js
env: {
  NODE_ENV: 'production',
  // 不要这样做：
  // DATABASE_URL: 'postgresql://...',

  // 应该从环境变量读取
}
```

### 4. 定期更新

```bash
# 更新PM2
pm2 update

# 更新全局PM2
npm update -g pm2
```

---

## 常用命令速查表

| 命令 | 说明 |
|------|------|
| `pm2 start ecosystem.config.js` | 启动应用 |
| `pm2 restart <name>` | 重启应用 |
| `pm2 reload <name>` | 零停机重载 |
| `pm2 stop <name>` | 停止应用 |
| `pm2 delete <name>` | 删除应用 |
| `pm2 list` | 查看所有应用 |
| `pm2 monit` | 实时监控 |
| `pm2 logs` | 查看日志 |
| `pm2 logs --err` | 查看错误日志 |
| `pm2 flush` | 清空日志 |
| `pm2 save` | 保存当前配置 |
| `pm2 resurrect` | 恢复保存的配置 |
| `pm2 startup` | 设置开机自启 |
| `pm2 unstartup` | 移除开机自启 |

---

## 进阶配置

### 自定义环境变量

```javascript
// ecosystem.config.js
env_custom: {
  NODE_ENV: 'custom',
  PORT: 4000,
  CUSTOM_VAR: 'value',
},
```

启动:
```bash
pm2 start ecosystem.config.js --env custom
```

### 多应用管理

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      script: './dist/api.js',
    },
    {
      name: 'worker',
      script: './dist/worker.js',
      instances: 2,
    },
  ],
};
```

### Graceful Shutdown

在应用中实现:

```typescript
// server/index.ts
process.on('SIGINT', async () => {
  console.log('Received SIGINT, gracefully shutting down...');

  // 关闭数据库连接
  await db.disconnect();

  // 关闭HTTP服务器
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // 30秒超时强制退出
  setTimeout(() => {
    console.error('Forced shutdown after 30s');
    process.exit(1);
  }, 30000);
});
```

---

## 相关文档

- [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) - 环境变量配置
- [AWS_RDS_POSTGRESQL_SETUP.md](AWS_RDS_POSTGRESQL_SETUP.md) - 数据库设置
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 完整部署指南
- [PM2官方文档](https://pm2.keymetrics.io/docs/usage/quick-start/)

---

**维护者**: Claude Sonnet 4.5
**最后更新**: 2026-01-30
