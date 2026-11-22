import crypto from 'node:crypto';
import { Customer, ApiKey, Administrator, SecurityIncident, IpBlacklist, UserSession } from '../database/models/index.js';
import { getRedisClient } from './redis.service.js';
import { RealtimeService } from './realtime.service.js';
import type { SecurityIncidentType, SecuritySeverity } from '@arjun/types';

export function parseDeviceName(userAgent?: string): { os: string; browser: string; device: string } {
  if (!userAgent) return { os: 'Unknown OS', browser: 'Unknown Browser', device: 'Unknown Device' };

  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';

  let browser = 'Unknown Browser';
  if (/edg/i.test(userAgent)) browser = 'Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/postman/i.test(userAgent)) browser = 'Postman';
  else if (/curl/i.test(userAgent)) browser = 'cURL';

  return { os, browser, device: `${browser} on ${os}` };
}

export function normalizeIp(ip: string): string {
  if (!ip) return '127.0.0.1';
  let clean = ip.trim();
  if (clean.startsWith('::ffff:')) {
    clean = clean.substring(7);
  }
  return clean;
}

export class SecurityService {
  /**
   * Records a security incident, broadcasts real-time alert, and persists to DB.
   */
  static async recordIncident(params: {
    incidentType: SecurityIncidentType;
    severity?: SecuritySeverity;
    sourceIp: string;
    customerId?: string;
    customerUsername?: string;
    keyPrefix?: string;
    endpoint?: string;
    method?: string;
    details?: Record<string, any>;
    actionTaken: string;
  }) {
    const normIp = normalizeIp(params.sourceIp);
    const incident = await SecurityIncident.create({
      incidentType: params.incidentType,
      severity: params.severity || 'HIGH',
      sourceIp: normIp,
      customerId: params.customerId,
      customerUsername: params.customerUsername,
      keyPrefix: params.keyPrefix,
      endpoint: params.endpoint,
      method: params.method,
      details: params.details || {},
      actionTaken: params.actionTaken,
    });

    // Real-time broadcast to all listening dashboards
    RealtimeService.broadcast('security_alert', {
      id: incident._id.toString(),
      incidentType: incident.incidentType,
      severity: incident.severity,
      sourceIp: incident.sourceIp,
      customerUsername: incident.customerUsername,
      keyPrefix: incident.keyPrefix,
      endpoint: incident.endpoint,
      actionTaken: incident.actionTaken,
      details: incident.details,
      createdAt: incident.createdAt,
    });

    return incident;
  }

  /**
   * Fast-path check if an IP is currently blacklisted.
   */
  static async isIpBlacklisted(rawIp: string): Promise<{ blacklisted: boolean; reason?: string }> {
    const ip = normalizeIp(rawIp);
    const redis = getRedisClient();

    // 1. Redis Cache
    const cached = await redis.get(`blacklist:ip:${ip}`);
    if (cached) {
      return { blacklisted: true, reason: cached };
    }

    // 2. Database Lookup
    const record = await IpBlacklist.findOne({ ip, isActive: true });
    if (!record) {
      return { blacklisted: false };
    }

    // Check expiration if temporary ban
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      record.isActive = false;
      await record.save();
      return { blacklisted: false };
    }

    // Cache in Redis
    const ttlSeconds = record.expiresAt
      ? Math.max(1, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000))
      : 86400 * 30; // 30 days for permanent ban

    await redis.set(`blacklist:ip:${ip}`, record.reason, 'EX', ttlSeconds);
    return { blacklisted: true, reason: record.reason };
  }

  /**
   * Adds an IP to the blacklist, updates Redis, and logs incident.
   */
  static async blacklistIp(ip: string, reason: string, blockedBy = 'SYSTEM_AUTO_BAN', expiresInHours?: number) {
    const normIp = normalizeIp(ip);
    const redis = getRedisClient();
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600 * 1000) : undefined;

    const record = await IpBlacklist.findOneAndUpdate(
      { ip: normIp },
      {
        reason,
        blockedBy,
        expiresAt,
        isActive: true,
        $inc: { incidentCount: 1 },
        lastTriggeredAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const ttlSeconds = expiresInHours ? expiresInHours * 3600 : 86400 * 30;
    await redis.set(`blacklist:ip:${normIp}`, reason, 'EX', ttlSeconds);

    RealtimeService.broadcast('ip_blacklisted', {
      ip: normIp,
      reason,
      blockedBy,
      expiresAt,
    });

    return record;
  }

  /**
   * Removes an IP from the blacklist and invalidates cache.
   */
  static async unblacklistIp(ip: string) {
    const normIp = normalizeIp(ip);
    const redis = getRedisClient();

    await IpBlacklist.updateMany({ ip: normIp }, { isActive: false });
    await redis.del(`blacklist:ip:${normIp}`);

    RealtimeService.broadcast('ip_unbanned', { ip: normIp });
  }

  /**
   * Resets or updates a customer's single bound IP.
   * If newIp is provided, binds to that IP; if omitted, unlocks so first request auto-binds.
   */
  static async resetCustomerBoundIp(customerId: string, newIp?: string) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const normNewIp = newIp ? normalizeIp(newIp) : undefined;
    customer.boundIp = normNewIp;
    if (normNewIp) {
      if (!customer.activeIps?.includes(normNewIp)) {
        customer.activeIps = [...(customer.activeIps || []), normNewIp];
      }
    } else {
      customer.activeIps = [];
    }

    // If customer was suspended due to key sharing, reactivate them
    if (customer.status === 'suspended') {
      customer.status = 'active';
      customer.suspendedAt = undefined;
      await ApiKey.updateMany({ customerId: customer._id }, { status: 'active' });
    }

    await customer.save();

    // Clear Redis caches for this customer and keys
    const redis = getRedisClient();
    const activeKeys = await ApiKey.find({ customerId: customer._id });
    for (const k of activeKeys) {
      await redis.del(`auth:key:${k.keyHash}`);
      await redis.del(`key:bound_ip:${k.keyHash}`);
      await redis.del(`key:ips:${k.keyHash}`);
    }

    RealtimeService.broadcast('customer_updated', {
      customerId: customer._id.toString(),
      username: customer.username,
      boundIp: customer.boundIp,
      status: customer.status,
    });

    return customer;
  }

  /**
   * Enterprise Multi-Device Session Issuance with Redis and MongoDB Synchronization
   */
  static async issueSession(
    userId: string,
    role: 'admin' | 'customer',
    ipAddress = '127.0.0.1',
    userAgent = 'Unknown'
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const redis = getRedisClient();
    const redisKey = `session:active:${role}:${userId}`;
    const sessionDataKey = `session:data:${sessionId}`;
    const normIp = normalizeIp(ipAddress);
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24-hour absolute session lifetime

    // 1. Create or persist in MongoDB UserSession (mark previous sessions superseded)
    try {
      await UserSession.updateMany(
        { userId, role, sessionId: { $ne: sessionId } },
        { isActive: false }
      );
      await UserSession.create({
        userId,
        role,
        sessionId,
        ipAddress: normIp,
        userAgent,
        expiresAt,
        isActive: true,
        lastActivityAt: new Date(),
      });
    } catch (err) {
      console.error('[SecurityService] Failed to record UserSession in MongoDB:', err);
    }

    // 2. Cache in Redis (Fast-path active lookup)
    const sessionPayload = JSON.stringify({
      sessionId,
      userId,
      role,
      ipAddress: normIp,
      userAgent,
      expiresAt: expiresAt.toISOString(),
      lastActivityAt: Date.now(),
      isActive: true,
    });
    await redis.set(sessionDataKey, sessionPayload, 'EX', 24 * 3600);
    await redis.set(redisKey, sessionId, 'EX', 24 * 3600);

    // 3. Update database model
    if (role === 'admin') {
      await Administrator.updateOne(
        { _id: userId },
        {
          activeSessionId: sessionId,
          lastLoginAt: new Date(),
          lastLoginIp: normIp,
          currentLoginIp: normIp,
          currentLoginUserAgent: userAgent,
        }
      );
    } else {
      await Customer.updateOne(
        { _id: userId },
        { activeSessionId: sessionId, lastLoginAt: new Date() }
      );
    }

    return sessionId;
  }

  /**
   * Validates active session, enforcing idle timeout (2 hours) and absolute session expiration
   */
  static async validateSession(userId: string, role: 'admin' | 'customer', tokenSessionId?: string): Promise<boolean> {
    if (!tokenSessionId) {
      return false;
    }

    const redis = getRedisClient();

    // Strict Superseding Session Check: If another session was established, terminate older session
    const activeSessionKey = `session:active:${role}:${userId}`;
    const activeSessionId = await redis.get(activeSessionKey);
    if (activeSessionId && activeSessionId !== tokenSessionId) {
      return false;
    }

    const sessionDataKey = `session:data:${tokenSessionId}`;
    const cachedSessionRaw = await redis.get(sessionDataKey);

    const IDLE_TIMEOUT_MS = 2 * 3600 * 1000; // 2 hours idle timeout
    const now = Date.now();

    if (cachedSessionRaw) {
      try {
        const cached = JSON.parse(cachedSessionRaw);
        if (!cached.isActive || cached.userId !== userId) {
          return false;
        }

        // Idle timeout verification
        if (now - cached.lastActivityAt > IDLE_TIMEOUT_MS) {
          await this.revokeSession(tokenSessionId, userId, role);
          return false;
        }

        // Absolute lifetime verification
        if (new Date(cached.expiresAt).getTime() < now) {
          await this.revokeSession(tokenSessionId, userId, role);
          return false;
        }

        // Throttled update of lastActivityAt (every 60s)
        if (now - cached.lastActivityAt > 60000) {
          cached.lastActivityAt = now;
          await redis.set(sessionDataKey, JSON.stringify(cached), 'EX', 24 * 3600);
          UserSession.updateOne({ sessionId: tokenSessionId }, { lastActivityAt: new Date() }).exec();
        }

        return true;
      } catch {
        // Fall through to database check
      }
    }

    // Fallback: Check MongoDB UserSession
    const dbSession = await UserSession.findOne({ sessionId: tokenSessionId, userId, isActive: true });
    if (dbSession) {
      if (dbSession.expiresAt.getTime() < now) {
        dbSession.isActive = false;
        await dbSession.save();
        return false;
      }

      if (now - dbSession.lastActivityAt.getTime() > IDLE_TIMEOUT_MS) {
        dbSession.isActive = false;
        await dbSession.save();
        return false;
      }

      // Re-populate Redis
      const sessionPayload = JSON.stringify({
        sessionId: tokenSessionId,
        userId,
        role,
        ipAddress: dbSession.ipAddress,
        userAgent: dbSession.userAgent,
        expiresAt: dbSession.expiresAt.toISOString(),
        lastActivityAt: now,
        isActive: true,
      });
      await redis.set(sessionDataKey, sessionPayload, 'EX', 24 * 3600);
      return true;
    }

    // Fallback: Check Administrator/Customer model
    if (role === 'admin') {
      const admin = await Administrator.findById(userId).select('activeSessionId').lean();
      return admin?.activeSessionId === tokenSessionId;
    } else {
      const customer = await Customer.findById(userId).select('activeSessionId').lean();
      return customer?.activeSessionId === tokenSessionId;
    }
  }

  /**
   * Returns all active sessions for a user with parsed device and IP information
   */
  static async listActiveSessions(userId: string, role: 'admin' | 'customer', currentSessionId?: string) {
    const sessions = await UserSession.find({
      userId,
      role,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastActivityAt: -1 })
      .lean();

    return sessions.map((s) => {
      const deviceInfo = parseDeviceName(s.userAgent);
      return {
        id: s._id.toString(),
        sessionId: s.sessionId,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent || 'Unknown',
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        createdAt: (s as any).createdAt || s.lastActivityAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        isCurrent: s.sessionId === currentSessionId,
      };
    });
  }

  /**
   * Revokes an individual session immediately on both Redis and MongoDB
   */
  static async revokeSession(sessionId: string, userId: string, role: 'admin' | 'customer') {
    const redis = getRedisClient();
    await redis.del(`session:data:${sessionId}`);
    await UserSession.updateOne({ sessionId, userId }, { isActive: false });

    if (role === 'admin') {
      await Administrator.updateOne({ _id: userId, activeSessionId: sessionId }, { activeSessionId: null });
      const currentActive = await redis.get(`session:active:${role}:${userId}`);
      if (currentActive === sessionId) {
        await redis.del(`session:active:${role}:${userId}`);
      }
    } else {
      await Customer.updateOne({ _id: userId, activeSessionId: sessionId }, { activeSessionId: null });
      const currentActive = await redis.get(`session:active:${role}:${userId}`);
      if (currentActive === sessionId) {
        await redis.del(`session:active:${role}:${userId}`);
      }
    }
  }

  /**
   * Revokes all active sessions for a user (or all except current session)
   */
  static async revokeAllSessions(userId: string, role: 'admin' | 'customer', exceptSessionId?: string) {
    const redis = getRedisClient();
    const query: any = { userId, role, isActive: true };
    if (exceptSessionId) {
      query.sessionId = { $ne: exceptSessionId };
    }

    const sessions = await UserSession.find(query).select('sessionId').lean();
    for (const s of sessions) {
      await redis.del(`session:data:${s.sessionId}`);
    }

    await UserSession.updateMany(query, { isActive: false });

    if (!exceptSessionId) {
      await redis.del(`session:active:${role}:${userId}`);
      if (role === 'admin') {
        await Administrator.updateOne({ _id: userId }, { activeSessionId: null });
      } else {
        await Customer.updateOne({ _id: userId }, { activeSessionId: null });
      }
    }
  }

  static async terminateSession(userId: string, role: 'admin' | 'customer') {
    await this.revokeAllSessions(userId, role);
  }
}
