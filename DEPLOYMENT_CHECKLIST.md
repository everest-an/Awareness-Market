# ✅ 自部署 LLM 部署检查清单

> 使用本清单确保部署步骤完整无遗漏

---

## 📋 部署前准备

### 1. 账号注册

- [ ] RunPod 账号已注册
  - [ ] 访问 https://runpod.io/ 注册
  - [ ] 完成邮箱验证
  - [ ] 添加支付方式（信用卡/借记卡）
  - [ ] 充值 $25（赠送 $25 = $50 总额）

- [ ] HuggingFace 账号已注册
  - [ ] 访问 https://huggingface.co/ 注册
  - [ ] 访问 https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
  - [ ] 接受 Meta 的许可协议
  - [ ] 生成 Access Token: https://huggingface.co/settings/tokens
  - [ ] 记录 Token: `hf_____________________`

### 2. 本地环境

- [ ] Node.js 已安装 (v18+)
  - [ ] 运行 `node --version` 验证

- [ ] Git 已安装
  - [ ] 运行 `git --version` 验证

- [ ] 项目依赖已安装
  - [ ] 运行 `npm install`

---

## 🚀 部署步骤

### Phase 1: 创建 GPU Pod (5 分钟)

- [ ] 登录 RunPod 控制台
- [ ] 点击 "Deploy" → "GPU Instance"
- [ ] 选择配置：
  - [ ] GPU Type: **RTX 4090** (24GB VRAM)
  - [ ] Pricing: **Spot** (最便宜)
  - [ ] Template: **PyTorch 2.1**
  - [ ] Volume Size: **50GB**
- [ ] 点击 "Deploy On-Demand"
- [ ] 等待 Pod 启动（30-60 秒）
- [ ] 记录 Pod 信息：
  - [ ] Pod ID: `_________________`
  - [ ] 公网地址: `https://_______________-8000.proxy.runpod.net`

### Phase 2: 部署 vLLM 服务器 (10 分钟)

#### 2.1 连接到 Pod

- [ ] 点击 Pod 的 "Connect" 按钮
- [ ] 选择 "Start Web Terminal" 或使用 SSH
- [ ] 确认在 `/workspace` 目录

#### 2.2 下载部署脚本

```bash
# 方法 1: 直接运行（推荐）
export HF_TOKEN=hf_your_token_here
bash <(curl -sSL https://raw.githubusercontent.com/your-repo/scripts/deploy-vllm.sh)
```

或手动执行：

- [ ] 安装依赖
  ```bash
  pip install vllm==0.6.0 fastapi uvicorn python-multipart
  ```

- [ ] 登录 HuggingFace
  ```bash
  huggingface-cli login --token hf_your_token_here
  ```

- [ ] 下载模型（需要 5-10 分钟）
  ```bash
  huggingface-cli download meta-llama/Llama-3.1-8B-Instruct \
    --local-dir /workspace/models/llama-3.1-8b \
    --local-dir-use-symlinks False
  ```

- [ ] 创建服务器代码
  ```bash
  # 从 QUICK_START_LLAMA.md 复制 vllm_server.py 代码
  nano /workspace/vllm_server.py
  # 粘贴代码并保存 (Ctrl+X, Y, Enter)
  ```

- [ ] 启动服务器
  ```bash
  nohup python /workspace/vllm_server.py > /workspace/vllm.log 2>&1 &
  ```

- [ ] 等待服务器启动（30 秒）
  ```bash
  sleep 30
  ```

#### 2.3 验证部署

- [ ] 测试健康检查
  ```bash
  curl http://localhost:8000/health
  ```
  预期输出：
  ```json
  {
    "status": "healthy",
    "model": "Llama-3.1-8B",
    "gpu": "NVIDIA GeForce RTX 4090",
    "memory": "7.84GB"
  }
  ```

- [ ] 测试隐藏状态提取
  ```bash
  curl -X POST http://localhost:8000/v1/hidden_states \
    -H "Content-Type: application/json" \
    -d '{"prompts": ["Hello, world!"], "layer": -2}'
  ```

- [ ] 测试公网访问
  ```bash
  curl https://your-pod-id-8000.proxy.runpod.net/health
  ```

### Phase 3: 配置 Awareness Network (5 分钟)

#### 3.1 配置环境变量

**方法 1: 自动配置（推荐）**

- [ ] 在本地运行配置脚本
  ```bash
  cd "e:/Awareness Market/Awareness-Network"
  bash scripts/setup-env.sh
  ```

- [ ] 按提示输入信息

**方法 2: 手动配置**

- [ ] 复制 `.env.example` 到 `.env`
  ```bash
  copy .env.example .env
  ```

- [ ] 编辑 `.env` 文件，添加/修改以下配置：
  ```env
  USE_SELF_HOSTED_LLM=true
  VLLM_BASE_URL=https://your-pod-id-8000.proxy.runpod.net
  VLLM_MODEL_NAME=llama-3.1-8b
  LLM_COST_PROVIDER=runpod-rtx-4090-spot

  # 可选：RunPod 自动管理
  RUNPOD_API_KEY=your_runpod_api_key
  RUNPOD_POD_ID=your_pod_id
  ```

#### 3.2 启动服务

- [ ] 安装依赖（如果还没有）
  ```bash
  npm install
  ```

- [ ] 启动开发服务器
  ```bash
  npm run dev
  ```

- [ ] 等待服务器启动（监听 3000 端口）

### Phase 4: 测试集成 (2 分钟)

#### 4.1 手动测试

- [ ] 测试健康检查
  ```bash
  curl http://localhost:3000/api/trpc/latentmas.trueLatentMAS.testSelfHostedHealth
  ```

- [ ] 测试隐藏状态提取
  ```bash
  curl -X POST http://localhost:3000/api/trpc/latentmas.trueLatentMAS.testHiddenStateExtraction \
    -H "Content-Type: application/json" \
    -d '{"prompts": ["Test prompt"]}'
  ```

#### 4.2 自动化测试

- [ ] 运行测试脚本
  ```bash
  bash scripts/test-integration.sh
  ```

- [ ] 确认所有测试通过 ✓

### Phase 5: 训练第一个 W-Matrix (5 分钟)

#### 5.1 使用 API

- [ ] 编译文本到潜空间
  ```bash
  curl -X POST http://localhost:3000/api/trpc/latentmas.trueLatentMAS.compileTextToLatent \
    -H "Content-Type: application/json" \
    -d '{
      "text": "Machine learning is a subset of artificial intelligence.",
      "sourceModel": "llama-3.1-8b",
      "latentSteps": 20
    }'
  ```

- [ ] 记录 `packageId`
- [ ] 检查 `quality.informationRetention` > 0.9

#### 5.2 使用前端 UI

- [ ] 访问 http://localhost:3000/latent-test
- [ ] 进入 "论文实现" 标签页
- [ ] 输入测试文本
- [ ] 点击 "编译到潜空间"
- [ ] 查看结果

---

## 🎯 验收标准

### 必须通过的检查

- [ ] vLLM 服务器健康检查返回 `status: healthy`
- [ ] 隐藏状态提取返回 4096 维向量
- [ ] 成本统计正常显示
- [ ] 编译到潜空间成功，信息保留率 > 0.9
- [ ] 前端 UI 可以正常使用

### 性能基准

- [ ] 单个 prompt 隐藏状态提取 < 200ms
- [ ] 100 prompts 批量处理 < 10s
- [ ] W-Matrix 训练（200 prompts）< 30s

### 成本验证

- [ ] 单次训练成本 < $0.01
- [ ] 每日成本 < $0.50（轻度使用）
- [ ] 月度预测成本 < $20

---

## 🔧 故障排查

### 常见问题

#### 1. 模型下载失败

- [ ] 检查 HF_TOKEN 是否正确
- [ ] 检查网络连接
- [ ] 检查磁盘空间（需要 ~20GB）
- [ ] 尝试使用镜像站点

#### 2. vLLM 服务器启动失败

- [ ] 查看日志：`tail -f /workspace/vllm.log`
- [ ] 检查 GPU 内存使用：`nvidia-smi`
- [ ] 降低 `GPU_MEMORY_UTILIZATION` 到 0.7
- [ ] 重启 Pod

#### 3. 连接超时

- [ ] 检查 VLLM_BASE_URL 是否正确
- [ ] 测试公网访问：`curl https://...`
- [ ] 检查 Pod 是否在运行
- [ ] 检查防火墙设置

#### 4. 成本超预算

- [ ] 检查 Pod 是否忘记停止
- [ ] 启用智能启停：使用 `RunPodManager.withAutoManage()`
- [ ] 查看成本统计：`getCostStats`
- [ ] 调整使用频率

---

## 📊 部署完成报告

部署完成后，填写以下信息：

### 环境信息

- **部署日期**: _______________
- **Pod ID**: _______________
- **GPU 型号**: RTX 4090 / A100 / 其他
- **模型**: Llama 3.1 8B / 其他
- **公网地址**: _______________

### 性能数据

- **首次隐藏状态提取耗时**: _____ ms
- **100 prompts 批量处理耗时**: _____ s
- **W-Matrix 训练耗时**: _____ s
- **信息保留率**: _____ %

### 成本数据

- **首次训练成本**: $_____
- **预估日成本**: $_____
- **预估月成本**: $_____

### 测试结果

- [ ] 所有自动化测试通过
- [ ] 手动验证通过
- [ ] 前端 UI 正常工作
- [ ] 成本在预算内

---

## 🎉 恭喜！

如果所有检查项都已完成，你已经成功部署了自部署 LLM 系统！

### 下一步

1. [ ] 集成到三大市场（记忆、推理链、W-Matrix）
2. [ ] 设置成本监控告警
3. [ ] 优化批量处理流程
4. [ ] 添加更多模型支持

### 记得

- ⏸️ 不用时停止 Pod 节省成本
- 📊 定期检查成本统计
- 🔄 定期更新模型和依赖
- 📝 记录使用经验和优化措施

---

**部署成功！🚀 成本节省 99.4%！💰**
