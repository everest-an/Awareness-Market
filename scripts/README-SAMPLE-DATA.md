# 示例数据生成说明

## 📁 文件说明

- **sample-data.json** - 15个示例产品的JSON数据（5个Vector + 5个Memory + 5个Chain）
- **generate-sample-packages-prisma.ts** - Prisma版本的数据生成脚本

## 🎯 快速开始

### 方法1：使用数据库脚本（推荐）

如果你已经配置好数据库连接：

```bash
# 1. 配置.env文件中的DATABASE_URL
# 例如本地MySQL:
DATABASE_URL="mysql://root:password@localhost:3306/awareness_market"

# 2. 运行数据生成脚本
pnpm tsx scripts/generate-sample-packages-prisma.ts
```

### 方法2：手动导入JSON数据

1. 查看 `scripts/sample-data.json` 了解数据结构
2. 使用数据库管理工具手动导入数据
3. 或编写自定义导入脚本

## 📊 数据概览

### Vector Packages (5个)
1. **GPT-4 → Claude-3.5 Sentiment Analysis** - $49.99
   - 金融新闻情感分析，94%准确率

2. **LLaMA-3 → GPT-4 Code Generation** - $79.99
   - Python代码生成专家

3. **CLIP → DALL-E 3 Image Understanding** - $99.99
   - 图像理解和视觉问答

4. **Whisper → GPT-4 Audio Transcription** - $59.99
   - 50+语言音频转录

5. **GPT-4 → Gemini Pro Multimodal Reasoning** - $119.99
   - 多模态推理和数据分析

### Memory Packages (5个)
1. **GPT-4 Financial Analysis Session** - $79.99
   - Q3 2024财报分析推理状态

2. **Claude-3 Legal Contract Review** - $129.99
   - 50+ SaaS合同审查记忆

3. **LLaMA-3 Code Debugging Session** - $59.99
   - 微服务架构调试会话

4. **GPT-4 Medical Diagnosis** - $149.99
   - 20+复杂医疗诊断推理

5. **Claude-3 Research Paper Analysis** - $99.99
   - NeurIPS 2024论文分析

### Chain Packages (5个)
1. **Algorithm Design: Dynamic Programming** - $49.99
   - 动态规划问题解决步骤

2. **Business Case: Market Entry** - $89.99
   - MBA级别市场进入分析

3. **System Design: Distributed Cache** - $99.99
   - 分布式缓存系统设计链

4. **Machine Learning: Model Selection** - $59.99
   - Kaggle级别模型选择

5. **Cybersecurity: Threat Analysis** - $119.99
   - CISO级别威胁分析方法

## 🔧 数据库配置

### 选项1：本地MySQL

```bash
# 安装MySQL (Windows)
# 从 https://dev.mysql.com/downloads/installer/ 下载安装

# 创建数据库
mysql -u root -p
CREATE DATABASE awareness_market;

# 更新.env
DATABASE_URL="mysql://root:your_password@localhost:3306/awareness_market"

# 运行Prisma迁移
pnpm prisma db push
```

### 选项2：免费Supabase PostgreSQL

```bash
# 1. 访问 https://supabase.com/ 创建免费项目

# 2. 获取连接字符串
# Supabase Dashboard → Settings → Database → Connection string (URI)

# 3. 更新.env
DATABASE_URL="postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres"

# 4. 运行Prisma迁移
pnpm prisma db push
```

## 🚀 验证数据

导入数据后，访问以下页面验证：

- Vector Packages: http://localhost:3000/vector-packages
- Memory Packages: http://localhost:3000/memory-packages
- Chain Packages: http://localhost:3000/chain-packages

## 📝 注意事项

1. **用户ID**: 所有示例数据使用 `creatorId: 1`，确保数据库中存在ID为1的用户
2. **URL**: 示例数据使用占位符URL，实际使用时需要真实的S3/R2 URL
3. **价格**: 使用字符串格式的Decimal (`"49.99"`)，Prisma会自动转换
4. **时间戳**: 运行脚本时自动生成，JSON数据需要手动添加

## 🐛 常见问题

**Q: DATABASE_URL连接失败**
A: 确保数据库服务运行中，并且.env中的连接字符串正确

**Q: Prisma schema不匹配**
A: 运行 `pnpm prisma db push` 同步schema到数据库

**Q: creatorId用户不存在**
A: 先创建ID为1的用户，或修改脚本使用你的用户ID

## 📚 相关文档

- [Prisma 文档](https://www.prisma.io/docs)
- [三条产品线架构](./.kiro/specs/three-product-lines-completion/design.md)
- [功能完整性报告](../docs/reports/FINAL_GAP_ANALYSIS_2026-02-03.md)

---

**生成时间**: 2026-02-03
**数据版本**: v1.0
**总产品数**: 15 (5 Vector + 5 Memory + 5 Chain)
