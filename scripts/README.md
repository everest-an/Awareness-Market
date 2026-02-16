# 🚀 自动化部署脚本

本目录包含自动化部署和测试脚本，用于快速部署自部署 LLM 服务。

---

## 📋 脚本列表

### 1. `deploy-vllm.sh` - vLLM 服务器部署

**用途**: 在 RunPod GPU Pod 上自动部署 vLLM 推理服务器

**功能**:
- ✅ 自动安装依赖（vLLM, FastAPI, PyTorch）
- ✅ 下载 Llama 3.1 8B 模型
- ✅ 创建 vLLM 服务器代码
- ✅ 启动服务器并验证
- ✅ 可选：创建 systemd 服务

**使用方法**:
```bash
# 在 RunPod Pod 内运行
export HF_TOKEN=your_huggingface_token
bash deploy-vllm.sh
```

**预计耗时**: 10-15 分钟（取决于网络速度）

---

### 2. `setup-env.sh` - 环境变量配置

**用途**: 自动配置 `.env` 文件以使用自部署 LLM

**功能**:
- ✅ 交互式配置向导
- ✅ 自动更新 `.env` 文件
- ✅ 验证配置正确性

**使用方法**:
```bash
# 在 Awareness Network 项目根目录运行
bash scripts/setup-env.sh
```

**交互式提示**:
1. vLLM 服务器地址（从 RunPod 获取）
2. 模型名称（默认：llama-3.1-8b）
3. RunPod API Key（可选）
4. RunPod Pod ID（可选）
5. 成本追踪提供商

---

### 3. `test-integration.sh` - 集成测试

**用途**: 测试自部署 LLM 集成是否正常工作

**功能**:
- ✅ 健康检查测试
- ✅ 隐藏状态提取测试
- ✅ RunPod 管理测试（如果配置）
- ✅ 成本统计测试
- ✅ 模型列表测试

**使用方法**:
```bash
# 确保后端正在运行
npm run dev

# 在另一个终端运行测试
bash scripts/test-integration.sh
```

**输出示例**:
```
======================================
  自部署 LLM 集成测试
======================================

[✓] 自部署 LLM 健康检查
[✓] 隐藏状态提取
[✓] 成本统计查询
[✓] 支持的模型列表

======================================
  测试结果
======================================

通过: 4
失败: 0

[✓] 所有测试通过！集成成功！
```

---

## 🎯 完整部署流程

### Step 1: 部署 vLLM 服务器（在 RunPod）

```bash
# 1. 注册 RunPod 账号
# 访问: https://runpod.io/

# 2. 创建 GPU Pod
# - GPU Type: RTX 4090
# - Template: PyTorch 2.1
# - Storage: 50GB

# 3. SSH 连接到 Pod
# 使用 RunPod Web Terminal 或 SSH

# 4. 获取 HuggingFace Token
# 访问: https://huggingface.co/settings/tokens

# 5. 运行部署脚本
export HF_TOKEN=hf_your_token_here
bash <(curl -s https://raw.githubusercontent.com/your-repo/scripts/deploy-vllm.sh)

# 或者手动下载并运行
curl -O https://raw.githubusercontent.com/your-repo/scripts/deploy-vllm.sh
bash deploy-vllm.sh
```

**部署完成后，记录以下信息**:
- Pod ID (例: `abc123def456`)
- 公网地址 (例: `https://abc123def456-8000.proxy.runpod.net`)

---

### Step 2: 配置 Awareness Network（在本地）

```bash
# 1. 进入项目目录
cd "e:/Awareness Market/Awareness-Network"

# 2. 运行配置脚本
bash scripts/setup-env.sh

# 按提示输入:
# - vLLM 服务器地址: https://your-pod-id-8000.proxy.runpod.net
# - 模型名称: llama-3.1-8b
# - RunPod API Key: (从 RunPod 控制台获取)
# - RunPod Pod ID: your-pod-id
# - 成本提供商: 1 (runpod-rtx-4090-spot)
```

---

### Step 3: 测试集成

```bash
# 1. 启动后端
npm run dev

# 2. 在另一个终端运行测试
bash scripts/test-integration.sh

# 3. 查看测试结果
# 所有测试应该通过 ✓
```

---

### Step 4: 训练第一个 W-Matrix

```bash
# 方法 1: 使用 tRPC API
curl -X POST http://localhost:3000/api/trpc/latentmas.trueLatentMAS.compileTextToLatent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Machine learning is a subset of artificial intelligence.",
    "sourceModel": "llama-3.1-8b",
    "latentSteps": 20,
    "enableRealign": true
  }'

# 方法 2: 使用前端 UI
# 访问: http://localhost:3000/latent-test
# 进入 "论文实现" 标签页
# 输入文本并点击 "编译到潜空间"
```

---

## 🔧 故障排查

### 问题 1: vLLM 服务器启动失败

**症状**: `curl http://localhost:8000/health` 返回错误

**解决方案**:
```bash
# 查看日志
tail -f /workspace/vllm.log

# 常见原因:
# 1. GPU 内存不足 -> 降低 GPU_MEMORY_UTILIZATION (0.9 -> 0.7)
# 2. 模型未下载完成 -> 检查 /workspace/models/llama-3.1-8b
# 3. 端口被占用 -> pkill -f vllm_server.py 后重启
```

---

### 问题 2: 连接超时

**症状**: `testSelfHostedHealth` 返回连接失败

**解决方案**:
```bash
# 1. 检查 .env 配置
grep VLLM_BASE_URL .env

# 2. 测试 RunPod 公网地址
curl https://your-pod-id-8000.proxy.runpod.net/health

# 3. 检查 Pod 是否运行
# 访问 RunPod 控制台确认 Pod 状态
```

---

### 问题 3: 隐藏状态维度不匹配

**症状**: 提取的隐藏状态维度不是 4096

**解决方案**:
```bash
# 这是正常的！不同模型有不同的隐藏状态维度:
# - Llama 3.1 8B: 4096
# - Qwen 2.5 7B: 4096
# - Llama 3.1 70B: 8192

# W-Matrix 训练会自动处理维度转换
```

---

## 📊 性能优化

### 批量处理优化

```typescript
// 批量提取隐藏状态（更高效）
const prompts = [/* 100 个 prompts */];
const results = await client.extractHiddenStates(prompts, -2);

// 而不是:
for (const prompt of prompts) {
  const result = await client.extractHiddenStates([prompt], -2);
}
```

### 智能 Pod 管理

```typescript
import { getGlobalRunPodManager } from './server/latentmas/clients/runpod-manager';

const manager = getGlobalRunPodManager();

// 自动启停（推荐）
const wMatrix = await manager.withAutoManage(async () => {
  return await trainWMatrixForModelPair({...});
});
// Pod 会自动停止，节省成本
```

---

## 💰 成本监控

### 实时成本查询

```bash
# API 查询
curl http://localhost:3000/api/trpc/latentmas.trueLatentMAS.getCostStats

# 输出:
# {
#   "success": true,
#   "stats": {
#     "dailyCost": "$0.05",
#     "monthlyCost": "$1.23",
#     "projectedMonthlyCost": "$18.45"
#   }
# }
```

### 导出成本数据

```bash
# 导出 CSV
curl http://localhost:3000/api/trpc/latentmas.trueLatentMAS.exportCostData > cost-report.csv

# 在 Excel/Google Sheets 中打开分析
```

---

## 🎓 高级用法

### 自定义 vLLM 配置

编辑 `/workspace/vllm_server.py`:

```python
# 调整 GPU 内存使用
GPU_MEMORY_UTILIZATION = 0.7  # 降低到 70%

# 调整最大序列长度
MAX_MODEL_LEN = 8192  # 增加到 8192

# 多 GPU 支持
TENSOR_PARALLEL_SIZE = 2  # 使用 2 个 GPU
```

### 添加新模型

```bash
# 下载新模型
huggingface-cli download Qwen/Qwen2.5-7B-Instruct \
  --local-dir /workspace/models/qwen-2.5-7b

# 修改 vllm_server.py
MODEL_PATH = "/workspace/models/qwen-2.5-7b"

# 重启服务器
pkill -f vllm_server.py
nohup python /workspace/vllm_server.py > /workspace/vllm.log 2>&1 &
```

---

## 📚 相关文档

- [集成总览](../docs/SELF_HOSTED_LLM_INTEGRATION.md)
- [快速部署指南](../docs/QUICK_START_LLAMA.md)
- [预算优化方案](../LATENTMAS_BUDGET_DEPLOYMENT.md)
- [实现状态](../docs/technical/LATENTMAS_IMPLEMENTATION_STATUS.md)

---

## 🆘 需要帮助？

**常见问题**:
1. 查看上面的故障排查部分
2. 检查日志文件（`/workspace/vllm.log`）
3. 访问文档目录获取更多信息

**获取支持**:
- GitHub Issues
- 项目文档
- 社区论坛

---

**祝部署顺利！🎉**
