import mongoose from 'mongoose';
import { request } from 'undici';

/**
 * Health Check Job
 * Periodically verifies upstream API responsiveness
 */
export async function runHealthCheckJob() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const apis = await db
      .collection('api_catalog')
      .find({
        status: 'active',
        'healthCheck.enabled': true,
      })
      .toArray();

    for (const api of apis) {
      const endpointPath = api.healthCheck?.endpointPath || '/health';
      const targetUrl = `${api.upstreamBaseUrl.replace(/\/$/, '')}${endpointPath}`;

      const start = Date.now();
      try {
        const response = await request(targetUrl, {
          method: 'GET',
          headersTimeout: 5000,
          bodyTimeout: 5000,
        });

        const latency = Date.now() - start;
        const isHealthy = response.statusCode >= 200 && response.statusCode < 500;

        await db.collection('api_catalog').updateOne(
          { _id: api._id },
          {
            $set: {
              'healthCheck.lastStatus': isHealthy ? 'healthy' : 'unhealthy',
              'healthCheck.lastLatencyMs': latency,
              'healthCheck.lastCheckedAt': new Date(),
              'healthCheck.failureCount': isHealthy ? 0 : (api.healthCheck.failureCount || 0) + 1,
            },
          }
        );
      } catch (err) {
        await db.collection('api_catalog').updateOne(
          { _id: api._id },
          {
            $set: {
              'healthCheck.lastStatus': 'unhealthy',
              'healthCheck.lastLatencyMs': Date.now() - start,
              'healthCheck.lastCheckedAt': new Date(),
              'healthCheck.failureCount': (api.healthCheck?.failureCount || 0) + 1,
            },
          }
        );
      }
    }
  } catch (err) {
    console.error('[HealthCheckJob] Error checking API health:', err);
  }
}
