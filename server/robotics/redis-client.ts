/**
 * Redis Client for Robotics Middleware
 * 生产级缓存和会话存储
 */

import { createClient, RedisClientType } from 'redis';

class RedisClientManager {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  async getClient(): Promise<RedisClientType> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[Redis] Max reconnection attempts reached');
            return new Error('Max reconnection attempts');
          }
          const delay = Math.min(retries * 100, 3000);
          console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('[Redis] Connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('[Redis] Ready');
    });

    this.client.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    await this.client.connect();

    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }
}

// 单例实例
const redisManager = new RedisClientManager();

export async function getRedisClient(): Promise<RedisClientType> {
  return await redisManager.getClient();
}

export function isRedisReady(): boolean {
  return redisManager.isReady();
}

export async function disconnectRedis(): Promise<void> {
  await redisManager.disconnect();
}
