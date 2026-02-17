/**
 * One-off migration script: run with `npx tsx scripts/run-migration-04.ts`
 * Uses Prisma's $executeRawUnsafe to apply migration 04 (provider_keys table).
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const sqlFile = path.join(process.cwd(), 'prisma/migrations/04_add_provider_keys.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  // Split on statement boundaries — Prisma executeRawUnsafe handles one statement at a time
  // We'll split on the DO $$ blocks and individual statements carefully
  const statements = splitStatements(sql);

  console.log(`Running ${statements.length} SQL statements…`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  [${i + 1}/${statements.length}] OK`);
    } catch (err: any) {
      // Ignore "already exists" errors for idempotency
      if (err.message?.includes('already exists') || err.code === '42P07' || err.code === '42710') {
        console.log(`  [${i + 1}/${statements.length}] Skipped (already exists)`);
      } else {
        console.error(`  [${i + 1}/${statements.length}] FAILED: ${err.message}`);
        throw err;
      }
    }
  }

  console.log('\nMigration 04 applied successfully.');
}

/**
 * Split SQL file into individual executable statements.
 * Handles DO $$ ... $$ blocks as single statements.
 */
function splitStatements(sql: string): string[] {
  const results: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comment-only lines at top level
    if (!inDollarQuote && trimmed.startsWith('--')) {
      continue;
    }

    current += line + '\n';

    // Track $$ dollar-quoting
    if (!inDollarQuote) {
      const match = current.match(/(\$[^$]*\$)/g);
      if (match && match.length % 2 === 1) {
        inDollarQuote = true;
        dollarTag = match[match.length - 1];
      }
    } else {
      if (current.includes(dollarTag, current.lastIndexOf(dollarTag) === current.indexOf(dollarTag) ? current.indexOf(dollarTag) + 1 : 0)) {
        inDollarQuote = false;
      }
    }

    // Statement ends with ; at top level
    if (!inDollarQuote && trimmed.endsWith(';')) {
      results.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    results.push(current.trim());
  }

  return results.filter(s => s.length > 0);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
