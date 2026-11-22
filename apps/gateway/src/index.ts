import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import crypto from 'node:crypto';
import promClient from 'prom-client';
import { config } from './config/index.js';
import { KeyValidator } from './authentication/keyValidator.js';
import { RouteResolver } from './routing/routeResolver.js';
import { QuotaEngine } from './quota/quotaEngine.js';
import { ProxyEngine } from './proxy/proxyEngine.js';
import { isIpAllowed, AppError } from '@arjun/shared';
import { AntiSharingGuard, getClientIp } from './security/antiSharingGuard.js';
import { AnnouncementManager } from './announcements/announcementManager.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
// Universal raw body parser: preserves all request body types (JSON, form-data, multipart, text, binary) as raw Buffer
app.use(express.raw({ type: '*/*', limit: `${config.proxy.maxRequestBytes}b` }));

// Prometheus Metrics
promClient.collectDefaultMetrics({ prefix: 'arjun_gateway_' });

const gatewayRequestsCounter = new promClient.Counter({
  name: 'arjun_gateway_requests_total',
  help: 'Total requests processed by API Gateway',
  labelNames: ['route', 'method', 'status_code'],
});

const gatewayLatencyHistogram = new promClient.Histogram({
  name: 'arjun_gateway_request_latency_seconds',
  help: 'Gateway request latency distribution',
  labelNames: ['route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

let redis: Redis;
let keyValidator: KeyValidator;
let routeResolver: RouteResolver;
let quotaEngine: QuotaEngine;

app.get('/health', async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    const pong = await redis.ping();
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }
  const isHealthy = mongoOk && redisOk;
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    services: { mongodb: mongoOk ? 'up' : 'down', redis: redisOk ? 'up' : 'down' },
  });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Client Announcement Acknowledgment Endpoint
app.post('/api/v1/announcements/:id/acknowledge', async (req, res) => {
  try {
    const rawKey = keyValidator.extractApiKey(req);
    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_API_KEY', message: 'API key required to acknowledge announcement.' },
      });
    }

    const customer = await keyValidator.authenticate(rawKey);
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ success: false, error: { message: 'Database connection offline' } });
    }

    const announcementId = req.params.id;
    const clientIp = getClientIp(req);

    const query: any = { announcementId };
    if (mongoose.Types.ObjectId.isValid(announcementId)) {
      query.$or = [{ announcementId }, { _id: new mongoose.Types.ObjectId(announcementId) }];
      delete query.announcementId;
    }

    const announcement = await db.collection('announcements').findOne(query);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'ANNOUNCEMENT_NOT_FOUND', message: `Announcement ${announcementId} not found.` },
      });
    }

    // Record acknowledgment if not already acknowledged
    const acks = announcement.acknowledgments || [];
    const alreadyAcked = acks.some((a: any) => a.clientId === customer.customerId);
    if (!alreadyAcked) {
      await db.collection('announcements').updateOne(
        { _id: announcement._id },
        {
          $push: {
            acknowledgments: {
              clientId: customer.customerId,
              customerUsername: customer.username,
              keyPrefix: customer.keyPrefix,
              clientIp,
              acknowledgedAt: new Date(),
            },
          } as any,
        }
      );
    }

    return res.status(200).json({
      success: true,
      status: 'acknowledged',
      message: `Announcement ${announcementId} acknowledged successfully.`,
      data: {
        announcement_id: announcementId,
        client_id: customer.customerId,
        acknowledged_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'ACK_FAILED', message: err.message },
    });
  }
});

app.all('/v1*', async (req, res) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  console.log(`[Gateway Proxy] ${req.method} ${req.originalUrl}`);

  const start = Date.now();
  let customerId: string | null = null;
  let customer: any = null;
  let apiId: string | null = null;
  let statusCode = 500;
  let errorCode: string | undefined = undefined;
  let requestBytes = 0;
  let responseBytes = 0;
  let upstreamStatus: number | undefined = undefined;

  try {
    const clientIp = getClientIp(req);
    await AntiSharingGuard.checkIpBlacklist(clientIp, redis);

    // Gateway WAF Fast-Path Protection
    const userAgent = (req.headers['user-agent'] as string) || '';
    if (/\b(sqlmap|nikto|acunetix|wpscan|masscan|zgrab|nmap|havij|netsparker|dirbuster)\b/i.test(userAgent)) {
      statusCode = 403;
      errorCode = 'WAF_BLOCKED';
      return res.status(403).json({
        success: false,
        error: { code: 'WAF_BLOCKED', message: 'Request blocked by Web Application Firewall: Malicious automated scanner probing prohibited' },
      });
    }

    if (/(?:\.\.[\/\\]|\%2e\%2e[\/\\]|\%2e\%2e\%2f|\.\.%2f|\.\.%5c|etc[\/\\](?:passwd|shadow))/i.test(req.url)) {
      statusCode = 403;
      errorCode = 'WAF_BLOCKED';
      return res.status(403).json({
        success: false,
        error: { code: 'WAF_BLOCKED', message: 'Request blocked by Web Application Firewall: Path traversal sequence detected' },
      });
    }

    // Platform-Wide Maintenance Check
    const rawMaint = await redis.get('system:maintenance').catch(() => null);
    if (rawMaint) {
      try {
        const maint = JSON.parse(rawMaint);
        if (maint.global || maint.gateway) {
          statusCode = 503;
          errorCode = 'API_MAINTENANCE';
          return res.status(503).json({
            success: false,
            status: 'maintenance',
            error: {
              code: 'API_MAINTENANCE',
              message: maint.message || 'This API is temporarily unavailable due to scheduled platform maintenance.',
            },
            announcement: {
              active: true,
              type: 'maintenance',
              severity: 'warning',
              title: 'Scheduled Platform Maintenance',
              message: maint.message || 'Platform undergoing maintenance. Please retry in a few moments.',
            },
            meta: {
              retry_after: 900,
            },
          });
        }
      } catch {}
    }

    const fullPath = req.path;
    const gatewayRoutePath = fullPath.startsWith('/v1') ? fullPath.substring(3) : fullPath;
    const resolved = await routeResolver.resolve(gatewayRoutePath || '/');

    if (!resolved) {
      statusCode = 404;
      errorCode = 'API_NOT_FOUND';
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_NOT_FOUND',
          message: `The API endpoint '${gatewayRoutePath}' does not exist in the catalog.`,
        },
      });
    }

    const { route, subPath } = resolved;
    apiId = route.id;

    if (route.status === 'disabled') {
      statusCode = 403;
      errorCode = 'API_DISABLED';
      return res.status(403).json({
        success: false,
        error: { code: 'API_DISABLED', message: 'This API endpoint is currently disabled by administrator.' },
      });
    }

    if (route.status === 'maintenance') {
      statusCode = 503;
      errorCode = 'API_MAINTENANCE';
      return res.status(503).json({
        success: false,
        status: 'maintenance',
        error: { code: 'API_MAINTENANCE', message: 'This API endpoint is currently undergoing maintenance.' },
        announcement: {
          active: true,
          type: 'maintenance',
          severity: 'warning',
          title: 'Scheduled Maintenance',
          message: 'This API is temporarily undergoing maintenance. Please try again later.',
        },
        meta: {
          retry_after: 900,
        },
      });
    }

    if (!route.allowedMethods.includes(req.method)) {
      statusCode = 405;
      errorCode = 'METHOD_NOT_ALLOWED';
      res.setHeader('Allow', route.allowedMethods.join(', '));
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `HTTP method ${req.method} is not permitted for this endpoint. Allowed methods: ${route.allowedMethods.join(', ')}`,
        },
      });
    }

    const rawKey = keyValidator.extractApiKey(req);
    if (!rawKey) {
      statusCode = 401;
      errorCode = 'MISSING_API_KEY';
      await AntiSharingGuard.trackFailedKeyAttempt(clientIp, redis, null);
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API Key missing. Provide your key via header X-API-Key: arjun_live_... or Authorization: Bearer arjun_live_...',
        },
      });
    }

    try {
      customer = await keyValidator.authenticate(rawKey);
    } catch (authErr) {
      await AntiSharingGuard.trackFailedKeyAttempt(clientIp, redis, rawKey);
      throw authErr;
    }
    customerId = customer.customerId;

    // Strict Single-IP Locking & Anti-Key Sharing Enforcement
    await AntiSharingGuard.enforce(req, customer, redis);

    if (
      !customer.allowedApis.includes('*') &&
      !customer.allowedApis.includes(route.id) &&
      !customer.allowedApis.includes(route.slug) &&
      !customer.allowedApis.includes('rootx-vehicle-osint') &&
      !customer.allowedApis.includes('vehicle2-n') &&
      !customer.allowedApis.includes('vehicle2n') &&
      !customer.allowedApis.includes('v2nn') &&
      !customer.allowedApis.includes('v2n-2') &&
      !customer.allowedApis.includes('v2n')
    ) {
      statusCode = 403;
      errorCode = 'API_ACCESS_DENIED';
      return res.status(403).json({
        success: false,
        error: { code: 'API_ACCESS_DENIED', message: 'Your account does not have permission to access this API endpoint.' },
      });
    }

    if (!isIpAllowed(clientIp, customer.allowedIps)) {
      statusCode = 403;
      errorCode = 'IP_NOT_ALLOWED';
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: `Requests from IP address ${clientIp} are not permitted for this account.`,
        },
      });
    }

    const quotaResult = await quotaEngine.checkAndReserve({
      customerId: customer.customerId,
      apiId: route.id,
      dailyLimit: customer.dailyRequestLimit,
      monthlyLimit: customer.monthlyRequestLimit,
      lifetimeLimit: customer.lifetimeRequestLimit,
      concurrencyLimit: customer.maxConcurrentRequests,
      bandwidthLimitBytes: customer.maxBandwidthBytes,
    });

    if (!quotaResult.allowed) {
      statusCode = 429;
      errorCode = quotaResult.code || 'QUOTA_EXCEEDED';
      res.setHeader('X-RateLimit-Limit', customer.dailyRequestLimit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        success: false,
        error: {
          code: quotaResult.code,
          message: quotaResult.message,
        },
        usage: quotaResult.usage,
      });
    }

    res.setHeader('X-RateLimit-Limit', (quotaResult.dailyLimit || customer.dailyRequestLimit).toString());
    res.setHeader('X-RateLimit-Remaining', (quotaResult.remainingDaily ?? 0).toString());

    // Match Active Announcement for Client & API Route
    const activeAnnouncements = await AnnouncementManager.getActiveAnnouncements(redis);
    const matchedAnnouncement = AnnouncementManager.matchAnnouncement(activeAnnouncements, {
      apiId: route.id,
      routeSlug: route.slug,
      gatewayPath: gatewayRoutePath,
      customerId: customer.customerId,
      customerUsername: customer.username,
      keyPrefix: customer.keyPrefix,
      apiVersion: (route as any).version || 'v1',
    });

    let proxyResult;
    try {
      proxyResult = await ProxyEngine.forwardRequest(req, res, route, {
        developerTag: customer.developerTag || 'arjunkahar',
        reqLeft: quotaResult.remainingDaily !== undefined ? quotaResult.remainingDaily : Math.max(0, customer.dailyRequestLimit - (quotaResult.dailyUsed || 0)),
        reqTotal: quotaResult.dailyLimit || customer.dailyRequestLimit || 5000,
        expiresAt: customer.expiresAt,
        announcement: matchedAnnouncement || undefined,
      }, subPath, redis);
      statusCode = proxyResult.statusCode;
      requestBytes = proxyResult.requestBytes;
      responseBytes = proxyResult.responseBytes;
      upstreamStatus = proxyResult.upstreamStatus;
    } finally {
      await quotaEngine.releaseConcurrency(customer.customerId);
      const totalBytes = requestBytes + responseBytes;
      if (totalBytes > 0) {
        await quotaEngine.recordBandwidth(customer.customerId, totalBytes);
      }
    }
  } catch (err: any) {
    if (err instanceof AppError) {
      statusCode = err.statusCode;
      errorCode = err.code;
      return res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }

    statusCode = 500;
    errorCode = 'GATEWAY_ERROR';
    console.error('[Gateway] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'GATEWAY_ERROR', message: 'Internal API Gateway error' },
    });
  } finally {
    const duration = Date.now() - start;
    const sourceIp = getClientIp(req);

    gatewayRequestsCounter.inc({ route: req.path, method: req.method, status_code: statusCode.toString() });
    gatewayLatencyHistogram.observe({ route: req.path, status_code: statusCode.toString() }, duration / 1000);

    // Live Telemetry Event Stream Broadcast
    redis.publish(
      'pubsub:realtime',
      JSON.stringify({
        event: 'traffic',
        payload: {
          requestId,
          method: req.method,
          endpoint: req.originalUrl,
          sourceIp,
          statusCode,
          durationMs: duration,
          customerUsername: customer ? customer.username : 'Anonymous',
          keyPrefix: customer ? customer.keyPrefix : 'none',
          timestamp: new Date().toISOString(),
        },
      })
    ).catch(() => {});

    if (customerId && apiId) {
      const logEntry = JSON.stringify({
        requestId,
        customerId,
        apiId,
        method: req.method,
        endpoint: req.originalUrl,
        sourceIp,
        statusCode,
        upstreamStatus,
        durationMs: duration,
        requestBytes,
        responseBytes,
        timestamp: new Date().toISOString(),
        errorCode,
        userAgent: req.headers['user-agent'],
      });
      redis.lpush('queue:request_logs', logEntry).catch(() => {});
    }
  }
});

async function bootstrap() {
  console.log('==================================================');
  console.log('       ARJUN API MANAGER — API GATEWAY SERVICE    ');
  console.log(`       Listening on Port: ${config.port}           `);
  console.log('==================================================');

  try {
    await mongoose.connect(config.database.uri, {
      maxPoolSize: config.database.maxPoolSize,
    });
    console.log('[Gateway] MongoDB connected');

    const RedisConstructor: any = (RedisMock as any).default || RedisMock;
    if (process.env.REDIS_MOCK === 'true' || config.env === 'development') {
      console.log('[Gateway] Using in-memory Redis store (ioredis-mock)');
      redis = new RedisConstructor() as Redis;
    } else {
      try {
        const client = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
          keyPrefix: config.redis.keyPrefix,
          lazyConnect: true,
          retryStrategy: () => null,
          maxRetriesPerRequest: 1,
          connectTimeout: 1000,
        });
        await client.connect();
        await client.ping();
        redis = client;
        console.log('[Gateway] Redis connected');
      } catch (err: any) {
        console.warn(`[Gateway] Redis unavailable (${err.message}) — falling back to in-memory store`);
        redis = new RedisConstructor() as Redis;
      }
    }

    keyValidator = new KeyValidator(redis);
    routeResolver = new RouteResolver(redis);
    quotaEngine = new QuotaEngine(redis);

    app.listen(config.port, () => {
      console.log(`[Gateway] Arjun API Gateway is actively proxying on port ${config.port}`);
    });
  } catch (err) {
    console.error('[Gateway] Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
