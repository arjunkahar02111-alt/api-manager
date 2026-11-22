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
import { Announcement, Customer, ApiKey } from '../../apps/backend/src/database/models/index.js';
import { AnnouncementManager } from '../../apps/gateway/src/announcements/announcementManager.js';
import { hashApiKey } from '@arjun/shared';

describe('Admin Dynamic Announcement & Maintenance Engine Suite', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let testApiKey: string;
  let customerId: string;
  let createdAnnouncementId: string;
  let redisMockClient: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    redisMockClient = new (RedisMock as any)();

    await AuthService.seedSuperAdmin();

    // Authenticate Admin
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });
    adminToken = loginRes.body.data.accessToken;

    // Create a Client for acknowledgment tests
    testApiKey = 'arjun_live_testclientannouncement123456789';
    const keyHash = hashApiKey(testApiKey);

    const client = await Customer.create({
      username: 'client_ann_test',
      email: 'client_ann@example.com',
      fullName: 'Test Client Announcement',
      createdBy: 'admin',
      passwordHash: 'hashedpwd',
      apiKey: testApiKey,
      apiKeyHash: keyHash,
      keyPrefix: 'arjun_live_testclient',
      developerTag: 'testclient',
      allowedApis: ['*'],
      allowedIps: ['*'],
      status: 'active',
      dailyRequestLimit: 5000,
      monthlyRequestLimit: 150000,
      lifetimeRequestLimit: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    customerId = client._id.toString();

    await ApiKey.create({
      keyId: 'key_ann_01',
      customerId,
      keyHash,
      keyPrefix: 'arjun_live_testclient',
      label: 'Production Key',
      status: 'active',
      allowedIps: ['*'],
      allowedApis: ['*'],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('1. should allow administrator to create a draft announcement', async () => {
    const res = await request(app)
      .post('/api/v1/admin/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Scheduled Maintenance Notice',
        message: 'This API will undergo scheduled upgrades at midnight.',
        type: 'maintenance',
        severity: 'warning',
        priority: 10,
        targetScope: 'global',
        acknowledgmentRequired: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.announcementId).toMatch(/^ANN-/);
    expect(res.body.data.status).toBe('draft');
    createdAnnouncementId = res.body.data.announcementId;
  });

  it('2. should publish announcement and make it active in AnnouncementManager', async () => {
    const pubRes = await request(app)
      .post(`/api/v1/admin/announcements/${createdAnnouncementId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe('published');

    // Retrieve active announcements
    const activeList = await AnnouncementManager.getActiveAnnouncements(redisMockClient);
    expect(activeList.length).toBeGreaterThanOrEqual(1);

    const matched = AnnouncementManager.matchAnnouncement(activeList, {
      apiId: 'api_vehicle',
      gatewayPath: '/v1/vehicle2-n',
      customerId,
      customerUsername: 'client_ann_test',
    });

    expect(matched).not.toBeNull();
    expect(matched?.id).toBe(createdAnnouncementId);
    expect(matched?.type).toBe('maintenance');
    expect(matched?.acknowledgment_required).toBe(true);
  });

  it('3. should record client acknowledgment with API key header', async () => {
    const ackRes = await request(app)
      .post(`/api/v1/announcements/${createdAnnouncementId}/acknowledge`)
      .set('X-API-Key', testApiKey);

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.success).toBe(true);
    expect(ackRes.body.data.acknowledged).toBe(true);
    expect(ackRes.body.data.client_id).toBe(customerId);

    // Verify record in database
    const dbAnnouncement = await Announcement.findOne({ announcementId: createdAnnouncementId });
    expect(dbAnnouncement?.acknowledgments.length).toBe(1);
    expect(dbAnnouncement?.acknowledgments[0].clientId).toBe(customerId);
  });

  it('4. should pause announcement and immediately remove it from active matching', async () => {
    const pauseRes = await request(app)
      .post(`/api/v1/admin/announcements/${createdAnnouncementId}/pause`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe('paused');

    await redisMockClient.del('gateway:announcements:active');

    const activeList = await AnnouncementManager.getActiveAnnouncements(redisMockClient);
    const matched = AnnouncementManager.matchAnnouncement(activeList, {
      apiId: 'api_vehicle',
      gatewayPath: '/v1/vehicle2-n',
      customerId,
    });

    expect(matched).toBeNull();
  });

  it('5. should reject unauthorized acknowledgment requests without API key', async () => {
    const res = await request(app)
      .post(`/api/v1/announcements/${createdAnnouncementId}/acknowledge`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('6. should broadcast an emergency announcement immediately via /emergency endpoint without error', async () => {
    const res = await request(app)
      .post('/api/v1/admin/announcements/emergency')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Platform Critical Incident',
        message: 'All endpoints temporarily operating in fallback mode.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('emergency');
    expect(res.body.data.severity).toBe('critical');
    expect(res.body.data.priority).toBe(100);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.acknowledgmentRequired).toBe(true);
    expect(res.body.data.title).toContain('🚨 EMERGENCY: Platform Critical Incident');
  });
});
