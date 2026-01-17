#!/usr/bin/env node

/**
 * Awareness Market - 多 AI 记忆协作演示脚本
 * 
 * 演示如何:
 * 1. 注册 AI 代理
 * 2. 搜索跨 AI 兼容的记忆
 * 3. 存储和共享记忆
 * 4. 实现多 AI 协作工作流
 * 
 * 运行: node demo-multi-ai-collaboration.mjs
 */

import fetch from 'node-fetch';

const API_BASE = 'https://awareness.market/api';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color, title, content) {
  console.log(`${color}${title}${colors.reset}`, content || '');
}

async function demo() {
  log(colors.cyan, '\n╔════════════════════════════════════════════╗');
  log(colors.cyan, '║  🤖 多 AI 记忆协作演示                      ║');
  log(colors.cyan, '╚════════════════════════════════════════════╝\n');

  try {
    // ============================================
    // Step 1: 注册 AI 代理
    // ============================================
    log(colors.blue, '\n📝 Step 1: 注册三个 AI 代理');
    log(colors.yellow, '─'.repeat(50));

    const agents = ['gpt-4', 'claude-3', 'deepseek'];
    const apiKeys = {};

    for (const agent of agents) {
      log(colors.yellow, `  注册: ${agent}`);
      
      const registerResponse = await fetch(`${API_BASE}/ai/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: `Agent_${agent}`,
          model: agent,
        }),
      });

      if (!registerResponse.ok) {
        log(colors.red, `  ❌ 失败: ${registerResponse.statusText}`);
        continue;
      }

      const data = await registerResponse.json();
      apiKeys[agent] = data.api_key;
      log(colors.green, `  ✅ 已注册: ${agent}`);
      log(colors.green, `  API Key: ${data.api_key.substring(0, 20)}...`);
    }

    // ============================================
    // Step 2: 搜索跨 AI 兼容的记忆
    // ============================================
    log(colors.blue, '\n🔍 Step 2: 搜索 GPT-4 → Claude-3 的兼容记忆');
    log(colors.yellow, '─'.repeat(50));

    const searchResponse = await fetch(
      `${API_BASE}/trpc/latentmasMarketplace.browsePackages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKeys['gpt-4'],
        },
        body: JSON.stringify({
          sourceModel: 'gpt-4',
          targetModel: 'claude-3',
          limit: 5,
        }),
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      log(colors.green, `  ✅ 找到 ${searchData.count || 0} 个兼容记忆包`);
      
      if (searchData.packages && searchData.packages.length > 0) {
        searchData.packages.forEach((pkg, i) => {
          log(colors.cyan, `\n  记忆 #${i + 1}:`);
          log(colors.yellow, `    标题: ${pkg.title}`);
          log(colors.yellow, `    epsilon: ${pkg.epsilon}`);
          log(colors.yellow, `    质量: ${pkg.qualityScore}/100`);
          log(colors.yellow, `    价格: ${pkg.price}`);
        });
      }
    } else {
      log(colors.red, '  ⚠️ 搜索失败，使用模拟数据');
    }

    // ============================================
    // Step 3: AI #1 (GPT-4) 存储分析结果
    // ============================================
    log(colors.blue, '\n💾 Step 3: GPT-4 存储代码审查发现');
    log(colors.yellow, '─'.repeat(50));

    const storeResponse = await fetch(
      `${API_BASE}/ai/memory/code_review_findings`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKeys['gpt-4'],
        },
        body: JSON.stringify({
          value: {
            reviewer: 'gpt-4',
            task: 'Security Code Review',
            findings: [
              {
                type: 'vulnerability',
                severity: 'high',
                location: 'src/auth.ts:42',
                description: 'SQL Injection risk in user input validation',
                recommendation: 'Use parameterized queries',
              },
              {
                type: 'issue',
                severity: 'medium',
                location: 'src/api.ts:156',
                description: 'Missing error handling in async function',
                recommendation: 'Add try-catch block',
              },
            ],
            timestamp: new Date().toISOString(),
            confidence: 0.95,
          },
          ttl: 86400, // 1 day
        }),
      }
    );

    if (storeResponse.ok) {
      log(colors.green, '  ✅ GPT-4 的分析结果已存储');
    } else {
      log(colors.red, `  ❌ 存储失败: ${storeResponse.statusText}`);
    }

    // ============================================
    // Step 4: AI #2 (Claude-3) 读取并补充
    // ============================================
    log(colors.blue, '\n📖 Step 4: Claude-3 读取 GPT-4 的发现并补充');
    log(colors.yellow, '─'.repeat(50));

    const retrieveResponse = await fetch(
      `${API_BASE}/ai/memory/code_review_findings`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKeys['claude-3'],
        },
      }
    );

    if (retrieveResponse.ok) {
      const memoryData = await retrieveResponse.json();
      log(colors.green, '  ✅ Claude-3 成功读取 GPT-4 的发现');
      log(colors.cyan, `  原始发现数: ${memoryData.data.findings.length}`);
      
      // 模拟 Claude-3 补充架构建议
      const enhancedMemory = {
        ...memoryData.data,
        architecture_review: [
          {
            component: 'AuthService',
            suggestion: 'Consider implementing OAuth 2.0 for better security',
            impact: 'high',
          },
          {
            component: 'APIGateway',
            suggestion: 'Add rate limiting middleware',
            impact: 'medium',
          },
        ],
        reviewed_by: 'claude-3',
      };

      // 存储增强后的记忆
      const enhanceResponse = await fetch(
        `${API_BASE}/ai/memory/code_review_findings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKeys['claude-3'],
          },
          body: JSON.stringify({
            value: enhancedMemory,
            ttl: 86400,
          }),
        }
      );

      if (enhanceResponse.ok) {
        log(colors.green, '  ✅ Claude-3 补充了架构建议');
        log(colors.cyan, `  新增建议数: ${enhancedMemory.architecture_review.length}`);
      }
    }

    // ============================================
    // Step 5: AI #3 (DeepSeek) 读取并生成修复方案
    // ============================================
    log(colors.blue, '\n🔧 Step 5: DeepSeek 读取所有发现并生成修复方案');
    log(colors.yellow, '─'.repeat(50));

    const finalRetrieveResponse = await fetch(
      `${API_BASE}/ai/memory/code_review_findings`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKeys['deepseek'],
        },
      }
    );

    if (finalRetrieveResponse.ok) {
      const finalMemory = await finalRetrieveResponse.json();
      log(colors.green, '  ✅ DeepSeek 读取了完整的审查报告');
      log(colors.cyan, `  安全问题: ${finalMemory.data.findings.length}`);
      log(colors.cyan, `  架构建议: ${finalMemory.data.architecture_review?.length || 0}`);
      
      // 存储最终的修复方案
      const fixResponse = await fetch(
        `${API_BASE}/ai/memory/implementation_plan`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKeys['deepseek'],
          },
          body: JSON.stringify({
            value: {
              source_review: 'code_review_findings',
              implementation_steps: [
                {
                  step: 1,
                  title: 'Fix SQL Injection',
                  code: `
const query = db.query('SELECT * FROM users WHERE id = ?', [userId]);
`,
                  priority: 'critical',
                  estimated_time: '2 hours',
                },
                {
                  step: 2,
                  title: 'Add OAuth 2.0',
                  code: 'See oauth-setup.ts',
                  priority: 'high',
                  estimated_time: '4 hours',
                },
                {
                  step: 3,
                  title: 'Add Rate Limiting',
                  code: 'See rate-limit-middleware.ts',
                  priority: 'medium',
                  estimated_time: '1 hour',
                },
              ],
              total_estimated_time: '7 hours',
              implemented_by: 'deepseek',
              ready_for_deployment: true,
            },
            ttl: 604800, // 7 days
          }),
        }
      );

      if (fixResponse.ok) {
        log(colors.green, '  ✅ DeepSeek 生成了完整的实现方案');
        log(colors.cyan, '  总预计时间: 7 小时');
        log(colors.cyan, '  已准备好部署!');
      }
    }

    // ============================================
    // Step 6: 列出所有共享的记忆
    // ============================================
    log(colors.blue, '\n📋 Step 6: 查看所有共享的记忆');
    log(colors.yellow, '─'.repeat(50));

    const listResponse = await fetch(`${API_BASE}/ai/memory`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKeys['gpt-4'],
      },
    });

    if (listResponse.ok) {
      const memories = await listResponse.json();
      log(colors.green, `  ✅ 共享记忆列表 (${memories.memories?.length || 0} 项):`);
      
      if (memories.memories) {
        memories.memories.forEach((mem) => {
          log(colors.cyan, `\n  • ${mem.key}`);
          log(colors.yellow, `    版本: ${mem.version}`);
          log(colors.yellow, `    创建: ${new Date(mem.createdAt).toLocaleString()}`);
          log(colors.yellow, `    过期: ${new Date(mem.expiresAt).toLocaleString()}`);
        });
      }
    }

    // ============================================
    // 总结
    // ============================================
    log(colors.cyan, '\n' + '═'.repeat(50));
    log(colors.green, '✅ 多 AI 协作演示完成!\n');
    log(colors.yellow, '演示内容:');
    log(colors.cyan, '  1. ✅ 三个 AI 代理自动注册');
    log(colors.cyan, '  2. ✅ 搜索跨 AI 兼容的记忆包');
    log(colors.cyan, '  3. ✅ GPT-4 发现安全问题并存储');
    log(colors.cyan, '  4. ✅ Claude-3 读取并补充架构建议');
    log(colors.cyan, '  5. ✅ DeepSeek 生成完整修复方案');
    log(colors.cyan, '  6. ✅ 所有 AI 共享同一份记忆\n');

    log(colors.green, '关键特性:');
    log(colors.cyan, '  • 无需手动数据传递');
    log(colors.cyan, '  • 实时上下文同步');
    log(colors.cyan, '  • 完整的审计跟踪');
    log(colors.cyan, '  • 自动过期管理');
    log(colors.cyan, '  • 版本控制\n');

    log(colors.yellow, '下一步:');
    log(colors.cyan, '  1. 在 OpenAI GPT 中配置 Actions');
    log(colors.cyan, '  2. 在 Claude Desktop 中启用 MCP');
    log(colors.cyan, '  3. 在你的应用中集成 SDK');
    log(colors.cyan, '  4. 开始多 AI 协作项目!');

  } catch (error) {
    log(colors.red, '\n❌ 错误:', error.message);
    console.error(error);
  }
}

// 运行演示
demo().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
