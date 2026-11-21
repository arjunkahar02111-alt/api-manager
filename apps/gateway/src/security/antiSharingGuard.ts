import type { Request } from 'express';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { ForbiddenError } from '@arjun/shared';
import type { AuthenticatedCustomerContext } from '../authentication/keyValidator.js';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return normalizeIp(first);
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return normalizeIp(realIp.trim());
  }

  return normalizeIp(req.ip || req.socket.remoteAddress || '127.0.0.1');
}

export function normalizeIp(ip: string): string {
  if (!ip) return '127.0.0.1';
  let clean = ip.trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.substring(7);
  }
  return clean;
}

export class AntiSharingGuard {
  /**
   * Fast-path check: Is this IP blacklisted?
   */
  static async checkIpBlacklist(clientIp: string, redis: Redis): Promise<void> {
    // 1. Redis lookup
    const cachedReason = await redis.get(`blacklist:ip:${clientIp}`);
    if (cachedReason) {
      throw new ForbiddenError(
        `Access Denied: IP address ${clientIp} is banned from this gateway. Reason: ${cachedReason}`,
        'IP_BLACKLISTED'
      );
    }

    // 2. Database lookup
    const db = mongoose.connection.db;
    if (db) {
      const record = await db.collection('ip_blacklists').findOne({ ip: clientIp, isActive: true });
      if (record) {
        if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
          await db.collection('ip_blacklists').updateOne({ _id: record._id }, { $set: { isActive: false } });
        } else {
          await redis.set(`blacklist:ip:${clientIp}`, record.reason || 'IP_BLACKLISTED', 'EX', 3600);
          throw new ForbiddenError(
            `Access Denied: IP address ${clientIp} is banned from this gateway. Reason: ${record.reason}`,
            'IP_BLACKLISTED'
          );
        }
      }
    }
  }

  /**
   * Failed API key probe tracking (Brute-force protection)
   */
  static async trackFailedKeyAttempt(clientIp: string, redis: Redis, attemptedKey?: string | null): Promise<void> {
    const key = `bruteforce:fail:${clientIp}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, 60); // 60-second window
    }

    if (attempts >= 10) {
      // Auto-ban IP for 24 hours
      const reason = `Automated Probe / Brute-force: ${attempts} failed API key attempts in 60s`;
      await redis.set(`blacklist:ip:${clientIp}`, reason, 'EX', 86400);

      const db = mongoose.connection.db;
      if (db) {
        await db.collection('ip_blacklists').updateOne(
          { ip: clientIp },
          {
            $set: {
              ip: clientIp,
              reason,
              blockedBy: 'SYSTEM_BRUTE_FORCE_AUTO_BAN',
              isActive: true,
              expiresAt: new Date(Date.now() + 86400 * 1000),
              lastTriggeredAt: new Date(),
            },
            $inc: { incidentCount: 1 },
          },
          { upsert: true }
        );

        await db.collection('security_incidents').insertOne({
          incidentType: 'BRUTE_FORCE_PROBE',
          severity: 'HIGH',
          sourceIp: clientIp,
          endpoint: 'GATEWAY_PROBE',
          details: { failedAttempts: attempts, sampleKey: attemptedKey ? `${attemptedKey.slice(0, 15)}...` : 'none' },
          actionTaken: 'AUTO_BANNED_IP_24H',
          createdAt: new Date(),
        });
      }

      redis.publish('pubsub:realtime', JSON.stringify({
        event: 'security_alert',
        payload: {
          incidentType: 'BRUTE_FORCE_PROBE',
          severity: 'HIGH',
          sourceIp: clientIp,
          actionTaken: 'AUTO_BANNED_IP_24H',
          reason,
          createdAt: new Date(),
        },
      })).catch(() => {});
    }
  }

  /**
   * Enforces Anti-Key Sharing and Strict Single-IP Locking
   */
  static async enforce(
    req: Request,
    customer: AuthenticatedCustomerContext,
    redis: Redis
  ): Promise<string> {
    const clientIp = getClientIp(req);

    // 1. If explicit allowlist is configured and matches, permit
    if (customer.allowedIps && customer.allowedIps.length > 0) {
      if (customer.allowedIps.includes('*') || customer.allowedIps.includes(clientIp)) {
        return clientIp;
      }
    }

    // 2. Strict Single-IP Enforcement
    if (customer.ipLockStrict) {
      // Check if this key already has a bound IP
      let boundIp = customer.boundIp;
      if (!boundIp) {
        // Check Redis fast cache for bound IP
        boundIp = (await redis.get(`key:bound_ip:${customer.keyHash}`)) || undefined;
      }

      // Case A: First request with this key -> Auto-bind to client's IP!
      if (!boundIp) {
        console.log(`[AntiSharingGuard] First-seen IP lock established for customer ${customer.username}: ${clientIp}`);
        customer.boundIp = clientIp;
        await redis.set(`key:bound_ip:${customer.keyHash}`, clientIp, 'EX', 86400 * 30);

        // Update database asynchronously
        const db = mongoose.connection.db;
        if (db) {
          db.collection('customers').updateOne(
            { _id: new mongoose.Types.ObjectId(customer.customerId) },
            {
              $set: { boundIp: clientIp, lastSeenIp: clientIp, lastSeenAt: new Date() },
              $addToSet: { activeIps: clientIp },
            }
          ).catch((e) => console.error('[AntiSharingGuard] Error saving bound IP:', e));
        }

        return clientIp;
      }

      // Case B: Key already bound to an IP. Check if incoming IP matches.
      if (boundIp !== clientIp) {
        // 🚨 VIOLATION: The key is being shared with another device/user!
        console.warn(`[AntiSharingGuard] 🚨 KEY SHARING VIOLATION: Customer ${customer.username} (Key: ${customer.keyPrefix}) bound to ${boundIp} attempted from foreign IP ${clientIp}`);

        if (customer.autoBanOnKeySharing) {
          // 1. Suspend Customer
          const db = mongoose.connection.db;
          if (db) {
            const custId = new mongoose.Types.ObjectId(customer.customerId);
            await db.collection('customers').updateOne(
              { _id: custId },
              {
                $set: { status: 'suspended', suspendedAt: new Date() },
                $inc: { keySharingViolations: 1 },
              }
            );

            // 2. Revoke API Key
            await db.collection('api_keys').updateOne(
              { keyHash: customer.keyHash },
              {
                $set: { status: 'revoked', revokedAt: new Date() },
              }
            );

            // 3. Blacklist the offending foreign IP
            const banReason = `Unauthorized key sharing: key ${customer.keyPrefix} locked to ${boundIp} was used from foreign IP ${clientIp}`;
            await db.collection('ip_blacklists').updateOne(
              { ip: clientIp },
              {
                $set: {
                  ip: clientIp,
                  reason: banReason,
                  blockedBy: 'SYSTEM_AUTO_BAN',
                  isActive: true,
                  lastTriggeredAt: new Date(),
                },
                $inc: { incidentCount: 1 },
              },
              { upsert: true }
            );

            // 4. Record Critical Security Incident
            await db.collection('security_incidents').insertOne({
              incidentType: 'KEY_SHARING_VIOLATION',
              severity: 'CRITICAL',
              sourceIp: clientIp,
              customerId: custId,
              customerUsername: customer.username,
              keyPrefix: customer.keyPrefix,
              endpoint: req.originalUrl,
              method: req.method,
              details: {
                boundIp,
                violatingIp: clientIp,
                userAgent: req.headers['user-agent'],
              },
              actionTaken: 'AUTO_BANNED_KEY_AND_IP',
              createdAt: new Date(),
            });
          }

          // Invalidate Redis caches
          await redis.del(`auth:key:${customer.keyHash}`);
          await redis.del(`key:bound_ip:${customer.keyHash}`);
          await redis.set(`blacklist:ip:${clientIp}`, 'KEY_SHARING_AUTO_BAN', 'EX', 86400 * 30);

          // Publish real-time alert to live admin monitoring
          redis.publish('pubsub:realtime', JSON.stringify({
            event: 'security_alert',
            payload: {
              incidentType: 'KEY_SHARING_VIOLATION',
              severity: 'CRITICAL',
              sourceIp: clientIp,
              customerUsername: customer.username,
              keyPrefix: customer.keyPrefix,
              actionTaken: 'AUTO_BANNED_KEY_AND_IP',
              details: { boundIp, offendingForeignIp: clientIp },
              createdAt: new Date(),
            },
          })).catch(() => {});

          throw new ForbiddenError(
            `SECURITY VIOLATION: Unauthorized multi-user API key sharing detected. This API key is strictly locked to IP ${boundIp}. In accordance with single-user policy, this API key has been revoked and IP ${clientIp} has been banned.`,
            'KEY_SHARING_PROHIBITED'
          );
        } else {
          throw new ForbiddenError(
            `Access Denied: This API key is locked to authorized IP ${boundIp}. Requests from IP ${clientIp} are rejected.`,
            'IP_NOT_PERMITTED'
          );
        }
      }
    }

    return clientIp;
  }
}
