#!/usr/bin/env node
/**
 * Test Database Connection Script
 *
 * This script tests the connection to your PostgreSQL database
 * and verifies that Prisma can connect successfully.
 *
 * Usage:
 *   node scripts/test-db-connection.js
 *
 * Requirements:
 *   - DATABASE_URL must be set in .env file
 *   - Prisma Client must be generated (npm run prisma:generate)
 */

const { PrismaClient } = require('@prisma/client');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testConnection() {
  log('\n🔍 Testing Database Connection...', colors.cyan);
  log('━'.repeat(50), colors.cyan);

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    log('❌ DATABASE_URL is not set in environment variables', colors.red);
    log('Please set it in your .env file', colors.yellow);
    process.exit(1);
  }

  // Mask password in URL for display
  const maskedUrl = process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@');
  log(`\n📡 Connection String: ${maskedUrl}`, colors.white);

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    // Test 1: Basic connection
    log('\n[1/4] Testing basic connection...', colors.yellow);
    await prisma.$connect();
    log('✅ Connection established!', colors.green);

    // Test 2: Query PostgreSQL version
    log('\n[2/4] Querying PostgreSQL version...', colors.yellow);
    const versionResult = await prisma.$queryRaw`SELECT version()`;
    const version = versionResult[0].version;
    log(`✅ ${version.split(' ').slice(0, 2).join(' ')}`, colors.green);

    // Test 3: Check database name
    log('\n[3/4] Checking current database...', colors.yellow);
    const dbResult = await prisma.$queryRaw`SELECT current_database()`;
    const dbName = dbResult[0].current_database;
    log(`✅ Connected to database: ${dbName}`, colors.green);

    // Test 4: List tables
    log('\n[4/4] Checking tables...', colors.yellow);
    const tablesResult = await prisma.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    if (tablesResult.length === 0) {
      log('⚠️  No tables found (migrations not yet applied)', colors.yellow);
      log('\nNext step: Run migrations', colors.cyan);
      log('  npx prisma migrate deploy', colors.white);
    } else {
      log(`✅ Found ${tablesResult.length} table(s):`, colors.green);
      tablesResult.forEach((row) => {
        log(`   - ${row.tablename}`, colors.white);
      });
    }

    // Success summary
    log('\n━'.repeat(50), colors.green);
    log('✨ All connection tests passed!', colors.green);
    log('━'.repeat(50), colors.green);

    // Additional info
    log('\n📊 Connection Details:', colors.cyan);
    const connectionInfo = await prisma.$queryRaw`
      SELECT
        current_user as username,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port
    `;
    log(`   User: ${connectionInfo[0].username}`, colors.white);
    if (connectionInfo[0].server_ip) {
      log(`   Server: ${connectionInfo[0].server_ip}:${connectionInfo[0].server_port}`, colors.white);
    }

  } catch (error) {
    log('\n━'.repeat(50), colors.red);
    log('❌ Connection Test Failed', colors.red);
    log('━'.repeat(50), colors.red);

    log(`\n${colors.red}Error: ${error.message}${colors.reset}`);

    // Provide helpful error messages
    if (error.message.includes('timeout')) {
      log('\n💡 Troubleshooting Tips:', colors.yellow);
      log('1. Check if RDS instance is running (status: available)', colors.white);
      log('2. Verify security group allows your IP on port 5432', colors.white);
      log('3. Confirm "Publicly accessible" is enabled in RDS', colors.white);
    } else if (error.message.includes('password authentication failed')) {
      log('\n💡 Troubleshooting Tips:', colors.yellow);
      log('1. Check the password in DATABASE_URL', colors.white);
      log('2. Ensure no special characters need URL encoding', colors.white);
      log('3. Verify username is correct (should be: postgres)', colors.white);
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      log('\n💡 Troubleshooting Tips:', colors.yellow);
      log('1. Check database name in DATABASE_URL', colors.white);
      log('2. Ensure database "awareness_market" was created', colors.white);
      log('3. Try connecting to default "postgres" database first', colors.white);
    } else if (error.message.includes('getaddrinfo')) {
      log('\n💡 Troubleshooting Tips:', colors.yellow);
      log('1. Check if endpoint address is correct', colors.white);
      log('2. Verify DNS resolution is working', colors.white);
      log('3. Ensure RDS instance is in "available" state', colors.white);
    }

    log('\n📖 Full error details:', colors.cyan);
    console.error(error);

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testConnection();
