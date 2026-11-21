import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from './config/index.js';
import { runExpirationJob } from './jobs/expiration.job.js';
import { runReconciliationJob } from './jobs/reconciliation.job.js';
import { runWebhookJob } from './jobs/webhook.job.js';
import { runHealthCheckJob } from './jobs/health.job.js';
import { runRetentionJob } from './jobs/retention.job.js';
import { runAutomationJob } from './jobs/automation.job.js';

async function bootstrap() {
  console.log('==================================================');
  console.log('    ARJUN API MANAGER — BACKGROUND WORKER SERVICE ');
  console.log('==================================================');

  try {
    await mongoose.connect(config.database.uri);
    console.log('[Worker] MongoDB connected');

    let redis: Redis;
    if (process.env.REDIS_MOCK === 'true') {
      console.log('[Worker] Using in-memory Redis store (ioredis-mock)');
      redis = new (RedisMock as any)() as unknown as Redis;
    } else {
      try {
        redis = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
          keyPrefix: config.redis.keyPrefix,
          lazyConnect: true,
          retryStrategy: () => null,
          maxRetriesPerRequest: 1,
        });
        await redis.connect();
        await redis.ping();
        console.log('[Worker] Redis connected');
      } catch (err: any) {
        console.warn(`[Worker] Redis unavailable (${err.message}) — falling back to in-memory store`);
        redis = new (RedisMock as any)() as unknown as Redis;
      }
    }

    console.log('[Worker] Initializing scheduled jobs...');

    setInterval(() => runReconciliationJob(redis), 5000);
    setInterval(() => runExpirationJob(redis), 60000);
    setInterval(() => runWebhookJob(), 10000);
    setInterval(() => runHealthCheckJob(), 60000);
    setInterval(() => runAutomationJob(redis), 30000);
    setInterval(() => runRetentionJob(90), 24 * 3600 * 1000);

    runReconciliationJob(redis);
    runExpirationJob(redis);
    runAutomationJob(redis);
    runHealthCheckJob();

    console.log('[Worker] All background worker loops active.');
  } catch (err) {
    console.error('[Worker] Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
