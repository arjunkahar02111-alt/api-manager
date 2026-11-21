import mongoose from 'mongoose';

/**
 * Log Retention Job
 * Prunes request logs older than 90 days to prevent unbounded database disk consumption
 */
export async function runRetentionJob(retentionDays = 90) {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await db.collection('request_logs').deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    if (result.deletedCount > 0) {
      console.log(`[RetentionJob] Purged ${result.deletedCount} old request logs.`);
    }
  } catch (err) {
    console.error('[RetentionJob] Error running retention job:', err);
  }
}
