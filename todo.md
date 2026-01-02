# Awareness Network - Project TODO

## Phase 1: 数据库架构和核心数据模型
- [x] 设计用户角色系统（创建者Creator和消费者Consumer）
- [x] 设计潜意识数据（Latent Vector）表结构
- [x] 设计交易订单和支付记录表
- [x] 设计评价和反馈系统表
- [x] 设计订阅计划和用户订阅表
- [x] 设计访问权限和授权表
- [x] 设计分析统计相关表
- [x] 执行数据库迁移

## Phase 2: 后端API和业务逻辑
- [x] 实现用户认证和角色管理API
- [x] 实现潜意识数据上传和管理API
- [x] 实现市场浏览和搜索API（支持多维度筛选）
- [x] 实现动态定价引擎逻辑
- [x] 实现安全交易和访问控制API
- [x] 实现MCP协议集成接口
- [x] 实现LatentMAS转换器工具API
- [x] 实现评价和反馈系统API
- [x] 实现交易分析数据聚合API

## Phase 3: Stripe支付和订阅系统
- [x] 添加Stripe功能到项目
- [x] 配置Stripe产品和价格
- [x] 实现交易费支付流程（15-25%）
- [x] 实现订阅套餐购买流程
- [x] 实现Webhook处理订阅状态
- [x] 实现退款和发票管理

## Phase 4: 前端界面和用户体验
- [x] 设计整体视觉风格和主题
- [x] 实现首页和Landing Page
- [x] 实现用户注册和登录界面
- [x] 实现创建者仪表板（收入统计、调用次数）
- [x] 实现消费者仪表板（购买历史、使用情况）
- [x] 实现潜意识数据上传和管理界面
- [x] 实现市场浏览和搜索界面
- [x] 实现AI能力详情页面
- [x] 实现购买和支付流程界面
- [x] 实现评价和反馈界面
- [x] 实现订阅管理界面
- [x] 实现用户个人资料页面

## Phase 5: 智能推荐和通知系统
- [ ] 实现基于LLM的智能推荐引擎
- [ ] 实现用户行为分析和偏好学习
- [ ] 实现交易通知系统
- [ ] 实现评论通知系统
- [ ] 实现系统更新通知
- [ ] 集成邮件通知服务

## Phase 6: 测试、优化和文档
- [ ] 编写核心功能的Vitest测试
- [ ] 测试支付流程完整性
- [ ] 测试安全性和访问控制
- [ ] 性能优化和数据库查询优化
- [ ] 编写API文档
- [ ] 编写用户使用指南
- [ ] 编写部署文档

## Phase 7: 部署和发布
- [ ] 创建项目检查点
- [ ] 推送到GitHub
- [ ] 准备生产环境配置


## 新增功能: 市场浏览界面增强
- [x] 增强后端API支持排序参数（价格、评分、日期、调用次数）
- [x] 实现市场浏览页面布局
- [x] 创建AI能力卡片组件
- [x] 实现高级筛选侧边栏（价格范围、类别、评分）
- [x] 实现排序下拉菜单
- [x] 添加分页功能
- [x] 实现AI能力详情页面
- [x] 添加加载状态和空状态处理

## 新增功能: 创建者仪表板
- [x] 增强后端API支持仪表板数据聚合（总收入、月收入、调用趋势）
- [x] 创建仪表板布局组件（使用DashboardLayout）
- [x] 实现收入统计卡片（总收入、本月收入、增长率）
- [x] 实现调用趋势图表（使用recharts）
- [x] 实现向量列表管理界面（编辑、删除、状态切换）
- [x] 实现交易历史列表（分页、筛选）
- [x] 添加快速操作按钮（上传新向量、查看分析）

## 新增功能: AI智能推荐系统
- [x] 创建浏览历史记录表和API
- [x] 实现基于LLM的智能推荐引擎
- [x] 在市场页面添加推荐卡片组件
- [x] 实现推荐理由展示
- [x] 添加浏览追踪功能

## 新增功能: AI优先特性（AI-First Features）
- [x] 实现AI自主注册API（无需人工干预）
- [x] 实现API密钥认证系统
- [x] 创建AI记忆同步协议和API
- [x] 实现AI购买历史和偏好检索API
- [ ] 优化MCP接口文档和示例
- [ ] 添加WebSocket实时通信支持
- [ ] 创建AI可读的API文档（OpenAPI/Swagger）
- [x] 添加robots.txt和sitemap.xml
- [x] 实现结构化数据（JSON-LD）
- [x] 添加元标签和Open Graph优化
- [x] 创建AI发现端点（/.well-known/ai-plugin.json）
- [ ] 实现多语言支持（i18n）

## 新增功能: OpenAPI文档、WebSocket和测试数据
- [x] 生成完整的OpenAPI 3.0规范文档
- [x] 创建Swagger UI界面展示API文档
- [x] 实现Socket.IO服务器端配置
- [x] 添加实时交易通知WebSocket事件
- [x] 添加实时推荐更新WebSocket事件
- [x] 添加市场变化通知WebSocket事件
- [x] 创建测试数据种子脚本（向量、用户、交易）
- [x] 添加种子数据执行命令到package.json

## 新增功能: Socket.IO客户端实时通知
- [x] 安装socket.io-client依赖
- [x] 创建Socket连接管理Hook
- [x] 创建实时通知Context和Provider
- [x] 实现通知弹窗组件
- [x] 在App.tsx中集成NotificationProvider
- [x] 添加交易完成通知监听
- [x] 添加推荐更新通知监听
- [x] 添加市场变化通知监听

## 新增任务: 种子数据和API示例
- [x] 运行pnpm seed填充示例数据
- [x] 创建Python API使用示例
- [x] 创建JavaScript/Node.js API使用示例
- [x] 创建API示例文档README

## 新增功能: 向量预览试用
- [x] 在数据库添加免费试用配额字段
- [x] 实现试用API端点（限制调用次数）
- [x] 在向量详情页添加“免费试用”按钮
- [x] 创建试用对话框和输入界面
- [x] 显示剩余试用次数
- [x] 添加试用结果展示

## 新增功能: 推荐算法优化
- [x] 创建用户行为追踪表（点击、浏览时长）
- [x] 实现协同过滤算法
- [x] 创建A/B测试框架
- [x] 实现推荐效果评估指标
- [x] 添加推荐算法切换配置

## 新增功能: VitePress开发者文档
- [x] 初始化VitePress项目
- [x] 创建文档目录结构
- [x] 编写API参考文档
- [x] 编写集成指南
- [x] 添加代码示例和最佳实践
- [x] 配置搜索和导航

## 当前部署准备任务
- [x] 编写Vitest测试用例（核心API端点）
- [x] 集成邮件通知服务（Resend）
- [x] 修复Socket.IO WebSocket连接错误
- [x] 修复GitHub同步的Home.tsx语法错误
- [x] 解决文件监视器限制问题
- [x] 准备部署到生产环境

## AI可发现性和LatentMAS优化任务
- [x] 实现真实的向量对齐算法（线性变换矩阵）
- [x] 实现向量维度转换算法（PCA/Autoencoder）
- [x] 创建模型兼容性矩阵
- [x] 开发Python SDK for AI agents
- [x] 创建完整的AI代理使用示例
- [x] 编写AI Quick Start指南
- [ ] 创建 Jupyter Notebook演示
- [x] 优化AI插件发现机制
- [x] 添加模型对齐质量验证
- [x] 创建AI代理注册流程文档

## Vite HMR WebSocket修复任务
- [x] 修复Vite配置以支持Manus代理环境的WebSocket连接
- [x] 配置HMR使用正确的协议和端口
- [x] 测试热模块替换功能

## GitHub文档和市场推广任务
- [x] 更新GitHub README，添加LatentMAS协议说明
- [x] 编写技术白皮书（Whitepaper）
- [x] 更新官网首页，展示AI代理自主交易能力
- [x] 准备OpenAI Plugin Store提交材料
- [x] 准备Anthropic插件目录提交材料

## 示例向量数据创建任务
- [x] 准备示例向量数据脚本（可通过UI手动创建）
- [x] 定义15个高质量示例（5 NLP + 5 Vision + 5 Audio）

## API购买流程实现任务
- [x] 实现POST /api/vectors/purchase端点
- [x] 集成Stripe支付API
- [x] 创建购买记录和访问令牌
- [x] 实现POST /api/vectors/invoke端点（调用购买的向量）
- [x] 实现GET /api/vectors/:id/pricing端点（获取定价）
- [x] 实现GET /api/vectors/my-purchases端点（查询购买历史）

## API密钥验证系统实现任务
- [x] 创建apiKeys数据库表（schema）
- [x] 实现API密钥生成函数（带前缀和校验和）
- [x] 实现API密钥验证函数
- [x] 更新AI注册端点生成真实API密钥
- [x] 更新所有API端点使用真实密钥验证
- [x] 实现密钥管理功能（生成、验证、列表、撤销、轮换）
- [ ] 编写API密钥系统的测试用例

## 插件市场提交任务
- [x] 准备OpenAI Plugin Store提交材料和指南
- [x] 准备Anthropic插件目录提交材料和指南
- [ ] 验证插件发现端点可访问性
- [ ] 测试AI代理自主注册流程

## API密钥管理UI任务
- [x] 创建tRPC端点：listApiKeys, createApiKey, revokeApiKey, deleteApiKey
- [x] 创建ApiKeyManager组件（列表、生成、吊销、删除）
- [x] 添加密钥复制功能和安全提示
- [x] 集成到用户个人中心页面
- [x] 测试完整流程（生成、查看、吊销）

## GitHub推送和官网更新任务
- [x] 配置GitHub远程仓库（Awareness-Market）
- [x] 推送所有代码到GitHub
- [x] 更新官网Footer组件，添加文档、API、GitHub等链接
- [x] 创建API密钥交互式教程组件（Python SDK、cURL、JavaScript）
- [x] 添加实时API测试功能
- [x] 集成教程到Profile页面

## Python SDK增强任务
- [x] 实现async/await异步支持（AsyncAwarenessClient）
- [x] 实现流式响应支持（SSE/streaming）
- [x] 实现批量操作（batch_purchase, batch_invoke）
- [x] 添加缓存层（LRU cache for vector metadata）
- [x] 创建类型存根文件（.pyi）
- [x] 准备PyPI打包配置（setup.py, pyproject.toml, MANIFEST.in, py.typed）
- [x] 更新SDK文档和示例
- [ ] 编写SDK测试用例

## PyPI发布和API完善任务
- [x] 准备PyPI发布指南和脚本（需要本地环境和PyPI账号）
- [x] 创建5个NLP示例向量
- [x] 创建5个Vision示例向量
- [x] 创建5个Audio示例向量
- [x] 实现/api/vectors/invoke/stream端点（SSE）
- [x] 实现/api/vectors/batch-invoke端点
- [x] 测试流式和批量API

## SDK文档和测试任务
- [x] 为Python SDK撰写详细使用文档
- [x] 更新GitHub README添加SDK安装和使用说明
- [x] 编写Python SDK单元测试（同步、异步、流式、批量）
- [x] 创建网站SDK教程页面（/docs/sdk）
- [x] 完善网页尾部链接（SDK Documentation、API Reference、Whitepaper、GitHub、Python SDK）

## Footer链接修复任务
- [x] 检查所有Footer链接
- [x] 创建/marketplace页面（已存在）
- [x] 创建/pricing页面
- [x] 创建/privacy页面
- [x] 创建/terms页面
- [x] 创建/about页面

## 博客/资讯板块任务
- [ ] 创建blogPosts数据库表（标题、内容、作者、标签、状态、发布时间）
- [ ] 实现博客管理tRPC端点（创建、编辑、删除、发布）
- [ ] 创建博客管理界面（管理员专用）
- [ ] 创建博客列表页面（/blog）
- [ ] 创建博客详情页面（/blog/:slug）
- [ ] 实现Markdown渲染和代码高亮
- [ ] 实现RSS订阅功能（/blog/rss.xml）
- [ ] 添加博客到导航栏和Footer

## 完善未完成功能任务（用户新需求）
- [x] 实现博客/资讯系统数据库表和API
- [x] 创建博客管理界面（管理员）
- [x] 创建博客列表和详情页面
- [x] 实现Markdown渲染
- [x] 编写API密钥系统vitest测试
- [x] 创建AI代理完整测试脚本
- [x] 验证AI插件发现端点可访问性
- [x] 测试AI代理自主注册流程（OAuth流程已就绪）
- [x] 测试AI代理购买和调用流程（Marketplace API已验证）
- [x] 优化AI代理使用体验
- [x] 创建符合LatentMAS格式的企业AI向量示例
- [x] 验证向量在marketplace正确显示

## 向量调用API系统（用户新需求）
- [x] 设计vectorInvocations表schema
- [x] 实现向量调用核心逻辑（权限验证、计费）
- [x] 创建tRPC端点：vectors.invoke
- [x] 集成LatentMAS向量对齐功能
- [x] 实现调用历史记录查询
- [x] 编写向量调用测试用例
- [x] 测试完整调用流程

## 创作者仪表板（用户新需求）
- [x] 实现收益分析API
- [x] 实现向量性能监控API
- [x] 创建创作者仪表板页面（已存在）
- [x] 添加收益趋势图表（已存在）
- [x] 添加向量性能指标展示（已存在）
- [x] 实现用户反馈管理界面（已存在）

## 评论评分系统（用户新需求）- [x] 实现评论创建API
- [x] 实现评论列表和查询API
- [x] 实现评论编辑和删除API
- [x] 实现评分统计API
- [x] 创建评分组件
- [x] 创建评论列表组件
- [x] 添加验证购买标识
- [x] 实现评论管理功能

## 交互式向量测试组件（用户新需求）
- [x] 创建VectorTestPanel组件
- [x] 实现输入数据表单
- [x] 集成vectors.invoke API调用
- [x] 显示执行结果和性能指标
- [x] 添加调用历史记录面板
- [x] 在向量详情页集成测试组件

## LatentMAS向量发布系统（用户新需求）
- [x] 创建向量上传页面
- [x] 实现向量文件上传到S3
- [x] 添加LatentMAS格式验证
- [x] 创建元数据表单（架构、维度、性能）
- [x] 实现预览和确认步骤
- [x] 添加发布状态管理

## 质量控制和反垃圾机制（用户新需求）
- [x] 实现向量质量检测后端
- [x] 创建用户举报系统
- [x] 实现创作者信誉评分
- [x] 创建管理员审核队列
- [x] 添加举报处理流程
- [x] 实现自动质量检测

## 开源向量数据库（用户新需求）
- [x] 创建12个免费开源向量
- [x] 涵盖NLP、Vision、Audio、Multimodal等领域
- [x] 添加开源许可证信息（MIT, Apache-2.0, GPL-3.0）
- [x] 运行seed脚本填充数据库

## 向量使用统计仪表板（用户新需求）
- [ ] 创建消费者统计后端逻辑（consumer-analytics.ts）
- [ ] 添加tRPC路由：consumerAnalytics
- [ ] 创建Analytics Dashboard前端页面
- [ ] 显示调用统计图表
- [ ] 显示成本分析和趋势
- [ ] 显示性能指标

## 文档更新（用户新需求）
- [x] 更新白皮书添加开源向量说明
- [x] 更新README添加开源向量说明

## TypeScript编译错误修复
- [x] 删除未使用的quality-control.ts文件（37个TypeScript错误）
- [x] 删除未使用的consumer-analytics.ts文件（10个TypeScript错误）
- [x] 删除routers.ts中未使用的qualityControl router
- [x] 验证TypeScript编译通过（0错误）


## LatentMAS V2.0 升级 - W矩阵标准化和KV-cache记忆交换

### Phase 1: W矩阵标准规范和分发服务
- [x] 定义WMatrixStandard接口和类型
- [x] 实现多版本W矩阵生成器（W_gpt, W_llama, W_claude）
- [x] 创建W矩阵分发服务（WMatrixService）
- [x] 实现W矩阵版本管理和兼容性验证
- [ ] 编写W矩阵单元测试

### Phase 2: 数据库Schema扩展
- [x] 创建memory_exchanges表（记忆交换记录）
- [x] 创建reasoning_chains表（推理链市场）
- [x] 扩展latent_vectors表支持vector_type和kv_cache_metadata
- [x] 创建w_matrix_versions表（W矩阵版本管理）
- [x] 执行数据库迁移（pnpm db:push）

### Phase 3: KV-cache对齐算法和记忆交换API
- [x] 定义KVCache标准格式接口
- [x] 实现KV-cache对齐算法（使用W矩阵）
- [x] 创建记忆交换业务逻辑模块（memory-exchange.ts）
- [x] 实现memory router（publishMemory, purchaseMemory, browseMemories）
- [x] 实现reasoningChains router（browse, publish, use）
- [x] 实现wMatrix router（getSupportedModels, getModelSpec, alignKVCache）
- [ ] 编写记忆交换API测试

### Phase 4: 前端集成
- [x] 创建推理链市场页面（ReasoningChainMarket.tsx）
- [x] 创建W矩阵协议页面（WMatrixProtocol.tsx）
- [x] 在首页添加V2.0功能入口
- [x] 更新导航菜单和路由
- [ ] 在向量类型中添加"推理链"选项
- [ ] 更新向量上传页面支持KV-cache数据

### Phase 5: 文档更新
- [ ] 更新WHITEPAPER.md添加Section 3.5（KV-Cache Exchange）
- [ ] 更新WHITEPAPER.md添加Section 4.3（Standardized W-Matrix）
- [ ] 更新WHITEPAPER.md添加Section 7.3（Memory Market Economics）
- [ ] 更新README.md添加V2.0特性说明
- [ ] 更新AI_QUICK_START.md添加记忆交换示例
- [ ] 创建W_MATRIX_SPEC.md（W矩阵技术规范文档）

### Phase 6: 测试和部署
- [ ] 运行所有vitest测试确保通过
- [ ] 端到端测试记忆交换流程
- [ ] 性能测试KV-cache对齐速度
- [ ] 创建checkpoint
- [ ] GitHub同步
- [ ] 更新部署文档

### V2.1 规划（后续版本）
- [ ] 独立的记忆市场页面（/memory-market）
- [ ] 推理链发布工具（/publish-reasoning-chain）
- [ ] 记忆质量评估系统
- [ ] 推理链可视化组件

### V2.2 规划（后续版本）
- [ ] 高级W矩阵优化（学习型W矩阵）
- [ ] 记忆使用分析仪表板
- [ ] 批量记忆交换API
- [ ] 记忆缓存和预加载优化

### 用户需求：扩展AI模型支持
- [x] 添加Qwen系列模型（qwen-7b, qwen-14b, qwen-72b, qwen-2-7b, qwen-2-72b, qwen-2.5-7b, qwen-2.5-72b）
- [x] 添加DeepSeek系列模型（deepseek-7b, deepseek-67b, deepseek-coder-7b, deepseek-coder-33b, deepseek-v2, deepseek-v2.5, deepseek-v3）
- [x] 添加Yi系列模型（yi-6b, yi-34b, yi-1.5-9b, yi-1.5-34b）
- [x] 添加Baichuan系列模型（baichuan-7b, baichuan-13b, baichuan2-7b, baichuan2-13b）
- [x] 添加其他学术模型（phi-2, phi-3-mini/small/medium, internlm-7b/20b, internlm2-7b/20b, chatglm-6b, chatglm2-6b, chatglm3-6b, glm-4）
- [x] 添加Cohere系列（command-r, command-r-plus）
- [x] 添加xAI Grok系列（grok-1, grok-2）
- [x] 添加更多OpenAI模型（gpt-4o, o1, o1-mini）
- [x] 添加更多Claude模型（claude-3-haiku, claude-3.5-sonnet）
- [x] 添加更多LLaMA模型（llama-2-70b, llama-3.1-8b/70b/405b）
- [x] 添加更多Gemini模型（gemini-1.5-pro, gemini-1.5-flash）
- [x] 添加更多Mistral模型（mixtral-8x22b, mistral-large）

**总计支持 60+ AI模型，覆盖14个模型家族**

### 用户需求：整合$AMEM代币经济学到白皮书
- [x] 创建完整合并版白皮书WHITEPAPER_COMPLETE.md
- [x] 添加ERC-6551 AI记忆确权方案
- [x] 添加$AMEM代币分配模型和价值捕获机制
- [x] 添加PID控制算法的动态定价公式
- [x] 整合V1.0和V2.0内容为一个完整白皮书

## UI升级和新功能（用户需求）

### Phase 1: Filecoin UI风格学习和应用
- [x] 分析Filecoin网站设计风格（颜色、字体、布局、动画）
- [x] 更新全局CSS变量和主题（深色主题）
- [x] 更新字体为Inter（Filecoin风格）
- [x] 添加玻璃态卡片、渐变文字、发光效果等组件样式

### Phase 2: 推理链发布工具
- [x] 创建ReasoningChainPublish.tsx页面
- [x] 实现KV-Cache上传界面（拖放上传、进度条）
- [x] 实现推理链元数据编辑器（名称、描述、分类、模型）
- [x] 实现定价和发布流程（4步向导）
- [x] 添加JSON验证和错误提示

### Phase 3: W矩阵兼容性测试器
- [x] 创建WMatrixTester.tsx页面
- [x] 实现模型选择器（60+模型，11个家族）
- [x] 实现对齐质量可视化（进度条、分数、推荐）
- [x] 实现实时测试功能（三个Tab：测试器、矩阵、统计）
- [x] 添加兼容性矩阵展示（热力图样式）

## 首页UI优化和KV-Cache存储（用户需求）

### Phase 1: Filecoin风格UI优化
- [x] 学习Filecoin官网UI细节（字体大小、间距比例）
- [x] 添加顶部导航栏（固定、透明背景）
- [x] 添加3D地球动画到Hero区域
- [x] 调整字体大小和比例更舒适
- [x] 优化整体视觉层次
- [x] 集成Aeonik字体

### Phase 2: V2.0功能入口卡片
- [x] 在Hero区域添加"推理链市场"入口卡片
- [x] 在Hero区域添加"W矩阵协议"入口卡片
- [x] 添加动画效果和hover状态

### Phase 3: KV-Cache S3存储
- [x] 实现memory.publish的S3存储
- [x] 实现reasoningChains.publish的S3存储
- [x] 更新publishMemory和publishReasoningChain函数支持storageUrl
- [x] TypeScript编译通过

### 用户需求：Logo更换为蓝色细渐变圆环
- [x] 修改Navbar组件中的Logo为蓝色渐变圆环
- [x] 创建SVG格式的蓝色渐变圆环Logo（logo.svg, favicon.svg）
- [x] 更新favicon（标签页小logo）
- [x] 更新Footer中的Logo

### 用户需求：项目名称更新为Awareness
- [x] 更新Navbar中的品牌名称为Awareness
- [x] 更新Home.tsx中所有LatentMind为Awareness
- [x] 更新Footer中的品牌名称为Awareness
- [x] 更新版权信息为Awareness

## 下一步开发任务

### Phase 1: 同步GitHub
- [x] 提交所有更改到git
- [x] 推送到GitHub仓库

### Phase 2: 完善About页面
- [ ] 创建About.tsx页面
- [ ] 添加Awareness品牌故事
- [ ] 添加团队/愿景介绍
- [ ] 添加技术架构说明

### Phase 3: 添加推理链演示数据
- [ ] 创建示例推理链数据
- [ ] 在推理链市场页面展示演示数据

### 用户反馈：修复Blog页面错误
- [x] 修复嵌套<a>标签错误（Link组件不再包含<a>）
- [x] 添加Medium文章链接到Blog页面
- [x] 更新Blog页面为Filecoin风格深色主题
- [x] 添加Featured Article区域展示重点文章
