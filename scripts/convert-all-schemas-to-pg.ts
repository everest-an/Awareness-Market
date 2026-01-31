#!/usr/bin/env tsx
/**
 * Convert all MySQL schemas to PostgreSQL
 */

import fs from 'fs';
import path from 'path';

const schemasToConvert = [
  'schema-memory-nft',
  'schema-workflow',
  'schema-api-usage',
  'schema-latentmas-packages',
  'schema-mcp-tokens',
  'schema-storage-tiers',
];

function convertSchema(content: string): string {
  let converted = content;

  // Convert imports
  converted = converted.replace(/from ['"]drizzle-orm\/mysql-core['"]/g, 'from "drizzle-orm/pg-core"');

  // Convert type imports
  converted = converted.replace(/\bint\b/g, 'integer');
  converted = converted.replace(/\bmysqlTable\b/g, 'pgTable');
  converted = converted.replace(/\bmysqlEnum\b/g, 'pgEnum');
  converted = converted.replace(/\blongtext\b/g, 'text');
  converted = converted.replace(/\bdecimal\b/g, 'numeric');

  // Convert autoincrement to serial
  converted = converted.replace(/integer\("id"\)\.autoincrement\(\)\.primaryKey\(\)/g, 'serial("id").primaryKey()');
  converted = converted.replace(/integer\("(\w+)"\)\.autoincrement\(\)/g, 'serial("$1")');

  // Remove onUpdateNow
  converted = converted.replace(/\.onUpdateNow\(\)/g, '');

  return converted;
}

console.log('🔄 Converting all MySQL schemas to PostgreSQL...\n');

for (const schemaName of schemasToConvert) {
  const inputFile = path.join(process.cwd(), `drizzle/${schemaName}.ts`);
  const outputFile = path.join(process.cwd(), `drizzle/${schemaName}-pg.ts`);

  if (!fs.existsSync(inputFile)) {
    console.log(`⚠️  Skipping ${schemaName} (not found)`);
    continue;
  }

  const content = fs.readFileSync(inputFile, 'utf-8');
  const converted = convertSchema(content);

  fs.writeFileSync(outputFile, converted);
  console.log(`✅ Converted ${schemaName}.ts → ${schemaName}-pg.ts`);
}

console.log('\n✨ All schemas converted!');
