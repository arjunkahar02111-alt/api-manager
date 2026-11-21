import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { Customer, SecurityNotification, ApiKey } from '../../database/models/index.js';
import { DeviceService } from '../../services/device.service.js';
import { TotpService } from '../../services/totp.service.js';
import { SecurityService } from '../../services/security.service.js';
import { getRedisClient } from '../../services/redis.service.js';
import { TotpVerifySchema } from '@arjun/schemas';
import { sendSuccess, UnauthorizedError, NotFoundError, ValidationError, generateApiKey } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

/**
 * List registered devices for customer
 */
router.get('/devices', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const devices = await DeviceService.listUserDevices(req.customer!.customerId);
    return sendSuccess(res, devices);
  } catch (err) {
    next(err);
  }
});

/**
 * Revoke a registered device
 */
router.delete('/devices/:deviceId', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    await DeviceService.revokeDevice(req.customer!.customerId, req.params.deviceId as string);
    return sendSuccess(res, null, 'Device access revoked successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * Toggle trusted device status
 */
router.post('/devices/:deviceId/trust', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const isTrusted = Boolean(req.body.isTrusted);
    await DeviceService.setDeviceTrust(req.customer!.customerId, req.params.deviceId as string, isTrusted);
    return sendSuccess(res, null, `Device trust status updated to ${isTrusted}`);
  } catch (err) {
    next(err);
  }
});

/**
 * Terminate all active sessions across all devices
 */
router.post('/logout-all', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    await SecurityService.terminateSession(req.customer!.customerId, 'customer');
    return sendSuccess(res, null, 'All sessions terminated across all devices');
  } catch (err) {
    next(err);
  }
});

/**
 * List security notifications for this customer
 */
router.get('/notifications', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const notifs = await SecurityNotification.find({
      $or: [{ userId: req.customer!.customerId }, { userId: null }],
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return sendSuccess(res, notifs);
  } catch (err) {
    next(err);
  }
});

/**
 * Mark notification as read
 */
router.post('/notifications/:id/read', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    await SecurityNotification.updateOne(
      { _id: req.params.id, userId: req.customer!.customerId },
      { $set: { read: true } }
    );
    return sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
});

/**
 * Setup 2FA TOTP (returns secret & otpauth URL)
 */
router.post('/2fa/setup', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const secret = TotpService.generateSecret();
    const otpauthUri = TotpService.generateOtpauthUri(customer.username, secret);

    customer.totpSecretEncrypted = secret;
    await customer.save();

    return sendSuccess(res, {
      secret,
      otpauthUri,
      message: 'Scan the QR code or enter secret into Google Authenticator or Authy',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Enable 2FA by verifying 6-digit code
 */
router.post('/2fa/enable', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const { token } = TotpVerifySchema.parse(req.body);
    const customer = await Customer.findById(req.customer!.customerId);
    if (!customer || !customer.totpSecretEncrypted) {
      throw new UnauthorizedError('2FA setup not initiated', 'NO_2FA_SETUP');
    }

    const isValid = TotpService.verifyTotp(customer.totpSecretEncrypted, token);
    if (!isValid) {
      throw new UnauthorizedError('Invalid 6-digit 2FA verification code', 'INVALID_TOTP');
    }

    // Generate 8 single-use backup recovery codes
    const { plainCodes, hashedCodes } = TotpService.generateBackupCodes();

    customer.totpEnabled = true;
    customer.backupCodes = hashedCodes;
    customer.accountSecurityScore = Math.min(100, (customer.accountSecurityScore || 70) + 20);
    await customer.save();

    return sendSuccess(res, {
      enabled: true,
      backupCodes: plainCodes,
      message: 'Two-factor authentication enabled successfully. Store your backup recovery codes securely.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Disable 2FA
 */
router.post('/2fa/disable', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    customer.totpEnabled = false;
    customer.totpSecretEncrypted = undefined;
    customer.backupCodes = [];
    customer.accountSecurityScore = Math.max(50, (customer.accountSecurityScore || 85) - 20);
    await customer.save();

    return sendSuccess(res, { enabled: false }, 'Two-factor authentication disabled');
  } catch (err) {
    next(err);
  }
});

/**
 * Account Security Score & Health Summary
 */
router.get('/security-score', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId).lean();
    if (!customer) throw new NotFoundError('Customer not found');

    let score = 50;
    const recommendations: string[] = [];

    if (customer.totpEnabled) {
      score += 25;
    } else {
      recommendations.push('Enable Two-Factor Authentication (2FA) for +25 points');
    }

    if (customer.boundIp) {
      score += 15;
    } else {
      recommendations.push('Lock your API key to your specific IP address for +15 points');
    }

    if ((customer.keySharingViolations || 0) === 0) {
      score += 10;
    } else {
      recommendations.push('Warning: Account has key sharing violation history (-10 points)');
      score -= 10;
    }

    return sendSuccess(res, {
      score: Math.min(100, Math.max(0, score)),
      is2FaEnabled: customer.totpEnabled,
      boundIp: customer.boundIp || null,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Self-service API Key Rotation:
 * Invalidates current key immediately and produces a fresh cryptographic API key.
 * Resets bound IP lock for seamless developer workstation transition.
 */
router.post('/rotate-key', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const oldKey = await ApiKey.findOne({ customerId: customer._id, status: 'active' });
    if (oldKey) {
      oldKey.status = 'revoked';
      oldKey.revokedAt = new Date();
      await oldKey.save();

      const redis = getRedisClient();
      await redis.del(`key:${oldKey.keyHash}`);
      await redis.del(`customer:${customer._id}`);
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    const newKey = await ApiKey.create({
      customerId: customer._id,
      keyHash,
      keyPrefix,
      status: 'active',
    });

    if (oldKey) {
      oldKey.replacedBy = newKey._id as any;
      await oldKey.save();
    }

    customer.boundIp = undefined;
    await customer.save();

    return sendSuccess(
      res,
      {
        rawKey,
        keyPrefix,
        createdAt: newKey.createdAt,
        message: 'New API key generated successfully. Store it safely; it will never be displayed again.',
      },
      'API key rotated successfully'
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Configure personal API daily request limit within admin threshold
 */
router.post('/limits', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const { dailyRequestLimit } = req.body;
    if (dailyRequestLimit !== undefined) {
      const num = Number(dailyRequestLimit);
      if (isNaN(num) || num < 10) {
        throw new ValidationError('Daily limit must be at least 10 requests');
      }
      customer.dailyRequestLimit = num;
      await customer.save();

      const redis = getRedisClient();
      await redis.del(`customer:${customer._id}`);
    }

    return sendSuccess(res, { dailyRequestLimit: customer.dailyRequestLimit }, 'Personal daily limit updated');
  } catch (err) {
    next(err);
  }
});

export default router;
