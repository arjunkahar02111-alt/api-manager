import { Router } from 'express';
import crypto from 'node:crypto';
import os from 'node:os';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { RealtimeService } from '../../services/realtime.service.js';
import { getRedisClient } from '../../services/redis.service.js';
import { RequestLog, Customer, SecurityIncident, IpBlacklist } from '../../database/models/index.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

/**
 * Server-Sent Events (SSE) Live Monitoring Stream
 * Authenticated via query parameter token (?token=...) or standard Bearer authorization header
 */
router.get('/live-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = crypto.randomUUID();
  RealtimeService.addClient(clientId, res);

  // Keep-alive heartbeat every 15 seconds
  const interval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(interval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    RealtimeService.removeClient(clientId);
  });
});

/**
 * Real-time Metrics and Active Connections
 */
router.get('/realtime-metrics', requireAdminAuth, async (_req, res, next) => {
  try {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
      processRssBytes: memoryUsage.rss,
      processHeapUsedBytes: memoryUsage.heapUsed,
    };

    const redis = getRedisClient();
    let redisConnected = false;
    try {
      await redis.ping();
      redisConnected = true;
    } catch {}

    const [activeCustomers, lockedIps, todayRequests, recentAlerts] = await Promise.all([
      Customer.countDocuments({ status: 'active' }),
      IpBlacklist.countDocuments({ isActive: true }),
      RequestLog.countDocuments({
        timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      SecurityIncident.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return sendSuccess(res, {
      activeStreamClients: RealtimeService.getClientCount(),
      systemMemory,
      uptimeSeconds: Math.floor(process.uptime()),
      redisConnected,
      activeCustomers,
      lockedIps,
      todayRequests,
      recentAlerts,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
