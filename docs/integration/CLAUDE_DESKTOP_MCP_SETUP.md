# Claude Desktop MCP Server 配置指南

**完整指南：配置 Awareness LatentMAS MCP Server 在 Claude Desktop**

---

## 📋 前置要求

- ✅ Node.js 18+ 已安装
- ✅ Claude Desktop 应用已安装
- ✅ Awareness marketplace 账号（可选，用于购买功能）
- ✅ 基本的命令行操作知识

---

## 🚀 快速开始（5分钟）

### 步骤 1: 构建 MCP Server

```bash
# 克隆或下载项目
cd latentmind-marketplace/mcp-server

# 安装依赖
npm install

# 构建 TypeScript 到 JavaScript
npm run build
```

构建完成后，会在 `mcp-server/dist/` 目录生成 `index.js` 文件。

### 步骤 2: 配置 Claude Desktop

#### macOS

1. 打开配置文件：
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. 添加以下配置：
```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/latentmind-marketplace/mcp-server/dist/index.js"
      ],
      "env": {
        "VITE_APP_URL": "https://awareness.market"
      }
    }
  }
}
```

#### Windows

1. 打开配置文件：
```powershell
notepad %APPDATA%\Claude\claude_desktop_config.json
```

2. 添加以下配置：
```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": [
        "C:\\Users\\YOUR_USERNAME\\latentmind-marketplace\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "VITE_APP_URL": "https://awareness.market"
      }
    }
  }
}
```

#### Linux

1. 打开配置文件：
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

2. 添加以下配置：
```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": [
        "/home/YOUR_USERNAME/latentmind-marketplace/mcp-server/dist/index.js"
      ],
      "env": {
        "VITE_APP_URL": "https://awareness.market"
      }
    }
  }
}
```

**重要**：将 `YOUR_USERNAME` 替换为你的实际用户名，或使用完整的绝对路径。

### 步骤 3: 重启 Claude Desktop

完全退出 Claude Desktop 并重新启动（不是最小化）。

### 步骤 4: 验证安装

在 Claude Desktop 中输入：

```
Can you search for LatentMAS memories that convert GPT-3.5 to GPT-4?
```

如果配置成功，Claude 会使用 `search_latentmas_memories` 工具查询市场。

---

## 🛠️ 可用工具

MCP Server 提供 5 个工具供 Claude 使用：

### 1. search_latentmas_memories

搜索符合条件的记忆包。

**示例对话**：
```
User: Find memory packages that align GPT-3.5-turbo with Claude-3.5-sonnet

Claude: [使用 search_latentmas_memories 工具]
- sourceModel: "gpt-3.5-turbo"
- targetModel: "claude-3.5-sonnet"
- maxEpsilon: 0.05
- limit: 10

结果：找到 3 个高质量记忆包...
```

### 2. get_memory_details

获取特定记忆包的详细信息。

**示例对话**：
```
User: Tell me more about memory package #12345

Claude: [使用 get_memory_details 工具]
- memoryId: "12345"

结果：
- W-Matrix 版本: v2.1.0
- Epsilon: 3.2%
- 认证等级: Gold
- 价格: $5.00
- 下载次数: 127
```

### 3. check_model_compatibility

检查两个模型是否兼容，并推荐最佳 W-Matrix。

**示例对话**：
```
User: Can I use a memory package to convert LLaMA-3.1-8b outputs to GPT-4?

Claude: [使用 check_model_compatibility 工具]
- sourceModel: "llama-3.1-8b"
- targetModel: "gpt-4"

结果：
- 兼容性: Yes
- 推荐 W-Matrix: #45678
- 预期 epsilon: 4.1%
```

### 4. purchase_memory

购买记忆包（需要 API 密钥）。

**示例对话**：
```
User: Purchase the best GPT-3.5 → GPT-4 memory package for me

Claude: [先搜索，然后使用 purchase_memory 工具]
- memoryId: "12345"
- paymentMethod: "credits"

结果：
- 购买成功！
- 下载链接: https://awareness.market/download/...
- 交易 ID: tx_abc123
```

**注意**：购买功能需要在环境变量中配置 API 密钥。

### 5. list_my_memories

列出已购买的记忆包。

**示例对话**：
```
User: Show me all the memories I've purchased

Claude: [使用 list_my_memories 工具]

结果：
1. GPT-3.5 → GPT-4 (epsilon: 3.2%)
2. Claude → GPT-4 (epsilon: 4.1%)
3. LLaMA → Claude (epsilon: 3.8%)
```

---

## 🔐 配置 API 密钥（可选）

如果你想使用购买功能，需要配置 API 密钥：

### 步骤 1: 获取 API 密钥

1. 访问 https://awareness.market/api-keys
2. 登录你的账号
3. 创建新的 API 密钥
4. 复制密钥（格式：`ak_live_xxxxxx`）

### 步骤 2: 添加到配置

更新 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "API_KEY": "ak_live_your_api_key_here"
      }
    }
  }
}
```

### 步骤 3: 重启 Claude Desktop

---

## 📚 使用示例

### 示例 1: 发现和评估记忆包

**对话**：
```
User: I'm using GPT-3.5-turbo but want GPT-4 quality outputs. Can you help me find a memory package?

Claude: I'll search for memory packages that can align GPT-3.5-turbo with GPT-4.

[使用 search_latentmas_memories]

I found 5 memory packages:

1. **GPT-3.5 → GPT-4 Premium** (ID: 12345)
   - Epsilon: 2.8% (Platinum certified)
   - Price: $10.00
   - Downloads: 342
   - Rating: 4.9/5

2. **GPT-3.5 → GPT-4 Standard** (ID: 12346)
   - Epsilon: 3.5% (Gold certified)
   - Price: $5.00
   - Downloads: 127
   - Rating: 4.7/5

3. **GPT-3.5 → GPT-4 Basic** (ID: 12347)
   - Epsilon: 4.2% (Silver certified)
   - Price: $2.50
   - Downloads: 89
   - Rating: 4.5/5

I recommend #12345 (Premium) for the best quality, or #12346 (Standard) for a good balance of quality and price.
```

### 示例 2: 检查兼容性

**对话**：
```
User: I have a LLaMA-3.1-70b model. Can I use it with Claude-3.5-sonnet memories?

Claude: Let me check the compatibility between LLaMA-3.1-70b and Claude-3.5-sonnet.

[使用 check_model_compatibility]

Good news! These models are compatible:

- **Compatibility**: Yes ✅
- **Recommended W-Matrix**: #78901
- **Expected Epsilon**: 3.9%
- **Certification**: Gold
- **Price**: $7.50

The alignment is feasible with good quality. The recommended W-Matrix has been tested with 156 successful alignments.

Would you like me to show you more details about this W-Matrix?
```

### 示例 3: 自动购买工作流

**对话**：
```
User: I need to align my GPT-3.5 outputs to GPT-4. Find the best package under $10 and purchase it for me.

Claude: I'll search for the best GPT-3.5 → GPT-4 memory package under $10.

[使用 search_latentmas_memories]

Found 3 packages under $10. The best one is:

**GPT-3.5 → GPT-4 Premium**
- Epsilon: 2.8% (Platinum)
- Price: $10.00
- Rating: 4.9/5

This is exactly at your budget limit but offers the highest quality. Shall I proceed with the purchase?

User: Yes, purchase it.

Claude: [使用 purchase_memory]

✅ Purchase successful!

**Transaction Details**:
- Memory ID: 12345
- Amount: $10.00
- Transaction ID: tx_abc123def456

**Download Information**:
- Download URL: https://awareness.market/download/12345/w-matrix.bin
- Expires: 2026-02-05 (30 days)

**Usage Instructions**:
1. Download the W-Matrix file
2. Load it in your LatentMAS SDK
3. Use it to align GPT-3.5 outputs to GPT-4

Would you like me to show you the integration code?
```

---

## 🧪 测试 MCP Server

### 方法 1: 使用 Claude Desktop

直接在 Claude Desktop 中测试：

```
Test 1: Search
"Search for memories that convert GPT-3.5 to GPT-4"

Test 2: Details
"Get details for memory package #12345"

Test 3: Compatibility
"Check if LLaMA-3.1 is compatible with GPT-4"

Test 4: List (需要 API key)
"List all my purchased memories"

Test 5: Purchase (需要 API key)
"Purchase memory package #12345"
```

### 方法 2: 使用 MCP Inspector

```bash
# 安装 MCP Inspector
npm install -g @modelcontextprotocol/inspector

# 运行测试
npx @modelcontextprotocol/inspector node mcp-server/dist/index.js
```

这会打开一个 Web 界面，可以直接测试所有工具。

---

## 🐛 故障排除

### 问题 1: MCP Server 没有出现在 Claude Desktop

**解决方案**：
1. 检查配置文件路径是否正确
2. 确认 JSON 格式正确（使用 https://jsonlint.com 验证）
3. 确认 `index.js` 路径是绝对路径
4. 完全退出并重启 Claude Desktop（不是最小化）
5. 检查 Claude Desktop 日志：
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`
   - Linux: `~/.config/Claude/logs/`

### 问题 2: "Cannot find module" 错误

**解决方案**：
```bash
cd mcp-server
npm install
npm run build
```

确保 `dist/index.js` 文件存在。

### 问题 3: API 连接错误

**解决方案**：
1. 检查 `VITE_APP_URL` 是否正确
2. 确认网络连接正常
3. 测试 API 是否可访问：
```bash
curl https://awareness.market/api/health
```

### 问题 4: 购买功能不工作

**解决方案**：
1. 确认 API 密钥已配置在 `env.API_KEY`
2. 检查 API 密钥格式（应以 `ak_live_` 开头）
3. 验证 API 密钥在 awareness.market 是否有效
4. 确认账户余额充足

### 问题 5: 工具响应慢

**解决方案**：
1. 检查网络延迟
2. 使用本地开发环境（`VITE_APP_URL=http://localhost:3000`）
3. 启用调试模式查看详细日志：
```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "DEBUG": "true",
        "VITE_APP_URL": "https://awareness.market"
      }
    }
  }
}
```

---

## 🔧 高级配置

### 使用本地开发环境

如果你在本地运行 Awareness marketplace：

```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "VITE_APP_URL": "http://localhost:3000",
        "API_KEY": "your_local_api_key"
      }
    }
  }
}
```

### 启用详细日志

```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "DEBUG": "true",
        "LOG_LEVEL": "verbose"
      }
    }
  }
}
```

### 配置超时时间

```json
{
  "mcpServers": {
    "awareness-latentmas": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "VITE_APP_URL": "https://awareness.market",
        "REQUEST_TIMEOUT": "30000"
      }
    }
  }
}
```

---

## 📖 资源链接

- **MCP Server 源码**: `mcp-server/index.ts`
- **API 文档**: https://awareness.market/api-docs
- **用户指南**: https://awareness.market/docs
- **Discord 社区**: https://discord.gg/awareness
- **GitHub Issues**: https://github.com/awareness-market/latentmas/issues

---

## 🎯 最佳实践

### 1. 使用描述性查询

❌ 不好：
```
"Find memories"
```

✅ 好：
```
"Find memory packages that convert GPT-3.5-turbo to GPT-4 with epsilon < 4%"
```

### 2. 明确指定模型名称

使用完整的模型名称（如 `gpt-3.5-turbo` 而不是 `GPT-3.5`）以获得最准确的结果。

### 3. 先检查兼容性

在购买前，先使用 `check_model_compatibility` 确认模型兼容性。

### 4. 比较多个选项

让 Claude 搜索并比较多个记忆包，然后选择最适合你需求的。

### 5. 保存购买记录

定期使用 `list_my_memories` 查看已购买的记忆包。

---

## 🚀 下一步

1. ✅ 配置 MCP Server
2. ✅ 测试所有 5 个工具
3. ⏭️ 探索 Awareness marketplace
4. ⏭️ 集成到你的工作流
5. ⏭️ 分享反馈和建议

---

*最后更新: 2026-01-05*  
*MCP Server 版本: 1.0.0*  
*兼容 Claude Desktop 1.0+*
