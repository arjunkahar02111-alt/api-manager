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
import { DeveloperProfile } from '../../apps/backend/src/database/models/DeveloperProfile.js';

describe('Developer Profile & Contact Credits System Suite', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await AuthService.seedSuperAdmin();

    // Authenticate Admin
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });
    adminToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('1. GET /api/v1/developer-profile should return official DEV ARJUN default profile publicly', async () => {
    const res = await request(app).get('/api/v1/developer-profile');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.name).toBe('DEV ARJUN');
    expect(data.role).toBe('Developer & Founder');
    expect(data.product).toBe('KARVION API MANAGER');
    expect(data.email).toBe('kahararjun537@gmail.com');
    expect(data.telegram).toBe('@ArjunXploit');
    expect(data.telegramUrl).toBe('https://t.me/ArjunXploit');
    expect(data.instagram).toBe('@arjunnn021');
    expect(data.instagramUrl).toBe('https://www.instagram.com/arjunnn021/');
    expect(data.twitter).toBe('@ArjunKahar021');
    expect(data.twitterUrl).toBe('https://x.com/ArjunKahar021');
    expect(data.portfolioUrl).toBe('https://www.arjunkaharofficial.in/');
    expect(data.youtubeName).toBe('Gaming Arjun');
    expect(data.youtubeUrl).toBe('https://www.youtube.com/@GamingArjun');
    expect(data.footerCreditText).toBe('Developed & Maintained by DEV ARJUN');
    expect(data.enabled).toBe(true);
    expect(data.socialLinks.email).toBe(true);
    expect(data.socialLinks.telegram).toBe(true);
    expect(data.socialLinks.instagram).toBe(true);
    expect(data.socialLinks.twitter).toBe(true);
    expect(data.socialLinks.portfolio).toBe(true);
    expect(data.socialLinks.youtube).toBe(true);
  });

  it('2. PUT /api/v1/admin/developer-profile should reject unauthenticated requests with 401', async () => {
    const res = await request(app)
      .put('/api/v1/admin/developer-profile')
      .send({
        name: 'DEV ARJUN',
        role: 'Developer & Founder',
        product: 'KARVION API MANAGER',
        description: 'Updated test description',
        email: 'kahararjun537@gmail.com',
        telegram: '@ArjunXploit',
        telegramUrl: 'https://t.me/ArjunXploit',
        instagram: '@arjunnn021',
        instagramUrl: 'https://www.instagram.com/arjunnn021/',
        twitter: '@ArjunKahar021',
        twitterUrl: 'https://x.com/ArjunKahar021',
        portfolioUrl: 'https://www.arjunkaharofficial.in/',
        youtubeName: 'Gaming Arjun',
        youtubeUrl: 'https://www.youtube.com/@GamingArjun',
        avatarUrl: '',
        footerCreditText: 'Developed & Maintained by DEV ARJUN',
        enabled: true,
        socialLinks: {
          email: true,
          telegram: true,
          instagram: true,
          twitter: true,
          portfolio: true,
          youtube: true,
        },
      });

    expect(res.status).toBe(401);
  });

  it('3. PUT /api/v1/admin/developer-profile should reject invalid email format with 400', async () => {
    const res = await request(app)
      .put('/api/v1/admin/developer-profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'DEV ARJUN',
        role: 'Developer & Founder',
        product: 'KARVION API MANAGER',
        description: 'Test description',
        email: 'not-a-valid-email',
        telegram: '@ArjunXploit',
        telegramUrl: 'https://t.me/ArjunXploit',
        instagram: '@arjunnn021',
        instagramUrl: 'https://www.instagram.com/arjunnn021/',
        twitter: '@ArjunKahar021',
        twitterUrl: 'https://x.com/ArjunKahar021',
        portfolioUrl: 'https://www.arjunkaharofficial.in/',
        youtubeName: 'Gaming Arjun',
        youtubeUrl: 'https://www.youtube.com/@GamingArjun',
        avatarUrl: '',
        footerCreditText: 'Developed & Maintained by DEV ARJUN',
        enabled: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4. PUT /api/v1/admin/developer-profile should reject invalid URLs with 400', async () => {
    const res = await request(app)
      .put('/api/v1/admin/developer-profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'DEV ARJUN',
        role: 'Developer & Founder',
        product: 'KARVION API MANAGER',
        description: 'Test description',
        email: 'kahararjun537@gmail.com',
        telegram: '@ArjunXploit',
        telegramUrl: 'not_a_valid_url',
        instagram: '@arjunnn021',
        instagramUrl: 'https://www.instagram.com/arjunnn021/',
        twitter: '@ArjunKahar021',
        twitterUrl: 'https://x.com/ArjunKahar021',
        portfolioUrl: 'https://www.arjunkaharofficial.in/',
        youtubeName: 'Gaming Arjun',
        youtubeUrl: 'https://www.youtube.com/@GamingArjun',
        avatarUrl: '',
        footerCreditText: 'Developed & Maintained by DEV ARJUN',
        enabled: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('5. PUT /api/v1/admin/developer-profile should successfully update and persist developer profile', async () => {
    const updatedPayload = {
      name: 'DEV ARJUN',
      role: 'Chief Architect & Founder',
      product: 'KARVION API MANAGER',
      description: 'Engineering resilient reverse proxies and API management systems.',
      email: 'kahararjun537@gmail.com',
      telegram: '@ArjunXploit',
      telegramUrl: 'https://t.me/ArjunXploit',
      instagram: '@arjunnn021',
      instagramUrl: 'https://www.instagram.com/arjunnn021/',
      twitter: '@ArjunKahar021',
      twitterUrl: 'https://x.com/ArjunKahar021',
      portfolioUrl: 'https://www.arjunkaharofficial.in/',
      youtubeName: 'Gaming Arjun',
      youtubeUrl: 'https://www.youtube.com/@GamingArjun',
      avatarUrl: '',
      footerCreditText: 'Handcrafted & Engineered by DEV ARJUN',
      enabled: true,
      socialLinks: {
        email: true,
        telegram: true,
        instagram: true,
        twitter: true,
        portfolio: true,
        youtube: false,
      },
    };

    const updateRes = await request(app)
      .put('/api/v1/admin/developer-profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatedPayload);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.role).toBe('Chief Architect & Founder');
    expect(updateRes.body.data.footerCreditText).toBe('Handcrafted & Engineered by DEV ARJUN');
    expect(updateRes.body.data.socialLinks.youtube).toBe(false);

    // Verify GET /api/v1/developer-profile returns updated data
    const getRes = await request(app).get('/api/v1/developer-profile');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.role).toBe('Chief Architect & Founder');
    expect(getRes.body.data.footerCreditText).toBe('Handcrafted & Engineered by DEV ARJUN');
    expect(getRes.body.data.socialLinks.youtube).toBe(false);

    // Verify MongoDB document
    const doc = await DeveloperProfile.findOne();
    expect(doc).toBeDefined();
    expect(doc?.role).toBe('Chief Architect & Founder');
    expect(doc?.footerCreditText).toBe('Handcrafted & Engineered by DEV ARJUN');
  });
});
