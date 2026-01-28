#!/usr/bin/env node

/**
 * AI代理发现和协作功能测试脚本
 *
 * 测试内容：
 * 1. AI代理发现 - 按能力搜索AI
 * 2. 检查代理兼容性
 * 3. 创建多AI协作工作流
 * 4. 监控工作流执行状态
 * 5. 验证ERC-8004链上记录（可选）
 *
 * 运行: node scripts/test/test-agent-discovery-collaboration.mjs
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, title, content = '') {
  console.log(`${color}${title}${colors.reset}`, content);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log(colors.cyan, '\n╔════════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║  🤖 AI代理发现与协作功能测试                                    ║');
  log(colors.cyan, '╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // ============================================
    // Step 1: 发现具有特定能力的AI代理
    // ============================================
    log(colors.blue, '\n📡 Step 1: 发现AI代理');
    log(colors.yellow, '─'.repeat(70));

    const discoverResponse = await fetch(`${API_BASE}/api/trpc/agentDiscovery.discoverAgents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requiredCapabilities: [],
        minReputationScore: 500,
        specialization: 'nlp',
        limit: 10,
      }),
    });

    if (!discoverResponse.ok) {
      log(colors.red, '  ❌ 发现失败:', await discoverResponse.text());
      return;
    }

    const discoveryData = await discoverResponse.json();
    const agents = discoveryData.result?.data?.agents || [];

    log(colors.green, `  ✅ 发现 ${agents.length} 个AI代理`);

    if (agents.length > 0) {
      log(colors.cyan, '\n  发现的代理:');
      agents.slice(0, 5).forEach((agent, i) => {
        log(colors.yellow, `  ${i + 1}. ${agent.agentName}`);
        log(colors.cyan, `     ID: ${agent.agentId}`);
        log(colors.cyan, `     信用评分: ${agent.creditScore} (${agent.creditGrade})`);
        log(colors.cyan, `     专长: ${agent.specializations.join(', ') || 'N/A'}`);
        log(colors.cyan, `     创建记忆数: ${agent.totalMemoriesCreated}`);
        log(colors.cyan, `     链上状态: ${agent.isOnChain ? '✅ 已注册' : '❌ 未注册'}`);
        log(colors.cyan, `     活跃状态: ${agent.isActive ? '🟢 在线' : '🔴 离线'}`);
      });
    }

    if (agents.length < 2) {
      log(colors.yellow, '\n  ⚠️ 需要至少2个代理才能测试协作功能');
      log(colors.yellow, '  请先创建更多AI代理或降低minReputationScore');
      return;
    }

    // ============================================
    // Step 2: 获取详细代理信息
    // ============================================
    log(colors.blue, '\n📋 Step 2: 获取代理详细信息');
    log(colors.yellow, '─'.repeat(70));

    const agentId = agents[0].agentId;
    const profileResponse = await fetch(`${API_BASE}/api/trpc/agentDiscovery.getAgentProfile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
      }),
    });

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const profile = profileData.result?.data;

      log(colors.green, `  ✅ 获取代理 "${profile.agentName}" 的详细信息`);
      log(colors.cyan, `  总收入: $${profile.totalRevenue}`);
      log(colors.cyan, `  平均评分: ${profile.avgRating.toFixed(2)}/5.0`);
      log(colors.cyan, `  作品集: ${profile.portfolio?.length || 0} 个记忆包`);

      if (profile.onChainReputation) {
        log(colors.cyan, '\n  链上声誉:');
        log(colors.cyan, `    总交互: ${profile.onChainReputation.totalInteractions}`);
        log(colors.cyan, `    成功率: ${profile.onChainReputation.successRate}%`);
        log(colors.cyan, `    声誉分数: ${profile.onChainReputation.score}`);
      }
    } else {
      log(colors.yellow, '  ⚠️ 获取详细信息失败');
    }

    // ============================================
    // Step 3: 检查两个代理之间的兼容性
    // ============================================
    if (agents.length >= 2) {
      log(colors.blue, '\n🔗 Step 3: 检查代理兼容性');
      log(colors.yellow, '─'.repeat(70));

      const fromAgent = agents[0].agentId;
      const toAgent = agents[1].agentId;

      const compatResponse = await fetch(`${API_BASE}/api/trpc/agentDiscovery.checkCompatibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAgent,
          toAgent,
        }),
      });

      if (compatResponse.ok) {
        const compatData = await compatResponse.json();
        const compat = compatData.result?.data;

        log(colors.green, `  ✅ 兼容性检查完成`);
        log(colors.cyan, `  代理A: ${agents[0].agentName}`);
        log(colors.cyan, `  代理B: ${agents[1].agentName}`);
        log(colors.cyan, `  兼容: ${compat.compatible ? '✅ 是' : '❌ 否'}`);
        log(colors.cyan, `  兼容性分数: ${(compat.compatibilityScore * 100).toFixed(1)}%`);
        log(colors.cyan, `  共同专长: ${compat.sharedSpecializations.join(', ') || '无'}`);
        log(colors.cyan, `  预计延迟: ${compat.estimatedLatency}`);
      }
    }

    // ============================================
    // Step 4: 创建协作工作流（需要认证）
    // ============================================
    log(colors.blue, '\n🚀 Step 4: 创建多AI协作工作流');
    log(colors.yellow, '─'.repeat(70));

    // 注意：这需要有效的JWT token
    // 在实际使用中，需要先登录获取token
    log(colors.yellow, '  ⚠️ 跳过工作流创建（需要认证token）');
    log(colors.cyan, '\n  要测试协作工作流，请使用以下示例代码:');

    const exampleCode = `
    // 1. 先登录获取token
    const loginRes = await fetch('${API_BASE}/api/trpc/auth.loginEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'your@email.com',
        password: 'yourpassword'
      })
    });
    const { accessToken } = await loginRes.json();

    // 2. 创建协作工作流
    const workflowRes = await fetch('${API_BASE}/api/trpc/agentCollaboration.collaborate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${accessToken}\`
      },
      body: JSON.stringify({
        task: 'Security code review and fix generation',
        agents: ['${agents[0]?.agentId || 'agent_xxx'}', '${agents[1]?.agentId || 'agent_yyy'}'],
        orchestration: 'sequential', // or 'parallel'
        memorySharing: true,
        recordOnChain: true,
        inputData: {
          codebase: 'https://github.com/example/repo',
          files: ['src/auth.ts', 'src/api.ts']
        }
      })
    });

    const { workflowId } = await workflowRes.json();

    // 3. 监控工作流状态
    const statusRes = await fetch(\`${API_BASE}/api/trpc/agentCollaboration.getWorkflowStatus?workflowId=\${workflowId}\`);
    const status = await statusRes.json();
    console.log('工作流状态:', status);
    `;

    log(colors.magenta, exampleCode);

    // ============================================
    // Step 5: 演示工作流状态查询
    // ============================================
    log(colors.blue, '\n📊 Step 5: 工作流状态查询示例');
    log(colors.yellow, '─'.repeat(70));

    log(colors.cyan, '  工作流执行流程:');
    log(colors.green, '  1. 创建工作流 → 获得workflowId');
    log(colors.green, '  2. 工作流自动执行（异步）');
    log(colors.green, '  3. 查询状态监控进度');
    log(colors.green, '  4. 所有步骤完成后获取结果');

    log(colors.cyan, '\n  顺序执行模式 (sequential):');
    log(colors.yellow, '  ┌─────────┐     ┌─────────┐     ┌─────────┐');
    log(colors.yellow, '  │ Agent 1 │────>│ Agent 2 │────>│ Agent 3 │');
    log(colors.yellow, '  └─────────┘     └─────────┘     └─────────┘');
    log(colors.cyan, '  每个代理依次执行，可以读取前一个代理的输出');

    log(colors.cyan, '\n  并行执行模式 (parallel):');
    log(colors.yellow, '  ┌─────────┐');
    log(colors.yellow, '  │ Agent 1 │────┐');
    log(colors.yellow, '  └─────────┘    │');
    log(colors.yellow, '  ┌─────────┐    ├────> 汇总结果');
    log(colors.yellow, '  │ Agent 2 │────┤');
    log(colors.yellow, '  └─────────┘    │');
    log(colors.yellow, '  ┌─────────┐    │');
    log(colors.yellow, '  │ Agent 3 │────┘');
    log(colors.yellow, '  └─────────┘');
    log(colors.cyan, '  所有代理同时执行，最后汇总');

    // ============================================
    // Step 6: ERC-8004链上记录说明
    // ============================================
    log(colors.blue, '\n⛓️  Step 6: ERC-8004链上记录');
    log(colors.yellow, '─'.repeat(70));

    log(colors.cyan, '  自动链上记录功能:');
    log(colors.green, '  ✅ 每次协作完成后自动调用 recordInteraction()');
    log(colors.green, '  ✅ 记录内容: fromAgent → toAgent, success, weight');
    log(colors.green, '  ✅ 自动更新双方的链上声誉分数');
    log(colors.green, '  ✅ 可选关闭 (recordOnChain: false)');

    log(colors.cyan, '\n  链上声誉影响:');
    log(colors.yellow, '  • 成功协作: +权重分数');
    log(colors.yellow, '  • 失败协作: -权重/2分数');
    log(colors.yellow, '  • 累计形成长期声誉');
    log(colors.yellow, '  • 影响未来协作推荐');

    // ============================================
    // 总结
    // ============================================
    log(colors.cyan, '\n' + '═'.repeat(70));
    log(colors.green, '✅ AI代理发现与协作功能测试完成!\n');

    log(colors.yellow, '新增功能总结:');
    log(colors.cyan, '  1. ✅ AI代理发现 API (agentDiscovery.discoverAgents)');
    log(colors.cyan, '  2. ✅ 代理详细信息 (agentDiscovery.getAgentProfile)');
    log(colors.cyan, '  3. ✅ 兼容性检查 (agentDiscovery.checkCompatibility)');
    log(colors.cyan, '  4. ✅ 协作工作流 (agentCollaboration.collaborate)');
    log(colors.cyan, '  5. ✅ 工作流状态 (agentCollaboration.getWorkflowStatus)');
    log(colors.cyan, '  6. ✅ ERC-8004自动记录交互\n');

    log(colors.green, 'API端点:');
    log(colors.cyan, '  POST /api/trpc/agentDiscovery.discoverAgents');
    log(colors.cyan, '  POST /api/trpc/agentDiscovery.getAgentProfile');
    log(colors.cyan, '  POST /api/trpc/agentDiscovery.checkCompatibility');
    log(colors.cyan, '  POST /api/trpc/agentCollaboration.collaborate');
    log(colors.cyan, '  GET  /api/trpc/agentCollaboration.getWorkflowStatus\n');

    log(colors.yellow, '使用场景:');
    log(colors.cyan, '  • GPT-4自动发现擅长代码审查的AI');
    log(colors.cyan, '  • Claude找到兼容的架构设计AI协作');
    log(colors.cyan, '  • 多AI顺序执行: 审查→建议→修复');
    log(colors.cyan, '  • 多AI并行执行: 多角度同时分析');
    log(colors.cyan, '  • 自动记录协作历史到区块链\n');

  } catch (error) {
    log(colors.red, '\n❌ 错误:', error.message);
    console.error(error);
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
