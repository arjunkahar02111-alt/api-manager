import { Customer, ApiKey, ApiCatalog, UsageDaily, UsageMonthly, UsageEvent } from '../database/models/index.js';
import { generateApiKey, ConflictError, NotFoundError } from '@arjun/shared';
import { logAdminAction } from './audit.service.js';
import { getRedisClient } from './redis.service.js';
import { SocketService } from './socket.service.js';
import { config } from '../config/index.js';

export interface CreateCustomerInput {
  username: string;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  planId?: string;
  validityDays?: number;
  dailyRequestLimit?: number;
  monthlyRequestLimit?: number;
  lifetimeRequestLimit?: number;
  maxConcurrentRequests?: number;
  maxBandwidthBytes?: number;
  allowedApis?: string[];
  allowedIps?: string[];
  tags?: string[];
  developerTag?: string;
  price?: number;
  currency?: string;
}

export class CustomerService {
  /**
   * Create customer, assign plan/quotas, generate single cryptographically secure API key
   * Returns the customer and the raw API key (displayed ONCE)
   */
  static async createCustomer(
    data: CreateCustomerInput,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const rawUsername = (data.username || (data as any).name || `client_${Date.now()}`).toString().trim();
    const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const fullName = data.fullName && data.fullName.trim() ? data.fullName.trim() : rawUsername;
    const email = data.email && data.email.trim()
      ? data.email.trim().toLowerCase()
      : `${cleanUsername}_${Date.now()}@client.internal`;

    // 1. Automatically purge any legacy soft-deleted client records with this username or email
    await Customer.deleteMany({
      $or: [{ username: cleanUsername }, { email }],
      status: 'deleted',
    });

    // 2. Reject only if an active or suspended client currently occupies this username or email
    const existing = await Customer.findOne({
      $or: [{ username: cleanUsername }, { email }],
      status: { $ne: 'deleted' },
    });
    if (existing) {
      throw new ConflictError(`A client with the name '${cleanUsername}' or email '${email}' already exists`);
    }

    const validityDays = data.validityDays && Number(data.validityDays) > 0 ? Number(data.validityDays) : 30;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const customer = await Customer.create({
      username: cleanUsername,
      fullName,
      email,
      phone: data.phone,
      company: data.company,
      notes: data.notes,
      planId: data.planId,
      dailyRequestLimit: data.dailyRequestLimit !== undefined ? Number(data.dailyRequestLimit) : 1000,
      monthlyRequestLimit: data.monthlyRequestLimit !== undefined ? Number(data.monthlyRequestLimit) : 30000,
      lifetimeRequestLimit: data.lifetimeRequestLimit !== undefined ? Number(data.lifetimeRequestLimit) : 100000,
      maxConcurrentRequests: data.maxConcurrentRequests !== undefined ? Number(data.maxConcurrentRequests) : 10,
      maxBandwidthBytes: data.maxBandwidthBytes !== undefined ? Number(data.maxBandwidthBytes) : 10737418240,
      allowedApis: data.allowedApis || ['*'],
      allowedIps: data.allowedIps || [],
      tags: data.tags || [],
      developerTag: data.developerTag && data.developerTag.trim() ? data.developerTag.trim() : 'arjunkahar',
      price: data.price !== undefined ? Number(data.price) : 0,
      currency: data.currency || 'USD',
      expiresAt,
      status: 'active',
      createdBy: adminUsername,
    });

    // Generate single active API key
    const { rawKey, keyPrefix, keyHash } = generateApiKey();

    const apiKey = await ApiKey.create({
      customerId: customer._id,
      keyHash,
      keyPrefix,
      status: 'active',
    });

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'CUSTOMER_CREATED',
      resourceType: 'customer',
      resourceId: customer._id.toString(),
      afterState: {
        username: customer.username,
        email: customer.email,
        keyPrefix: apiKey.keyPrefix,
        expiresAt: customer.expiresAt,
      },
      sourceIp,
      result: 'success',
    });

    const publicBase = (config.publicBaseUrl || 'https://api.karviontechnologies.in').replace(/\/$/, '');
    const apis = await ApiCatalog.find({ status: 'active' }).limit(1);
    const sampleEndpoint = apis.length > 0
      ? (apis[0].gatewayPath.startsWith('/v1') ? apis[0].gatewayPath : `/v1${apis[0].gatewayPath}`)
      : '/v1/vehicle2-n';
    const sampleUrl = `${publicBase}${sampleEndpoint}`;

    const clientShareText = [
      `🚀 Your API Access Details:`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Service:     ${apis.length > 0 ? apis[0].name : 'API Access'}`,
      `Gateway URL: ${sampleUrl}`,
      `API Key:     ${rawKey}`,
      `Daily Limit: ${customer.dailyRequestLimit ? customer.dailyRequestLimit.toLocaleString() : 'Unlimited'} requests/day`,
      `Expires:     ${expiresAt.toDateString()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👉 Direct URL (Key in URL):`,
      `${sampleUrl}?key=${rawKey}&query=YOUR_SEARCH`,
      ``,
      `👉 cURL Command:`,
      `curl "${sampleUrl}?key=${rawKey}&query=YOUR_SEARCH"`,
      ``,
      `👉 Header Authentication:`,
      `curl -H "X-API-Key: ${rawKey}" "${sampleUrl}?query=YOUR_SEARCH"`,
    ].join('\n');

    SocketService.broadcastToAdmin('client:created', {
      customerId: customer._id.toString(),
      username: customer.username,
      fullName: customer.fullName,
      keyPrefix: apiKey.keyPrefix,
    });

    return {
      customer,
      apiKey: {
        id: apiKey._id,
        keyPrefix: apiKey.keyPrefix,
        rawKey, // Returned once!
        createdAt: apiKey.createdAt,
      },
      gatewayUrl: sampleUrl,
      shareText: clientShareText,
    };
  }

  /**
   * Regenerate API Key: immediately invalidates existing key and creates a fresh one
   */
  static async regenerateApiKey(
    customerId: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    // Revoke old active key
    const oldKey = await ApiKey.findOne({ customerId: customer._id, status: 'active' });
    if (oldKey) {
      oldKey.status = 'revoked';
      oldKey.revokedAt = new Date();
      await oldKey.save();

      // Evict from Redis key cache
      const redis = getRedisClient();
      await redis.del(`key:${oldKey.keyHash}`);
    }

    // Generate new key
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

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'API_KEY_REGENERATED',
      resourceType: 'customer',
      resourceId: customer._id.toString(),
      beforeState: { oldKeyPrefix: oldKey?.keyPrefix },
      afterState: { newKeyPrefix: newKey.keyPrefix },
      sourceIp,
      result: 'success',
    });

    const publicBase = (config.publicBaseUrl || 'https://api.karviontechnologies.in').replace(/\/$/, '');
    const apis = await ApiCatalog.find({ status: 'active' }).limit(1);
    const sampleEndpoint = apis.length > 0
      ? (apis[0].gatewayPath.startsWith('/v1') ? apis[0].gatewayPath : `/v1${apis[0].gatewayPath}`)
      : '/v1/vehicle2-n';
    const sampleUrl = `${publicBase}${sampleEndpoint}`;

    const clientShareText = [
      `🚀 Your Regenerated API Key:`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Endpoint: ${sampleUrl}`,
      `New Key:  ${rawKey}`,
      `Header:   X-API-Key: ${rawKey}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Example cURL:`,
      `curl -H "X-API-Key: ${rawKey}" "${sampleUrl}"`,
    ].join('\n');

    SocketService.broadcastToAdmin('client:updated', {
      customerId: customer._id.toString(),
      action: 'key_regenerated',
    });

    return {
      keyPrefix: newKey.keyPrefix,
      rawKey,
      createdAt: newKey.createdAt,
      gatewayUrl: sampleUrl,
      shareText: clientShareText,
    };
  }

  static async suspendCustomer(
    customerId: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    customer.status = 'suspended';
    customer.suspendedAt = new Date();
    await customer.save();

    // Evict customer cache in Redis
    const redis = getRedisClient();
    await redis.del(`customer:${customer._id}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'CUSTOMER_SUSPENDED',
      resourceType: 'customer',
      resourceId: customer._id.toString(),
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('client:updated', {
      customerId: customer._id.toString(),
      status: 'suspended',
      action: 'suspended',
    });

    return customer;
  }

  static async activateCustomer(
    customerId: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    customer.status = 'active';
    customer.suspendedAt = undefined;
    await customer.save();

    const redis = getRedisClient();
    await redis.del(`customer:${customer._id}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'CUSTOMER_ACTIVATED',
      resourceType: 'customer',
      resourceId: customer._id.toString(),
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('client:updated', {
      customerId: customer._id.toString(),
      status: 'active',
      action: 'activated',
    });

    return customer;
  }

  static async renewCustomer(
    customerId: string,
    additionalDays: number,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const baseTime = customer.expiresAt.getTime() > Date.now() ? customer.expiresAt.getTime() : Date.now();
    customer.expiresAt = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);
    if (customer.status === 'expired') {
      customer.status = 'active';
    }
    await customer.save();

    const redis = getRedisClient();
    await redis.del(`customer:${customer._id}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'CUSTOMER_RENEWED',
      resourceType: 'customer',
      resourceId: customer._id.toString(),
      afterState: { expiresAt: customer.expiresAt, additionalDays },
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('client:updated', {
      customerId: customer._id.toString(),
      action: 'renewed',
    });

    return customer;
  }

  static async resetUsage(
    customerId: string,
    type: 'daily' | 'monthly' | 'lifetime',
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const redis = getRedisClient();
    const today = new Date().toISOString().substring(0, 10);
    const month = today.substring(0, 7);

    if (type === 'daily') {
      await redis.del(`quota:${customerId}:daily:${today}`);
      await UsageDaily.deleteMany({ customerId: customer._id, date: today });
    } else if (type === 'monthly') {
      await redis.del(`quota:${customerId}:monthly:${month}`);
      await UsageMonthly.deleteMany({ customerId: customer._id, month });
    } else if (type === 'lifetime') {
      await redis.del(`quota:${customerId}:lifetime`);
      await UsageDaily.deleteMany({ customerId: customer._id });
      await UsageMonthly.deleteMany({ customerId: customer._id });
    }

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: `USAGE_RESET_${type.toUpperCase()}`,
      resourceType: 'customer',
      resourceId: customer._id.toString(),
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('client:updated', {
      customerId: customer._id.toString(),
      action: 'usage_reset',
    });

    return { success: true, message: `${type} usage successfully reset for customer ${customer.username}` };
  }

  static async deleteCustomer(
    customerId: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const customerUsername = customer.username;

    // Revoke and delete all keys from database and Redis cache
    const keys = await ApiKey.find({ customerId: customer._id });
    const redis = getRedisClient();
    for (const key of keys) {
      await redis.del(`auth:key:${key.keyHash}`).catch(() => {});
      await redis.del(`key:bound_ip:${key.keyHash}`).catch(() => {});
    }
    await ApiKey.deleteMany({ customerId: customer._id });

    // Clean up Redis customer cache & bound IP
    await redis.del(`customer:${customer._id}`).catch(() => {});
    if (customer.boundIp) {
      await redis.srem('security:bound_ips', customer.boundIp).catch(() => {});
    }

    // Completely hard delete the customer record from MongoDB
    await Customer.findByIdAndDelete(customer._id);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'CUSTOMER_DELETED',
      resourceType: 'customer',
      resourceId: customerId,
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('client:deleted', {
      customerId,
      username: customerUsername,
    });

    return { success: true };
  }

  /**
   * Real-time customer quota and usage summary
   */
  static async getCustomerUsage(customerId: string) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const today = new Date().toISOString().substring(0, 10);
    const month = today.substring(0, 7);
    const redis = getRedisClient();

    // Fetch from Redis high-speed counters
    const [dailyCountStr, monthlyCountStr, lifetimeCountStr, bandwidthStr, concurrencyStr] = await Promise.all([
      redis.get(`quota:${customerId}:daily:${today}`),
      redis.get(`quota:${customerId}:monthly:${month}`),
      redis.get(`quota:${customerId}:lifetime`),
      redis.get(`quota:${customerId}:bandwidth:${month}`),
      redis.get(`quota:${customerId}:concurrency`),
    ]);

    const dailyUsed = parseInt(dailyCountStr || '0', 10);
    const monthlyUsed = parseInt(monthlyCountStr || '0', 10);
    const lifetimeUsed = parseInt(lifetimeCountStr || '0', 10);
    const bandwidthBytesUsed = parseInt(bandwidthStr || '0', 10);
    const activeConcurrency = parseInt(concurrencyStr || '0', 10);

    return {
      daily: {
        used: dailyUsed,
        limit: customer.dailyRequestLimit,
        remaining: Math.max(0, customer.dailyRequestLimit - dailyUsed),
      },
      monthly: {
        used: monthlyUsed,
        limit: customer.monthlyRequestLimit,
        remaining: Math.max(0, customer.monthlyRequestLimit - monthlyUsed),
      },
      lifetime: {
        used: lifetimeUsed,
        limit: customer.lifetimeRequestLimit,
        remaining: Math.max(0, customer.lifetimeRequestLimit - lifetimeUsed),
      },
      concurrency: {
        current: activeConcurrency,
        limit: customer.maxConcurrentRequests,
      },
      bandwidth: {
        usedBytes: bandwidthBytesUsed,
        limitBytes: customer.maxBandwidthBytes,
      },
      status: customer.status,
      expiresAt: customer.expiresAt,
    };
  }
}
