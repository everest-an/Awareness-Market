/**
 * Test Database Connection
 *
 * Tests connection to AWS RDS and displays database status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic Connection');
    console.log('-'.repeat(60));

    const startTime = Date.now();
    await prisma.$connect();
    const connectTime = Date.now() - startTime;

    console.log('✅ Connected successfully!');
    console.log(`   Connection time: ${connectTime}ms\n`);

    // Test 2: Database version
    console.log('Test 2: Database Version');
    console.log('-'.repeat(60));

    const versionResult = await prisma.$queryRaw`SELECT version();` as any[];
    console.log('✅ PostgreSQL version:');
    console.log(`   ${versionResult[0].version}\n`);

    // Test 3: pgvector extension
    console.log('Test 3: pgvector Extension');
    console.log('-'.repeat(60));

    const extensionResult = await prisma.$queryRaw`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector';
    ` as any[];

    if (extensionResult.length > 0) {
      console.log('✅ pgvector installed:');
      console.log(`   Version: ${extensionResult[0].extversion}\n`);
    } else {
      console.log('⚠️  pgvector NOT installed');
      console.log('   Run: psql $DATABASE_URL < prisma/migrations/00_install_pgvector.sql\n');
    }

    // Test 4: memory_entries table
    console.log('Test 4: Memory System Tables');
    console.log('-'.repeat(60));

    const tableResult = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('memory_entries', 'memory_scores', 'memory_conflicts')
      ORDER BY table_name;
    ` as any[];

    const tables = tableResult.map(r => r.table_name);

    if (tables.includes('memory_entries')) {
      console.log('✅ memory_entries table exists');
    } else {
      console.log('⚠️  memory_entries table NOT found');
      console.log('   Run: psql $DATABASE_URL < prisma/migrations/01_create_memory_system.sql');
    }

    if (tables.includes('memory_scores')) {
      console.log('✅ memory_scores table exists');
    }

    if (tables.includes('memory_conflicts')) {
      console.log('✅ memory_conflicts table exists (Phase 1 完成)');
    } else {
      console.log('⚠️  memory_conflicts table NOT found');
      console.log('   Run: pnpm run memory:migrate');
    }

    console.log('');

    // Test 5: Phase B fields
    if (tables.includes('memory_entries')) {
      console.log('Test 5: Phase B Fields (第1阶段)');
      console.log('-'.repeat(60));

      const columnsResult = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'memory_entries'
          AND column_name IN ('claim_key', 'claim_value', 'root_id', 'agent_id', 'department', 'role')
        ORDER BY column_name;
      ` as any[];

      const phaseColumns = columnsResult.map(r => r.column_name);

      const expectedColumns = ['claim_key', 'claim_value', 'root_id', 'agent_id', 'department', 'role'];
      const missingColumns = expectedColumns.filter(col => !phaseColumns.includes(col));

      if (missingColumns.length === 0) {
        console.log('✅ All Phase B fields present:');
        phaseColumns.forEach(col => console.log(`   - ${col}`));
        console.log('');
      } else {
        console.log(`⚠️  Missing ${missingColumns.length} Phase B fields:`);
        missingColumns.forEach(col => console.log(`   - ${col}`));
        console.log('\n   Run: pnpm run memory:migrate\n');
      }
    }

    // Test 6: Memory count
    if (tables.includes('memory_entries')) {
      console.log('Test 6: Memory Entries Count');
      console.log('-'.repeat(60));

      const countResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM memory_entries;
      ` as any[];

      console.log(`✅ Total memories: ${countResult[0].count}\n`);
    }

    // Summary
    console.log('=' .repeat(60));
    console.log('📊 Connection Test Summary\n');

    const status = {
      connected: true,
      pgvector: extensionResult.length > 0,
      base_tables: tables.includes('memory_entries'),
      phase_b_ready: tables.includes('memory_conflicts'),
    };

    if (status.connected && status.pgvector && status.base_tables && status.phase_b_ready) {
      console.log('🎉 Database is ready for Phase 1 testing!');
      console.log('   Next step: pnpm run memory:test\n');
    } else if (status.connected && status.pgvector && status.base_tables) {
      console.log('⚠️  Database needs Phase 1 migration');
      console.log('   Next step: pnpm run memory:migrate\n');
    } else if (status.connected && status.pgvector) {
      console.log('⚠️  Database needs initial setup');
      console.log('   Next step: psql $DATABASE_URL < prisma/migrations/01_create_memory_system.sql\n');
    } else if (status.connected) {
      console.log('⚠️  Database needs pgvector extension');
      console.log('   Next step: psql $DATABASE_URL < prisma/migrations/00_install_pgvector.sql\n');
    }

  } catch (error: any) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.error('\nPossible causes:');
    console.error('  1. AWS RDS instance is stopped or not available');
    console.error('  2. Security group blocking port 5432');
    console.error('  3. Incorrect DATABASE_URL in .env');
    console.error('  4. Network/VPC configuration issue');
    console.error('\nDatabase URL (from .env):');
    console.error('  Host:', process.env.DATABASE_URL?.match(/\/\/([^:@]+@)?([^:\/]+)/)?.[2] || 'unknown');
    console.error('\n💡 Options:');
    console.error('  - Start AWS RDS: https://console.aws.amazon.com/rds/');
    console.error('  - Use local database: DATABASE_URL=postgresql://localhost:5432/awareness_market');
    console.error('  - Check security group: Allow port 5432 from your IP\n');

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testConnection();
