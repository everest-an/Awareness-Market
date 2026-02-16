# 🔧 Awareness Market - 故障排除指南

---

## 🚨 常见故障排除

### 1. Go 服务无法启动

**症状**: 运行启动脚本后没有响应，或收到错误信息

**诊断**:
```bash
# 检查 Go 是否安装
go version

# 检查端口是否被占用
netstat -an | findstr "808"  # Windows
lsof -i :8080                # macOS/Linux

# 检查 Go 服务目录
ls go-services/memory-exchange/cmd/
```

**解决方案**:

```bash
# 如果端口被占用，杀死占用进程
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID号> /F

# macOS/Linux
lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**如果 Go 版本过旧**:
- 下载 Go 1.21+ 从 https://golang.org/dl/
- 更新后重新启动

---

### 2. 数据库连接失败

**症状**: 
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: password authentication failed for user
```

**诊断**:
```bash
# 检查 PostgreSQL 是否运行
netstat -an | findstr :5432  # Windows
lsof -i :5432                # macOS/Linux

# 或使用 Docker
docker ps | grep postgres

# 测试连接
psql -h localhost -U postgres
```

**解决方案**:

```bash
# 使用 Docker 启动 PostgreSQL
docker run -d \
  --name awareness-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=awareness \
  -p 5432:5432 \
  postgres:16

# 或使用 Docker Compose
docker-compose up -d postgres

# 更新 .env 中的连接字符串
DATABASE_URL=postgresql://postgres:password@localhost:5432/awareness
```

---

### 3. API Gateway 返回 503 Service Unavailable

**症状**: 请求返回错误 503，无法连接 Go 服务

**诊断**:
```bash
# 检查 Go 服务是否运行
curl http://localhost:8083/health
curl http://localhost:8080/health
curl http://localhost:8081/health

# 检查网络连接
ping localhost
telnet localhost 8083
```

**解决方案**:

```bash
# 1. 确保所有 Go 服务都在运行
./start-go-services.ps1   # Windows
./start-go-services.sh    # Linux/macOS

# 2. 检查日志
cat /tmp/memory-exchange.log      # macOS/Linux
type %TEMP%\memory-exchange.log   # Windows

# 3. 手动启动单个服务测试
cd go-services/memory-exchange
go run ./cmd/main.go

# 4. 检查环境变量
echo $MEMORY_SERVICE_URL
echo $API_KEY_SECRET
```

---

### 4. 认证失败 (401/403)

**症状**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

**诊断**:
```bash
# 检查环境变量是否设置
echo $API_KEY_SECRET

# 检查请求头
curl -v -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/memory/browse
```

**解决方案**:

```bash
# 1. 创建或更新 .env 文件
cat > .env << EOF
API_KEY_SECRET=your_secret_key_here
MEMORY_API_KEY=your_memory_key
VECTOR_API_KEY=your_vector_key
WMATRIX_API_KEY=your_wmatrix_key
EOF

# 2. 重启所有服务
pkill -f "go run"
./start-go-services.ps1

# 3. 验证认证
curl -H "Authorization: Bearer $(echo $API_KEY_SECRET)" \
  http://localhost:8080/api/v1/memory/browse
```

---

### 5. TypeScript 编译错误

**症状**: `pnpm check` 显示大量错误

**诊断**:
```bash
# 查看所有错误
pnpm check

# 查看特定文件的错误
pnpm check -- client/src/pages/Dashboard.tsx

# 检查 tsconfig.json
cat tsconfig.json | grep -A5 "strict"
```

**解决方案**:

```bash
# 1. 清理缓存
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 2. 更新类型定义
pnpm add -D typescript@latest

# 3. 检查导入路径
# 确保所有导入使用 Go 服务地址
grep -r "http://localhost:8080" server/

# 4. 修复数据类型
# 运行 Pylance 自动修复
pnpm fix
```

---

### 6. 端口冲突

**症状**: "Address already in use" 或 "EADDRINUSE"

**诊断**:
```bash
# 查看哪些进程占用端口
# Windows
netstat -ano | findstr :3001
netstat -ano | findstr :8080

# macOS/Linux
lsof -i :3001
lsof -i :8080
```

**解决方案**:

```bash
# Windows
taskkill /PID <PID号> /F

# macOS/Linux
kill -9 <PID号>

# 或改变应用端口
export PORT=3002
pnpm dev

# 或改变 Go 服务端口
export MEMORY_EXCHANGE_PORT=8090
go run ./cmd/main.go
```

---

### 7. 网络超时

**症状**:
```
Error: ETIMEDOUT
Error: Request timeout after 30000ms
```

**诊断**:
```bash
# 检查网络连接
ping google.com

# 检查 DNS
nslookup localhost

# 测试特定端口连接
curl -v --connect-timeout 5 http://localhost:8080/health
```

**解决方案**:

```bash
# 1. 检查防火墙
# Windows: 检查防火墙是否阻止端口
# 设置 > 隐私和安全 > Windows 防火墙 > 允许应用通过防火墙

# 2. 增加超时时间
# 在 .env 中添加
TIMEOUT=60000

# 3. 检查网络接口
netstat -a | grep LISTEN

# 4. 重启网络服务
# Windows
ipconfig /flushdns

# macOS/Linux
sudo dscacheutil -flushcache
```

---

### 8. 内存泄漏或性能下降

**症状**: 应用逐渐变慢，内存占用持续增长

**诊断**:
```bash
# 检查进程内存使用
# Windows
Get-Process node | Select-Object -Property Name, @{Name="Memory(MB)"; Expression={[math]::Round($_.WorkingSet / 1MB, 2)}}

# macOS/Linux
ps aux | grep node

# 使用 Node.js 调试工具
node --inspect server/index.ts

# Chrome DevTools: chrome://inspect
```

**解决方案**:

```bash
# 1. 添加内存限制
export NODE_OPTIONS=--max-old-space-size=2048
pnpm dev

# 2. 启用垃圾回收日志
node --expose-gc --trace-gc server/index.ts

# 3. 使用性能分析工具
# clinic.js 分析
npm install -g clinic
clinic doctor -- node server/index.ts

# 4. 减少日志输出
LOG_LEVEL=warn pnpm dev
```

---

### 9. CORS 错误

**症状**:
```
Access to XMLHttpRequest at 'http://localhost:3001/api/v1/vectors/search'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**诊断**:
```bash
# 检查 CORS 配置
grep -r "CORS\|cors" server/

# 检查请求头
curl -v -H "Origin: http://localhost:5173" \
  http://localhost:3001/api/v1/vectors/search
```

**解决方案**:

```bash
# 在 server/index.ts 中配置 CORS
import cors from 'cors';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

# 或在 .env 中指定
CORS_ORIGIN=http://localhost:5173
```

---

### 10. Docker 容器问题

**症状**: `docker-compose up` 失败或容器不断重启

**诊断**:
```bash
# 查看容器日志
docker-compose logs memory-exchange

# 检查容器状态
docker-compose ps

# 检查网络
docker network ls
docker network inspect awareness_network
```

**解决方案**:

```bash
# 1. 重建容器
docker-compose down
docker-compose up --build

# 2. 清理所有 Docker 资源
docker system prune -a

# 3. 查看详细日志
docker-compose logs -f --tail=100 memory-exchange

# 4. 进入容器调试
docker-compose exec memory-exchange /bin/bash

# 5. 检查环境变量
docker-compose config | grep -A5 "environment:"
```

---

## 🆘 当上述解决方案都不起作用时

### 收集诊断信息

```bash
# 创建诊断报告
cat > DIAGNOSTIC_REPORT.txt << EOF
系统信息:
$(uname -a)

Go 版本:
$(go version)

Node 版本:
$(node --version)

NPM/PNPM 版本:
$(pnpm --version)

已运行的进程:
$(ps aux | grep -E "node|go|docker")

网络连接:
$(netstat -an | grep LISTEN)

环境变量:
$(env | grep -i "awareness\|database\|api_key")

package.json:
$(cat package.json)

最后的错误日志:
$(tail -50 /tmp/*.log 2>/dev/null || echo "No logs found")
EOF

cat DIAGNOSTIC_REPORT.txt
```

### 获取帮助

1. **查看日志文件**:
   ```bash
   # Linux/macOS
   tail -100 /tmp/memory-exchange.log
   tail -100 /tmp/vector-operations.log
   
   # Windows
   type %TEMP%\memory-exchange.log
   type %TEMP%\vector-operations.log
   ```

2. **检查服务状态**:
   ```bash
   curl -v http://localhost:3001/health/detailed
   ```

3. **运行测试**:
   ```bash
   pnpm test
   ```

4. **查看完整文档**:
   - [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md)
   - [GO_SERVICES_INTEGRATION_GUIDE.md](GO_SERVICES_INTEGRATION_GUIDE.md)
   - [SERVICE_ARCHITECTURE_REVIEW.md](SERVICE_ARCHITECTURE_REVIEW.md)

---

## 📝 快速参考表

| 问题 | 命令 | 预期输出 |
|------|------|--------|
| 检查 Go 服务 | `curl http://localhost:8080/health` | `{"status":"ok"}` |
| 检查数据库 | `psql -h 127.0.0.1 -U postgres` | `postgres=#` 提示 |
| 检查端口占用 | `netstat -an \| grep 3001` | 空（未占用）或进程信息 |
| 查看 Node 进程 | `ps aux \| grep node` | 列出所有 Node 进程 |
| 清理缓存 | `pnpm store prune` | 完成消息 |
| 重新安装依赖 | `pnpm install --force` | 完成，无错误 |

---

**最后更新**: 2024
**维护者**: Awareness Market Team
**报告问题**: 检查上述 12 个常见问题或收集诊断信息提交报告
