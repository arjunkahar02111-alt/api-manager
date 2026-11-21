import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { getRedisClient, closeRedis } from './services/redis.service.js';
import { AuthService } from './services/auth.service.js';
import { seedInitialData } from './database/seed.js';
import { SocketService } from './services/socket.service.js';
import { HostingService } from './services/hosting.service.js';

async function bootstrap() {
  console.log('==================================================');
  console.log('   ARJUN API MANAGER — MANAGEMENT BACKEND SERVICE   ');
  console.log('   Domain: api.karviontechnologies.in             ');
  console.log('==================================================');

  try {
    // 1. Connect MongoDB
    console.log(`[Bootstrap] Connecting to MongoDB: ${config.database.uri}...`);
    await connectDatabase(config.database.uri);

    // 2. Connect Redis
    console.log(`[Bootstrap] Connecting to Redis: ${config.redis.host}:${config.redis.port}...`);
    let redis = getRedisClient();
    try {
      await redis.connect();
      await redis.ping();
      console.log('[Bootstrap] Redis connected successfully.');
    } catch (err: any) {
      console.warn(`[Bootstrap] Redis unavailable (${err.message}) — falling back to in-memory store`);
      process.env.REDIS_MOCK = 'true';
      await closeRedis();
      redis = getRedisClient();
    }

    // 3. Seed Super Admin and Baseline Configurations
    await AuthService.seedSuperAdmin();
    await seedInitialData();
    HostingService.initWorkspace();

    // 4. Start HTTP Server
    const server = app.listen(config.port, () => {
      console.log(`[Bootstrap] Arjun API Backend is running on port ${config.port}`);
      console.log(`[Bootstrap] Health endpoint available at http://localhost:${config.port}/health`);
    });

    // 5. Initialize Socket.IO Telemetry Engine
    SocketService.initialize(server);

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Shutdown] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('[Shutdown] HTTP server closed.');
        await disconnectDatabase();
        await closeRedis();
        console.log('[Shutdown] Database and Redis connections closed. Exiting.');
        process.exit(0);
      });

      // Force exit after 10s if hanging
      setTimeout(() => {
        console.error('[Shutdown] Forced exit after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err: any) {
    console.error('[Bootstrap] Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
