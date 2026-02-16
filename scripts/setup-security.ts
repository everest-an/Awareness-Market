/**
 * Security Setup Script
 *
 * Automated setup and verification for P1+P2 security enhancements
 * Run: npx tsx scripts/setup-security.ts
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

// ============================================================================
// Step 1: Check Prerequisites
// ============================================================================

async function checkPrerequisites(): Promise<boolean> {
  log('\n📋 Checking prerequisites...', 'blue');

  let allGood = true;

  // Check Node.js version
  const nodeVersion = process.version;
  if (parseInt(nodeVersion.slice(1)) < 18) {
    error(`Node.js version must be >= 18.x (current: ${nodeVersion})`);
    allGood = false;
  } else {
    success(`Node.js version: ${nodeVersion}`);
  }

  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    error('.env file not found');
    info('Copy .env.security.template to .env and fill in values');
    allGood = false;
  } else {
    success('.env file found');
  }

  // Check if Prisma is installed
  try {
    execSync('npx prisma --version', { stdio: 'ignore' });
    success('Prisma CLI installed');
  } catch {
    error('Prisma CLI not found');
    allGood = false;
  }

  // Check if Redis is accessible
  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || '6379';
    execSync(`redis-cli -h ${redisHost} -p ${redisPort} ping`, { stdio: 'ignore' });
    success(`Redis accessible at ${redisHost}:${redisPort}`);
  } catch {
    warning('Redis not accessible (required for rate limiting)');
  }

  return allGood;
}

// ============================================================================
// Step 2: Generate Security Keys
// ============================================================================

function generateSecurityKeys() {
  log('\n🔑 Generating security keys...', 'blue');

  // Check if encryption key exists
  if (!process.env.ENCRYPTION_KEY) {
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    warning('ENCRYPTION_KEY not set in .env');
    info(`Add this to your .env file:`);
    log(`ENCRYPTION_KEY=${encryptionKey}`, 'yellow');
  } else {
    success('ENCRYPTION_KEY configured');
  }

  // Check if JWT secret exists
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'CHANGE_ME_TO_A_SECURE_SECRET_AT_LEAST_32_CHARACTERS') {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    warning('JWT_SECRET not set or using default');
    info(`Add this to your .env file:`);
    log(`JWT_SECRET=${jwtSecret}`, 'yellow');
  } else {
    success('JWT_SECRET configured');
  }
}

// ============================================================================
// Step 3: Run Database Migrations
// ============================================================================

async function runDatabaseMigrations() {
  log('\n🗄️  Running database migrations...', 'blue');

  try {
    // Check database connection
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    success('Database schema updated');

    // Generate Prisma client
    execSync('npx prisma generate', { stdio: 'inherit' });
    success('Prisma client generated');
  } catch (error) {
    error('Database migration failed');
    throw error;
  }
}

// ============================================================================
// Step 4: Verify Security Features
// ============================================================================

async function verifySecurityFeatures() {
  log('\n🔍 Verifying security features...', 'blue');

  // Check encryption
  try {
    const { testEncryption, isEncryptionConfigured } = await import('../server/utils/encryption');

    if (!isEncryptionConfigured()) {
      warning('Encryption not configured (ENCRYPTION_KEY missing)');
    } else if (!testEncryption()) {
      error('Encryption test failed');
    } else {
      success('Encryption working correctly');
    }
  } catch (error) {
    warning('Could not test encryption (module not found)');
  }

  // Check database tables
  try {
    const { prisma } = await import('../server/db-prisma');

    const tables = [
      'api_key_rotation_history',
      'ip_whitelists',
      'ip_access_logs',
      'user_sessions',
    ];

    for (const table of tables) {
      try {
        await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`);
        success(`Table exists: ${table}`);
      } catch {
        error(`Table missing: ${table}`);
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    warning('Could not verify database tables');
  }
}

// ============================================================================
// Step 5: Display Security Checklist
// ============================================================================

function displaySecurityChecklist() {
  log('\n📝 Security Configuration Checklist', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const checklist = [
    { name: 'ENCRYPTION_KEY', required: true, env: 'ENCRYPTION_KEY' },
    { name: 'JWT_SECRET', required: true, env: 'JWT_SECRET' },
    { name: 'Database backup S3 bucket', required: false, env: 'S3_BACKUP_BUCKET' },
    { name: 'AWS credentials for backup', required: false, env: 'AWS_ACCESS_KEY_ID' },
    { name: 'Email service for notifications', required: false, env: 'EMAIL_SERVICE' },
    { name: 'Redis for rate limiting', required: true, env: 'REDIS_HOST' },
    { name: 'Session timeout config', required: false, env: 'SESSION_IDLE_TIMEOUT_MINUTES' },
  ];

  for (const item of checklist) {
    const value = process.env[item.env];
    const configured = !!value;

    if (configured) {
      success(`${item.name}`);
    } else if (item.required) {
      error(`${item.name} (REQUIRED)`);
    } else {
      warning(`${item.name} (optional)`);
    }
  }
}

// ============================================================================
// Step 6: Display Next Steps
// ============================================================================

function displayNextSteps() {
  log('\n🚀 Next Steps', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const steps = [
    '1. Review .env file and ensure all required keys are set',
    '2. Start Redis: redis-server',
    '3. Start your application: pnpm dev',
    '4. Start security workers (see SECURITY_DEPLOYMENT_GUIDE.md)',
    '5. Test rate limiting: curl http://localhost:3000/api/health (101 times)',
    '6. Enable API key auto-rotation for production keys',
    '7. Configure IP whitelist for organization (if needed)',
    '8. Review session management settings',
    '9. Set up monitoring alerts (see deployment guide)',
    '10. Schedule regular security audits',
  ];

  steps.forEach((step) => {
    info(step);
  });

  log('\n📚 Documentation:', 'blue');
  info('- SECURITY_DEPLOYMENT_GUIDE.md (complete deployment guide)');
  info('- SECURITY_ENHANCEMENTS_P1.md (P1 features)');
  info('- docs/P2-API-KEY-AUTO-ROTATION.md');
  info('- docs/P2-IP-WHITELIST-CONTROL.md');
  info('- docs/P2-SESSION-MANAGEMENT.md');
}

// ============================================================================
// Main Setup Function
// ============================================================================

async function main() {
  log('╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Awareness Network - Security Setup                   ║', 'cyan');
  log('║  P1 + P2 Security Enhancements                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  try {
    // Step 1: Prerequisites
    const prereqsOk = await checkPrerequisites();
    if (!prereqsOk) {
      error('\nPrerequisites check failed. Please fix the issues above and try again.');
      process.exit(1);
    }

    // Step 2: Generate keys
    generateSecurityKeys();

    // Step 3: Database migrations
    await runDatabaseMigrations();

    // Step 4: Verify features
    await verifySecurityFeatures();

    // Step 5: Checklist
    displaySecurityChecklist();

    // Step 6: Next steps
    displayNextSteps();

    log('\n✅ Security setup completed successfully!', 'green');
    log('\n💡 Tip: Run this script again after updating .env to verify configuration', 'cyan');
  } catch (error) {
    error('\n❌ Setup failed');
    console.error(error);
    process.exit(1);
  }
}

// Run setup
main();
