import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from '../config/index.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (process.env.REDIS_MOCK === 'true') {
      console.log('[Redis] Using in-memory Redis store (ioredis-mock)');
      redisClient = new (RedisMock as any)() as unknown as Redis;
      return redisClient;
    }

    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      lazyConnect: true,
      retryStrategy(times: number) {
        if (times > 2) return null;
        return Math.min(times * 50, 1000);
      },
      maxRetriesPerRequest: 2,
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Redis client connected');
    });

    redisClient.on('error', (err: Error) => {
      console.warn('[Redis] Connection warning:', err.message);
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore disconnect errors
    }
    redisClient = null;
  }
}
