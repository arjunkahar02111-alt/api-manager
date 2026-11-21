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
import { Customer, ApiKey, UserDevice, Administrator } from '../../apps/backend/src/database/models/index.js';
import { TotpService } from '../../apps/backend/src/services/totp.service.js';
import { DeviceService } from '../../apps/backend/src/services/device.service.js';
import { RiskAssessmentService } from '../../apps/backend/src/services/riskAssessment.service.js';
import { SecurityService } from '../../apps/backend/src/services/security.service.js';
import { generateApiKey } from '@arjun/shared';

describe('Enterprise Security & Acceptance Verification Suite', () => {
  let mongoServer: MongoMemoryServer;
  let redis: any;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    redis = new (RedisMock as any)();
    await ApiKey.init();
    await Customer.init();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('1. Strict API Key 1-User-1-Key Binding & Non-Transferability', () => {
    it('should associate each API key with exactly one customer and enforce unique ownership', async () => {
      const userA = await Customer.create({
        username: 'enterprise_user_a',
        fullName: 'Enterprise User A',
        email: 'user_a@enterprise.com',
        status: 'active',
        allowedApis: ['*'],
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
        createdBy: 'admin',
      });

      const userB = await Customer.create({
        username: 'enterprise_user_b',
        fullName: 'Enterprise User B',
        email: 'user_b@enterprise.com',
        status: 'active',
        allowedApis: ['*'],
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
        createdBy: 'admin',
      });

      const { rawKey: keyA, keyPrefix: prefixA, keyHash: hashA } = generateApiKey();
      const apiKeyDocA = await ApiKey.create({
        customerId: userA._id,
        keyHash: hashA,
        keyPrefix: prefixA,
        status: 'active',
      });

      // Verification: Key A is bound exclusively to User A
      expect(apiKeyDocA.customerId.toString()).toBe(userA._id.toString());
      expect(apiKeyDocA.customerId.toString()).not.toBe(userB._id.toString());

      // Attempting to duplicate keyHash for another user triggers MongoDB unique constraint
      await expect(
        ApiKey.create({
          customerId: userB._id,
          keyHash: hashA,
          keyPrefix: prefixA,
          status: 'active',
        })
      ).rejects.toThrow();
    });
  });

  describe('2. Two-Factor Authentication (RFC 6238 TOTP & Recovery Codes)', () => {
    it('should generate valid Base32 secret and verify genuine 6-digit TOTP code', () => {
      const secret = TotpService.generateSecret();
      expect(secret.length).toBeGreaterThanOrEqual(16);

      const uri = TotpService.generateOtpauthUri('arjun_dev', secret);
      expect(uri).toContain('otpauth://totp/Arjun%20Api%20Manager:arjun_dev');

      // Generate current code
      const currentToken = TotpService.generateCurrentToken(secret);
      expect(currentToken).toHaveLength(6);

      // Verify token
      const isValid = TotpService.verifyTotp(secret, currentToken);
      expect(isValid).toBe(true);

      // Invalid tokens must be rejected
      expect(TotpService.verifyTotp(secret, '000000')).toBe(false);
      expect(TotpService.verifyTotp(secret, '999999')).toBe(false);
    });

    it('should generate 8 single-use cryptographically hashed backup recovery codes', () => {
      const { plainCodes, hashedCodes } = TotpService.generateBackupCodes();

      expect(plainCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);

      plainCodes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}(-[A-F0-9]{4})?$/);
      });

      // Verify backup code consumption
      const codeToTest = plainCodes[0];
      const result = TotpService.consumeBackupCode(codeToTest, hashedCodes);
      expect(result.valid).toBe(true);
      expect(result.remainingCodes).toHaveLength(7);

      // Single-use guarantee: consuming same code again must fail
      const repeatResult = TotpService.consumeBackupCode(codeToTest, result.remainingCodes);
      expect(repeatResult.valid).toBe(false);
      expect(repeatResult.remainingCodes).toHaveLength(7);
    });
  });

  describe('3. Device Binding & Session Fingerprinting', () => {
    it('should register client devices, track OS/browser fingerprints, and support revocation', async () => {
      const customer = await Customer.create({
        username: 'device_test_user',
        fullName: 'Device Tester',
        email: 'device@test.com',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
        createdBy: 'admin',
      });

      const mockUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

      const dev = await DeviceService.recordDeviceLogin({
        userId: customer._id.toString(),
        ipAddress: '157.240.22.35',
        userAgent: mockUa,
      });

      expect(dev).toBeDefined();
      expect(dev.os).toBe('Windows');
      expect(dev.browser).toContain('Chrome');
      expect(dev.ipAddress).toBe('157.240.22.35');
      expect(dev.isTrusted).toBe(true);

      // Toggle trust to false
      await DeviceService.setDeviceTrust(customer._id.toString(), dev.deviceId, false);
      const updated = await UserDevice.findOne({ deviceId: dev.deviceId });
      expect(updated?.isTrusted).toBe(false);

      // Revoke device
      await DeviceService.revokeDevice(customer._id.toString(), dev.deviceId);
      const revoked = await UserDevice.findOne({ deviceId: dev.deviceId });
      expect(revoked?.status).toBe('revoked');
    });
  });

  describe('4. Anti-Key-Sharing Risk Assessment Engine', () => {
    it('should evaluate low risk for stable client accessing from bound IP', async () => {
      const result = await RiskAssessmentService.assessRequestRisk({
        customerId: new mongoose.Types.ObjectId().toString(),
        keyHash: 'hash_risk_test_1',
        keyPrefix: 'arj_live_1',
        clientIp: '182.70.10.5',
        boundIp: '182.70.10.5',
        userAgent: 'ArjunClient/1.0',
        endpoint: '/v1/users',
      });

      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.action).toBe('MONITOR');
    });

    it('should assign medium risk to carrier subnet shifts without banning immediately', async () => {
      // Subnet shift: 182.70.10.5 -> 182.70.10.88 (same /24 or /16 carrier pool)
      const result = await RiskAssessmentService.assessRequestRisk({
        customerId: new mongoose.Types.ObjectId().toString(),
        keyHash: 'hash_risk_test_2',
        keyPrefix: 'arj_live_2',
        clientIp: '182.70.10.88',
        boundIp: '182.70.10.5',
        userAgent: 'ArjunClient/1.0',
        endpoint: '/v1/users',
      });

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThan(75);
      expect(result.action).not.toBe('SUSPEND_KEY');
    });

    it('should assign elevated risk score (>=50) for geographically divergent IP', async () => {
      const result = await RiskAssessmentService.assessRequestRisk({
        customerId: new mongoose.Types.ObjectId().toString(),
        keyHash: 'hash_risk_test_3',
        keyPrefix: 'arj_live_3',
        clientIp: '14.139.45.10', // Completely distinct ISP/network
        boundIp: '198.51.100.22',
        userAgent: 'Python-urllib/3.10', // Changed user agent
        endpoint: '/v1/users',
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(['HIGH', 'CRITICAL', 'MEDIUM']).toContain(result.riskLevel);
    });
  });

  describe('5. Instant Session Invalidation & Concurrent Login Protocol', () => {
    it('should immediately terminate old session when logging in on a new device', async () => {
      const admin = await Administrator.create({
        username: 'admin_session_test',
        passwordHash: 'hash_secret',
        role: 'super_admin',
        totpEnabled: false,
        isActive: true,
        failedLoginAttempts: 0,
      });

      const userId = admin._id.toString();

      // Login 1 from Device A
      const session1 = await SecurityService.issueSession(userId, 'admin', '10.0.0.1', 'Device-A');
      expect(session1).toBeDefined();

      const isValid1Before = await SecurityService.validateSession(userId, 'admin', session1);
      expect(isValid1Before).toBe(true);

      // Login 2 from Device B -> supersedes Device A
      const session2 = await SecurityService.issueSession(userId, 'admin', '10.0.0.2', 'Device-B');
      expect(session2).not.toBe(session1);

      // Device A must now be rejected
      const isValid1After = await SecurityService.validateSession(userId, 'admin', session1);
      expect(isValid1After).toBe(false);

      // Device B is valid
      const isValid2 = await SecurityService.validateSession(userId, 'admin', session2);
      expect(isValid2).toBe(true);
    });
  });
});
