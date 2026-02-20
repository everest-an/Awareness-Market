/**
 * Database Migration Runner
 *
 * Checks for missing tables and applies SQL migrations in order.
 * Safe to run multiple times — all migrations use IF NOT EXISTS / idempotent patterns.
 *
 * Usage:
 *   npx tsx scripts/run-migrations.ts
 *   # or on server:
 *   node -e "require('./scripts/run-migrations.js').runMigrations()"
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface MigrationFile {
  name: string;
  path: string;
  order: number;
}

const MIGRATIONS_DIR = path.resolve(__dirname, '../prisma/migrations');

function discoverMigrations(): MigrationFile[] {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(f => {
    const match = f.match(/^(\d+)/);
    return {
      name: f,
      path: path.join(MIGRATIONS_DIR, f),
      order: match ? parseInt(match[1], 10) : 999,
    };
  });
}

async function tableExists(tableName: string): Promise<boolean> {
  const result: any[] = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    tableName,
  );
  return result.length > 0;
}

export async function checkWorkspaceTables(): Promise<{
  workspaces: boolean;
  workspaceAgents: boolean;
  allReady: boolean;
}> {
  const workspaces = await tableExists('workspaces');
  const workspaceAgents = await tableExists('workspace_agents');
  return {
    workspaces,
    workspaceAgents,
    allReady: workspaces && workspaceAgents,
  };
}

export async function runMigrations(): Promise<void> {
  console.log('=== Awareness Market — Database Migration Runner ===\n');

  // Check connectivity
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('[OK] Database connection successful\n');
  } catch (err) {
    console.error('[FAIL] Cannot connect to database:', (err as Error).message);
    process.exit(1);
  }

  // Check existing tables
  const coreTablesCheck = [
    'users', 'mcp_tokens', 'ai_memory',
    'workspaces', 'workspace_agents',
    'memory_entries', 'memory_policies',
  ];

  console.log('Table status:');
  for (const table of coreTablesCheck) {
    const exists = await tableExists(table);
    console.log(`  ${exists ? '[EXISTS]' : '[MISSING]'} ${table}`);
  }
  console.log('');

  // Run all migrations (idempotent)
  const migrations = discoverMigrations();
  console.log(`Found ${migrations.length} migration files:\n`);

  for (const mig of migrations) {
    console.log(`  Running ${mig.name}...`);
    try {
      const sql = fs.readFileSync(mig.path, 'utf-8');
      // Split by semicolons and execute statements (skip empty)
      // For complex PL/pgSQL blocks, we run the whole file at once
      await prisma.$executeRawUnsafe(sql);
      console.log(`  [OK] ${mig.name} applied`);
    } catch (err: any) {
      // Some statements may fail if already applied — that's expected
      if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
        console.log(`  [SKIP] ${mig.name} (already applied)`);
      } else {
        console.error(`  [WARN] ${mig.name}: ${err.message?.substring(0, 120)}`);
      }
    }
  }

  // Verify
  console.log('\nPost-migration check:');
  const status = await checkWorkspaceTables();
  console.log(`  workspaces:       ${status.workspaces ? '[OK]' : '[MISSING]'}`);
  console.log(`  workspace_agents: ${status.workspaceAgents ? '[OK]' : '[MISSING]'}`);

  if (status.allReady) {
    console.log('\n=== All workspace tables ready! ===');
  } else {
    console.log('\n=== WARNING: Some tables are still missing. Run individual SQL files manually. ===');
    console.log('  psql $DATABASE_URL -f prisma/migrations/06_add_workspaces.sql');
    console.log('  psql $DATABASE_URL -f prisma/migrations/07_enhance_workspace_agents.sql');
  }

  await prisma.$disconnect();
}

// Run if executed directly
if (require.main === module) {
  runMigrations().catch(console.error);
}
