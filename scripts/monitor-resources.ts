#!/usr/bin/env tsx
/**
 * Server Resource Monitor
 *
 * 监控服务器资源使用情况（CPU、内存、磁盘）
 *
 * Usage:
 *   npx tsx scripts/monitor-resources.ts          # 单次检查
 *   npx tsx scripts/monitor-resources.ts --watch  # 持续监控
 */

import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

interface ResourceStatus {
  timestamp: string;
  cpu: {
    count: number;
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: string;
    used: string;
    free: string;
    usagePercent: number;
  };
  disk: {
    total: string;
    used: string;
    free: string;
    usagePercent: number;
  };
  pm2?: {
    processes: Array<{
      name: string;
      status: string;
      cpu: string;
      memory: string;
      restarts: number;
      uptime: string;
    }>;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getCPUUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);

  return usage;
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usagePercent = (used / total) * 100;

  return {
    total: formatBytes(total),
    used: formatBytes(used),
    free: formatBytes(free),
    usagePercent: parseFloat(usagePercent.toFixed(2)),
  };
}

function getDiskInfo() {
  try {
    // Windows
    if (process.platform === 'win32') {
      const output = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf-8' });
      const lines = output.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('No disk info');

      // 解析C盘信息（第一行是标题，第二行是数据）
      const dataLine = lines[1].trim().split(/\s+/);
      if (dataLine.length >= 3) {
        const free = parseInt(dataLine[1]);
        const total = parseInt(dataLine[2]);
        const used = total - free;
        const usagePercent = (used / total) * 100;

        return {
          total: formatBytes(total),
          used: formatBytes(used),
          free: formatBytes(free),
          usagePercent: parseFloat(usagePercent.toFixed(2)),
        };
      }
    }

    // Linux/macOS
    const output = execSync('df -k /', { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const data = lines[1].split(/\s+/);

    const total = parseInt(data[1]) * 1024;
    const used = parseInt(data[2]) * 1024;
    const free = parseInt(data[3]) * 1024;
    const usagePercent = parseInt(data[4]);

    return {
      total: formatBytes(total),
      used: formatBytes(used),
      free: formatBytes(free),
      usagePercent,
    };
  } catch (error) {
    return {
      total: 'N/A',
      used: 'N/A',
      free: 'N/A',
      usagePercent: 0,
    };
  }
}

function getPM2Status() {
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf-8' });
    const processes = JSON.parse(output);

    return {
      processes: processes.map((p: any) => ({
        name: p.name,
        status: p.pm2_env.status,
        cpu: p.monit.cpu + '%',
        memory: formatBytes(p.monit.memory),
        restarts: p.pm2_env.restart_time,
        uptime: formatUptime(p.pm2_env.pm_uptime),
      })),
    };
  } catch (error) {
    return undefined;
  }
}

function formatUptime(startTime: number): string {
  const uptime = Date.now() - startTime;
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function getStatusEmoji(percent: number): string {
  if (percent >= 90) return '🔴';
  if (percent >= 70) return '🟡';
  return '🟢';
}

function checkResources(): ResourceStatus {
  return {
    timestamp: new Date().toISOString(),
    cpu: {
      count: os.cpus().length,
      usage: getCPUUsage(),
      loadAverage: os.loadavg(),
    },
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    pm2: getPM2Status(),
  };
}

function printStatus(status: ResourceStatus) {
  console.clear();
  console.log('🖥️  Server Resource Monitor');
  console.log('=' .repeat(80));
  console.log(`📅 Time: ${new Date(status.timestamp).toLocaleString()}\n`);

  // CPU
  const cpuEmoji = getStatusEmoji(status.cpu.usage);
  console.log(`${cpuEmoji} CPU (${status.cpu.count} cores)`);
  console.log(`   Usage: ${status.cpu.usage.toFixed(2)}%`);
  console.log(`   Load Average: ${status.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
  console.log('');

  // Memory
  const memEmoji = getStatusEmoji(status.memory.usagePercent);
  console.log(`${memEmoji} Memory`);
  console.log(`   Total: ${status.memory.total}`);
  console.log(`   Used:  ${status.memory.used} (${status.memory.usagePercent.toFixed(2)}%)`);
  console.log(`   Free:  ${status.memory.free}`);
  console.log('');

  // Disk
  const diskEmoji = getStatusEmoji(status.disk.usagePercent);
  console.log(`${diskEmoji} Disk`);
  console.log(`   Total: ${status.disk.total}`);
  console.log(`   Used:  ${status.disk.used} (${status.disk.usagePercent.toFixed(2)}%)`);
  console.log(`   Free:  ${status.disk.free}`);
  console.log('');

  // PM2 Processes
  if (status.pm2) {
    console.log('📊 PM2 Processes');
    console.log('   ' + '-'.repeat(76));
    console.log(`   ${'Name'.padEnd(25)} ${'Status'.padEnd(10)} ${'CPU'.padEnd(8)} ${'Memory'.padEnd(12)} ${'Uptime'.padEnd(10)} Restarts`);
    console.log('   ' + '-'.repeat(76));

    for (const proc of status.pm2.processes) {
      const statusIcon = proc.status === 'online' ? '✅' : '❌';
      console.log(
        `   ${statusIcon} ${proc.name.padEnd(23)} ${proc.status.padEnd(10)} ${proc.cpu.padEnd(8)} ${proc.memory.padEnd(12)} ${proc.uptime.padEnd(10)} ${proc.restarts}`
      );
    }
    console.log('');
  }

  // Alerts
  const alerts: string[] = [];
  if (status.cpu.usage > 80) alerts.push('⚠️  CPU usage is high (>80%)');
  if (status.memory.usagePercent > 85) alerts.push('⚠️  Memory usage is high (>85%)');
  if (status.disk.usagePercent > 90) alerts.push('⚠️  Disk usage is critical (>90%)');

  if (alerts.length > 0) {
    console.log('🚨 Alerts');
    alerts.forEach((alert) => console.log(`   ${alert}`));
    console.log('');
  }

  console.log('=' .repeat(80));
}

function saveToLog(status: ResourceStatus) {
  const logDir = './logs';
  const logFile = `${logDir}/resource-monitor.jsonl`;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  fs.appendFileSync(logFile, JSON.stringify(status) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch') || args.includes('-w');
  const interval = parseInt(args.find((a) => a.startsWith('--interval='))?.split('=')[1] || '5000');

  console.log('🔍 Checking server resources...\n');

  if (watchMode) {
    console.log(`📡 Watch mode enabled (updating every ${interval / 1000}s)`);
    console.log('   Press Ctrl+C to stop\n');

    setInterval(() => {
      const status = checkResources();
      printStatus(status);
      saveToLog(status);
    }, interval);

    // Initial check
    const status = checkResources();
    printStatus(status);
    saveToLog(status);
  } else {
    const status = checkResources();
    printStatus(status);
    saveToLog(status);

    console.log('💡 Tip: Use --watch for continuous monitoring');
    console.log('   Example: npx tsx scripts/monitor-resources.ts --watch');
    console.log('');
  }
}

main();
