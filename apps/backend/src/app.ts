import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import promClient from 'prom-client';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getRedisClient } from './services/redis.service.js';

// Admin route imports
import adminAuthRoutes from './modules/admin/auth.routes.js';
import adminCustomerRoutes from './modules/admin/customer.routes.js';
import adminCatalogRoutes from './modules/admin/catalog.routes.js';
import adminSubscriptionRoutes from './modules/admin/subscription.routes.js';
import adminPaymentRoutes from './modules/admin/payment.routes.js';
import adminAnalyticsRoutes from './modules/admin/analytics.routes.js';
import adminLogsRoutes from './modules/admin/logs.routes.js';
import adminAuditRoutes from './modules/admin/audit.routes.js';
import adminSystemRoutes from './modules/admin/system.routes.js';
import adminMaintenanceRoutes from './modules/admin/maintenance.routes.js';
import adminTicketsRoutes from './modules/admin/tickets.routes.js';
import adminBackupsRoutes from './modules/admin/backups.routes.js';
import adminSecurityRoutes from './modules/admin/security.routes.js';
import adminMonitoringRoutes from './modules/admin/monitoring.routes.js';
import adminHostingRoutes from './modules/admin/hosting.routes.js';

// Customer route imports
import customerAuthRoutes from './modules/customer/auth.routes.js';
import customerDashboardRoutes from './modules/customer/dashboard.routes.js';
import customerApisRoutes from './modules/customer/apis.routes.js';
import customerUsageRoutes from './modules/customer/usage.routes.js';
import customerLogsRoutes from './modules/customer/logs.routes.js';
import customerIpRoutes from './modules/customer/ip.routes.js';
import customerWebhooksRoutes from './modules/customer/webhooks.routes.js';
import customerTicketsRoutes from './modules/customer/tickets.routes.js';
import customerSubscriptionRoutes from './modules/customer/subscription.routes.js';
import customerSecurityRoutes from './modules/customer/security.routes.js';

// Prometheus metrics setup
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'arjun_backend_' });

export const httpRequestDuration = new promClient.Histogram({
  name: 'arjun_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        config.frontendOrigin,
        'https://api.karviontechnologies.in',
        'http://localhost:8080',
        'http://localhost:3000',
      ];
      if (allowedOrigins.includes(origin) || origin.endsWith('.karviontechnologies.in')) {
        return callback(null, true);
      }
      return callback(null, true); // Dev flexible fallback
    },
    credentials: true,
  })
);

app.use(compression());
app.use(cookieParser(config.security.cookieSecret));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    const pong = await getRedisClient().ping();
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }

  const isHealthy = mongoOk && redisOk;
  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'backend',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
    },
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Admin API Routes
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/customers', adminCustomerRoutes);
app.use('/api/v1/admin/apis', adminCatalogRoutes);
app.use('/api/v1/admin/subscriptions', adminSubscriptionRoutes);
app.use('/api/v1/admin/payments', adminPaymentRoutes);
app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
app.use('/api/v1/admin/logs', adminLogsRoutes);
app.use('/api/v1/admin/audit', adminAuditRoutes);
app.use('/api/v1/admin/system', adminSystemRoutes);
app.use('/api/v1/admin/maintenance', adminMaintenanceRoutes);
app.use('/api/v1/admin/tickets', adminTicketsRoutes);
app.use('/api/v1/admin/backups', adminBackupsRoutes);
app.use('/api/v1/admin/security', adminSecurityRoutes);
app.use('/api/v1/admin/monitoring', adminMonitoringRoutes);
app.use('/api/v1/admin/hosting', adminHostingRoutes);

// Customer API Routes
app.use('/api/v1/customer/auth', customerAuthRoutes);
app.use('/api/v1/customer/dashboard', customerDashboardRoutes);
app.use('/api/v1/customer/apis', customerApisRoutes);
app.use('/api/v1/customer/usage', customerUsageRoutes);
app.use('/api/v1/customer/logs', customerLogsRoutes);
app.use('/api/v1/customer/ip-allowlist', customerIpRoutes);
app.use('/api/v1/customer/webhooks', customerWebhooksRoutes);
app.use('/api/v1/customer/tickets', customerTicketsRoutes);
app.use('/api/v1/customer/subscription', customerSubscriptionRoutes);
app.use('/api/v1/customer/security', customerSecurityRoutes);

// 404 Handler
app.use('*', (req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The route ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
});

// Centralized Error Handler
app.use(errorHandler);
