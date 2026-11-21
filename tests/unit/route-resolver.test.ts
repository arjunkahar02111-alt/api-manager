import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import RedisMock from 'ioredis-mock';

vi.mock('ioredis', () => {
  return {
    Redis: RedisMock,
    default: RedisMock,
  };
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RouteResolver } from '../../apps/gateway/src/routing/routeResolver.js';
import { ApiCatalog } from '../../apps/backend/src/database/models/index.js';

describe('Gateway Route Resolver & Vehicle Intelligence Aliases Suite', () => {
  let mongoServer: MongoMemoryServer;
  let redis: any;
  let resolver: RouteResolver;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    redis = new (RedisMock as any)();
    resolver = new RouteResolver(redis);
    await ApiCatalog.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. should resolve /vehicle2-n using fallback even when catalog is completely empty', async () => {
    const resolved = await resolver.resolve('/vehicle2-n');
    expect(resolved).not.toBeNull();
    expect(resolved?.route.gatewayPath).toBe('/vehicle2-n');
    expect(resolved?.route.upstreamBaseUrl).toBe('https://rootx-osint.in');
    expect(resolved?.route.upstreamPath).toContain('type=v_num');
    expect(resolved?.route.status).toBe('active');
  });

  it('2. should resolve /vehicle2-n alias when catalog only has /osint/vehicle', async () => {
    await redis.flushall();
    // Seed only /osint/vehicle in DB
    await ApiCatalog.create({
      name: 'RootX Vehicle OSINT',
      slug: 'rootx-vehicle-osint',
      gatewayPath: '/osint/vehicle',
      upstreamBaseUrl: 'https://rootx-osint.in',
      upstreamPath: '/?type=v_num&key=Axn_personal',
      allowedMethods: ['GET'],
      status: 'active',
    });

    const resolved = await resolver.resolve('/vehicle2-n');
    expect(resolved).not.toBeNull();
    expect(resolved?.route.upstreamBaseUrl).toBe('https://rootx-osint.in');
    expect(resolved?.route.name).toBe('RootX Vehicle OSINT');
  });

  it('3. should resolve exact /vehicle2-n endpoint when explicitly registered in catalog', async () => {
    await redis.flushall();
    await ApiCatalog.create({
      name: 'RootX Vehicle Intelligence (Vehicle2-N)',
      slug: 'vehicle2-n',
      gatewayPath: '/vehicle2-n',
      upstreamBaseUrl: 'https://rootx-osint.in',
      upstreamPath: '/?type=v_num&key=Axn_personal',
      allowedMethods: ['GET'],
      status: 'active',
    });

    const resolved = await resolver.resolve('/vehicle2-n');
    expect(resolved).not.toBeNull();
    expect(resolved?.route.slug).toBe('vehicle2-n');
    expect(resolved?.route.gatewayPath).toBe('/vehicle2-n');
  });

  it('4. should resolve /v2n-2 and /v2n aliases correctly', async () => {
    await redis.flushall();
    const resolvedV2n2 = await resolver.resolve('/v2n-2');
    expect(resolvedV2n2).not.toBeNull();
    expect(resolvedV2n2?.route.upstreamBaseUrl).toBe('https://rootx-osint.in');

    const resolvedV2n = await resolver.resolve('/v2n');
    expect(resolvedV2n).not.toBeNull();
    expect(resolvedV2n?.route.upstreamBaseUrl).toBe('https://rootx-osint.in');
  });

  it('5. should return null for non-existent and unmapped routes', async () => {
    await redis.flushall();
    const resolved = await resolver.resolve('/nonexistent-unknown-endpoint');
    expect(resolved).toBeNull();
  });
});
