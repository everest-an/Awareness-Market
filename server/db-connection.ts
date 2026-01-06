/**
 * Database Connection Manager with Connection Pooling and Retry Logic
 * 
 * Features:
 * - Connection pooling (min: 5, max: 20)
 * - Automatic retry on connection errors
 * - Query timeout (30 seconds)
 * - Connection health monitoring
 * - Graceful shutdown
 */

import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';

interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxRetries: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: ConnectionPoolConfig = {
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 5000, // 5 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

let _pool: mysql.Pool | null = null;
let _db: MySql2Database<Record<string, never>> | null = null;
let _connectionAttempts = 0;
let _lastConnectionError: Error | null = null;

/**
 * Create MySQL connection pool with optimized settings
 */
function createPool(config: ConnectionPoolConfig = DEFAULT_CONFIG): mysql.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: config.max,
    maxIdle: config.min,
    idleTimeout: config.idleTimeoutMillis,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  // Monitor pool events
  pool.on('acquire', () => {
    console.log('[DB Pool] Connection acquired');
  });

  pool.on('release', () => {
    console.log('[DB Pool] Connection released');
  });

  pool.on('connection', () => {
    console.log('[DB Pool] New connection created');
  });

  pool.on('enqueue', () => {
    console.log('[DB Pool] Waiting for available connection');
  });

  return pool;
}

/**
 * Get database connection with retry logic
 */
export async function getDb(): Promise<MySql2Database<Record<string, never>>> {
  if (_db && _pool) {
    return _db;
  }

  const config = DEFAULT_CONFIG;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      _connectionAttempts++;
      console.log(`[DB] Connection attempt ${attempt}/${config.maxRetries}`);

      if (!_pool) {
        _pool = createPool(config);
      }

      // Test connection
      const connection = await _pool.getConnection();
      await connection.ping();
      connection.release();

      // Create Drizzle instance
      _db = drizzle(_pool);
      _lastConnectionError = null;

      console.log('[DB] Connection established successfully');
      return _db;
    } catch (error) {
      lastError = error as Error;
      _lastConnectionError = lastError;
      console.error(`[DB] Connection attempt ${attempt} failed:`, lastError.message);

      // Close failed pool
      if (_pool) {
        await _pool.end().catch(() => {});
        _pool = null;
      }

      // Wait before retry
      if (attempt < config.maxRetries) {
        const delay = config.retryDelay * attempt; // Exponential backoff
        console.log(`[DB] Retrying in ${delay}ms...`);
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
  if (!_pool) {
    return null;
  }

  return {
    totalConnections: (_pool as any)._allConnections?.length || 0,
    freeConnections: (_pool as any)._freeConnections?.length || 0,
    queueLength: (_pool as any)._connectionQueue?.length || 0,
    connectionAttempts: _connectionAttempts,
    lastError: _lastConnectionError?.message || null,
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
    const db = await getDb();
    if (!_pool) {
      throw new Error('Connection pool not initialized');
    }

    const connection = await _pool.getConnection();
    await connection.ping();
    connection.release();

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
  console.log('[DB] Closing all connections...');

  if (_pool) {
    try {
      await _pool.end();
      console.log('[DB] All connections closed');
    } catch (error) {
      console.error('[DB] Error closing connections:', error);
    } finally {
      _pool = null;
      _db = null;
    }
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
