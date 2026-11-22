import jwt from 'jsonwebtoken';
import { Administrator, Customer, ApiKey } from '../database/models/index.js';
import {
  verifyPassword,
  hashPassword,
  hashApiKey,
  generateApiKey,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} from '@arjun/shared';
import { config } from '../config/index.js';
import { logAdminAction } from './audit.service.js';
import { SecurityService, normalizeIp } from './security.service.js';
import { TotpService } from './totp.service.js';
import { getRedisClient } from './redis.service.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  static async seedSuperAdmin(): Promise<void> {
    const adminCount = await Administrator.countDocuments();
    if (adminCount === 0) {
      console.log('[AuthService] No administrator found. Seeding initial Super Admin...');
      const passwordHash = await hashPassword(config.superAdminSeed.password);
      await Administrator.create({
        username: config.superAdminSeed.username.toLowerCase(),
        passwordHash,
        role: 'super_admin',
        isActive: true,
        failedLoginAttempts: 0,
      });
      console.log(`[AuthService] Super Admin '${config.superAdminSeed.username}' seeded successfully.`);
    }
  }

  static async adminLogin(
    username: string,
    password: string,
    sourceIp: string,
    userAgent?: string,
    totpCode?: string
  ) {
    const normIp = normalizeIp(sourceIp);
    const redis = getRedisClient();

    // 1. Abuse & Rate-Limiting: Check failed attempts for this source IP
    const ipFailuresKey = `login:failed:ip:${normIp}`;
    const rawIpFailures = await redis.get(ipFailuresKey);
    const ipFailures = rawIpFailures ? parseInt(rawIpFailures, 10) : 0;

    if (ipFailures >= 10) {
      throw new ForbiddenError(
        'Too many failed login attempts from this network. Temporary lockout active for 15 minutes.',
        'IP_THROTTLED'
      );
    }

    // 2. Progressive login delay on repeated failures (mitigate automated credential stuffing)
    if (ipFailures >= 2) {
      const progressiveDelayMs = Math.min(2500, (ipFailures - 1) * 400);
      await new Promise((resolve) => setTimeout(resolve, progressiveDelayMs));
    }

    const admin = await Administrator.findOne({ username: username.toLowerCase().trim() });
    if (!admin) {
      await redis.set(ipFailuresKey, (ipFailures + 1).toString(), 'EX', 900);
      throw new UnauthorizedError('Invalid administrator clearance credentials', 'INVALID_CREDENTIALS');
    }

    if (!admin.isActive) {
      throw new ForbiddenError('Administrator account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    // 3. Account lockout check
    if (admin.lockoutUntil && admin.lockoutUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((admin.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenError(
        `Account locked due to consecutive failed authentication attempts. Please try again in ${remainingMinutes} minutes.`,
        'ACCOUNT_LOCKED'
      );
    }

    // 4. Password verification (scrypt timing-safe comparison)
    const isMatch = await verifyPassword(password, admin.passwordHash);
    if (!isMatch) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        admin.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await admin.save();
      await redis.set(ipFailuresKey, (ipFailures + 1).toString(), 'EX', 900);

      await logAdminAction({
        administratorId: admin._id.toString(),
        administratorUsername: admin.username,
        action: 'ADMIN_LOGIN_FAILED',
        resourceType: 'administrator',
        resourceId: admin._id.toString(),
        sourceIp: normIp,
        userAgent,
        result: 'failure',
        errorMessage: 'Invalid passphrase',
      });

      throw new UnauthorizedError('Invalid administrator clearance credentials', 'INVALID_CREDENTIALS');
    }

    // 5. Multi-Factor Authentication (TOTP / Backup Code)
    if (admin.totpEnabled) {
      if (!totpCode || !totpCode.trim()) {
        throw new UnauthorizedError('Two-factor authentication code required', '2FA_REQUIRED');
      }

      const cleanCode = totpCode.trim();
      let isValidMfa = false;

      // Check standard 6-digit TOTP
      if (cleanCode.length === 6 && admin.totpSecretEncrypted) {
        isValidMfa = TotpService.verifyTotp(admin.totpSecretEncrypted, cleanCode);
      }

      // Check backup recovery code if not valid TOTP
      if (!isValidMfa && admin.backupCodesHashed && admin.backupCodesHashed.length > 0) {
        const backupResult = TotpService.consumeBackupCode(cleanCode, admin.backupCodesHashed);
        if (backupResult.valid) {
          isValidMfa = true;
          admin.backupCodesHashed = backupResult.remainingCodes;
          await admin.save();
        }
      }

      if (!isValidMfa) {
        admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
        await admin.save();
        await redis.set(ipFailuresKey, (ipFailures + 1).toString(), 'EX', 900);

        await logAdminAction({
          administratorId: admin._id.toString(),
          administratorUsername: admin.username,
          action: 'ADMIN_LOGIN_MFA_FAILED',
          resourceType: 'administrator',
          resourceId: admin._id.toString(),
          sourceIp: normIp,
          userAgent,
          result: 'failure',
          errorMessage: 'Invalid 2FA code',
        });

        throw new UnauthorizedError('Invalid two-factor authentication code', 'INVALID_2FA');
      }
    }

    // 6. Reset failed attempts & clear lockout upon successful credentials + MFA
    admin.failedLoginAttempts = 0;
    admin.lockoutUntil = undefined;
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = normIp;
    admin.currentLoginIp = normIp;
    admin.currentLoginUserAgent = userAgent;
    await admin.save();
    await redis.del(ipFailuresKey);

    // 7. Issue rotated session ID with device tracking & Redis/MongoDB persistence
    const sessionId = await SecurityService.issueSession(admin._id.toString(), 'admin', normIp, userAgent);

    const accessToken = jwt.sign(
      { adminId: admin._id.toString(), username: admin.username, role: admin.role, sessionId },
      config.jwt.adminSecret,
      { expiresIn: config.jwt.adminAccessExpiry as any }
    );

    const refreshToken = jwt.sign(
      { adminId: admin._id.toString(), type: 'refresh', sessionId },
      config.jwt.adminSecret,
      { expiresIn: config.jwt.adminRefreshExpiry as any }
    );

    await logAdminAction({
      administratorId: admin._id.toString(),
      administratorUsername: admin.username,
      action: 'ADMIN_LOGIN_SUCCESS',
      resourceType: 'administrator',
      resourceId: admin._id.toString(),
      sourceIp: normIp,
      userAgent,
      result: 'success',
    });

    return {
      admin: {
        id: admin._id.toString(),
        username: admin.username,
        role: admin.role,
        totpEnabled: admin.totpEnabled,
        lastLoginAt: admin.lastLoginAt,
      },
      sessionId,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Password change with current password validation, strong hashing, and session revocation
   */
  static async changeAdminPassword(
    adminId: string,
    currentPass: string,
    newPass: string,
    sourceIp: string,
    userAgent?: string
  ) {
    const admin = await Administrator.findById(adminId);
    if (!admin) {
      throw new NotFoundError('Administrator not found');
    }

    const isMatch = await verifyPassword(currentPass, admin.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }

    if (currentPass === newPass) {
      throw new ConflictError('New password cannot be identical to current password');
    }

    const passwordHash = await hashPassword(newPass);
    admin.passwordHash = passwordHash;
    admin.passwordChangedAt = new Date();
    await admin.save();

    // Revoke all existing sessions across all devices
    await SecurityService.revokeAllSessions(adminId, 'admin');

    await logAdminAction({
      administratorId: admin._id.toString(),
      administratorUsername: admin.username,
      action: 'ADMIN_PASSWORD_CHANGED',
      resourceType: 'administrator',
      resourceId: admin._id.toString(),
      sourceIp: normalizeIp(sourceIp),
      userAgent,
      result: 'success',
    });

    return { message: 'Password updated successfully. All sessions revoked.' };
  }

  static async getAdminById(adminId: string) {
    const admin = await Administrator.findById(adminId).lean();
    if (!admin) return null;
    return {
      id: admin._id.toString(),
      username: admin.username,
      role: admin.role,
      totpEnabled: admin.totpEnabled,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
    };
  }

  /**
   * Generates new TOTP setup configuration
   */
  static async setupAdminMfa(adminId: string) {
    const admin = await Administrator.findById(adminId);
    if (!admin) throw new NotFoundError('Administrator not found');

    const secret = TotpService.generateSecret();
    const otpauthUri = TotpService.generateOtpauthUri(admin.username, secret, 'Karvion API Manager');

    return { secret, otpauthUri };
  }

  /**
   * Verifies initial TOTP code, enables MFA, and returns 8 single-use recovery backup codes
   */
  static async enableAdminMfa(adminId: string, secret: string, code: string, sourceIp: string, userAgent?: string) {
    const admin = await Administrator.findById(adminId);
    if (!admin) throw new NotFoundError('Administrator not found');

    const isValid = TotpService.verifyTotp(secret, code.trim());
    if (!isValid) {
      throw new UnauthorizedError('Invalid TOTP verification code. Verification failed.', 'INVALID_2FA');
    }

    const { plainCodes, hashedCodes } = TotpService.generateBackupCodes();

    admin.totpEnabled = true;
    admin.totpSecretEncrypted = secret;
    admin.backupCodesHashed = hashedCodes;
    await admin.save();

    await logAdminAction({
      administratorId: admin._id.toString(),
      administratorUsername: admin.username,
      action: 'ADMIN_MFA_ENABLED',
      resourceType: 'administrator',
      resourceId: admin._id.toString(),
      sourceIp: normalizeIp(sourceIp),
      userAgent,
      result: 'success',
    });

    return {
      message: 'Multi-Factor Authentication enabled successfully',
      backupCodes: plainCodes,
    };
  }

  /**
   * Disables MFA after current password and code verification
   */
  static async disableAdminMfa(
    adminId: string,
    password: string,
    code: string,
    sourceIp: string,
    userAgent?: string
  ) {
    const admin = await Administrator.findById(adminId);
    if (!admin) throw new NotFoundError('Administrator not found');

    const isMatch = await verifyPassword(password, admin.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Current passphrase is required to disable MFA', 'INVALID_CREDENTIALS');
    }

    let isValid = false;
    if (admin.totpSecretEncrypted) {
      isValid = TotpService.verifyTotp(admin.totpSecretEncrypted, code.trim());
    }

    if (!isValid && admin.backupCodesHashed) {
      const backupResult = TotpService.consumeBackupCode(code.trim(), admin.backupCodesHashed);
      if (backupResult.valid) {
        isValid = true;
      }
    }

    if (!isValid) {
      throw new UnauthorizedError('Invalid verification code', 'INVALID_2FA');
    }

    admin.totpEnabled = false;
    admin.totpSecretEncrypted = undefined;
    admin.backupCodesHashed = [];
    await admin.save();

    await logAdminAction({
      administratorId: admin._id.toString(),
      administratorUsername: admin.username,
      action: 'ADMIN_MFA_DISABLED',
      resourceType: 'administrator',
      resourceId: admin._id.toString(),
      sourceIp: normalizeIp(sourceIp),
      userAgent,
      result: 'success',
    });

    return { message: 'Multi-Factor Authentication disabled successfully' };
  }

  static async customerKeyLogin(rawApiKey: string) {
    const keyHash = hashApiKey(rawApiKey);
    const keyRecord = await ApiKey.findOne({ keyHash });

    if (!keyRecord) {
      throw new UnauthorizedError('Invalid API key provided', 'INVALID_API_KEY');
    }

    const customer = await Customer.findById(keyRecord.customerId);
    if (!customer) {
      throw new UnauthorizedError('Customer record not found for this API key', 'CUSTOMER_NOT_FOUND');
    }

    if (customer.status === 'suspended') {
      throw new ForbiddenError('Your account has been suspended by the administrator.', 'ACCOUNT_SUSPENDED');
    }

    if (keyRecord.status !== 'active') {
      throw new ForbiddenError(`API key is ${keyRecord.status}`, 'KEY_INACTIVE');
    }

    if (customer.status === 'expired' || customer.expiresAt.getTime() < Date.now()) {
      if (customer.status !== 'expired') {
        customer.status = 'expired';
        await customer.save();
      }
      throw new ForbiddenError('Your account has expired. Please contact administrator for renewal.', 'ACCOUNT_EXPIRED');
    }

    // Issue single-user active session ID
    const sessionId = await SecurityService.issueSession(customer._id.toString(), 'customer');
    customer.activeSessionId = sessionId;
    await customer.save();

    const token = jwt.sign(
      {
        customerId: customer._id.toString(),
        username: customer.username,
        email: customer.email,
        keyPrefix: keyRecord.keyPrefix,
        sessionId,
      },
      config.jwt.customerSecret,
      { expiresIn: config.jwt.customerAccessExpiry as any }
    );

    return {
      customer: {
        id: customer._id.toString(),
        username: customer.username,
        fullName: customer.fullName,
        email: customer.email,
        status: customer.status,
        expiresAt: customer.expiresAt.toISOString(),
        keyPrefix: keyRecord.keyPrefix,
      },
      token,
    };
  }

  static async customerRegister(params: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) {
    const existing = await Customer.findOne({
      $or: [{ username: params.username.toLowerCase() }, { email: params.email.toLowerCase() }],
    });
    if (existing) {
      throw new ConflictError('Username or email already in use');
    }

    const passwordHash = await hashPassword(params.password);
    const expiresAt = new Date(Date.now() + 365 * 86400 * 1000); // 1 year default

    const customer = await Customer.create({
      username: params.username.toLowerCase(),
      fullName: params.fullName,
      email: params.email.toLowerCase(),
      phone: params.phone,
      passwordHash,
      emailVerified: true,
      status: 'active',
      dailyRequestLimit: 5000,
      monthlyRequestLimit: 100000,
      lifetimeRequestLimit: 500000,
      maxConcurrentRequests: 10,
      maxBandwidthBytes: 10737418240,
      allowedApis: ['*'],
      allowedIps: [],
      developerTag: 'arjunkahar',
      expiresAt,
      createdBy: 'self-register',
    });

    const { rawKey, keyPrefix, keyHash } = generateApiKey();

    await ApiKey.create({
      customerId: customer._id,
      keyHash,
      keyPrefix,
      name: 'Default Production Key',
      status: 'active',
    });

    const sessionId = await SecurityService.issueSession(customer._id.toString(), 'customer');
    customer.activeSessionId = sessionId;
    await customer.save();

    const token = jwt.sign(
      {
        customerId: customer._id.toString(),
        username: customer.username,
        email: customer.email,
        keyPrefix,
        sessionId,
      },
      config.jwt.customerSecret,
      { expiresIn: config.jwt.customerAccessExpiry as any }
    );

    return {
      customer: {
        id: customer._id.toString(),
        username: customer.username,
        fullName: customer.fullName,
        email: customer.email,
        keyPrefix,
      },
      apiKey: rawKey,
      token,
    };
  }

  static async customerPasswordLogin(
    identifier: string,
    password: string,
    sourceIp: string,
    userAgent?: string,
    totpCode?: string
  ) {
    const customer = await Customer.findOne({
      $or: [{ username: identifier.toLowerCase() }, { email: identifier.toLowerCase() }],
    });

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (customer.status === 'suspended') {
      throw new ForbiddenError('Account is suspended. Please contact administrator.', 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await verifyPassword(password, customer.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (customer.totpEnabled) {
      if (!totpCode) {
        return { requires2FA: true, message: 'Two-factor authentication code required' };
      }
      const validTotp = TotpService.verifyTotp(customer.totpSecretEncrypted || '', totpCode);
      if (!validTotp) {
        throw new UnauthorizedError('Invalid two-factor authentication code', 'INVALID_TOTP');
      }
    }

    const keyRecord = await ApiKey.findOne({ customerId: customer._id, status: 'active' });
    const sessionId = await SecurityService.issueSession(customer._id.toString(), 'customer');
    customer.activeSessionId = sessionId;
    customer.lastSeenIp = sourceIp;
    customer.lastSeenAt = new Date();
    await customer.save();

    const token = jwt.sign(
      {
        customerId: customer._id.toString(),
        username: customer.username,
        email: customer.email,
        keyPrefix: keyRecord?.keyPrefix || 'arjun_live_',
        sessionId,
      },
      config.jwt.customerSecret,
      { expiresIn: config.jwt.customerAccessExpiry as any }
    );

    return {
      customer: {
        id: customer._id.toString(),
        username: customer.username,
        fullName: customer.fullName,
        email: customer.email,
        keyPrefix: keyRecord?.keyPrefix || 'arjun_live_',
      },
      token,
    };
  }
}
