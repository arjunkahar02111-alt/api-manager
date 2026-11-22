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
import { TotpService } from '../../apps/backend/src/services/totp.service.js';
import { hashApiKey } from '@arjun/shared';

describe('Admin Security, Session Protection & WAF Engine Suite', () => {
  let mongoServer: MongoMemoryServer;
  let adminToken: string;
  let adminSessionId: string;
  let adminCookie: string;
  let clientApiKey: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await AuthService.seedSuperAdmin();

    // Authenticate Admin
    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    adminToken = loginRes.body.data.accessToken;
    adminSessionId = loginRes.body.data.sessionId;

    // Extract cookie from Set-Cookie header
    const setCookie = loginRes.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      adminCookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(';')[0];
    }

    // Create a regular Client with API key to test route isolation
    clientApiKey = 'arjun_live_testclientwaf1234567890123456';
    const keyHash = hashApiKey(clientApiKey);

    const client = await Customer.create({
      username: 'client_waf_test',
      email: 'client_waf@example.com',
      fullName: 'Client WAF Isolation Test',
      createdBy: 'admin',
      passwordHash: 'hashedpassword',
      apiKey: clientApiKey,
      apiKeyHash: keyHash,
      keyPrefix: 'arjun_live_testcli',
      developerTag: 'testclient',
      allowedApis: ['*'],
      allowedIps: ['*'],
      status: 'active',
      dailyRequestLimit: 5000,
      monthlyRequestLimit: 150000,
      lifetimeRequestLimit: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await ApiKey.create({
      keyId: 'key_waf_01',
      customerId: client._id.toString(),
      keyHash,
      keyPrefix: 'arjun_live_testcli',
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

  // 1. Mandatory Admin Login & Generic Errors
  it('1. should reject invalid credentials with generic error without leaking account state', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'nonexistent_admin', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid administrator clearance credentials');
  });

  it('2. should reject wrong password for existing administrator with identical generic error', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'IncorrectPassword999!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid administrator clearance credentials');
  });

  // 2. Cookie-based Session Authentication & Rotation
  it('3. should authenticate valid administrator, rotate session ID, and set HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.sessionId).toBeDefined();

    adminToken = res.body.data.accessToken;
    adminSessionId = res.body.data.sessionId;

    // Check Set-Cookie contains arjun_admin_token with HttpOnly
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieHeader).toContain('arjun_admin_token');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
    expect(cookieHeader.toLowerCase()).toContain('samesite=lax');

    if (cookies && cookies.length > 0) {
      adminCookie = (Array.isArray(cookies) ? cookies[0] : cookies).split(';')[0];
    }
  });

  // 3. Protected Route Access Control
  it('4. should reject unauthenticated requests to protected admin routes with 401', async () => {
    const res = await request(app).get('/api/v1/admin/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('5. should reject client API keys attempting to access administrator routes', async () => {
    const res = await request(app)
      .get('/api/v1/admin/customers')
      .set('x-api-key', clientApiKey)
      .set('Authorization', `Bearer ${clientApiKey}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('6. should permit access to admin routes when authenticated via HttpOnly cookie', async () => {
    const res = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.admin.username).toBe('admin');
  });

  // 4. Active Sessions Listing & Individual Revocation
  it('7. should list all active administrator sessions across devices', async () => {
    const res = await request(app)
      .get('/api/v1/admin/auth/sessions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const firstSession = res.body.data[0];
    expect(firstSession.sessionId).toBeDefined();
    expect(firstSession.ipAddress).toBeDefined();
    expect(firstSession.device).toBeDefined();
  });

  it('8. should allow revoking an individual session and immediately block that session', async () => {
    // 1. Log in from a second virtual device (superseding session 1)
    const device2Login = await request(app)
      .post('/api/v1/admin/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    const device2Token = device2Login.body.data.accessToken;
    const device2SessionId = device2Login.body.data.sessionId;

    // 2. Verify device 2 can access /me
    const meRes = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${device2Token}`);
    expect(meRes.status).toBe(200);

    // 3. Revoke device 2's session
    const revokeRes = await request(app)
      .delete(`/api/v1/admin/auth/sessions/${device2SessionId}`)
      .set('Authorization', `Bearer ${device2Token}`);
    expect(revokeRes.status).toBe(200);

    // 4. Verify device 2 is immediately rejected on subsequent requests
    const blockedRes = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${device2Token}`);
    expect(blockedRes.status).toBe(401);
    expect(blockedRes.body.error.code).toBe('SESSION_TERMINATED');

    // 5. Restore primary admin session for subsequent tests
    const restoreLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });
    adminToken = restoreLogin.body.data.accessToken;
    adminSessionId = restoreLogin.body.data.sessionId;
  });

  // 5. Server-Side Logout & Session Termination
  it('9. POST /api/v1/admin/auth/logout should destroy session in Redis/MongoDB and clear cookie', async () => {
    const tempLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    const tempToken = tempLogin.body.data.accessToken;

    const logoutRes = await request(app)
      .post('/api/v1/admin/auth/logout')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(logoutRes.status).toBe(200);

    // Verify subsequent request with that token is rejected
    const afterLogout = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${tempToken}`);

    expect(afterLogout.status).toBe(401);
  });

  // 6. Password Change & Invalidation of All Prior Sessions
  it('10. changing password should invalidate all existing active sessions immediately', async () => {
    // 1. Login to get an active session
    const preChangeLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    const preChangeToken = preChangeLogin.body.data.accessToken;

    // 2. Change password
    const newPass = 'UpdatedAdminSecret2026!Strong';
    const changeRes = await request(app)
      .post('/api/v1/admin/auth/change-password')
      .set('Authorization', `Bearer ${preChangeToken}`)
      .send({
        currentPassword: 'AdminStrongSecurePassword2026!',
        newPassword: newPass,
      });

    expect(changeRes.status).toBe(200);

    // 3. Verify prior session token is now rejected
    const checkOldToken = await request(app)
      .get('/api/v1/admin/auth/me')
      .set('Authorization', `Bearer ${preChangeToken}`);
    expect(checkOldToken.status).toBe(401);

    // 4. Verify login with old password fails
    const failLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });
    expect(failLogin.status).toBe(401);

    // 5. Verify login with new password succeeds
    const successLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: newPass });
    expect(successLogin.status).toBe(200);
    adminToken = successLogin.body.data.accessToken;

    // Restore password to default for remainder of tests
    await request(app)
      .post('/api/v1/admin/auth/change-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: newPass,
        newPassword: 'AdminStrongSecurePassword2026!',
      });

    const restoreLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });
    adminToken = restoreLogin.body.data.accessToken;
  });

  // 7. Multi-Factor Authentication (MFA / TOTP)
  it('11. should generate MFA setup secret and enable TOTP with backup recovery codes', async () => {
    // 1. Get MFA Setup
    const setupRes = await request(app)
      .get('/api/v1/admin/auth/mfa/setup')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.secret).toBeDefined();
    expect(setupRes.body.data.otpauthUri).toContain('otpauth://totp/');

    const secret = setupRes.body.data.secret;
    const currentCode = TotpService.generateCurrentToken(secret);

    // 2. Enable MFA with valid code
    const enableRes = await request(app)
      .post('/api/v1/admin/auth/mfa/enable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ secret, code: currentCode });

    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.backupCodes).toBeDefined();
    expect(enableRes.body.data.backupCodes.length).toBe(8);

    const backupCode = enableRes.body.data.backupCodes[0];

    // 3. Attempt login without MFA code -> must return 401 with 2FA_REQUIRED
    const mfaRequiredRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    expect(mfaRequiredRes.status).toBe(401);
    expect(mfaRequiredRes.body.error.code).toBe('2FA_REQUIRED');

    // 4. Attempt login with invalid MFA code -> must return 401 with INVALID_2FA
    const invalidMfaRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!', totpCode: '000000' });

    expect(invalidMfaRes.status).toBe(401);
    expect(invalidMfaRes.body.error.code).toBe('INVALID_2FA');

    // 5. Attempt login with valid emergency backup recovery code -> must succeed!
    const backupLoginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!', totpCode: backupCode });

    expect(backupLoginRes.status).toBe(200);
    expect(backupLoginRes.body.data.accessToken).toBeDefined();

    // 6. Disable MFA for cleanup
    const disableCode = TotpService.generateCurrentToken(secret);
    const disableRes = await request(app)
      .post('/api/v1/admin/auth/mfa/disable')
      .set('Authorization', `Bearer ${backupLoginRes.body.data.accessToken}`)
      .send({ password: 'AdminStrongSecurePassword2026!', code: disableCode });

    expect(disableRes.status).toBe(200);
  });

  // 8. Web Application Firewall (WAF) Attacks Interception
  it('12. WAF should intercept and block SQL Injection attack in URL query parameter', async () => {
    const res = await request(app).get('/api/v1/developer-profile?search=1%27%20UNION%20SELECT%20null,null,password%20FROM%20users--');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WAF_BLOCKED');
    expect(res.body.error.ruleId).toBe('WAF_SQLI_UNION');
  });

  it('13. WAF should intercept and block Cross-Site Scripting (XSS) payload in request body', async () => {
    const res = await request(app)
      .put('/api/v1/admin/developer-profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '<script>alert(document.cookie)</script>',
        role: 'Developer & Founder',
        product: 'KARVION API MANAGER',
        description: 'Test XSS injection',
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
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WAF_BLOCKED');
    expect(res.body.error.threatType).toBe('XSS');
  });

  it('14. WAF should intercept and block Directory Traversal sequence in request URL', async () => {
    const res = await request(app).get('/api/v1/developer-profile/../../etc/passwd');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WAF_BLOCKED');
    expect(res.body.error.threatType).toBe('PATH_TRAVERSAL');
  });

  it('15. WAF should intercept and block Command Injection (RCE) payload', async () => {
    const res = await request(app).get('/api/v1/developer-profile?command=test;%20whoami');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WAF_BLOCKED');
    expect(res.body.error.threatType).toBe('RCE');
  });

  it('16. WAF should intercept and block automated scanner user-agents (e.g. sqlmap, nikto)', async () => {
    const res = await request(app)
      .get('/api/v1/developer-profile')
      .set('User-Agent', 'sqlmap/1.6.12#stable (https://sqlmap.org)');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WAF_BLOCKED');
    expect(res.body.error.threatType).toBe('PROTOCOL_ABUSE');
  });

  it('17. WAF should allow legitimate API requests and administrative operations without false positives', async () => {
    const res = await request(app).get('/api/v1/developer-profile');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('DEV ARJUN');
  });
});
