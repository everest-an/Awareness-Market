#!/usr/bin/env tsx
/**
 * Environment Configuration Checker
 *
 * 检查所有必需的环境变量是否已正确配置
 *
 * Usage: npx tsx scripts/check-env-config.ts
 */

import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

interface EnvCheck {
  name: string;
  required: boolean;
  category: 'critical' | 'important' | 'optional';
  description: string;
  validator?: (value: string) => boolean;
  suggestion?: string;
}

const ENV_CHECKS: EnvCheck[] = [
  // Critical - Application
  {
    name: 'NODE_ENV',
    required: true,
    category: 'critical',
    description: 'Application environment',
    validator: (v) => ['development', 'production', 'test'].includes(v),
    suggestion: 'Set to "production" for deployment',
  },
  {
    name: 'PORT',
    required: false,
    category: 'important',
    description: 'Application port',
    validator: (v) => !isNaN(Number(v)) && Number(v) > 0 && Number(v) < 65536,
    suggestion: 'Default: 3001',
  },

  // Critical - Database
  {
    name: 'DATABASE_URL',
    required: true,
    category: 'critical',
    description: 'PostgreSQL connection string',
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    suggestion: 'postgresql://user:pass@host:5432/dbname',
  },

  // Critical - Authentication
  {
    name: 'JWT_SECRET',
    required: true,
    category: 'critical',
    description: 'JWT signing secret',
    validator: (v) => v.length >= 32,
    suggestion: 'Generate with: openssl rand -base64 32',
  },

  // Important - AWS S3
  {
    name: 'AWS_REGION',
    required: true,
    category: 'important',
    description: 'AWS region for S3',
    validator: (v) => /^[a-z]{2}-[a-z]+-\d{1}$/.test(v),
    suggestion: 'Example: us-east-1',
  },
  {
    name: 'AWS_ACCESS_KEY_ID',
    required: true,
    category: 'important',
    description: 'AWS access key for S3',
    validator: (v) => v.startsWith('AKIA') && v.length === 20,
    suggestion: 'Get from AWS IAM console',
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    required: true,
    category: 'important',
    description: 'AWS secret key for S3',
    validator: (v) => v.length === 40,
    suggestion: 'Get from AWS IAM console',
  },
  {
    name: 'S3_BUCKET_NAME',
    required: true,
    category: 'important',
    description: 'S3 bucket for vector packages',
    suggestion: 'Example: awareness-market-storage',
  },

  // Important - Email
  {
    name: 'RESEND_API_KEY',
    required: true,
    category: 'important',
    description: 'Resend API key for emails',
    validator: (v) => v.startsWith('re_'),
    suggestion: 'Get from https://resend.com/api-keys',
  },
  {
    name: 'EMAIL_FROM',
    required: true,
    category: 'important',
    description: 'Email sender address',
    validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    suggestion: 'Example: noreply@yourdomain.com',
  },

  // Optional - Payment
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    category: 'optional',
    description: 'Stripe secret key',
    validator: (v) => v.startsWith('sk_'),
    suggestion: 'Get from Stripe dashboard (optional for MVP)',
  },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    required: false,
    category: 'optional',
    description: 'Stripe publishable key',
    validator: (v) => v.startsWith('pk_'),
  },

  // Optional - OAuth
  {
    name: 'GITHUB_CLIENT_ID',
    required: false,
    category: 'optional',
    description: 'GitHub OAuth client ID',
  },
  {
    name: 'GITHUB_CLIENT_SECRET',
    required: false,
    category: 'optional',
    description: 'GitHub OAuth client secret',
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    category: 'optional',
    description: 'Google OAuth client ID',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    category: 'optional',
    description: 'Google OAuth client secret',
  },

  // Optional - Redis
  {
    name: 'REDIS_URL',
    required: false,
    category: 'optional',
    description: 'Redis connection URL',
    validator: (v) => v.startsWith('redis://') || v.startsWith('rediss://'),
    suggestion: 'Recommended for production rate limiting',
  },

  // Optional - Blockchain
  {
    name: 'FUJI_RPC_URL',
    required: false,
    category: 'optional',
    description: 'Avalanche Fuji testnet RPC',
  },
  {
    name: 'AVALANCHE_RPC_URL',
    required: false,
    category: 'optional',
    description: 'Avalanche mainnet RPC',
  },

  // Optional - AI
  {
    name: 'OPENAI_API_KEY',
    required: false,
    category: 'optional',
    description: 'OpenAI API key',
    validator: (v) => v.startsWith('sk-'),
  },
];

function generateJWTSecret(): string {
  return crypto.randomBytes(32).toString('base64');
}

function checkEnvironment() {
  console.log('🔍 Checking Environment Configuration\n');
  console.log('=' .repeat(80));

  const results = {
    critical: { passed: 0, failed: 0, warnings: 0 },
    important: { passed: 0, failed: 0, warnings: 0 },
    optional: { passed: 0, failed: 0, warnings: 0 },
  };

  const missing: EnvCheck[] = [];
  const invalid: Array<EnvCheck & { value: string; reason: string }> = [];
  const warnings: Array<EnvCheck & { value: string; reason: string }> = [];

  for (const check of ENV_CHECKS) {
    const value = process.env[check.name];
    const category = check.category;

    if (!value || value.trim() === '') {
      if (check.required) {
        missing.push(check);
        results[category].failed++;
      } else {
        results[category].warnings++;
      }
      continue;
    }

    // Validate if validator exists
    if (check.validator && !check.validator(value)) {
      invalid.push({
        ...check,
        value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
        reason: 'Invalid format',
      });
      results[category].failed++;
      continue;
    }

    // Check for placeholder values
    const placeholders = [
      'your-',
      'placeholder',
      'change-me',
      'xxx',
      'AKIA...',
      'sk_test_placeholder',
      'pk_test_placeholder',
    ];
    const isPlaceholder = placeholders.some((p) => value.includes(p));
    if (isPlaceholder) {
      warnings.push({
        ...check,
        value: value.substring(0, 20) + (value.length > 20 ? '...' : ''),
        reason: 'Contains placeholder value',
      });
      results[category].warnings++;
      continue;
    }

    results[category].passed++;
  }

  // Print results
  console.log('\n✅ CRITICAL VARIABLES');
  console.log(`   Passed: ${results.critical.passed}`);
  console.log(`   Failed: ${results.critical.failed}`);
  console.log(`   Warnings: ${results.critical.warnings}`);

  console.log('\n⚠️  IMPORTANT VARIABLES');
  console.log(`   Passed: ${results.important.passed}`);
  console.log(`   Failed: ${results.important.failed}`);
  console.log(`   Warnings: ${results.important.warnings}`);

  console.log('\n📋 OPTIONAL VARIABLES');
  console.log(`   Passed: ${results.optional.passed}`);
  console.log(`   Warnings: ${results.optional.warnings}`);

  // Print issues
  if (missing.length > 0) {
    console.log('\n❌ MISSING REQUIRED VARIABLES:\n');
    for (const check of missing) {
      console.log(`   ${check.name} (${check.category})`);
      console.log(`   └─ ${check.description}`);
      if (check.suggestion) {
        console.log(`   └─ Suggestion: ${check.suggestion}`);
      }
      console.log('');
    }
  }

  if (invalid.length > 0) {
    console.log('\n⚠️  INVALID VALUES:\n');
    for (const item of invalid) {
      console.log(`   ${item.name}: "${item.value}"`);
      console.log(`   └─ ${item.reason}`);
      if (item.suggestion) {
        console.log(`   └─ ${item.suggestion}`);
      }
      console.log('');
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    for (const item of warnings) {
      console.log(`   ${item.name}: "${item.value}"`);
      console.log(`   └─ ${item.reason}`);
      console.log('');
    }
  }

  // Generate missing secrets
  console.log('\n🔐 QUICK FIXES:\n');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your-')) {
    const newSecret = generateJWTSecret();
    console.log(`   # Generate JWT_SECRET`);
    console.log(`   JWT_SECRET=${newSecret}`);
    console.log('');
  }

  // Final summary
  console.log('=' .repeat(80));
  const totalFailed = results.critical.failed + results.important.failed;
  const totalWarnings = results.critical.warnings + results.important.warnings + results.optional.warnings;

  if (totalFailed === 0 && totalWarnings === 0) {
    console.log('\n✅ All environment variables are properly configured!');
    console.log('   Ready for deployment.\n');
    process.exit(0);
  } else if (totalFailed === 0) {
    console.log(`\n⚠️  Configuration complete with ${totalWarnings} warnings.`);
    console.log('   Please review warnings above.\n');
    process.exit(0);
  } else {
    console.log(`\n❌ Configuration incomplete: ${totalFailed} critical/important variables missing.`);
    console.log('   Please fix the issues above before deployment.\n');
    process.exit(1);
  }
}

checkEnvironment();
