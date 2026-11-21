import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import os from 'node:os';
import mongoose from 'mongoose';
import { getRedisClient } from './redis.service.js';
import { Customer, ApiKey, RequestLog, SecurityIncident, IpBlacklist } from '../database/models/index.js';

class SocketManager {
  private io: SocketIOServer | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  initialize(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
    });

    this.io.on('connection', (socket) => {
      // Auto-join telemetry room for instant zero-config updates
      socket.join('admin-telemetry');

      socket.on('subscribe:admin', () => {
        socket.join('admin-telemetry');
      });

      socket.on('subscribe:customer', (customerId: string) => {
        if (customerId) {
          socket.join(`customer:${customerId}`);
        }
      });
    });

    this.startMetricsLoop();
    console.log('[SocketService] Real-time Socket.IO telemetry engine online.');
  }

  broadcastToAdmin(event: string, payload: any) {
    if (this.io) {
      this.io.to('admin-telemetry').emit(event, payload);
      this.io.emit(event, payload);
    }
  }

  broadcastToCustomer(customerId: string, event: string, payload: any) {
    if (this.io) {
      this.io.to(`customer:${customerId}`).emit(event, payload);
    }
  }

  broadcastAll(event: string, payload: any) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }

  private startMetricsLoop() {
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    this.metricsInterval = setInterval(async () => {
      if (!this.io) return;

      try {
        const mem = process.memoryUsage();
        const mongoHealth = mongoose.connection.readyState === 1 ? 'up' : 'down';
        let redisHealth = 'down';
        try {
          const pong = await getRedisClient().ping();
          if (pong === 'PONG') redisHealth = 'up';
        } catch {}

        const [activeUsersCount, activeKeysCount, totalRequestsToday, recentIncidentsCount] =
          await Promise.all([
            Customer.countDocuments({ status: 'active' }),
            ApiKey.countDocuments({ status: 'active' }),
            RequestLog.countDocuments({
              timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            }),
            SecurityIncident.countDocuments({
              createdAt: { $gte: new Date(Date.now() - 3600 * 1000) },
            }),
          ]);

        const metrics = {
          timestamp: new Date().toISOString(),
          system: {
            processMemoryRssMb: Math.round(mem.rss / 1024 / 1024),
            processHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
            osFreeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
            osTotalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
            cpuLoad: os.loadavg()[0] || 0,
            uptimeSeconds: Math.floor(process.uptime()),
          },
          services: {
            mongodb: mongoHealth,
            redis: redisHealth,
          },
          telemetry: {
            activeUsers: activeUsersCount,
            activeKeys: activeKeysCount,
            totalRequestsToday,
            recentIncidentsLastHour: recentIncidentsCount,
          },
        };

        this.broadcastToAdmin('system:metrics', metrics);
      } catch {}
    }, 5000);
  }
}

export const SocketService = new SocketManager();
