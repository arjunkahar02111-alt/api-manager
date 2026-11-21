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
import { AntiSharingGuard } from '../../apps/gateway/src/security/antiSharingGuard.js';
import { SecurityService } from '../../apps/backend/src/services/security.service.js';
import { Customer, ApiKey, IpBlacklist, Administrator } from '../../apps/backend/src/database/models/index.js';

describe('Anti-Key Sharing & Strict Single-Session Security Suite', () => {
  let mongoServer: MongoMemoryServer;
  let redis: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    redis = new (RedisMock as any)();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('1. should block requests from blacklisted IPs with 403 IP_BLACKLISTED', async () => {
    await redis.set('blacklist:ip:103.22.44.11', 'Suspicious scraper detected', 'EX', 3600);

    await expect(AntiSharingGuard.checkIpBlacklist('103.22.44.11', redis)).rejects.toThrow(
      'Access Denied: IP address 103.22.44.11 is banned'
    );

    // Non-blacklisted IP passes
    await expect(AntiSharingGuard.checkIpBlacklist('127.0.0.1', redis)).resolves.not.toThrow();
  });

  it('2. should auto-lock first seen IP on initial API key request', async () => {
    const customer = await Customer.create({
      username: 'client_bob',
      fullName: 'Bob Developer',
      email: 'bob@example.com',
      status: 'active',
      dailyRequestLimit: 1000,
      monthlyRequestLimit: 30000,
      lifetimeRequestLimit: 100000,
      maxConcurrentRequests: 5,
      maxBandwidthBytes: 1000000,
      allowedApis: ['*'],
      allowedIps: [],
      ipLockStrict: true,
      autoBanOnKeySharing: true,
      expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      createdBy: 'admin',
    });

    const apiKey = await ApiKey.create({
      customerId: customer._id,
      keyHash: 'hash_test_bob_12345',
      keyPrefix: 'arjun_live_bob',
      status: 'active',
    });

    const mockReq1: any = {
      ip: '122.160.10.5',
      socket: { remoteAddress: '122.160.10.5' },
      headers: {},
      method: 'GET',
      originalUrl: '/v1/osint/vehicle',
    };

    const customerContext: any = {
      customerId: customer._id.toString(),
      username: customer.username,
      status: 'active',
      expiresAt: customer.expiresAt,
      dailyRequestLimit: 1000,
      monthlyRequestLimit: 30000,
      lifetimeRequestLimit: 100000,
      maxConcurrentRequests: 5,
      maxBandwidthBytes: 1000000,
      allowedApis: ['*'],
      allowedIps: [],
      keyPrefix: apiKey.keyPrefix,
      developerTag: 'arjunkahar',
      keyHash: apiKey.keyHash,
      boundIp: undefined,
      ipLockStrict: true,
      autoBanOnKeySharing: true,
    };

    // First request binds to 122.160.10.5
    const validatedIp = await AntiSharingGuard.enforce(mockReq1, customerContext, redis);
    expect(validatedIp).toBe('122.160.10.5');
    expect(customerContext.boundIp).toBe('122.160.10.5');

    // Second request from SAME IP succeeds
    await expect(AntiSharingGuard.enforce(mockReq1, customerContext, redis)).resolves.toBe('122.160.10.5');
  });

  it('3. should detect key sharing from foreign IP, auto-ban the key and blacklist the foreign IP', async () => {
    const customer = await Customer.findOne({ username: 'client_bob' });
    const apiKey = await ApiKey.findOne({ customerId: customer!._id });

    const customerContext: any = {
      customerId: customer!._id.toString(),
      username: customer!.username,
      status: 'active',
      expiresAt: customer!.expiresAt,
      dailyRequestLimit: 1000,
      monthlyRequestLimit: 30000,
      lifetimeRequestLimit: 100000,
      maxConcurrentRequests: 5,
      maxBandwidthBytes: 1000000,
      allowedApis: ['*'],
      allowedIps: [],
      keyPrefix: apiKey!.keyPrefix,
      developerTag: 'arjunkahar',
      keyHash: apiKey!.keyHash,
      boundIp: '122.160.10.5', // Locked to Bob's computer
      ipLockStrict: true,
      autoBanOnKeySharing: true,
    };

    // Friend attempts to use the key from foreign IP: 49.36.120.88
    const mockReqFriend: any = {
      ip: '49.36.120.88',
      socket: { remoteAddress: '49.36.120.88' },
      headers: { 'user-agent': 'python-requests/2.31.0' },
      method: 'GET',
      originalUrl: '/v1/osint/vehicle',
    };

    await expect(AntiSharingGuard.enforce(mockReqFriend, customerContext, redis)).rejects.toThrow(
      'SECURITY VIOLATION: Unauthorized multi-user API key sharing detected'
    );

    // Verify Customer account was auto-suspended
    const updatedCustomer = await Customer.findById(customer!._id);
    expect(updatedCustomer!.status).toBe('suspended');
    expect(updatedCustomer!.keySharingViolations).toBe(1);

    // Verify API key was auto-revoked
    const updatedKey = await ApiKey.findOne({ keyHash: apiKey!.keyHash });
    expect(updatedKey!.status).toBe('revoked');

    // Verify foreign IP was added to blacklist
    const bannedRecord = await mongoose.connection.db!.collection('ip_blacklists').findOne({ ip: '49.36.120.88' });
    expect(bannedRecord).toBeDefined();
    expect(bannedRecord?.reason).toContain('Unauthorized key sharing');
  });

  it('4. should enforce strict single-user login session and invalidate older session', async () => {
    const admin = await Administrator.create({
      username: 'single_session_admin',
      passwordHash: 'dummy_hash',
      role: 'super_admin',
      isActive: true,
      failedLoginAttempts: 0,
    });

    // Session 1 is issued (Browser 1)
    const session1 = await SecurityService.issueSession(admin._id.toString(), 'admin');
    const valid1 = await SecurityService.validateSession(admin._id.toString(), 'admin', session1);
    expect(valid1).toBe(true);

    // Session 2 is issued (Browser 2 logs in with same account)
    const session2 = await SecurityService.issueSession(admin._id.toString(), 'admin');
    const valid2 = await SecurityService.validateSession(admin._id.toString(), 'admin', session2);
    expect(valid2).toBe(true);

    // Browser 1's older session MUST be terminated / invalid!
    const isOldSessionValid = await SecurityService.validateSession(admin._id.toString(), 'admin', session1);
    expect(isOldSessionValid).toBe(false);
  });
});
