import mongoose from 'mongoose';
import { hashPassword } from '@arjun/shared';
import {
  Administrator,
  SubscriptionPlan,
  ApiCatalog,
  Customer,
  ApiKey,
} from '../../apps/backend/src/database/models/index.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arjun_api_manager';

async function seed() {
  console.log('[Seed] Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // 1. Super Admin
  const adminExists = await Administrator.findOne({ username: 'admin' });
  if (!adminExists) {
    const passwordHash = await hashPassword('AdminStrongSecurePassword2026!');
    await Administrator.create({
      username: 'admin',
      email: 'admin@karviontechnologies.in',
      passwordHash,
      role: 'super_admin',
      isActive: true,
      allowedIps: [],
    });
    console.log('[Seed] Created default Super Admin: admin / AdminStrongSecurePassword2026!');
  } else {
    console.log('[Seed] Super Admin already exists.');
  }

  // 2. Subscription Plans
  const plans = [
    {
      name: 'Starter Developer',
      slug: 'starter',
      description: 'Ideal for independent developers and MVP projects',
      dailyRequestLimit: 5000,
      monthlyRequestLimit: 100000,
      lifetimeRequestLimit: 500000,
      maxConcurrentRequests: 5,
      maxBandwidthBytes: 524288000, // 500 MB
      priceMonthly: 49,
      currency: 'USD',
      allowedApis: ['*'],
      isPublic: true,
    },
    {
      name: 'Professional Scale',
      slug: 'pro',
      description: 'Designed for production SaaS applications and growing teams',
      dailyRequestLimit: 25000,
      monthlyRequestLimit: 500000,
      lifetimeRequestLimit: 2500000,
      maxConcurrentRequests: 20,
      maxBandwidthBytes: 5368709120, // 5 GB
      priceMonthly: 149,
      currency: 'USD',
      allowedApis: ['*'],
      isPublic: true,
    },
    {
      name: 'Enterprise Ultra',
      slug: 'enterprise',
      description: 'Unlimited scalability, dedicated SLA, and high throughput',
      dailyRequestLimit: 100000,
      monthlyRequestLimit: 2000000,
      lifetimeRequestLimit: 10000000,
      maxConcurrentRequests: 50,
      maxBandwidthBytes: 53687091200, // 50 GB
      priceMonthly: 499,
      currency: 'USD',
      allowedApis: ['*'],
      isPublic: true,
    },
  ];

  for (const plan of plans) {
    await SubscriptionPlan.findOneAndUpdate({ slug: plan.slug }, plan, { upsert: true, new: true });
    console.log(`[Seed] Synced Subscription Plan: ${plan.name}`);
  }

  // 3. API Catalog Endpoints
  const endpoints = [
    {
      name: 'User Identity Verification',
      slug: 'user-identity-verify',
      description: 'Verifies customer credentials, identity details, and account authenticity',
      category: 'User Information',
      gatewayPath: '/user/verify',
      upstreamBaseUrl: 'https://httpbin.org',
      upstreamPath: '/post',
      allowedMethods: ['POST'],
      timeoutMs: 10000,
      cacheTtlSeconds: 0,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
    {
      name: 'Gaming Player Statistics',
      slug: 'gaming-player-stats',
      description: 'Fetches real-time player leaderboards, achievements, and session telemetry',
      category: 'Gaming APIs',
      gatewayPath: '/gaming/stats',
      upstreamBaseUrl: 'https://httpbin.org',
      upstreamPath: '/get',
      allowedMethods: ['GET'],
      timeoutMs: 8000,
      cacheTtlSeconds: 60,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
    {
      name: 'IP Geolocation & Threat Intel',
      slug: 'utility-geoip-intel',
      description: 'Resolves IP coordinates, ASN provider, VPN detection, and risk scoring',
      category: 'Utility APIs',
      gatewayPath: '/utility/geoip',
      upstreamBaseUrl: 'https://httpbin.org',
      upstreamPath: '/get',
      allowedMethods: ['GET'],
      timeoutMs: 5000,
      cacheTtlSeconds: 300,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
    {
      name: 'OSINT Domain Intelligence',
      slug: 'osint-domain-intel',
      description: 'Queries DNS history, WHOIS registration records, and SSL certificate chains',
      category: 'OSINT APIs',
      gatewayPath: '/osint/domain',
      upstreamBaseUrl: 'https://httpbin.org',
      upstreamPath: '/get',
      allowedMethods: ['GET'],
      timeoutMs: 12000,
      cacheTtlSeconds: 600,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
    {
      name: 'RootX Vehicle Intelligence OSINT (Vehicle2-N)',
      slug: 'vehicle2-n',
      description: 'Vehicle registration and RC to mobile intelligence lookup (Vehicle2-N)',
      category: 'Vehicle Information',
      gatewayPath: '/vehicle2-n',
      upstreamBaseUrl: 'https://rootx-osint.in',
      upstreamPath: '/?type=v_num&key=Axn_personal',
      allowedMethods: ['GET'],
      timeoutMs: 30000,
      cacheTtlSeconds: 0,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
    {
      name: 'RootX Vehicle Intelligence OSINT',
      slug: 'rootx-vehicle-osint',
      description: 'Vehicle registration and ownership intelligence lookup via RootX OSINT engine',
      category: 'Vehicle Information',
      gatewayPath: '/osint/vehicle',
      upstreamBaseUrl: 'https://rootx-osint.in',
      upstreamPath: '/?type=v_num&key=Axn_personal',
      allowedMethods: ['GET'],
      timeoutMs: 30000,
      cacheTtlSeconds: 0,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
    {
      name: 'Vehicle to Number V2N-2',
      slug: 'v2n-2',
      description: 'Vehicle registration to mobile number lookup (v2n-2)',
      category: 'Vehicle Information',
      gatewayPath: '/v2n-2',
      upstreamBaseUrl: 'https://rootx-osint.in',
      upstreamPath: '/?type=v_num&key=Axn_personal',
      allowedMethods: ['GET'],
      timeoutMs: 30000,
      cacheTtlSeconds: 0,
      isActive: true,
      authRequired: true,
      allowedCustomerPlans: ['*'],
    },
  ];

  for (const ep of endpoints) {
    await ApiCatalog.findOneAndUpdate({ slug: ep.slug }, ep, { upsert: true, new: true });
    console.log(`[Seed] Synced API Catalog Endpoint: ${ep.name} (${ep.gatewayPath})`);
  }

  console.log('[Seed] Seeding completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
