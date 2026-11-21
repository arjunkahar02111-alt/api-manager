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
} from '@arjun/shared';
import { config } from '../config/index.js';
import { logAdminAction } from './audit.service.js';
import { SecurityService } from './security.service.js';
import { TotpService } from './totp.service.js';

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

  static async adminLogin(username: string, password: string, sourceIp: string, userAgent?: string) {
    const admin = await Administrator.findOne({ username: username.toLowerCase() });
    if (!admin) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (!admin.isActive) {
      throw new ForbiddenError('Administrator account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    if (admin.lockoutUntil && admin.lockoutUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((admin.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenError(
        `Account locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minutes.`,
        'ACCOUNT_LOCKED'
      );
    }

    const isMatch = await verifyPassword(password, admin.passwordHash);
    if (!isMatch) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        admin.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await admin.save();

      await logAdminAction({
        administratorId: admin._id.toString(),
        administratorUsername: admin.username,
        action: 'ADMIN_LOGIN_FAILED',
        resourceType: 'administrator',
        resourceId: admin._id.toString(),
        sourceIp,
        userAgent,
        result: 'failure',
        errorMessage: 'Invalid password',
      });

      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    admin.failedLoginAttempts = 0;
    admin.lockoutUntil = undefined;
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = sourceIp;
    admin.currentLoginIp = sourceIp;
    admin.currentLoginUserAgent = userAgent;

    // Issue unique single-user session ID (terminates any previous active session)
    const sessionId = await SecurityService.issueSession(admin._id.toString(), 'admin');
    admin.activeSessionId = sessionId;
    await admin.save();

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
      sourceIp,
      userAgent,
      result: 'success',
    });

    return {
      admin: {
        id: admin._id.toString(),
        username: admin.username,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
      accessToken,
      refreshToken,
    };
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
