#!/usr/bin/env tsx
/**
 * Pre-Deployment Checklist
 *
 * 部署前检查所有配置和依赖
 *
 * Usage: npx tsx scripts/pre-deployment-check.ts
 */

import fs from 'fs';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => boolean, successMsg: string, failMsg: string) {
  try {
    const passed = fn();
    results.push({
      name,
      status: passed ? 'pass' : 'fail',
      message: passed ? successMsg : failMsg,
    });
  } catch (error) {
    results.push({
      name,
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function warn(name: string, message: string) {
  results.push({ name, status: 'warn', message });
}

console.log('🔍 Running Pre-Deployment Checks...\n');

// ============================================================================
// 1. 环境变量检查
// ============================================================================
console.log('1️⃣  Checking Environment Variables...');

check(
  'NODE_ENV',
  () => process.env.NODE_ENV === 'production',
  'NODE_ENV is set to production',
  'NODE_ENV should be "production" for deployment'
);

check(
  'DATABASE_URL',
  () => !!process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://'),
  'DATABASE_URL is configured',
  'DATABASE_URL is missing or invalid'
);

check(
  'JWT_SECRET',
  () => !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
  'JWT_SECRET is configured (>=32 chars)',
  'JWT_SECRET is missing or too short'
);

check(
  'AWS S3',
  () =>
    !!process.env.AWS_ACCESS_KEY_ID &&
    !!process.env.AWS_SECRET_ACCESS_KEY &&
    !!process.env.S3_BUCKET_NAME,
  'AWS S3 credentials configured',
  'AWS S3 credentials missing'
);

check(
  'Email Service',
  () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
  'Email service configured',
  'Email service (Resend) not configured'
);

// ============================================================================
// 2. 文件和目录检查
// ============================================================================
console.log('\n2️⃣  Checking Files and Directories...');

check('dist/ exists', () => fs.existsSync('./dist'), 'Build output exists', 'Run "pnpm run build" first');

check(
  'dist/index.js exists',
  () => fs.existsSync('./dist/index.js'),
  'Main entry file exists',
  'dist/index.js not found - check build output'
);

check(
  '.env file',
  () => fs.existsSync('./.env'),
  '.env file exists',
  '.env file missing - copy from .env.example'
);

check(
  'ecosystem config',
  () => fs.existsSync('./ecosystem.config.cjs') || fs.existsSync('./ecosystem.config.js'),
  'PM2 config exists',
  'ecosystem.config.cjs missing'
);

check('logs/ directory', () => {
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
  }
  return fs.existsSync('./logs');
}, 'logs/ directory exists', 'Failed to create logs directory');

// ============================================================================
// 3. 依赖检查
// ============================================================================
console.log('\n3️⃣  Checking Dependencies...');

check(
  'node_modules',
  () => fs.existsSync('./node_modules'),
  'Dependencies installed',
  'Run "pnpm install" first'
);

check('package.json', () => {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
  return !!pkg.dependencies && !!pkg.scripts;
}, 'package.json is valid', 'package.json is invalid');

// ============================================================================
// 4. 系统检查
// ============================================================================
console.log('\n4️⃣  Checking System Requirements...');

check('Node.js version', () => {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  return major >= 18;
}, `Node.js ${process.version} (>= 18)`, 'Node.js version should be >= 18');

try {
  execSync('pm2 --version', { stdio: 'ignore' });
  results.push({
    name: 'PM2',
    status: 'pass',
    message: 'PM2 is installed',
  });
} catch {
  results.push({
    name: 'PM2',
    status: 'warn',
    message: 'PM2 not installed globally - run "npm install -g pm2"',
  });
}

try {
  execSync('git --version', { stdio: 'ignore' });
  results.push({
    name: 'Git',
    status: 'pass',
    message: 'Git is installed',
  });
} catch {
  results.push({
    name: 'Git',
    status: 'warn',
    message: 'Git not installed',
  });
}

// ============================================================================
// 5. 数据库检查
// ============================================================================
console.log('\n5️⃣  Checking Database...');

if (process.env.DATABASE_URL) {
  try {
    // 简单的PostgreSQL版本检查
    // 注意: 这需要postgres客户端，如果没有会跳过
    const version = execSync(
      `psql "${process.env.DATABASE_URL}" -c "SELECT version();" -t`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    results.push({
      name: 'Database Connection',
      status: 'pass',
      message: 'Database is accessible',
    });
  } catch {
    results.push({
      name: 'Database Connection',
      status: 'warn',
      message: 'Could not verify database connection (psql not available)',
    });
  }
} else {
  results.push({
    name: 'Database Connection',
    status: 'fail',
    message: 'DATABASE_URL not configured',
  });
}

// ============================================================================
// 6. 安全检查
// ============================================================================
console.log('\n6️⃣  Security Checks...');

const placeholders = ['your-', 'placeholder', 'change-me', 'xxx', 'example'];
const envVars = ['JWT_SECRET', 'DATABASE_URL', 'AWS_SECRET_ACCESS_KEY'];

for (const varName of envVars) {
  const value = process.env[varName];
  if (value && placeholders.some((p) => value.includes(p))) {
    warn(
      `${varName} Security`,
      `${varName} contains placeholder value - use real credentials`
    );
  }
}

check('.gitignore includes .env', () => {
  if (!fs.existsSync('./.gitignore')) return false;
  const gitignore = fs.readFileSync('./.gitignore', 'utf-8');
  return gitignore.includes('.env');
}, '.env is in .gitignore', '.env should be in .gitignore');

// ============================================================================
// 打印结果
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('📊 Check Results\n');

const passed = results.filter((r) => r.status === 'pass').length;
const failed = results.filter((r) => r.status === 'fail').length;
const warnings = results.filter((r) => r.status === 'warn').length;

for (const result of results) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️ ';
  console.log(`${icon} ${result.name}`);
  console.log(`   ${result.message}`);
}

console.log('\n' + '='.repeat(80));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log('='.repeat(80));

if (failed > 0) {
  console.log('\n❌ Deployment check FAILED');
  console.log('   Please fix the issues above before deploying.\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️  Deployment check passed with warnings');
  console.log('   Please review warnings above.\n');
  process.exit(0);
} else {
  console.log('\n✅ All checks passed! Ready for deployment.');
  console.log('\n📝 Next steps:');
  console.log('   1. Review environment variables: npx tsx scripts/check-env-config.ts');
  console.log('   2. Run database migrations: pnpm run db:push');
  console.log('   3. Start with PM2: pnpm run pm2:start');
  console.log('   4. Monitor resources: npx tsx scripts/monitor-resources.ts --watch\n');
  process.exit(0);
}
