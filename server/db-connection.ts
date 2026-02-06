/**
 * Database Connection Manager using Prisma Client
 * 
 * Features:
 * - Automatic retry on connection errors
 * - Query timeout (30 seconds)
 * - Connection health monitoring
 * - Graceful shutdown
 */

import { createLogger } from './utils/logger';
import { prisma } from './db-prisma';

const logger = createLogger('Database');

interface ConnectionPoolConfig {
  maxRetries: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

let _connectionAttempts = 0;
let _lastConnectionError: Error | null = null;
let _lastSuccessfulPing: number | null = null;

async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

/**
 * Get database connection with retry logic
 */
export async function getDb() {
  if (_lastSuccessfulPing && Date.now() - _lastSuccessfulPing < 30000) {
    return prisma;
  }

  const config = DEFAULT_CONFIG;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      _connectionAttempts++;
      logger.info('Attempting database connection', {
        attempt,
        maxRetries: config.maxRetries,
        totalAttempts: _connectionAttempts
      });

      await pingDatabase();
      _lastConnectionError = null;
      _lastSuccessfulPing = Date.now();

      logger.info('Database connection established successfully', {
        attempt,
        totalAttempts: _connectionAttempts
      });
      return prisma;
    } catch (error) {
      lastError = error as Error;
      _lastConnectionError = lastError;
      logger.error('Database connection attempt failed', {
        attempt,
        maxRetries: config.maxRetries,
        error: lastError
      });

      // Wait before retry
      if (attempt < config.maxRetries) {
        const delay = config.retryDelay * attempt; // Exponential backoff
        logger.info('Retrying database connection', {
          delayMs: delay,
          nextAttempt: attempt + 1
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to connect to database after ${config.maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Execute query with timeout
 */
export async function executeWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Get connection pool statistics
 */
export function getPoolStats() {
  return {
    connectionAttempts: _connectionAttempts,
    lastError: _lastConnectionError?.message || null,
    lastSuccessfulPing: _lastSuccessfulPing,
  };
}

/**
 * Health check for database connection
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    await getDb();
    await pingDatabase();

    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Graceful shutdown - close all connections
 */
export async function closeConnections(): Promise<void> {
  logger.info('Closing all database connections');
  try {
    await prisma.$disconnect();
    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections', { error });
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  await closeConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeConnections();
  process.exit(0);
});
