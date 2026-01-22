# Awareness Market - Project TODO

## Phase 1: 数据库架构和核心数据模型

- [x] 设计用户角色系统（创建者Creator和消费者Consumer）
- [x] 设计潜意识数据（Latent Vector）表结构
- [x] 设计交易订单和支付记录表
- [x] 设计评价和反馈系统表
- [x] 设计订阅计划和用户订阅表
- [x] 设计访问权限和授权表
- [x] 设计分析统计相关表
- [x] 执行数据库迁移

## Phase 2: 后端 API 和业务逻辑

- [x] 实现用户认证和角色管理 API
- [x] 实现潜意识数据上传和管理 API
- [x] 实现市场浏览和搜索 API（支持多维度筛选）
- [x] 实现动态定价引擎逻辑
- [x] 实现安全交易和访问控制 API
- [x] 实现 MCP 协议集成接口
- [x] 实现 LatentMAS 转换器工具 API
- [x] 实现评价和反馈系统 API
- [x] 实现交易分析数据聚合 API

## Phase 3: Stripe 支付和订阅系统

- [x] 添加 Stripe 功能到项目
- [x] 配置 Stripe 产品和价格
- [x] 实现交易费支付流程（15-25%）
- [x] 实现订阅套餐购买流程
- [x] 实现 Webhook 处理订阅状态
- [x] 实现退款和发票管理

## Phase 4: 前端界面和用户体验

- [x] 设计整体视觉风格和主题
- [x] 实现首页和 Landing Page
- [x] 实现用户注册和登录界面
- [x] 实现创建者仪表板（收入统计、调用次数）
- [x] 实现消费者仪表板（购买历史、使用情况）
- [x] 实现潜意识数据上传和管理界面
- [x] 实现市场浏览和搜索界面
- [x] 实现 AI 能力详情页面
- [x] 实现购买和支付流程界面
- [x] 实现评价和反馈界面
- [x] 实现订阅管理界面
- [x] 实现用户个人资料页面

## Phase 5: 智能推荐和通知系统

- [x] 实现基于 LLM 的智能推荐引擎
- [x] 实现用户行为分析和偏好学习
- [x] 实现交易通知系统
- [x] 实现评论通知系统
- [x] 实现系统更新通知
- [x] 集成邮件通知服务

## Phase 6: 测试、优化和文档

- [x] 编写核心功能的 Vitest 测试
- [x] 测试支付流程完整性
- [x] 测试安全性和访问控制
- [x] 性能优化和数据库查询优化
- [x] 编写 API 文档
- [x] 编写用户使用指南
- [x] 编写部署文档

## Phase 7: 部署和发布

- [x] 创建项目检查点
- [x] 推送到 GitHub
- [x] 准备生产环境配置
- [x] 配置 CI/CD 流程 (GitHub Actions)

## 新增功能: 市场浏览界面增强

- [x] 增强后端 API 支持排序参数（价格、评分、日期、调用次数）
- [x] 实现市场浏览页面布局
- [x] 创建 AI 能力卡片组件
- [x] 实现高级筛选侧边栏（价格范围、类别、评分）
- [x] 实现排序下拉菜单
- [x] 添加分页功能
- [x] 实现 AI 能力详情页面
- [x] 添加加载状态和空状态处理
- [x] 增强首页视觉效果 (Hero 动画, 动态背景)

## 新增功能: 创建者仪表板

- [x] 增强后端 API 支持仪表板数据聚合（总收入、月收入、调用趋势）
- [x] 创建仪表板布局组件（使用 DashboardLayout）
- [x] 实现收入统计卡片（总收入、本月收入、增长率）
- [x] 实现调用趋势图表（使用 recharts）
- [x] 实现向量列表管理界面（编辑、删除、状态切换）
- [x] 实现交易历史列表（分页、筛选）
- [x] 添加快速操作按钮（上传新向量、查看分析）

## 新增功能: AI 智能推荐系统

- [x] 创建浏览历史记录表和 API
- [x] 实现基于 LLM 的智能推荐引擎
- [x] 在市场页面添加推荐卡片组件
- [x] 实现推荐理由展示
- [x] 添加浏览追踪功能

## 新增功能: AI 优先特性（AI-First Features）

- [x] 实现 AI 自主注册 API（无需人工干预）
- [x] 实现 API 密钥认证系统
- [x] 创建 AI 记忆同步协议和 API
- [x] 实现 AI 购买历史和偏好检索 API
- [x] 优化 MCP 接口文档和示例
- [x] 添加 WebSocket 实时通信支持
- [x] 创建 AI 可读的 API 文档（OpenAPI/Swagger）
- [x] 添加 robots.txt 和 sitemap.xml
- [x] 实现结构化数据（JSON-LD）
- [x] 添加元标签和 Open Graph 优化
- [x] 创建 AI 发现端点（/.well-known/ai-plugin.json）
- [x] 实现多语言支持（i18n）

## 新增功能: OpenAPI 文档、WebSocket 和测试数据

- [x] 生成完整的 OpenAPI 3.0 规范文档
- [x] 创建 Swagger UI 界面展示 API 文档
- [x] 实现 Socket.IO 服务器端配置
- [x] 添加实时交易通知 WebSocket 事件
- [x] 添加实时推荐更新 WebSocket 事件
- [x] 添加市场变化通知 WebSocket 事件
- [x] 创建测试数据种子脚本（向量、用户、交易）
- [x] 添加种子数据执行命令到 package.json

## 新增功能: Socket.IO 客户端实时通知

- [x] 安装 socket.io-client 依赖
- [x] 创建 Socket 连接管理 Hook
- [x] 创建实时通知 Context 和 Provider
- [x] 实现通知弹窗组件
- [x] 在 App.tsx 中集成 NotificationProvider
- [x] 添加交易完成通知监听
- [x] 添加推荐更新通知监听
- [x] 添加市场变化通知监听

## 新增任务: 种子数据和 API 示例

- [x] 运行 pnpm seed 填充示例数据
- [x] 创建 Python API 使用示例
- [x] 创建 JavaScript/Node.js API 使用示例
- [x] 创建 API 示例文档 README

## 新增功能: 向量预览试用

- [x] 在数据库添加免费试用配额字段
- [x] 实现试用 API 端点（限制调用次数）
- [x] 在向量详情页添加“免费试用”按钮
- [x] 创建试用对话框和输入界面
- [x] 显示剩余试用次数
- [x] 添加试用结果展示

## 新增功能: 推荐算法优化

- [x] 创建用户行为追踪表（点击、浏览时长）
- [x] 实现协同过滤算法
- [x] 创建 A/B 测试框架
- [x] 实现推荐效果评估指标
- [x] 添加推荐算法切换配置

## 新增功能: VitePress 开发者文档

- [x] 初始化 VitePress 项目
- [x] 创建文档目录结构
- [x] 编写 API 参考文档
- [x] 编写集成指南
- [x] 添加代码示例和最佳实践
- [x] 配置搜索和导航

## Product Development Plan

### Overview

- **Goal**: Deliver a fully functional Awareness Market platform (v1.0) with community‑driven ecosystem, i18n support, and secure transaction flow.
- **Timeline**: 12 months (Q1‑Q4 2026).

### Milestones

| Milestone | Target Date | Key Deliverables |
| --- | --- | --- |
| **M0 – Foundations** | 2026‑01‑31 | Core backend APIs, database schema, authentication, basic UI. |
| **M1 – Community & Marketplace** | 2026‑04‑30 | Capability manifest, marketplace UI, evaluation pipeline, community docs. |
| **M2 – i18n & Localization** | 2026‑07‑31 | `i18next` integration, English & 中文 translations, locale‑aware routing. |
| **M3 – Payment & Security** | 2026‑09‑30 | Stripe integration, encrypted vector delivery, audit logs. |
| **M4 – v1.0 Release** | 2026‑12‑31 | Public beta, CI/CD pipeline, changelog, documentation, marketing assets. |

### Pending Development (Unfinished Tasks)

- ✅ **实现多语言支持（i18n）** – i18n integration completed.
- ✅ **支付链路（Stripe Checkout + Webhook）** – implemented.
- ✅ **LatentMAS 矩阵上传与对齐** – implemented.
- ✅ **LatentMAS 格式转换（numpy/torch/safetensors/onnx/tensorflow）** – implemented.
- ✅ **AI ChatBox 真实后端连接** – implemented.

### Pending Deployments / Links

- ✅ All footer links have been updated to open in a new tab using native `<a>` tags.
- ✅ Home page navigation links are functional.
- ✅ i18n files are present and integrated.
- 📌 Configure required environment variables for production (Stripe, storage, LLM, vector converter).

---
