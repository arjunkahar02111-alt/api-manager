import mongoose from 'mongoose';
import { Redis } from 'ioredis';

export async function runExpirationJob(redis: Redis) {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const now = new Date();

    const expiredCustomers = await db
      .collection('customers')
      .find({
        status: 'active',
        expiresAt: { $lte: now },
      })
      .toArray();

    if (expiredCustomers.length > 0) {
      console.log(`[ExpirationJob] Found ${expiredCustomers.length} expired customer accounts. Updating...`);
      for (const customer of expiredCustomers) {
        await db.collection('customers').updateOne(
          { _id: customer._id },
          { $set: { status: 'expired', updatedAt: now } }
        );

        await redis.del(`customer:${customer._id}`);
        console.log(`[ExpirationJob] Account ${customer.username} marked as expired.`);
      }
    }
  } catch (err) {
    console.error('[ExpirationJob] Error running job:', err);
  }
}
