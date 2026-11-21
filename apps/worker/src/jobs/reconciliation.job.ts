import mongoose from 'mongoose';
import { Redis } from 'ioredis';

export async function runReconciliationJob(redis: Redis) {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const logBatch: any[] = [];
    for (let i = 0; i < 100; i++) {
      const entry = await redis.rpop('queue:request_logs');
      if (!entry) break;
      try {
        logBatch.push(JSON.parse(entry));
      } catch {}
    }

    if (logBatch.length === 0) return;

    const formattedLogs = logBatch.map((l) => ({
      ...l,
      customerId: new mongoose.Types.ObjectId(l.customerId),
      apiId: new mongoose.Types.ObjectId(l.apiId),
      timestamp: new Date(l.timestamp),
    }));

    await db.collection('request_logs').insertMany(formattedLogs);

    for (const log of logBatch) {
      const dateStr = log.timestamp.substring(0, 10);
      const monthStr = log.timestamp.substring(0, 7);
      const isSuccess = log.statusCode >= 200 && log.statusCode < 400;
      const totalBytes = (log.requestBytes || 0) + (log.responseBytes || 0);

      const customerObjectId = new mongoose.Types.ObjectId(log.customerId);
      const apiObjectId = new mongoose.Types.ObjectId(log.apiId);

      await db.collection('usage_daily').updateOne(
        { customerId: customerObjectId, apiId: apiObjectId, date: dateStr },
        {
          $inc: {
            requests: 1,
            successfulRequests: isSuccess ? 1 : 0,
            failedRequests: isSuccess ? 0 : 1,
            bandwidthBytes: totalBytes,
          },
        },
        { upsert: true }
      );

      await db.collection('usage_monthly').updateOne(
        { customerId: customerObjectId, apiId: apiObjectId, month: monthStr },
        {
          $inc: {
            requests: 1,
            successfulRequests: isSuccess ? 1 : 0,
            failedRequests: isSuccess ? 0 : 1,
            bandwidthBytes: totalBytes,
          },
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('[ReconciliationJob] Error during reconciliation:', err);
  }
}
