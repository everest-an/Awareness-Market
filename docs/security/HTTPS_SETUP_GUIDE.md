# HTTPS 和安全头设置指南

## 概述

HTTPS和安全头是生产环境的**必需配置**，用于保护用户数据和防止常见的Web攻击。

### 安全等级评估

| 配置 | 安全等级 | 说明 |
|------|---------|------|
| HTTP only | ❌ F级 | 完全不安全 |
| HTTPS basic | ⚠️ C级 | 基础加密 |
| HTTPS + 安全头 | ✅ A级 | 推荐配置 |
| HTTPS + 安全头 + HSTS Preload | ✅ A+ | 最佳配置 |

---

## 快速开始

### 1. 启用安全中间件

在 `server/_core/index.ts` 中添加：

```typescript
import { securityHeaders, getSecurityConfig } from './middleware/security-headers';
import { httpsRedirect, getHttpsConfig } from './middleware/https-redirect';

const app = express();

// HTTPS重定向 (生产环境)
app.use(httpsRedirect(getHttpsConfig()));

// 安全头
app.use(securityHeaders(getSecurityConfig()));

// ... 其他中间件
```

### 2. 环境配置

在 `.env` 中添加：

```bash
# 生产环境强制HTTPS
NODE_ENV=production
TRUST_PROXY=true

# SSL证书路径 (如果使用自签名证书)
SSL_KEY_PATH=/path/to/private-key.pem
SSL_CERT_PATH=/path/to/certificate.pem
SSL_CA_PATH=/path/to/ca-bundle.pem
```

### 3. 验证配置

访问以下网站测试你的HTTPS配置：
- [SSL Labs](https://www.ssllabs.com/ssltest/) - SSL/TLS评级
- [Security Headers](https://securityheaders.com/) - 安全头检查
- [Mozilla Observatory](https://observatory.mozilla.org/) - 综合安全评分

---

## SSL/TLS 证书获取

### 选项1：Let's Encrypt (免费，推荐)

**使用Certbot自动获取**:

```bash
# 安装Certbot
sudo apt-get install certbot

# 获取证书 (standalone模式)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 或使用webroot模式 (无需停止服务器)
sudo certbot certonly --webroot -w /var/www/html -d yourdomain.com

# 证书位置
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

**自动续期**:
```bash
# 测试自动续期
sudo certbot renew --dry-run

# 添加cron任务 (每天检查一次)
echo "0 0 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'" | sudo tee -a /etc/crontab
```

### 选项2：云服务商证书

#### AWS Certificate Manager (ACM)

```bash
# 申请证书
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS

# 验证域名 (在Route 53中添加CNAME记录)
```

#### Cloudflare SSL

1. 登录Cloudflare Dashboard
2. 选择域名
3. SSL/TLS → Origin Server
4. Create Certificate
5. 下载证书和私钥

### 选项3：购买商业证书

- **DigiCert**: 企业级，支持EV证书
- **Comodo**: 价格实惠
- **GlobalSign**: 国际认可度高

---

## Node.js HTTPS服务器配置

### 使用Express + HTTPS

```typescript
import https from 'https';
import fs from 'fs';
import express from 'express';

const app = express();

// ... 中间件配置

// HTTPS选项
const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/yourdomain.com/fullchain.pem'),
  // CA证书 (可选，用于客户端证书验证)
  ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : undefined,
};

// 创建HTTPS服务器
const httpsServer = https.createServer(httpsOptions, app);

httpsServer.listen(443, () => {
  console.log('HTTPS server running on port 443');
});

// HTTP重定向服务器 (可选)
const httpApp = express();
httpApp.use((req, res) => {
  res.redirect(301, `https://${req.headers.host}${req.url}`);
});

httpApp.listen(80, () => {
  console.log('HTTP redirect server running on port 80');
});
```

### 使用Nginx反向代理 (推荐生产环境)

```nginx
# /etc/nginx/sites-available/awareness-market

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # HTTPS重定向
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL证书
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Session cache
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # 代理到Node.js应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**启用配置**:
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/awareness-market /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载Nginx
sudo systemctl reload nginx
```

---

## 安全头详解

### 1. Strict-Transport-Security (HSTS)

**作用**: 强制浏览器使用HTTPS

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**参数**:
- `max-age`: HSTS策略有效期（秒）
- `includeSubDomains`: 包含所有子域名
- `preload`: 加入HSTS预加载列表

**提交到HSTS预加载列表**:
1. 访问 https://hstspreload.org/
2. 输入域名
3. 满足条件后提交
4. 等待审核（2-6周）

### 2. Content-Security-Policy (CSP)

**作用**: 防止XSS攻击

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

**常用指令**:
- `default-src`: 默认策略
- `script-src`: JavaScript来源
- `style-src`: CSS来源
- `img-src`: 图片来源
- `connect-src`: API请求来源
- `frame-ancestors`: 允许嵌入的父页面

**CSP配置示例**:
```typescript
cspDirectives: {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    'https://cdn.example.com',
    "'sha256-abc123...'", // 允许特定脚本哈希
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", 'https://api.stripe.com'],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
}
```

**CSP报告**:
```http
Content-Security-Policy-Report-Only: ...; report-uri /csp-report
```

处理报告:
```typescript
app.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.log('CSP violation:', req.body);
  // 发送到日志系统
  res.status(204).end();
});
```

### 3. X-Frame-Options

**作用**: 防止点击劫持（Clickjacking）

```http
X-Frame-Options: DENY
```

**选项**:
- `DENY`: 完全禁止嵌入
- `SAMEORIGIN`: 仅允许同源嵌入
- `ALLOW-FROM uri`: 允许特定域名嵌入（已废弃，使用CSP的frame-ancestors）

### 4. X-Content-Type-Options

**作用**: 防止MIME类型嗅探

```http
X-Content-Type-Options: nosniff
```

### 5. Referrer-Policy

**作用**: 控制Referer头信息泄露

```http
Referrer-Policy: strict-origin-when-cross-origin
```

**策略**:
- `no-referrer`: 不发送
- `same-origin`: 仅同源
- `strict-origin-when-cross-origin`: 推荐

### 6. Permissions-Policy

**作用**: 控制浏览器功能权限

```http
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 测试和验证

### 命令行测试

```bash
# 检查证书
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# 检查TLS版本
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# 检查HSTS
curl -I https://yourdomain.com | grep -i strict

# 检查所有安全头
curl -I https://yourdomain.com
```

### 在线工具

1. **SSL Labs** (https://www.ssllabs.com/ssltest/)
   - SSL/TLS配置评级
   - 目标: A或A+

2. **Security Headers** (https://securityheaders.com/)
   - 安全头检查
   - 目标: A或A+

3. **Mozilla Observatory** (https://observatory.mozilla.org/)
   - 综合安全评分
   - 目标: 90分以上

### 自动化测试

```typescript
// 测试安全头
import axios from 'axios';

async function testSecurityHeaders(url: string) {
  const response = await axios.get(url);
  const headers = response.headers;

  const tests = {
    'Strict-Transport-Security': headers['strict-transport-security'],
    'Content-Security-Policy': headers['content-security-policy'],
    'X-Frame-Options': headers['x-frame-options'],
    'X-Content-Type-Options': headers['x-content-type-options'],
    'Referrer-Policy': headers['referrer-policy'],
  };

  for (const [header, value] of Object.entries(tests)) {
    console.log(`${header}: ${value ? '✓' : '✗'}`);
  }
}

testSecurityHeaders('https://yourdomain.com');
```

---

## 常见问题

### 1. Mixed Content警告

**问题**: HTTPS页面加载HTTP资源

**解决方案**:
```typescript
// CSP中添加upgrade-insecure-requests
cspDirectives: {
  'upgrade-insecure-requests': [],
}
```

或手动替换所有HTTP链接为HTTPS。

### 2. CORS with HTTPS

```typescript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

### 3. WebSocket over HTTPS (WSS)

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({
  server: httpsServer,
  path: '/ws',
});

wss.on('connection', (ws) => {
  // ...
});
```

前端连接:
```javascript
const ws = new WebSocket('wss://yourdomain.com/ws');
```

### 4. 证书过期

```bash
# 检查证书过期时间
openssl x509 -in /path/to/cert.pem -noout -dates

# 自动续期 (Let's Encrypt)
sudo certbot renew
```

### 5. 自签名证书（仅开发环境）

```bash
# 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Node.js中使用
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ 仅开发环境!
```

---

## 生产部署清单

### 部署前

- [ ] 获取有效的SSL证书 (Let's Encrypt或商业证书)
- [ ] 配置HTTPS重定向
- [ ] 启用所有安全头
- [ ] 测试SSL配置 (SSL Labs: A级以上)
- [ ] 测试安全头 (Security Headers: A级以上)
- [ ] 配置HSTS preload
- [ ] 设置CSP策略
- [ ] 配置证书自动续期
- [ ] 设置监控告警（证书过期）

### 部署后

- [ ] 验证HTTP→HTTPS重定向正常
- [ ] 验证所有页面加载正常（无Mixed Content）
- [ ] 验证API请求正常
- [ ] 验证WebSocket连接正常（如果有）
- [ ] 提交到HSTS预加载列表
- [ ] 配置CDN SSL（如果使用CDN）
- [ ] 更新DNS CAA记录（推荐）

### DNS CAA记录

```bash
# 限制可以颁发证书的CA
yourdomain.com. CAA 0 issue "letsencrypt.org"
yourdomain.com. CAA 0 issuewild "letsencrypt.org"
yourdomain.com. CAA 0 iodef "mailto:security@yourdomain.com"
```

---

## 性能优化

### 1. HTTP/2 启用

Nginx配置:
```nginx
listen 443 ssl http2;
```

### 2. OCSP Stapling

```nginx
ssl_stapling on;
ssl_stapling_verify on;
```

### 3. Session复用

```nginx
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
```

### 4. 证书链优化

```bash
# 验证证书链
openssl s_client -connect yourdomain.com:443 -showcerts

# 优化证书链顺序
cat cert.pem intermediate.pem > fullchain.pem
```

---

## 监控和维护

### 证书过期监控

```typescript
import https from 'https';

async function checkCertExpiry(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host,
      port: 443,
      method: 'GET',
    }, (res) => {
      const cert = (res.socket as any).getPeerCertificate();
      const validTo = new Date(cert.valid_to);
      const daysLeft = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      resolve(daysLeft);
    });

    req.on('error', reject);
    req.end();
  });
}

// 定期检查 (每天)
setInterval(async () => {
  const daysLeft = await checkCertExpiry('yourdomain.com');

  if (daysLeft < 30) {
    console.warn(`⚠️  SSL certificate expires in ${daysLeft} days!`);
    // 发送告警
  }
}, 86400000); // 24小时
```

### 安全头监控

```typescript
async function monitorSecurityHeaders(url: string) {
  const response = await fetch(url);
  const headers = response.headers;

  const requiredHeaders = [
    'strict-transport-security',
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
  ];

  const missing = requiredHeaders.filter(h => !headers.get(h));

  if (missing.length > 0) {
    console.error(`❌ Missing security headers: ${missing.join(', ')}`);
    // 发送告警
  }
}
```

---

## 总结

✅ **HTTPS和安全头配置完成后**:
- 所有流量加密传输
- 防御XSS、点击劫持等攻击
- SSL Labs评级 A或A+
- Security Headers评级 A或A+
- 符合现代安全标准

🎯 **推荐配置**:
- HTTPS强制重定向
- HSTS preload
- 严格的CSP策略
- 所有安全头启用
- HTTP/2和OCSP Stapling

📊 **关键指标**:
- SSL Labs: A+ 评级
- Security Headers: A 评级
- 证书有效期 > 30天
- 无Mixed Content警告

---

**下一步**: 优化数据库查询以提升整体性能
