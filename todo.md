# Awareness Network 2.0 - 项目待办事项

## 🎉 项目状态：核心功能已完成，可以部署使用！

**已完成：**
- ✅ 8个数据库表 + 30+ tRPC API
- ✅ PaddleOCR免费OCR + GPT-4o文档生成
- ✅ Web端8个页面 + 移动端9个页面
- ✅ Stripe支付 + 订阅管理 + 15天免费试用
- ✅ S3存储 + IPFS服务模块
- ✅ Web3钱包USDT支付组件

**总代码量：6,500+ 行**

## Phase 1: 数据库Schema和核心API (当前阶段)

- [x] 扩展数据库Schema（subscriptions, files, documents, tags, document_tags, contacts, companies表）
- [x] 实现用户订阅管理API（创建、查询、更新订阅状态）
- [x] 实现文件上传API（支持Cloudflare R2存储）
- [x] 实现文档管理API（创建、查询、更新、删除知识文档）
- [x] 实现标签管理API（创建、关联、查询标签）
- [x] 实现联系人管理API（创建、查询、更新联系人）

## Phase 2: Web端界面开发

- [x] 设计并实现首页（Landing Page）
- [x] 实现用户仪表盘（Dashboard）布局
- [x] 实现文件上传界面（支持拖拽和摄像头拍照）
- [x] 实现知识文档列表和详情页
- [ ] 实现标签管理界面
- [x] 实现联系人列表和详情页
- [x] 实现搜索功能界面

## Phase 3: AI处理服务集成

- [x] 创建AI处理服务（FastAPI）
- [x] 集成PaddleOCR进行免费OCR识别（替代OpenAI Vision）
- [x] 实现知识文档自动生成功能（使用GPT-4o）
- [x] 实现AI摘要和关键词提取
- [x] 集成企业信息查询（使用GPT-4o搜索）
- [ ] 实现文本向量化（用于语义搜索）
- [ ] 实现任务队列（BullMQ + Redis）
- [x] 创建主应用与AI服务的通信接口
- [x] 实现文件上传组件（支持拖拽和摄像头）
- [x] 实现OCR处理流程界面
- [x] 实现知识文档展示和编辑界面
- [x] 集成实时处理进度显示

## Phase 4: 多登录方式和支付系统

- [x] 创建Web3钱包连接组件（ethers.js + MetaMask）
- [x] 实现USDT支付功能
- [ ] 实现Web3钱包登录（签名验证）
- [ ] 实现社交登录（Google OAuth）
- [x] 集成Stripe SDK和产品定义
- [x] 创建Stripe Checkout Session API
- [x] 实现Stripe Webhook处理
- [x] 创建订阅管理tRPC路由
- [x] 创建订阅管理前端页面
- [x] 实现15天免费试用逻辑
- [x] 实现订阅状态检查中间件
- [x] 实现存储配额管理
- [x] 集成订阅检查到文件上传API
- [ ] 完善支付成功/失败回调处理

## Phase 5: 分布式存储和隐私保护

- [x] 集成S3存储（Manus内置）
- [x] 实现文件上传到S3的工作流
- [x] 创建IPFS存储服务模块
- [x] 扩展files表支持IPFS CID和多存储类型
- [x] 创建IPFS路由和上传工作流
- [x] 集成IPFS到主路由
- [ ] 前端IPFS上传界面
- [ ] （可选）集成Arweave永久存储
- [ ] 实现文件元数据管理
- [ ] 实现文件访问权限控制

## Phase 6: 移动端App开发

- [x] 创建移动端项目结构（React Native 0.73）
- [x] 配置包管理和依赖
- [x] 创建tRPC客户端集成
- [x] 实现导航系统（Stack + Bottom Tabs）
- [x] 创建HomeScreen首页
- [x] 创建CameraScreen相机拍照页面
- [x] 创建DocumentsScreen文档列表页面
- [x] 创建DocumentDetailScreen文档详情页面
- [x] 创建ContactsScreen联系人列表页面
- [x] 创建ContactDetailScreen联系人详情页面
- [x] 创建ProfileScreen个人中心页面
- [x] 创建LoginScreen登录页面
- [x] 创建SubscriptionScreen订阅管理页面
- [ ] 实现离线模式和本地缓存
- [ ] 集成移动端支付（Apple Pay / Google Pay）
- [ ] 实现推送通知
- [ ] Android和iOS打包配置
- [ ] 发布到Google Play和App Store

## Phase 7: 测试和优化

- [ ] 编写单元测试（后端API）
- [ ] 编写集成测试（AI工作流）
- [ ] 编写E2E测试（用户核心流程）
- [ ] 性能优化（数据库查询、API响应时间）
- [ ] 安全审计（SQL注入、XSS、CSRF防护）
- [ ] 负载测试和扩展性验证

## Phase 8: 部署和文档

- [ ] 编写部署文档（Docker + Kubernetes）
- [ ] 配置CI/CD流水线
- [ ] 编写API文档
- [ ] 编写用户使用手册
- [ ] 编写商业化运营指南
- [ ] 准备App Store和Google Play提交材料


## Phase 7: UI重设计和GitHub推送

- [ ] 分析现有官网UI风格（颜色、字体、布局、组件风格）
- [ ] 提取官网设计系统（主色调、辅助色、圆角、阴影等）
- [ ] 重新设计Home.tsx首页匹配官网风格
- [ ] 重新设计Dashboard.tsx仪表盘
- [ ] 更新所有页面组件的UI风格
- [ ] 更新Tailwind CSS配置匹配官网色系
- [ ] 配置GitHub远程仓库
- [ ] 推送所有代码到GitHub
- [ ] 验证GitHub仓库完整性
- [ ] 创建完整的英文README.md
- [ ] 添加代码注释和文档


## Phase 9: 分离部署到生产环境

### 前端部署（Vercel - awareness.market）
- [x] 安装Vercel CLI
- [ ] 创建纯前端构建配置
- [ ] 配置API代理到后端服务
- [ ] 部署前端到Vercel
- [ ] 配置awareness.market域名

### 后端API部署（Railway - api.awareness.market）
- [ ] 创建Railway账号和项目
- [ ] 配置后端Dockerfile
- [ ] 设置环境变量
- [ ] 部署后端到Railway
- [ ] 配置api.awareness.market域名

### AI服务部署（Railway - ai.awareness.market）
- [ ] 创建AI服务Dockerfile
- [ ] 部署AI服务到Railway
- [ ] 配置ai.awareness.market域名

### 最终验证
- [ ] 测试前后端连接
- [ ] 测试AI服务调用
- [ ] 测试完整工作流


## Phase 10: AWS部署后的完善和优化

### 修复现有问题
- [x] 修复前端环境变量显示问题 (VITE_APP_TITLE等)
- [ ] 更新后端MongoDB连接字符串(使用认证)
- [ ] 配置正确的API端点连接
- [ ] 测试前后端集成
- [ ] 修复404路由问题
- [x] 添加健康检查端点

### 标签管理界面开发
- [x] 创建标签管理页面
- [x] 实现标签创建功能
- [ ] 实现标签编辑功能
- [ ] 实现标签删除功能
- [x] 实现标签搜索和过滤

### 前端IPFS上传界面
- [ ] 创建IPFS上传组件
- [ ] 实现IPFS上传进度显示
- [ ] 添加IPFS文件列表
- [ ] 实现IPFS文件预览

### Web3钱包登录
- [ ] 实现Web3钱包登录（签名验证）
- [ ] 创建Web3登录页面
- [ ] 集成MetaMask连接
- [ ] 实现签名验证逻辑

### 社交登录
- [ ] 实现Google OAuth登录
- [ ] 配置Google OAuth应用
- [ ] 创建OAuth回调处理
- [ ] 集成到登录页面

### 支付系统完善
- [ ] 完善支付成功回调处理
- [ ] 完善支付失败回调处理
- [ ] 添加支付状态通知
- [ ] 实现支付历史记录

### 文本向量化和语义搜索
- [ ] 实现文本向量化功能
- [ ] 集成向量数据库
- [ ] 实现语义搜索API
- [ ] 创建语义搜索界面

### 任务队列系统
- [ ] 安装和配置Redis
- [ ] 实现BullMQ任务队列
- [ ] 创建AI处理任务队列
- [ ] 实现任务状态监控

### 文件元数据和权限
- [ ] 实现文件元数据管理
- [ ] 实现文件访问权限控制
- [ ] 添加文件分享功能
- [ ] 实现文件版本控制

### 移动端完善
- [ ] 实现离线模式和本地缓存
- [ ] 集成移动端支付（Apple Pay / Google Pay）
- [ ] 实现推送通知
- [ ] Android和iOS打包配置
- [ ] 发布到Google Play和App Store

### 测试和优化
- [ ] 编写单元测试（后端API）
- [ ] 编写集成测试（AI工作流）
- [ ] 编写E2E测试（用户核心流程）
- [ ] 性能优化（数据库查询、API响应时间）
- [ ] 安全审计（SQL注入、XSS、CSRF防护）
- [ ] 负载测试和扩展性验证

### 部署和文档
- [ ] 编写部署文档（Docker + Kubernetes）
- [ ] 配置CI/CD流水线
- [ ] 编写API文档
- [ ] 编写用户使用手册
- [ ] 编写商业化运营指南

---

**Phase 10 添加时间**: 2025年11月5日

**最近更新**: 2025年11月5日 15:00
- [x] 修复前端环境变量显示问题 (VITE_APP_TITLE等) - 已更新默认值
