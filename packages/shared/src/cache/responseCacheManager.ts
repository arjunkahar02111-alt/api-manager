import type { Redis } from 'ioredis';
import crypto from 'node:crypto';

interface MemoryCacheEntry {
  body: string; // base64 encoded for binary safety
  isBuffer: boolean;
  contentType: string;
  statusCode: number;
  headers: Record<string, string>;
  expiresAt: number;
}

export class ResponseCacheManager {
  private static memoryStore = new Map<string, MemoryCacheEntry>();
  private static hits = 0;
  private static misses = 0;
  private static errors = 0;

  private static hashPayload(data: any): string {
    if (!data) return 'empty';
    if (typeof data === 'string') {
      return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }
    if (Buffer.isBuffer(data)) {
      return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }
    try {
      const sortedKeys = Object.keys(data).sort();
      const normalized: Record<string, any> = {};
      for (const k of sortedKeys) {
        normalized[k] = data[k];
      }
      return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').substring(0, 16);
    } catch {
      return 'hash_err';
    }
  }

  static buildCacheKey(routeSlug: string, method: string, path: string, queryParams: any, body: any): string {
    const qHash = this.hashPayload(queryParams);
    const bHash = this.hashPayload(body);
    const cleanPath = path.replace(/\/+/g, '/').toLowerCase();
    return `cache:api:${routeSlug}:${method.toUpperCase()}:${cleanPath}:${qHash}:${bHash}`;
  }

  static async get(
    redis: Redis | null | undefined,
    routeSlug: string,
    method: string,
    path: string,
    queryParams: any,
    body: any
  ): Promise<{ body: Buffer | string; contentType: string; statusCode: number; headers: Record<string, string>; ttlRemaining: number } | null> {
    const key = this.buildCacheKey(routeSlug, method, path, queryParams, body);

    try {
      if (redis) {
        const raw = await redis.get(key);
        if (raw) {
          const ttl = await redis.ttl(key);
          const parsed = JSON.parse(raw);
          this.hits++;
          const bodyPayload = parsed.isBuffer ? Buffer.from(parsed.body, 'base64') : parsed.body;
          return {
            body: bodyPayload,
            contentType: parsed.contentType || 'application/json',
            statusCode: parsed.statusCode || 200,
            headers: parsed.headers || {},
            ttlRemaining: ttl > 0 ? ttl : 60,
          };
        }
      }

      // Memory Cache Fallback
      const entry = this.memoryStore.get(key);
      if (entry) {
        if (Date.now() < entry.expiresAt) {
          this.hits++;
          const ttlRemaining = Math.max(1, Math.round((entry.expiresAt - Date.now()) / 1000));
          const bodyPayload = entry.isBuffer ? Buffer.from(entry.body, 'base64') : entry.body;
          return {
            body: bodyPayload,
            contentType: entry.contentType,
            statusCode: entry.statusCode,
            headers: entry.headers,
            ttlRemaining,
          };
        } else {
          this.memoryStore.delete(key);
        }
      }

      this.misses++;
      return null;
    } catch (err) {
      console.warn('[ResponseCacheManager] Cache read error:', err);
      this.errors++;
      this.misses++;
      return null;
    }
  }

  static async set(
    redis: Redis | null | undefined,
    routeSlug: string,
    method: string,
    path: string,
    queryParams: any,
    body: any,
    responseBody: Buffer | string,
    responseHeaders: Record<string, any>,
    statusCode = 200,
    ttlSeconds = 60
  ): Promise<void> {
    // Only cache successful idempotent operations unless explicitly instructed
    if (statusCode < 200 || statusCode >= 300) return;

    // Inspect upstream Cache-Control headers
    const cc = String(responseHeaders['cache-control'] || responseHeaders['Cache-Control'] || '').toLowerCase();
    if (cc.includes('no-store') || cc.includes('private')) {
      return; // Respect upstream no-store
    }

    const key = this.buildCacheKey(routeSlug, method, path, queryParams, body);
    const isBuffer = Buffer.isBuffer(responseBody);
    const bodyStr = isBuffer ? (responseBody as Buffer).toString('base64') : String(responseBody);
    const contentType = String(responseHeaders['content-type'] || responseHeaders['Content-Type'] || 'application/json');

    const cacheRecord = {
      body: bodyStr,
      isBuffer,
      contentType,
      statusCode,
      headers: {
        'content-type': contentType,
      },
    };

    try {
      if (redis) {
        await redis.set(key, JSON.stringify(cacheRecord), 'EX', ttlSeconds);
      }

      // Also set in memory fallback
      this.memoryStore.set(key, {
        body: bodyStr,
        isBuffer,
        contentType,
        statusCode,
        headers: cacheRecord.headers,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });

      // Cleanup memoryStore if oversized
      if (this.memoryStore.size > 2000) {
        const now = Date.now();
        for (const [k, v] of this.memoryStore.entries()) {
          if (v.expiresAt <= now) this.memoryStore.delete(k);
        }
      }
    } catch (err) {
      console.warn('[ResponseCacheManager] Cache write error:', err);
      this.errors++;
    }
  }

  static async purge(redis: Redis | null | undefined, routeSlug: string): Promise<number> {
    let deletedCount = 0;
    const pattern = `cache:api:${routeSlug}:*`;

    try {
      if (redis) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          deletedCount = await redis.del(...keys);
        }
      }

      for (const k of this.memoryStore.keys()) {
        if (k.startsWith(`cache:api:${routeSlug}:`)) {
          this.memoryStore.delete(k);
          deletedCount++;
        }
      }
    } catch (err) {
      console.warn('[ResponseCacheManager] Cache purge error:', err);
    }

    return deletedCount;
  }

  static getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      memoryKeysCount: this.memoryStore.size,
    };
  }
}
