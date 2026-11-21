import crypto from 'node:crypto';
import { Customer, ApiKey, Administrator, SecurityIncident, IpBlacklist } from '../database/models/index.js';
import { getRedisClient } from './redis.service.js';
import { RealtimeService } from './realtime.service.js';
import type { SecurityIncidentType, SecuritySeverity } from '@arjun/types';

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
   * Single-User Active Session Tracking
   */
  static async issueSession(userId: string, role: 'admin' | 'customer'): Promise<string> {
    const sessionId = crypto.randomUUID();
    const redis = getRedisClient();
    const redisKey = `session:active:${role}:${userId}`;

    // Store in Redis (valid for 7 days)
    await redis.set(redisKey, sessionId, 'EX', 7 * 86400);

    // Update in database model
    if (role === 'admin') {
      await Administrator.updateOne({ _id: userId }, { activeSessionId: sessionId });
    } else {
      await Customer.updateOne({ _id: userId }, { activeSessionId: sessionId });
    }

    return sessionId;
  }

  static async validateSession(userId: string, role: 'admin' | 'customer', tokenSessionId?: string): Promise<boolean> {
    if (!tokenSessionId) {
      // Legacy tokens without sessionId require re-login for strict security
      return false;
    }

    const redis = getRedisClient();
    const redisKey = `session:active:${role}:${userId}`;
    const activeSessionId = await redis.get(redisKey);

    if (activeSessionId) {
      return activeSessionId === tokenSessionId;
    }

    // Fallback to database check
    if (role === 'admin') {
      const admin = await Administrator.findById(userId).select('activeSessionId').lean();
      return admin?.activeSessionId === tokenSessionId;
    } else {
      const customer = await Customer.findById(userId).select('activeSessionId').lean();
      return customer?.activeSessionId === tokenSessionId;
    }
  }

  static async terminateSession(userId: string, role: 'admin' | 'customer') {
    const redis = getRedisClient();
    await redis.del(`session:active:${role}:${userId}`);
    if (role === 'admin') {
      await Administrator.updateOne({ _id: userId }, { activeSessionId: null });
    } else {
      await Customer.updateOne({ _id: userId }, { activeSessionId: null });
    }
  }
}
