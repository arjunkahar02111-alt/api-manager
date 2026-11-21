import mongoose from 'mongoose';
import { request } from 'undici';
import { decryptSecret, signWebhookPayload } from '@arjun/shared';

/**
 * Webhook Delivery Job
 * Dispatches HMAC-signed webhooks with exponential backoff retries
 */
export async function runWebhookJob() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const pendingDeliveries = await db
      .collection('webhook_deliveries')
      .find({
        status: { $in: ['pending', 'retrying'] },
        $or: [{ nextAttemptAt: { $lte: new Date() } }, { nextAttemptAt: { $exists: false } }],
      })
      .limit(20)
      .toArray();

    for (const delivery of pendingDeliveries) {
      const webhook = await db.collection('customer_webhooks').findOne({ _id: delivery.webhookId });
      if (!webhook || !webhook.enabled) {
        await db.collection('webhook_deliveries').updateOne(
          { _id: delivery._id },
          { $set: { status: 'failed', error: 'Webhook inactive or removed' } }
        );
        continue;
      }

      const payloadString = JSON.stringify({
        id: delivery._id,
        event: delivery.event,
        data: delivery.payloadReference,
        timestamp: new Date().toISOString(),
      });

      let signingSecret: string;
      try {
        signingSecret = decryptSecret(webhook.encryptedSecret);
      } catch {
        signingSecret = 'webhook-signature-fallback';
      }

      const signature = signWebhookPayload(payloadString, signingSecret);

      try {
        const response = await request(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Arjun-Signature': signature,
            'X-Arjun-Event': delivery.event,
          },
          body: payloadString,
          headersTimeout: 10000,
          bodyTimeout: 10000,
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
          await db.collection('webhook_deliveries').updateOne(
            { _id: delivery._id },
            {
              $set: {
                status: 'delivered',
                responseStatus: response.statusCode,
                lastAttemptAt: new Date(),
              },
            }
          );
        } else {
          throw new Error(`Target responded with status ${response.statusCode}`);
        }
      } catch (err: any) {
        const attempts = (delivery.attemptCount || 0) + 1;
        if (attempts >= 5) {
          await db.collection('webhook_deliveries').updateOne(
            { _id: delivery._id },
            {
              $set: {
                status: 'failed',
                attemptCount: attempts,
                lastAttemptAt: new Date(),
                error: err.message,
              },
            }
          );
        } else {
          // Exponential backoff: 30s, 60s, 120s, 240s
          const backoffSeconds = Math.pow(2, attempts) * 15;
          await db.collection('webhook_deliveries').updateOne(
            { _id: delivery._id },
            {
              $set: {
                status: 'retrying',
                attemptCount: attempts,
                lastAttemptAt: new Date(),
                nextAttemptAt: new Date(Date.now() + backoffSeconds * 1000),
                error: err.message,
              },
            }
          );
        }
      }
    }
  } catch (err) {
    console.error('[WebhookJob] Error running webhook deliveries:', err);
  }
}
