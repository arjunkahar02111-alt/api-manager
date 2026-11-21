import mongoose from 'mongoose';
import { Redis } from 'ioredis';

export async function runAutomationJob(redis: Redis) {
  const start = Date.now();
  const db = mongoose.connection.db;
  if (!db) return;

  const now = new Date();
  const actionsTaken: string[] = [];
  let itemsProcessed = 0;

  try {
    // 1. Scheduled Announcement Publishing & Expiration
    const scheduledAnnouncements = await db
      .collection('announcements')
      .find({ status: 'draft', startDate: { $lte: now } })
      .toArray();

    for (const ann of scheduledAnnouncements) {
      await db.collection('announcements').updateOne({ _id: ann._id }, { $set: { status: 'published', updatedAt: now } });
      actionsTaken.push(`Activated scheduled announcement ${ann.announcementId || ann._id}`);
      itemsProcessed++;
    }

    const expiredAnnouncements = await db
      .collection('announcements')
      .find({ status: 'published', expiresAt: { $lte: now } })
      .toArray();

    for (const ann of expiredAnnouncements) {
      await db.collection('announcements').updateOne({ _id: ann._id }, { $set: { status: 'expired', updatedAt: now } });
      actionsTaken.push(`Expired announcement ${ann.announcementId || ann._id}`);
      itemsProcessed++;
    }

    if (scheduledAnnouncements.length > 0 || expiredAnnouncements.length > 0) {
      await redis.del('gateway:announcements:active');
      await redis.publish(
        'pubsub:realtime',
        JSON.stringify({ event: 'announcement_sync', timestamp: now.toISOString() })
      );
    }

    // 2. High Error Rate Detection (>10% 5xx in last 15 minutes)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentLogs = await db
      .collection('request_logs')
      .find({ timestamp: { $gte: fifteenMinsAgo } })
      .project({ statusCode: 1, route: 1 })
      .toArray();

    if (recentLogs.length >= 20) {
      const errorCount = recentLogs.filter((l) => l.statusCode && l.statusCode >= 500).length;
      const errorRate = (errorCount / recentLogs.length) * 100;
      if (errorRate >= 15) {
        actionsTaken.push(`Detected high error spike (${errorRate.toFixed(1)}% 5xx across ${recentLogs.length} requests)`);
      }
    }

    // 3. Record execution in automation_audit_logs if any action occurred or every 10 minutes
    if (actionsTaken.length > 0) {
      await db.collection('automation_audit_logs').insertOne({
        jobName: 'platform_automation_engine',
        status: 'success',
        durationMs: Date.now() - start,
        itemsProcessed,
        actionsTaken,
        executedAt: now,
      });
      console.log(`[AutomationEngine] Processed ${itemsProcessed} items. Actions: ${actionsTaken.join('; ')}`);
    }
  } catch (err: any) {
    console.error('[AutomationEngine] Error running automation job:', err);
    try {
      await db.collection('automation_audit_logs').insertOne({
        jobName: 'platform_automation_engine',
        status: 'failure',
        durationMs: Date.now() - start,
        itemsProcessed,
        actionsTaken,
        errorMessage: err.message,
        executedAt: now,
      });
    } catch {}
  }
}
