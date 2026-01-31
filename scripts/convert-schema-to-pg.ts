#!/usr/bin/env tsx
/**
 * Convert MySQL Drizzle schema to PostgreSQL schema
 *
 * Usage: npx tsx scripts/convert-schema-to-pg.ts
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_FILE = path.join(process.cwd(), 'drizzle/schema.ts');
const OUTPUT_FILE = path.join(process.cwd(), 'drizzle/schema-pg.ts');

console.log('🔄 Converting MySQL schema to PostgreSQL...\n');

// Read original schema
let schema = fs.readFileSync(SCHEMA_FILE, 'utf-8');

// Convert imports
schema = schema.replace(
  /from "drizzle-orm\/mysql-core"/g,
  'from "drizzle-orm/pg-core"'
);

schema = schema.replace(
  /import \{([^}]+)\} from "drizzle-orm\/mysql-core"/g,
  (match, imports) => {
    const convertedImports = imports
      .split(',')
      .map((imp: string) => {
        const trimmed = imp.trim();
        // Convert MySQL types to PostgreSQL types
        if (trimmed === 'int') return 'integer';
        if (trimmed === 'mysqlEnum') return 'pgEnum';
        if (trimmed === 'mysqlTable') return 'pgTable';
        if (trimmed === 'longtext') return 'text';
        if (trimmed === 'decimal') return 'numeric';
        if (trimmed === 'bigint') return 'bigint';
        return trimmed;
      })
      .join(', ');
    return `import { ${convertedImports} } from "drizzle-orm/pg-core"`;
  }
);

// Convert table definitions
schema = schema.replace(/mysqlTable/g, 'pgTable');
schema = schema.replace(/mysqlEnum/g, 'pgEnum');

// Convert column types
schema = schema.replace(/\bint\(/g, 'integer(');
schema = schema.replace(/\.autoincrement\(\)/g, ''); // PostgreSQL uses serial/identity
schema = schema.replace(/longtext\(/g, 'text(');
schema = schema.replace(/decimal\(/g, 'numeric(');

// Convert integer primary key to serial
schema = schema.replace(
  /integer\("id"\)\.primaryKey\(\)/g,
  'serial("id").primaryKey()'
);

// Convert .onUpdateNow() (not supported in PostgreSQL)
schema = schema.replace(/\.onUpdateNow\(\)/g, '');

// Convert ENUM definitions - PostgreSQL requires enums to be defined before tables
const enumMatches = schema.match(/pgEnum\([^)]+\)/g) || [];
const enumDefs: string[] = [];

// Extract and convert enums
schema = schema.replace(
  /(\w+):\s*pgEnum\("(\w+)",\s*\[([^\]]+)\]\)/g,
  (match, fieldName, enumName, values) => {
    const pgEnumName = `${enumName}_enum`;
    if (!enumDefs.find(def => def.includes(pgEnumName))) {
      enumDefs.push(`export const ${pgEnumName} = pgEnum('${enumName}', [${values}]);`);
    }
    return `${fieldName}: ${pgEnumName}('${enumName}')`;
  }
);

// Add PostgreSQL-specific imports at top
const pgImports = `import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  pgEnum,
  bigint,
  index,
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Define enums first (PostgreSQL requirement)
${enumDefs.join('\n')}

`;

// Replace the import section
schema = schema.replace(
  /import \{[^}]+\} from "drizzle-orm\/pg-core";[\s\S]*?import \{ relations \} from "drizzle-orm";/,
  pgImports.trim()
);

// Convert export statements for sub-schemas to use -pg versions
schema = schema.replace(/export \* from '\.\/schema-memory-nft';/, "export * from './schema-memory-nft-pg';");
schema = schema.replace(/export \* from '\.\/schema-workflow';/, "export * from './schema-workflow-pg';");
schema = schema.replace(/export \* from '\.\/schema-api-usage';/, "export * from './schema-api-usage-pg';");
schema = schema.replace(/export \* from '\.\/schema-workflows';/, "export * from './schema-workflows-pg';");
schema = schema.replace(/export \* from '\.\/schema-w-matrix-compat';/, "export * from './schema-w-matrix-compat-pg';");

// Add comment at top
schema = `/**
 * PostgreSQL Schema for Awareness Network
 * Auto-converted from MySQL schema
 *
 * Key differences from MySQL:
 * - Uses serial instead of int().autoincrement()
 * - Uses pgEnum instead of mysqlEnum
 * - Removed .onUpdateNow() (use triggers or application logic)
 * - Uses numeric instead of decimal
 */

${schema}`;

// Write output
fs.writeFileSync(OUTPUT_FILE, schema);

console.log(`✅ Converted schema written to: ${OUTPUT_FILE}`);
console.log('\n📝 Manual adjustments needed:');
console.log('   1. Review enum definitions');
console.log('   2. Check timestamp default values');
console.log('   3. Verify index definitions');
console.log('   4. Update sub-schema imports if needed\n');
