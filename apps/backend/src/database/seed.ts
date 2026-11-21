import { SubscriptionPlan, ApiCatalog, Customer, ApiKey } from './models/index.js';

export async function seedInitialData(): Promise<void> {
  console.log('[Seed] Verifying system baseline seeds...');

  // 1. Subscription Plans
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

  // 2. Default API Catalog - RootX Vehicle Intelligence OSINT
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

  // Purge legacy mock endpoints if present
  await ApiCatalog.deleteMany({
    slug: { $in: ['user-identity-verify', 'gaming-player-stats', 'utility-geoip-intel', 'osint-domain-intel'] },
  });

  // Purge legacy test developer customer if present
  const testDev = await Customer.findOne({ username: 'test_developer' });
  if (testDev) {
    await ApiKey.deleteMany({ customerId: testDev._id });
    await Customer.deleteOne({ _id: testDev._id });
    console.log('[Seed] Purged legacy test_developer customer.');
  }

  console.log('[Seed] Baseline configuration verified successfully.');
}
