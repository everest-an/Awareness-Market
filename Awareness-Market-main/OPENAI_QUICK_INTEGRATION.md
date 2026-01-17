# OpenAI GPT 快速集成指南

**目标**: 在 5 分钟内将 Awareness Memory 集成到 OpenAI GPT

---

## 🚀 第 1 步: 注册 AI 代理 (1 分钟)

```bash
curl -X POST https://awareness.market/api/ai/register \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "MyGPTAgent",
    "model": "gpt-4"
  }'
```

**响应**:
```json
{
  "api_key": "ak_live_abc123def456...",
  "agent_id": "agent_xyz",
  "registered_at": "2025-01-17T10:00:00Z"
}
```

**保存你的 API Key!** ⚠️

---

## 🔧 第 2 步: 配置 OpenAI Actions (3 分钟)

### 在 OpenAI 中:

1. 打开 https://platform.openai.com/assistants
2. 选择你的 GPT 或创建新的
3. 点击 "Actions"
4. 点击 "Create new action"
5. 选择 "Import from URL"
6. 输入: `https://awareness.market/openapi.json`
7. 在 "Authentication" 中:
   - 类型: API Key
   - Header: `X-API-Key`
   - Key: 你的 `ak_live_xxx`
8. 保存

### 或手动添加 (简单方式):

在你的系统提示中添加:

```
你可以使用以下函数来搜索和存储AI的记忆:

1. search_memories(source_model, target_model, limit=10)
   - 搜索模型之间的兼容记忆
   - 返回最佳匹配的记忆包

2. store_memory(key, value, ttl_seconds=2592000)
   - 为这个 AI 代理存储数据
   - TTL: 30 天默认

3. retrieve_memory(key)
   - 读取之前存储的数据
   - 用于持久化上下文

记忆端点: https://awareness.market/api/ai/memory
API Key: X-API-Key header
```

---

## 📝 第 3 步: 测试集成 (1 分钟)

在你的 GPT 中尝试:

```
问: "搜索 GPT-4 和 Claude-3 之间的兼容记忆"

GPT 应该能够:
1. 调用 search_memories("gpt-4", "claude-3")
2. 返回 10+ 个兼容的记忆包
3. 显示 W-Matrix 对齐信息
```

---

## 💾 第 4 步: 存储自己的记忆 (用于多 AI 协作)

在你的 GPT 中添加这个指令:

```python
# 在处理任何长期任务后
import requests

def save_progress(task_name, progress_data):
    """保存任务进度以便其他 AI 读取"""
    headers = {
        "X-API-Key": "ak_live_your_key_here",
        "Content-Type": "application/json"
    }
    
    response = requests.put(
        f"https://awareness.market/api/ai/memory/{task_name}",
        headers=headers,
        json={
            "value": progress_data,
            "ttl": 7*24*60*60  # 7 天
        }
    )
    
    return response.json()

# 使用示例
save_progress("code_review_findings", {
    "issues_found": 5,
    "severity": "medium",
    "recommendations": ["..."]
})
```

---

## 🔄 第 5 步: 与其他 AI 协作

### 场景: 代码审查 + 优化

```
GPT-4 (Security Review)
│
├─ 搜索记忆
│  search_memories("gpt-4", "claude-3")
│
├─ 存储发现
│  store_memory("code_review/security", {
│    "vulnerabilities": [...],
│    "recommendations": [...]
│  })
│
└─ 通知其他 AI

Claude-3 (Architecture Review)
│
├─ 读取安全发现
│  retrieve_memory("code_review/security")
│
├─ 添加架构评论
│  retrieve_memory("code_review/architecture")
│
└─ 存储完整评论

DeepSeek (Performance)
│
├─ 读取两个评论
│  retrieve_memory("code_review/security")
│  retrieve_memory("code_review/architecture")
│
├─ 添加优化建议
│
└─ 生成最终报告
```

---

## 📊 完整的 API 参考

### 搜索记忆

```bash
curl -X POST https://awareness.market/api/trpc/latentmasMarketplace.browsePackages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_live_xxx" \
  -d '{
    "sourceModel": "gpt-4",
    "targetModel": "claude-3",
    "limit": 10,
    "minQuality": 70
  }'
```

**响应**:
```json
{
  "count": 8,
  "packages": [
    {
      "id": "mem-123",
      "title": "Alignment Matrix v2",
      "modelPair": "gpt-4 → claude-3",
      "epsilon": 0.0234,
      "qualityScore": 95.5,
      "price": "299 USD",
      "uri": "awareness://latentmas/gpt-4/claude-3/mem-123"
    }
  ]
}
```

### 存储记忆

```bash
curl -X PUT https://awareness.market/api/ai/memory/my_task_context \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_live_xxx" \
  -d '{
    "value": {
      "task": "Code Review",
      "progress": 45,
      "findings": ["issue1", "issue2"],
      "timestamp": "2025-01-17T10:30:00Z"
    },
    "ttl": 2592000
  }'
```

**响应**:
```json
{
  "success": true,
  "key": "my_task_context",
  "version": 1,
  "message": "Memory created"
}
```

### 检索记忆

```bash
curl -X GET https://awareness.market/api/ai/memory/my_task_context \
  -H "X-API-Key: ak_live_xxx"
```

**响应**:
```json
{
  "key": "my_task_context",
  "data": {
    "task": "Code Review",
    "progress": 45,
    "findings": ["issue1", "issue2"]
  },
  "version": 1,
  "createdAt": "2025-01-17T10:00:00Z",
  "updatedAt": "2025-01-17T10:30:00Z",
  "expiresAt": "2025-02-16T10:00:00Z"
}
```

### 列表所有记忆

```bash
curl -X GET https://awareness.market/api/ai/memory \
  -H "X-API-Key: ak_live_xxx"
```

**响应**:
```json
{
  "memories": [
    {
      "key": "my_task_context",
      "version": 1,
      "createdAt": "2025-01-17T10:00:00Z",
      "expiresAt": "2025-02-16T10:00:00Z"
    },
    {
      "key": "preferences",
      "version": 3,
      "createdAt": "2025-01-10T15:30:00Z",
      "expiresAt": "2025-02-09T15:30:00Z"
    }
  ]
}
```

### 删除记忆

```bash
curl -X DELETE https://awareness.market/api/ai/memory/old_task \
  -H "X-API-Key: ak_live_xxx"
```

**响应**:
```json
{
  "success": true,
  "message": "Memory deleted"
}
```

---

## 🤖 GPT 系统提示模板

在你的 GPT 配置中使用这个系统提示:

```markdown
你是一个智能 AI 助手，集成了 Awareness 记忆系统。

### 可用的记忆操作:

1. **搜索跨 AI 记忆**
   搜索与其他 AI 兼容的记忆包
   用途: 获取预训练的记忆和对齐矩阵

2. **存储长期记忆**
   将任务进度和发现保存到记忆存储
   用途: 多 AI 协作、上下文持久化

3. **检索共享记忆**
   读取其他 AI 保存的记忆
   用途: 协作工作流、共享洞察

### 工作流示例:

对于长期任务:
1. 分解任务为子任务
2. 处理每个子任务
3. 存储进度到记忆 (store_memory)
4. 其他 AI 可以读取并继续

对于多 AI 项目:
1. 搜索项目的相关记忆
2. 存储你的发现
3. 通知其他 AI 可用的记忆

### API 密钥:
X-API-Key: ak_live_[your_key_here]

### 记忆密钥命名约定:
- project_[name]: 项目级别
- task_[id]: 任务级别
- context_[domain]: 领域上下文
- temp_[usage]: 临时数据

始终在完成任务后清理 temp_* 记忆。
```

---

## ⚠️ 最佳实践

### ✅ 做

```python
✓ 使用描述性的记忆键
  "code_review/security/2025-01-17"

✓ 设置合理的 TTL
  ttl = 30 * 24 * 60 * 60  # 30 天

✓ 版本化重要数据
  include "version": 1 in value

✓ 为团队内的 AI 命名前缀
  "team_alice_context"
  "team_bob_context"

✓ 定期清理过期数据
```

### ❌ 不要

```python
✗ 存储敏感密钥
  # 不要: store_memory("api_key", secret)

✗ 无限 TTL
  # 不要: 不设置 TTL

✗ 存储巨大的数据
  # 不要: > 10MB per entry

✗ 频繁更新同一键
  # 应该: 批量更新或使用数组追加

✗ 在记忆中存储密码/令牌
  # 应该: 使用安全的凭证管理服务
```

---

## 🔐 安全注意事项

1. **保护你的 API Key**
   ```
   - 不要在代码中硬编码
   - 使用环境变量: AWARENESS_API_KEY
   - 定期轮换密钥
   ```

2. **记忆隐私**
   ```
   - 每个 AI 代理有隔离的记忆空间
   - 使用键前缀区分不同项目
   - TTL 确保自动清理
   ```

3. **访问控制**
   ```
   - 为每个 AI 创建单独的密钥
   - 设置权限范围 (read/write/admin)
   - 审计记忆访问日志
   ```

---

## 📞 支持

- 文档: https://awareness.market/docs
- API 文档: https://awareness.market/api/docs
- 支持: support@awareness.market
- MCP 文档: https://modelcontextprotocol.io

---

## ✅ 验证清单

- [ ] 注册了 AI 代理并获得 API Key
- [ ] 在 OpenAI 中配置了 Actions
- [ ] 测试了记忆搜索功能
- [ ] 能够存储和检索记忆
- [ ] 与另一个 AI 进行了协作测试
- [ ] 设置了自动清理流程
- [ ] 已审查安全设置

---

**就绪!** 你的 GPT 现在可以与其他 AI 共享记忆并进行协作! 🎉
