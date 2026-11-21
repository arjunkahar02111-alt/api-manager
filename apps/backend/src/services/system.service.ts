import os from 'node:os';
import mongoose from 'mongoose';
import { getRedisClient } from './redis.service.js';

export class SystemService {
  static async getSystemMetrics() {
    const memoryTotal = os.totalmem();
    const memoryFree = os.freemem();
    const memoryUsed = memoryTotal - memoryFree;
    const memoryUsagePct = Math.round((memoryUsed / memoryTotal) * 100);

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // Check Redis health
    let redisStatus = 'disconnected';
    let redisLatencyMs = 0;
    try {
      const redis = getRedisClient();
      const start = Date.now();
      const pong = await redis.ping();
      redisLatencyMs = Date.now() - start;
      if (pong === 'PONG') redisStatus = 'healthy';
    } catch {
      redisStatus = 'error';
    }

    // Check MongoDB health
    let mongoStatus = 'disconnected';
    if (mongoose.connection.readyState === 1) {
      mongoStatus = 'healthy';
    }

    return {
      server: {
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: Math.floor(os.uptime()),
        hostname: os.hostname(),
        nodeVersion: process.version,
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown CPU',
        loadAvg,
      },
      memory: {
        totalBytes: memoryTotal,
        usedBytes: memoryUsed,
        freeBytes: memoryFree,
        usagePercentage: memoryUsagePct,
      },
      services: {
        mongodb: {
          status: mongoStatus,
          readyState: mongoose.connection.readyState,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
