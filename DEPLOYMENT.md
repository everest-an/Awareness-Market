# Awareness Network 2.0 - 部署指南

## 项目概述

Awareness Network 2.0 是一个完整的商业级智能知识管理系统，支持Web端和移动端，提供OCR识别、AI文档生成、企业信息查询、分布式存储和订阅付费等功能。

### 技术栈

**后端：**
- Node.js + TypeScript
- tRPC 11（类型安全的API）
- Drizzle ORM（数据库ORM）
- MySQL/TiDB（数据库）
- FastAPI + Python（AI处理服务）
- PaddleOCR（免费OCR引擎）
- GPT-4o（文档生成和企业查询）

**前端Web：**
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui组件库
- TanStack Query（数据管理）
- Wouter（路由）

**移动端：**
- React Native 0.73
- React Navigation 6
- react-native-vision-camera（相机）
- ethers.js（Web3集成）

**支付和存储：**
- Stripe（订阅支付）
- S3/Cloudflare R2（文件存储）
- IPFS（分布式存储，付费功能）
- Arweave（永久存储，可选）

---

## 项目结构

```
awareness-network-v2/
├── client/                    # Web前端
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   ├── components/       # 可复用组件
│   │   ├── lib/              # 工具库
│   │   └── App.tsx           # 主应用
│   └── public/               # 静态资源
├── server/                    # Node.js后端
│   ├── _core/                # 核心框架
│   ├── routers.ts            # tRPC路由
│   ├── db.ts                 # 数据库查询
│   ├── ai-client.ts          # AI服务客户端
│   ├── stripe-client.ts      # Stripe客户端
│   ├── ipfs-storage.ts       # IPFS存储
│   └── subscription-middleware.ts  # 订阅检查
├── drizzle/                   # 数据库Schema
│   └── schema.ts             # 表定义
├── ai-service/                # Python AI服务
│   ├── main.py               # FastAPI应用
│   └── requirements.txt      # Python依赖
├── mobile-app/                # React Native移动端
│   ├── src/
│   │   ├── screens/          # 页面组件
│   │   ├── navigation/       # 导航配置
│   │   └── services/         # API服务
│   ├── android/              # Android原生代码
│   └── ios/                  # iOS原生代码
├── todo.md                    # 开发待办列表
└── README.md                  # 项目说明
```

---

## 数据库Schema

### 核心表结构

1. **users** - 用户表
   - id, openId, name, email, role, createdAt, updatedAt

2. **subscriptions** - 订阅表
   - id, userId, plan, status, stripeCustomerId, stripeSubscriptionId
   - currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd

3. **files** - 文件表
   - id, userId, fileName, fileType, fileSize, r2ObjectKey, ipfsCid, ipfsUrl
   - storageType (s3/ipfs/arweave), status, createdAt

4. **documents** - 文档表
   - id, userId, fileId, title, content, summary, tags, companyInfo
   - createdAt, updatedAt

5. **tags** - 标签表
   - id, name, createdAt

6. **documentTags** - 文档标签关联表
   - documentId, tagId

7. **contacts** - 联系人表
   - id, userId, documentId, name, title, company, phone, email
   - website, address, notes, createdAt

8. **companies** - 企业信息表
   - id, name, industry, description, website, employeeCount
   - foundedYear, location, createdAt

---

## 环境变量配置

### 后端环境变量

```bash
# 数据库
DATABASE_URL=mysql://user:password@host:port/database

# JWT和OAuth
JWT_SECRET=your-jwt-secret
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im

# Stripe支付
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# AI服务
OPENAI_API_KEY=sk-...

# S3存储（Manus内置）
# 已自动注入，无需手动配置

# IPFS（可选，付费功能）
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_API_KEY=your-ipfs-key
IPFS_API_SECRET=your-ipfs-secret

# 应用配置
VITE_APP_TITLE=Awareness Network 2.0
VITE_APP_LOGO=/logo.png
OWNER_OPEN_ID=your-owner-openid
OWNER_NAME=Your Name
```

### 移动端环境变量

```bash
# API端点
API_URL=https://your-domain.com/api/trpc
```

---

## 部署步骤

### 1. 数据库初始化

```bash
# 安装依赖
pnpm install

# 推送Schema到数据库
pnpm db:push

# 验证数据库连接
pnpm db:studio
```

### 2. 启动AI服务

```bash
cd ai-service

# 创建Python虚拟环境
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
# 服务运行在 http://localhost:5000
```

### 3. 启动Web应用

```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build
pnpm start
```

### 4. 配置Stripe Webhook

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com)
2. 进入 Developers → Webhooks
3. 添加端点：`https://your-domain.com/api/stripe/webhook`
4. 选择事件：
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. 复制Webhook签名密钥到 `STRIPE_WEBHOOK_SECRET`

### 5. 移动端App开发

#### Android

```bash
cd mobile-app

# 安装依赖
npm install

# 启动Metro Bundler
npm start

# 在另一个终端运行Android
npm run android

# 构建发布版
npm run build:android
# 输出：android/app/build/outputs/apk/release/app-release.apk
```

#### iOS

```bash
cd mobile-app

# 安装依赖
npm install
cd ios && pod install && cd ..

# 启动Metro Bundler
npm start

# 在另一个终端运行iOS
npm run ios

# 构建发布版（需要在Xcode中配置签名）
npm run build:ios
```

---

## 功能清单

### ✅ 已完成功能

**核心功能：**
- [x] 用户认证（Manus OAuth）
- [x] 文件上传（拖拽、选择、摄像头）
- [x] OCR文字识别（PaddleOCR）
- [x] AI文档生成（GPT-4o）
- [x] 企业信息查询（GPT-4o搜索）
- [x] 知识文档管理（CRUD）
- [x] 标签系统
- [x] 联系人管理
- [x] S3文件存储

**订阅和支付：**
- [x] 15天免费试用
- [x] Stripe订阅集成
- [x] Stripe Webhook处理
- [x] 订阅状态检查中间件
- [x] 存储配额管理
- [x] Web3钱包USDT支付组件

**分布式存储：**
- [x] S3存储（所有用户）
- [x] IPFS存储服务模块
- [x] 多存储类型支持

**Web前端：**
- [x] 首页（Landing Page）
- [x] Dashboard仪表盘
- [x] 文件上传页面
- [x] 摄像头拍照页面
- [x] 文档列表和详情
- [x] 联系人列表和详情
- [x] 订阅管理页面

**移动端App：**
- [x] 项目结构和配置
- [x] tRPC客户端集成
- [x] 导航系统
- [x] 所有核心页面（9个页面）

### 🚧 待完成功能

**认证：**
- [ ] Web3钱包登录（签名验证）
- [ ] 邮箱验证码登录
- [ ] 社交登录（Google, 微信）

**高级功能：**
- [ ] IPFS文件上传工作流（付费用户）
- [ ] Arweave永久存储
- [ ] 文本向量化和语义搜索
- [ ] 任务队列（BullMQ + Redis）

**移动端：**
- [ ] 离线模式和本地缓存
- [ ] 移动端支付（Apple Pay / Google Pay）
- [ ] 推送通知
- [ ] Android和iOS打包配置
- [ ] 发布到应用商店

**测试和优化：**
- [ ] 单元测试
- [ ] 集成测试
- [ ] E2E测试
- [ ] 性能优化
- [ ] 安全审计

---

## API文档

### tRPC路由

#### Auth
- `auth.me` - 获取当前用户
- `auth.logout` - 退出登录

#### Files
- `files.upload` - 上传文件
- `files.list` - 获取文件列表
- `files.getById` - 获取文件详情
- `files.delete` - 删除文件

#### Documents
- `documents.list` - 获取文档列表
- `documents.getById` - 获取文档详情
- `documents.create` - 创建文档
- `documents.update` - 更新文档
- `documents.delete` - 删除文档

#### Contacts
- `contacts.list` - 获取联系人列表
- `contacts.getById` - 获取联系人详情
- `contacts.create` - 创建联系人
- `contacts.update` - 更新联系人
- `contacts.delete` - 删除联系人

#### Tags
- `tags.list` - 获取标签列表
- `tags.create` - 创建标签
- `tags.addToDocument` - 添加标签到文档

#### AI
- `ai.processOCR` - 处理OCR识别
- `ai.generateDocument` - 生成知识文档
- `ai.queryCompany` - 查询企业信息
- `ai.health` - AI服务健康检查

#### Subscription
- `subscription.current` - 获取当前订阅
- `subscription.createCheckoutSession` - 创建Stripe Checkout
- `subscription.cancelSubscription` - 取消订阅

#### IPFS
- `ipfs.uploadFile` - 上传文件到IPFS（付费用户）
- `ipfs.getFileStatus` - 获取IPFS文件状态

---

## 商业化策略

### 订阅计划

1. **免费试用**
   - 15天完整功能体验
   - 自动创建试用订阅

2. **基础版** - $9.99/月
   - 无限文档存储
   - 100GB S3存储
   - OCR + AI文档生成
   - 企业信息查询

3. **专业版** - $19.99/月
   - 基础版所有功能
   - 500GB存储
   - IPFS分布式存储
   - 高级AI分析
   - 团队协作

4. **企业版** - $49.99/月
   - 专业版所有功能
   - 无限存储
   - Arweave永久存储
   - 自定义AI模型
   - 专属支持

### 支付方式

- **Stripe**：信用卡/借记卡
- **Web3**：MetaMask USDT支付

---

## 故障排除

### 数据库连接失败
```bash
# 检查DATABASE_URL配置
echo $DATABASE_URL

# 测试数据库连接
pnpm db:studio
```

### AI服务无法启动
```bash
# 检查Python依赖
pip list | grep paddleocr

# 重新安装PaddleOCR
pip install --upgrade paddleocr
```

### 移动端构建失败
```bash
# Android
cd android && ./gradlew clean && cd ..
npm run android

# iOS
cd ios && pod deintegrate && pod install && cd ..
npm run ios
```

### TypeScript编译错误
```bash
# 清除缓存
rm -rf node_modules .next
pnpm install
pnpm dev
```

---

## 安全建议

1. **环境变量**：永远不要提交 `.env` 文件到Git
2. **API密钥**：定期轮换Stripe和OpenAI密钥
3. **数据库**：启用SSL连接和访问控制
4. **CORS**：限制允许的来源域名
5. **Rate Limiting**：实施API速率限制
6. **输入验证**：使用Zod验证所有输入
7. **文件上传**：限制文件类型和大小

---

## 监控和日志

### 推荐工具

- **应用监控**：Sentry
- **日志管理**：LogRocket
- **性能分析**：Vercel Analytics
- **错误追踪**：Bugsnag

### 关键指标

- API响应时间
- OCR处理时间
- 文档生成成功率
- 订阅转化率
- 用户留存率

---

## 联系方式

- **开发者**：everest9812@gmail.com
- **GitHub**：https://github.com/everest-an/Awareness-Network
- **文档**：https://awareness.market

---

**Awareness Network 2.0** - 让知识管理更智能
