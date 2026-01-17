#!/usr/bin/env node

/**
 * 集成测试脚本 - 测试 Go 微服务与 Node.js API Gateway
 * 
 * 运行方式:
 *   node test-integration.mjs
 * 
 * 需要:
 *   1. 所有 Go 服务运行中 (ports 8080, 8081, 8083)
 *   2. Node.js 服务运行中 (port 3001)
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';
const GO_SERVICES = {
  memory: 'http://localhost:8080',
  marketplace: 'http://localhost:8081',
  vectors: 'http://localhost:8083'
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(color, ...args) {
  console.log(`${color}${args.join(' ')}${colors.reset}`);
}

async function testHealthCheck() {
  log(colors.blue, '\n=== 测试健康检查端点 ===');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    log(colors.green, '✓ 健康检查通过:', JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    log(colors.red, '✗ 健康检查失败:', err.message);
    return false;
  }
}

async function testDetailedHealth() {
  log(colors.blue, '\n=== 测试详细健康检查 ===');
  try {
    const res = await fetch(`${API_BASE}/health/detailed`);
    const data = await res.json();
    log(colors.green, '✓ 详细健康检查:');
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    log(colors.red, '✗ 详细健康检查失败:', err.message);
    return false;
  }
}

async function testGoServiceDirect(serviceName, url, endpoint) {
  log(colors.blue, `\n=== 直接测试 ${serviceName} 服务 ===`);
  try {
    const res = await fetch(`${url}${endpoint}`);
    const data = await res.json();
    log(colors.green, `✓ ${serviceName} ${endpoint} 返回:`, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    log(colors.red, `✗ ${serviceName} 失败:`, err.message);
    return false;
  }
}

async function testAPIGateway() {
  log(colors.blue, '\n=== 通过 API Gateway 测试向量服务 ===');
  try {
    const res = await fetch(`${API_BASE}/api/v1/vectors/stats`);
    const data = await res.json();
    log(colors.green, '✓ 向量统计数据:', JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    log(colors.red, '✗ API Gateway 向量测试失败:', err.message);
    return false;
  }
}

async function testTRPCEndpoint() {
  log(colors.blue, '\n=== 测试 tRPC 路由 (memory.browse) ===');
  try {
    // tRPC query format: /trpc/procedure.name
    const res = await fetch(`${API_BASE}/trpc/memory.browse?input=${encodeURIComponent(JSON.stringify({ limit: 5 }))}`);
    const data = await res.json();
    log(colors.green, '✓ Memory browse 响应:', JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    log(colors.red, '✗ tRPC 测试失败:', err.message);
    return false;
  }
}

async function main() {
  log(colors.yellow, '🚀 开始集成测试...\n');
  log(colors.yellow, '确保以下服务正在运行:');
  log(colors.yellow, '  - Node.js API Gateway: http://localhost:3001');
  log(colors.yellow, '  - Go Memory Service: http://localhost:8080');
  log(colors.yellow, '  - Go Marketplace Service: http://localhost:8081');
  log(colors.yellow, '  - Go Vector Service: http://localhost:8083');

  const results = [];

  // 测试 API Gateway 健康检查
  results.push({
    name: '健康检查',
    passed: await testHealthCheck()
  });

  // 测试详细健康检查
  results.push({
    name: '详细健康检查',
    passed: await testDetailedHealth()
  });

  // 直接测试 Go 服务
  results.push({
    name: 'Go Memory 服务',
    passed: await testGoServiceDirect('Memory', GO_SERVICES.memory, '/health')
  });

  results.push({
    name: 'Go Vectors 服务',
    passed: await testGoServiceDirect('Vectors', GO_SERVICES.vectors, '/stats')
  });

  // 通过 API Gateway 测试
  results.push({
    name: 'API Gateway (向量)',
    passed: await testAPIGateway()
  });

  // 测试 tRPC
  results.push({
    name: 'tRPC memory.browse',
    passed: await testTRPCEndpoint()
  });

  // 总结
  log(colors.yellow, '\n\n=== 测试总结 ===');
  results.forEach(r => {
    const icon = r.passed ? '✓' : '✗';
    const color = r.passed ? colors.green : colors.red;
    log(color, `${icon} ${r.name}`);
  });

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  log(colors.blue, `\n${passCount}/${totalCount} 测试通过`);
  
  if (passCount === totalCount) {
    log(colors.green, '🎉 所有集成测试通过！');
    process.exit(0);
  } else {
    log(colors.red, '❌ 某些测试失败，请检查 Go 服务是否运行');
    process.exit(1);
  }
}

main().catch(err => {
  log(colors.red, '测试脚本错误:', err);
  process.exit(1);
});
