#!/usr/bin/env tsx
/**
 * Check pgvector Extension
 *
 * Verifies that PostgreSQL has the pgvector extension installed
 *
 * Usage: npx tsx scripts/check-pgvector.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkPgVector() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('   Please configure your .env file first');
    process.exit(1);
  }

  console.log('🔍 Checking pgvector extension...\n');

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    sql = postgres(connectionString);

    // Check if extension is available
    const availableExtensions = await sql`
      SELECT * FROM pg_available_extensions WHERE name = 'vector'
    `;

    if (availableExtensions.length === 0) {
      console.error('❌ pgvector extension is NOT available on this PostgreSQL server');
      console.log('\n📚 Installation guide:');
      console.log('   - For managed PostgreSQL (Supabase, Railway, Neon): Enable in dashboard');
      console.log('   - For self-hosted: https://github.com/pgvector/pgvector#installation');
      process.exit(1);
    }

    console.log('✅ pgvector extension is available');
    console.log(`   Available version: ${availableExtensions[0].default_version}\n`);

    // Check if extension is installed
    const installedExtensions = await sql`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
    `;

    if (installedExtensions.length === 0) {
      console.log('⚠️  pgvector extension is available but NOT installed');
      console.log('\n🔧 To install, run this SQL command:');
      console.log('   CREATE EXTENSION vector;\n');
      console.log('Or run: npx tsx scripts/setup-pgvector.sql\n');
      process.exit(1);
    }

    console.log('✅ pgvector extension is installed');
    console.log(`   Installed version: ${installedExtensions[0].extversion}\n`);

    // Test vector operations
    try {
      const testResult = await sql`
        SELECT '[1,2,3]'::vector(3) <-> '[4,5,6]'::vector(3) AS distance
      `;
      console.log('✅ Vector operations working correctly');
      console.log(`   Test distance calculation: ${testResult[0].distance}\n`);
    } catch (error) {
      console.error('❌ Vector operations test failed:', error);
      process.exit(1);
    }

    // Check for existing vector columns
    const vectorColumns = await sql`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE data_type = 'USER-DEFINED'
        AND udt_name = 'vector'
      ORDER BY table_name, column_name
    `;

    if (vectorColumns.length > 0) {
      console.log('📊 Existing vector columns:');
      vectorColumns.forEach((col: any) => {
        console.log(`   - ${col.table_name}.${col.column_name}`);
      });
    } else {
      console.log('📊 No vector columns found yet (will be created by migration)');
    }

    console.log('\n🎉 pgvector is ready for use!');
    console.log('\nNext steps:');
    console.log('   1. Generate migration: pnpm run db:generate');
    console.log('   2. Apply migration: pnpm run db:push');
    console.log('   3. Start development: pnpm run dev\n');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   - Check DATABASE_URL is correct');
    console.log('   - Ensure PostgreSQL server is running');
    console.log('   - Verify network connectivity\n');
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}

checkPgVector().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
