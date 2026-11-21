import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import RedisMock from 'ioredis-mock';

vi.mock('ioredis', () => {
  return {
    Redis: RedisMock,
    default: RedisMock,
  };
});

import { app } from '../../apps/backend/src/app.js';
import { AuthService } from '../../apps/backend/src/services/auth.service.js';
import { Administrator, Customer, ApiKey } from '../../apps/backend/src/database/models/index.js';
import { hashPassword, hashApiKey } from '@arjun/shared';

let mongoServer: MongoMemoryServer;

describe('End-to-End API SaaS Lifecycle Test Suite', () => {
  let adminToken: string;
  let customerRawKey: string;
  let customerId: string;
  let customerToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Seed initial Super Admin
    await AuthService.seedSuperAdmin();
  }, 240000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // 1. ADMIN AUTHENTICATION
  describe('1. Super Admin Authentication', () => {
    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ username: 'admin', password: 'IncorrectPassword123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should authenticate Super Admin and return JWT access token', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.admin.username).toBe('admin');
      expect(res.body.data.admin.role).toBe('super_admin');

      adminToken = res.body.data.accessToken;
    });

    it('should fetch admin profile via GET /api/v1/admin/auth/me', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.admin.username).toBe('admin');
    });
  });

  // 2. CUSTOMER MANAGEMENT (Super Admin Only)
  describe('2. Customer Creation & API Key Generation', () => {
    it('should reject customer creation without admin authorization', async () => {
      const res = await request(app)
        .post('/api/v1/admin/customers')
        .send({
          username: 'client_corp',
          fullName: 'Client Corporation',
          email: 'client@corp.com',
          validityDays: 30,
        });

      expect(res.status).toBe(401);
    });

    it('should allow Super Admin to create a customer with single API key', async () => {
      const res = await request(app)
        .post('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'client_corp',
          fullName: 'Client Corporation',
          email: 'client@corp.com',
          validityDays: 30,
          dailyRequestLimit: 5,
          monthlyRequestLimit: 100,
          lifetimeRequestLimit: 500,
          maxConcurrentRequests: 2,
          maxBandwidthBytes: 10485760,
          allowedApis: ['*'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.username).toBe('client_corp');
      expect(res.body.data.apiKey.rawKey).toBeDefined();
      expect(res.body.data.apiKey.rawKey.startsWith('arjun_live_')).toBe(true);

      customerRawKey = res.body.data.apiKey.rawKey;
      customerId = res.body.data.customer._id;

      // Verify that raw key is NOT stored in MongoDB (One-way hash verification)
      const storedKey = await ApiKey.findOne({ customerId });
      expect(storedKey).toBeDefined();
      expect(storedKey?.keyHash).toBe(hashApiKey(customerRawKey));
      expect(storedKey?.keyHash).not.toBe(customerRawKey); // Plaintext is never stored
    });

    it('should prevent duplicate customer usernames', async () => {
      const res = await request(app)
        .post('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'client_corp',
          fullName: 'Duplicate Corp',
          email: 'dup@corp.com',
        });

      expect(res.status).toBe(409);
    });
  });

  // 3. CUSTOMER AUTHENTICATION VIA ASSIGNED API KEY
  describe('3. Customer Key Authentication & Developer Portal', () => {
    it('should reject customer login with invalid API key', async () => {
      const res = await request(app)
        .post('/api/v1/customer/auth/login')
        .send({ apiKey: 'arjun_live_invalidkey1234567890abcdef1234567890' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_API_KEY');
    });

    it('should authenticate customer using assigned API key and issue session', async () => {
      const res = await request(app)
        .post('/api/v1/customer/auth/login')
        .send({ apiKey: customerRawKey });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.customer.username).toBe('client_corp');

      customerToken = res.body.data.token;
    });

    it('should allow customer to view personal dashboard overview', async () => {
      const res = await request(app)
        .get('/api/v1/customer/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profile.username).toBe('client_corp');
      expect(res.body.data.profile.keyPrefix).toBe(customerRawKey.substring(0, 16));
    });
  });

  // 4. API KEY REGENERATION & OLD KEY INVALIDATION
  describe('4. API Key Regeneration & Immediate Invalidation', () => {
    let newRawKey: string;

    it('should regenerate key and immediately invalidate the old key', async () => {
      const regenRes = await request(app)
        .post(`/api/v1/admin/customers/${customerId}/regenerate-key`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(regenRes.status).toBe(200);
      expect(regenRes.body.data.rawKey).toBeDefined();
      expect(regenRes.body.data.rawKey).not.toBe(customerRawKey);

      newRawKey = regenRes.body.data.rawKey;

      // Verify old key is revoked and fails login
      const oldLoginRes = await request(app)
        .post('/api/v1/customer/auth/login')
        .send({ apiKey: customerRawKey });

      expect(oldLoginRes.status).toBe(403);
      expect(oldLoginRes.body.error.code).toBe('KEY_INACTIVE');

      // Verify new key succeeds login
      const newLoginRes = await request(app)
        .post('/api/v1/customer/auth/login')
        .send({ apiKey: newRawKey });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data.token).toBeDefined();

      customerRawKey = newRawKey;
      customerToken = newLoginRes.body.data.token;
    });
  });

  // 5. ACCOUNT SUSPENSION & REACTIVATION
  describe('5. Account Suspension & Reactivation Controls', () => {
    it('should block customer when account is suspended by administrator', async () => {
      // Suspend
      const suspendRes = await request(app)
        .post(`/api/v1/admin/customers/${customerId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(suspendRes.status).toBe(200);

      // Attempt login
      const loginRes = await request(app)
        .post('/api/v1/customer/auth/login')
        .send({ apiKey: customerRawKey });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

      // Reactivate
      const reactivateRes = await request(app)
        .post(`/api/v1/admin/customers/${customerId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reactivateRes.status).toBe(200);

      // Verify login works again
      const reloginRes = await request(app)
        .post('/api/v1/customer/auth/login')
        .send({ apiKey: customerRawKey });

      expect(reloginRes.status).toBe(200);
      expect(reloginRes.body.data.token).toBeDefined();
      customerToken = reloginRes.body.data.token;
    });
  });

  // 6. API CATALOG MANAGEMENT
  describe('6. Dynamic API Catalog Management', () => {
    let apiId: string;

    it('should create an API endpoint in the catalog', async () => {
      const res = await request(app)
        .post('/api/v1/admin/apis')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'User Verification Service',
          slug: 'user-verify',
          category: 'User Information',
          version: 'v1',
          gatewayPath: '/user/verify',
          upstreamBaseUrl: 'https://httpbin.org',
          upstreamPath: '/post',
          allowedMethods: ['POST'],
          timeoutMs: 10000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.gatewayPath).toBe('/user/verify');
      apiId = res.body.data._id;
    });

    it('should list API endpoints for customer', async () => {
      const res = await request(app)
        .get('/api/v1/customer/apis')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].examples.curl).toBeDefined();
    });
  });
});
