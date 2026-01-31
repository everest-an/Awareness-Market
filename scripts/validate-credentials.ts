/**
 * Credential Validation Script
 *
 * Checks .env file for unsafe or placeholder credentials
 * Run: npx tsx scripts/validate-credentials.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface ValidationRule {
  key: string;
  required: boolean;
  minLength?: number;
  pattern?: RegExp;
  notContain?: string[];
  description: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    key: 'JWT_SECRET',
    required: true,
    minLength: 32,
    notContain: ['your-secure', 'change', 'placeholder', 'secret', 'CHANGE_ME'],
    description: 'JWT signing secret (min 32 chars, use: openssl rand -base64 64)',
  },
  {
    key: 'AWS_ACCESS_KEY_ID',
    required: false,
    pattern: /^AKIA[A-Z0-9]{16}$/,
    notContain: ['your-access', 'CHANGE_ME', 'placeholder'],
    description: 'AWS Access Key ID (format: AKIA...)',
  },
  {
    key: 'AWS_SECRET_ACCESS_KEY',
    required: false,
    minLength: 40,
    notContain: ['your-secret', 'CHANGE_ME', 'placeholder'],
    description: 'AWS Secret Access Key (40 chars)',
  },
  {
    key: 'RESEND_API_KEY',
    required: false,
    pattern: /^re_[a-zA-Z0-9]+$/,
    notContain: ['your-resend', 'CHANGE_ME', 'placeholder'],
    description: 'Resend API Key (format: re_...)',
  },
  {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    pattern: /^sk_(test|live)_[a-zA-Z0-9]+$/,
    notContain: ['placeholder'],
    description: 'Stripe Secret Key (format: sk_test_... or sk_live_...)',
  },
  {
    key: 'DATABASE_URL',
    required: true,
    pattern: /^mysql:\/\/.+/,
    notContain: ['root:password@localhost'],
    description: 'Database connection URL',
  },
  {
    key: 'DEPLOYER_PRIVATE_KEY',
    required: false,
    minLength: 64,
    notContain: ['your-private', 'CHANGE_ME'],
    description: 'Blockchain deployer private key (64 hex chars)',
  },
];

function validateEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.log(`${RED}ERROR: .env file not found${RESET}`);
    console.log('Copy .env.example to .env and fill in your values');
    process.exit(1);
  }

  const envConfig = dotenv.parse(fs.readFileSync(envPath));

  console.log('\n========================================');
  console.log('🔐 Credential Validation Report');
  console.log('========================================\n');

  let hasErrors = false;
  let hasWarnings = false;

  for (const rule of VALIDATION_RULES) {
    const value = envConfig[rule.key];
    const issues: string[] = [];

    // Check if required
    if (rule.required && !value) {
      issues.push('Missing required value');
    }

    if (value) {
      // Check minimum length
      if (rule.minLength && value.length < rule.minLength) {
        issues.push(`Too short (min ${rule.minLength} chars, got ${value.length})`);
      }

      // Check pattern
      if (rule.pattern && !rule.pattern.test(value)) {
        issues.push(`Invalid format`);
      }

      // Check forbidden strings
      if (rule.notContain) {
        for (const forbidden of rule.notContain) {
          if (value.toLowerCase().includes(forbidden.toLowerCase())) {
            issues.push(`Contains unsafe placeholder: "${forbidden}"`);
          }
        }
      }
    }

    // Print result
    const status = issues.length === 0
      ? `${GREEN}✓${RESET}`
      : rule.required
        ? `${RED}✗${RESET}`
        : `${YELLOW}⚠${RESET}`;

    console.log(`${status} ${rule.key}`);
    console.log(`   ${rule.description}`);

    if (issues.length > 0) {
      for (const issue of issues) {
        console.log(`   ${RED}→ ${issue}${RESET}`);
      }
      if (rule.required) hasErrors = true;
      else hasWarnings = true;
    }
    console.log('');
  }

  console.log('========================================');

  if (hasErrors) {
    console.log(`${RED}❌ Validation FAILED - Fix required issues${RESET}`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`${YELLOW}⚠️  Validation PASSED with warnings${RESET}`);
    console.log('   Review optional credentials before production');
  } else {
    console.log(`${GREEN}✅ Validation PASSED${RESET}`);
  }

  console.log('========================================\n');
}

// Additional security checks
function checkGitIgnore(): void {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.env')) {
      console.log(`${RED}⚠️  WARNING: .env is not in .gitignore!${RESET}`);
      console.log('   Add ".env" to .gitignore immediately\n');
    }
  }
}

function checkGitHistory(): void {
  console.log('\n========================================');
  console.log('🔍 Git History Check');
  console.log('========================================');
  console.log('Run this command to check for leaked secrets:');
  console.log('  git log --all --full-history -- .env');
  console.log('  git log -p --all -S "AWS_SECRET_ACCESS_KEY"');
  console.log('\nIf secrets were ever committed, you should:');
  console.log('  1. Rotate ALL affected credentials immediately');
  console.log('  2. Use git-filter-branch or BFG to remove from history');
  console.log('  3. Force push to all remotes');
  console.log('========================================\n');
}

// Run validation
checkGitIgnore();
validateEnv();
checkGitHistory();
