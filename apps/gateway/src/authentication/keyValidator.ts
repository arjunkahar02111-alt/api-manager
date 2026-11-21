import type { Request } from 'express';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { hashApiKey, UnauthorizedError, ForbiddenError } from '@arjun/shared';

export interface AuthenticatedCustomerContext {
  customerId: string;
  username: string;
  status: string;
  expiresAt: Date;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  lifetimeRequestLimit: number;
  maxConcurrentRequests: number;
  maxBandwidthBytes: number;
  allowedApis: string[];
  allowedIps: string[];
  keyPrefix: string;
  developerTag: string;
  keyHash: string;
  boundIp?: string;
  ipLockStrict: boolean;
  autoBanOnKeySharing: boolean;
  keySharingViolations?: number;
}

export class KeyValidator {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  extractApiKey(req: Request): string | null {
    // 1. URL query parameters: ?key=..., ?api_key=..., ?apiKey=..., ?token=...
    const queryKey = req.query.key || req.query.api_key || req.query.apiKey || req.query.token;
    if (typeof queryKey === 'string' && queryKey.trim()) {
      return queryKey.trim();
    }

    // 2. Custom header: X-API-Key
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    // 3. Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        return token;
      }
    }

    // 4. Request Body parameter (JSON or form-urlencoded)
    if (req.body) {
      try {
        if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
          const bodyKey = (req.body as any).key || (req.body as any).api_key || (req.body as any).apiKey;
          if (typeof bodyKey === 'string' && bodyKey.trim()) return bodyKey.trim();
        } else if (Buffer.isBuffer(req.body)) {
          const text = req.body.toString('utf-8');
          if (text.startsWith('{')) {
            const parsed = JSON.parse(text);
            const bodyKey = parsed.key || parsed.api_key || parsed.apiKey;
            if (typeof bodyKey === 'string' && bodyKey.trim()) return bodyKey.trim();
          } else if (text.includes('=')) {
            const params = new URLSearchParams(text);
            const bodyKey = params.get('key') || params.get('api_key') || params.get('apiKey');
            if (bodyKey && bodyKey.trim()) return bodyKey.trim();
          }
        }
      } catch {}
    }

    return null;
  }

  async authenticate(rawKey: string): Promise<AuthenticatedCustomerContext> {
    const keyHash = hashApiKey(rawKey);

    const cacheKey = `auth:key:${keyHash}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      this.verifyCustomerStatus(data);
      return data;
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const keyRecord = await db.collection('api_keys').findOne({ keyHash });
    if (!keyRecord) {
      throw new UnauthorizedError('Invalid API key provided', 'INVALID_API_KEY');
    }

    if (keyRecord.status !== 'active') {
      throw new ForbiddenError(`API key is ${keyRecord.status}`, 'KEY_INACTIVE');
    }

    const customer = await db.collection('customers').findOne({ _id: keyRecord.customerId });
    if (!customer) {
      throw new UnauthorizedError('Customer account not found', 'CUSTOMER_NOT_FOUND');
    }

    const customerContext: AuthenticatedCustomerContext = {
      customerId: customer._id.toString(),
      username: customer.username,
      status: customer.status,
      expiresAt: new Date(customer.expiresAt),
      dailyRequestLimit: customer.dailyRequestLimit ?? 1000,
      monthlyRequestLimit: customer.monthlyRequestLimit ?? 30000,
      lifetimeRequestLimit: customer.lifetimeRequestLimit ?? 100000,
      maxConcurrentRequests: customer.maxConcurrentRequests ?? 10,
      maxBandwidthBytes: customer.maxBandwidthBytes ?? 1073741824,
      allowedApis: customer.allowedApis || ['*'],
      allowedIps: customer.allowedIps || [],
      keyPrefix: keyRecord.keyPrefix,
      developerTag: customer.developerTag || 'arjunkahar',
      keyHash,
      boundIp: customer.boundIp || undefined,
      ipLockStrict: customer.ipLockStrict !== false,
      autoBanOnKeySharing: customer.autoBanOnKeySharing !== false,
      keySharingViolations: customer.keySharingViolations || 0,
    };

    this.verifyCustomerStatus(customerContext);

    await this.redis.set(cacheKey, JSON.stringify(customerContext), 'EX', 60);

    return customerContext;
  }

  private verifyCustomerStatus(customer: AuthenticatedCustomerContext): void {
    if (customer.status === 'suspended') {
      throw new ForbiddenError('Your customer account has been suspended by the administrator', 'ACCOUNT_SUSPENDED');
    }

    const now = Date.now();
    const expiry = new Date(customer.expiresAt).getTime();
    if (customer.status === 'expired' || expiry <= now) {
      throw new ForbiddenError('Your API key has expired. Please contact support to renew.', 'ACCOUNT_EXPIRED');
    }

    if (customer.status === 'deleted') {
      throw new UnauthorizedError('Customer account no longer exists', 'CUSTOMER_DELETED');
    }
  }
}
