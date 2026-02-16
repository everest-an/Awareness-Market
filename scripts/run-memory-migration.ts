/**
 * Run Memory System Phase 1 Migration
 *
 * This script runs the Phase B fields migration (02_add_phase_b_fields.sql)
 * to add conflict detection, version tree, and permission fields.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting Phase 1 Migration (02_add_phase_b_fields.sql)...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '02_add_phase_b_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.match(/^\/\*/) || statement.trim() === '') {
        continue;
      }

      // Log statement being executed (truncated)
      const preview = statement.substring(0, 80).replace(/\n/g, ' ') + '...';
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}`);

      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`  ✅ Success\n`);
      } catch (error: any) {
        // Ignore "already exists" errors (idempotent migration)
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate key') ||
            error.message.includes('column') && error.message.includes('already exists')) {
          console.log(`  ⚠️  Already exists (skipping)\n`);
          continue;
        }
        throw error;
      }
    }

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check new columns
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'memory_entries'
        AND column_name IN ('claim_key', 'claim_value', 'root_id', 'agent_id', 'department', 'role')
      ORDER BY column_name;
    ` as any[];

    console.log('New columns in memory_entries:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check memory_conflicts table
    const conflictTable = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'memory_conflicts';
    ` as any[];

    if (conflictTable.length > 0) {
      console.log('\n✅ memory_conflicts table created');
    }

    // Check indexes
    const indexes = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('memory_entries', 'memory_conflicts')
        AND (indexname LIKE '%claim%' OR indexname LIKE '%root%' OR indexname LIKE '%department%' OR indexname LIKE '%agent%')
      ORDER BY indexname;
    ` as any[];

    console.log('\nNew indexes created:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

    // Check triggers
    const triggers = await prisma.$queryRaw`
      SELECT trigger_name, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table = 'memory_entries'
        AND trigger_name IN ('memory_entries_detect_conflicts', 'memory_entries_set_root_id')
      ORDER BY trigger_name;
    ` as any[];

    console.log('\nTriggers created:');
    triggers.forEach(trg => {
      console.log(`  - ${trg.trigger_name} (${trg.event_manipulation})`);
    });

    console.log('\n🎉 Phase 1 Migration verification complete!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration();
