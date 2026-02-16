/**
 * Drizzle ORM Database Connection
 *
 * Provides a centralized Drizzle database instance for tables that use Drizzle schema.
 * This is used alongside Prisma for tables that haven't been migrated to Prisma yet.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createLogger } from './utils/logger';

const logger = createLogger('Database:Drizzle');

// Create PostgreSQL connection
const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  max: 10,
});

// Create Drizzle instance
export const db = drizzle(client);

// Export client for cleanup if needed
export { client };

logger.info('Drizzle database connection initialized');
