import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hashPassword, hashApiKey } from '../../packages/shared/dist/index.js';
import {
  Administrator,
  SubscriptionPlan,
  ApiCatalog,
  Customer,
  ApiKey,
} from '../../apps/backend/dist/database/models/index.js';

let mongoServer: MongoMemoryServer | null = null;
const childProcesses: ChildProcess[] = [];

async function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function seedDatabase(mongoUri: string) {
  console.log('[DevRunner] Initializing and verifying seed records...');
  
  let connected = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      connected = true;
      break;
    } catch (err: any) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 1. Super Admin
  let admin = await Administrator.findOne({ username: 'admin' });
  if (!admin) {
    const passwordHash = await hashPassword('AdminStrongSecurePassword2026!');
    admin = await Administrator.create({
      username: 'admin',
      email: 'admin@karviontechnologies.in',
      passwordHash,
      role: 'super_admin',
      isActive: true,
      allowedIps: [],
    });
    console.log('[DevRunner] Super Admin seeded: admin / AdminStrongSecurePassword2026!');
  }

  // 2. Subscription Plans
  const plans = [
    {
      name: 'Starter Developer',
      description: 'Ideal for independent developers and MVP projects',
      durationDays: 30,
      dailyLimit: 5000,
      monthlyLimit: 100000,
      lifetimeLimit: 500000,
      concurrencyLimit: 5,
      bandwidthLimitBytes: 524288000,
      price: 49,
      currency: 'USD',
      allowedApis: ['*'],
      status: 'active',
    },
    {
      name: 'Professional Scale',
      description: 'Designed for production SaaS applications and growing teams',
      durationDays: 30,
      dailyLimit: 25000,
      monthlyLimit: 500000,
      lifetimeLimit: 2500000,
      concurrencyLimit: 20,
      bandwidthLimitBytes: 5368709120,
      price: 149,
      currency: 'USD',
      allowedApis: ['*'],
      status: 'active',
    },
    {
      name: 'Enterprise Ultra',
      description: 'Dedicated SLA, custom limits, and highest throughput',
      durationDays: 30,
      dailyLimit: 100000,
      monthlyLimit: 2000000,
      lifetimeLimit: 10000000,
      concurrencyLimit: 50,
      bandwidthLimitBytes: 53687091200,
      price: 499,
      currency: 'USD',
      allowedApis: ['*'],
      status: 'active',
    },
  ];

  for (const plan of plans) {
    await SubscriptionPlan.findOneAndUpdate({ name: plan.name }, plan, { upsert: true, new: true });
  }

  // 3. API Catalog Endpoints
  const endpoints = [
    {
      name: 'RootX Vehicle Intelligence OSINT',
      slug: 'rootx-vehicle-osint',
      description: 'Vehicle registration and ownership lookup via RootX OSINT engine',
      category: 'Vehicle Information',
      version: 'v1',
      gatewayPath: '/osint/vehicle',
      upstreamBaseUrl: 'https://rootx-osint.in',
      upstreamPath: '/?type=v_num&key=Axn_personal',
      allowedMethods: ['GET'],
      timeoutMs: 30000,
      status: 'active',
      authenticationRequired: true,
      allowedPlans: ['*'],
    },
  ];

  for (const ep of endpoints) {
    await ApiCatalog.findOneAndUpdate({ slug: ep.slug }, ep, { upsert: true, new: true });
  }

  // Delete older dummy test endpoints if present
  await ApiCatalog.deleteMany({
    slug: { $in: ['user-identity-verify', 'gaming-player-stats', 'utility-geoip-intel', 'osint-domain-intel'] },
  });

  // Delete test_developer or testing customer accounts
  const testDev = await Customer.findOne({ username: 'test_developer' });
  if (testDev) {
    await ApiKey.deleteMany({ customerId: testDev._id });
    await Customer.deleteOne({ _id: testDev._id });
    console.log('[DevRunner] Purged legacy test_developer customer and keys.');
  }

  await mongoose.disconnect();
  console.log('[DevRunner] Database successfully initialized with clean production state.');
}

function startProcess(name: string, cmd: string, args: string[], cwd: string, env: Record<string, string>) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  });

  childProcesses.push(child);

  child.on('error', (err) => {
    console.error(`[${name}] Error:`, err);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[${name}] Exited with code ${code}`);
    }
  });

  return child;
}

async function main() {
  console.log('\n========================================================================');
  console.log('       ARJUN API MANAGER — PRODUCTION-GRADE SAAS PLATFORM');
  console.log('       Canonical Domain: https://api.karviontechnologies.in');
  console.log('========================================================================\n');

  let mongoUri = 'mongodb://127.0.0.1:27017/arjun_api_manager';

  const mongoRunning = await isPortOpen(27017);
  if (mongoRunning) {
    console.log('[DevRunner] Detected existing MongoDB on 127.0.0.1:27017');
  } else {
    console.log('[DevRunner] Starting Embedded MongoDB Server (v8.2.6)...');
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'arjun_api_manager',
      },
    });
    mongoUri = mongoServer.getUri();
    console.log(`[DevRunner] Embedded MongoDB active at: ${mongoUri}`);
  }

  await seedDatabase(mongoUri);

  const rootDir = process.cwd();
  const backendDir = path.join(rootDir, 'apps', 'backend');
  const gatewayDir = path.join(rootDir, 'apps', 'gateway');
  const workerDir = path.join(rootDir, 'apps', 'worker');
  const frontendDir = path.join(rootDir, 'apps', 'frontend');

  const sharedEnv = {
    NODE_ENV: 'development',
    MONGODB_URI: mongoUri,
    BACKEND_PORT: '3000',
    GATEWAY_PORT: '3001',
    REDIS_MOCK: 'true',
    JWT_ADMIN_SECRET: 'super_secret_jwt_admin_key_32_chars_minimum',
    JWT_CUSTOMER_SECRET: 'super_secret_jwt_customer_key_32_chars_minimum',
    DATA_ENCRYPTION_KEY: 'e1f98a2b5c7d3e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    CORS_ALLOWED_ORIGINS: 'http://localhost:8080,http://127.0.0.1:8080,https://api.karviontechnologies.in',
  };

  // 1. Start Backend on port 3000
  console.log('[DevRunner] Starting Management Backend on port 3000...');
  startProcess('Backend', 'npx', ['tsx', 'watch', 'src/index.ts'], backendDir, sharedEnv);

  // 2. Start Gateway on port 3001
  console.log('[DevRunner] Starting API Gateway Proxy on port 3001...');
  startProcess('Gateway', 'npx', ['tsx', 'watch', 'src/index.ts'], gatewayDir, sharedEnv);

  // 3. Start Worker
  console.log('[DevRunner] Starting Background Worker Service...');
  startProcess('Worker', 'npx', ['tsx', 'watch', 'src/index.ts'], workerDir, sharedEnv);

  // 4. Start Frontend on port 8080
  console.log('[DevRunner] Starting Frontend Developer Dashboard on port 8080...');
  startProcess('Frontend', 'pnpm', ['run', 'dev'], frontendDir, sharedEnv);

  // Print helpful summary banner
  setTimeout(() => {
    console.log('\n========================================================================');
    console.log('   ARJUN API MANAGER IS NOW RUNNING AND ACCESSIBLE:');
    console.log('========================================================================');
    console.log('   Web Dashboard:               http://localhost:8080');
    console.log('   Super Admin Portal:          http://localhost:8080');
    console.log('   Customer Developer Portal:   http://localhost:8080');
    console.log('   Management Backend API:      http://localhost:3000/api/v1');
    console.log('   Public API Gateway Proxy:    http://localhost:3001/v1');
    console.log('   Health Check URL:            http://localhost:3000/health');
    console.log('------------------------------------------------------------------------');
    console.log('   Default Super Admin Credentials:');
    console.log('     Username: admin');
    console.log('     Password: AdminStrongSecurePassword2026!');
    console.log('------------------------------------------------------------------------');
    console.log('   Client Keys are generated on-demand by Super Admin in the Dashboard.');
    console.log('------------------------------------------------------------------------');
    console.log('   Direct API Gateway URL with Key in URL:');
    console.log('     curl "http://localhost:3001/v1/osint/vehicle?key=YOUR_KEY&query=DL10CE1234"');
    console.log('========================================================================\n');
  }, 3000);

  // Cleanup on exit
  const cleanup = async () => {
    console.log('\n[DevRunner] Shutting down services...');
    for (const child of childProcesses) {
      try {
        child.kill();
      } catch {}
    }
    if (mongoServer) {
      await mongoServer.stop();
      console.log('[DevRunner] Embedded MongoDB stopped.');
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('[DevRunner] Startup failed:', err);
  process.exit(1);
});
