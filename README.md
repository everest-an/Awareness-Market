# Awareness Network 2.0

一个基于AI的智能知识管理系统，帮助用户系统化整理会展资料、名片、文档照片等信息，自动生成知识文档并建立关联。

## 🌟 核心功能

### 📸 智能拍照与OCR
- 支持Web端文件上传和移动端摄像头实时拍照
- 集成PaddleOCR免费开源OCR引擎，支持中英文混合识别
- 自动提取图片中的文字内容

### 🤖 AI文档生成
- 基于GPT-4o自动生成结构化知识文档
- 智能提取关键词和摘要
- 自动查询企业信息并关联到文档

### 🏷️ 知识组织
- 标签系统：自动和手动标签分类
- 联系人管理：从名片自动提取联系信息
- 企业信息库：自动关联企业背景和主营业务

### 💾 多层存储
- **基础用户**：S3云存储（快速访问）
- **付费用户**：IPFS分布式存储（隐私保护）
- **高级用户**：Arweave永久存储（可选）

### 💳 灵活支付
- 15天免费试用
- Stripe信用卡支付（月付/年付/终身）
- Web3加密货币支付（USDT）

## 🛠️ 技术栈

### 后端
- **框架**: Node.js + Express + tRPC
- **数据库**: MySQL (TiDB)
- **AI服务**: Python FastAPI + PaddleOCR + OpenAI GPT-4o
- **存储**: S3 + IPFS + Arweave
- **支付**: Stripe + Ethers.js

### 前端
- **框架**: React 19 + TypeScript
- **UI**: Tailwind CSS 4 + shadcn/ui
- **路由**: Wouter
- **状态管理**: tRPC + React Query

### 移动端
- **框架**: React Native (待开发)
- **相机**: react-native-camera

## 📦 项目结构

```
awareness-network-v2/
├── client/                 # Web前端
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # UI组件
│   │   └── lib/          # 工具库
├── server/                # Node.js后端
│   ├── routers.ts        # tRPC路由
│   ├── db.ts             # 数据库查询
│   ├── stripe-client.ts  # Stripe集成
│   ├── ipfs-storage.ts   # IPFS存储
│   └── ai-client.ts      # AI服务客户端
├── ai-service/           # Python AI服务
│   ├── main.py          # FastAPI应用
│   └── requirements.txt # Python依赖
├── drizzle/             # 数据库Schema
│   └── schema.ts
└── mobile-app/          # React Native移动端（待开发）
```

## 🚀 快速开始

### 环境要求
- Node.js 22+
- Python 3.11+
- MySQL 8.0+
- pnpm 10+

### 安装依赖

```bash
# 安装Node.js依赖
pnpm install

# 安装Python依赖
cd ai-service
pip install -r requirements.txt
```

### 配置环境变量

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL=mysql://user:password@host:port/database

# OpenAI (用于文档生成)
OPENAI_API_KEY=sk-...

# Stripe支付
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# IPFS (可选，付费用户功能)
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_PROJECT_ID=...
IPFS_PROJECT_SECRET=...

# Web3支付钱包地址
PAYMENT_WALLET_ADDRESS=0x...
```

### 启动服务

```bash
# 启动Web应用（前端+后端）
pnpm dev

# 启动AI服务
cd ai-service
python main.py
```

### 访问应用

- Web应用: http://localhost:3000
- AI服务: http://localhost:5000

## 📊 数据库Schema

### 核心表
- `users` - 用户账户
- `subscriptions` - 订阅管理
- `files` - 上传文件
- `documents` - 知识文档
- `tags` - 标签
- `documentTags` - 文档标签关联
- `contacts` - 联系人
- `companies` - 企业信息

## 🔐 安全特性

- JWT会话管理
- Stripe安全支付
- Web3钱包签名验证
- 文件访问权限控制
- HTTPS加密传输

## 📱 移动端开发计划

- [ ] React Native基础架构
- [ ] 摄像头实时拍照
- [ ] 离线模式和本地缓存
- [ ] Apple Pay / Google Pay集成
- [ ] 推送通知

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 📧 联系方式

- Email: everest9812@gmail.com
- GitHub: https://github.com/everest-an/Awareness-Network

---

**Awareness Network 2.0** - 让知识管理更智能
