import { Redis } from 'ioredis';
import mongoose from 'mongoose';

export interface RouteConfig {
  id: string;
  name: string;
  slug: string;
  gatewayPath: string;
  upstreamBaseUrl: string;
  upstreamPath: string;
  allowedMethods: string[];
  timeoutMs: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  status: 'active' | 'disabled' | 'maintenance';
  cachePolicy?: { enabled: boolean; ttlSeconds: number };
}

export interface ResolvedRoute {
  route: RouteConfig;
  subPath: string;
}

export class RouteResolver {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async resolve(requestedPath: string): Promise<ResolvedRoute | null> {
    let cleanPath = requestedPath.startsWith('/') ? requestedPath : `/${requestedPath}`;
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // 1. Fast-path cache check for exact route
    const exactCacheKey = `gateway:api:${cleanPath}`;
    const exactCached = await this.redis.get(exactCacheKey);
    if (exactCached) {
      return { route: JSON.parse(exactCached), subPath: '' };
    }

    const db = mongoose.connection.db;
    if (!db) return null;

    // 2. Generate candidate path prefixes from most specific to root base path
    const segments = cleanPath.split('/').filter(Boolean);
    const candidatePaths: { path: string; subPath: string }[] = [];

    for (let i = segments.length; i > 0; i--) {
      const prefix = `/${segments.slice(0, i).join('/')}`;
      const remainder = segments.slice(i).join('/');
      candidatePaths.push({
        path: prefix,
        subPath: remainder ? `/${remainder}` : '',
      });
    }

    for (const candidate of candidatePaths) {
      const cacheKey = `gateway:api:${candidate.path}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return { route: JSON.parse(cached), subPath: candidate.subPath };
      }

      const api = await db.collection('api_catalog').findOne({
        gatewayPath: candidate.path,
      });

      if (api) {
        const routeConfig: RouteConfig = {
          id: api._id.toString(),
          name: api.name,
          slug: api.slug,
          gatewayPath: api.gatewayPath,
          upstreamBaseUrl: api.upstreamBaseUrl,
          upstreamPath: api.upstreamPath || '',
          allowedMethods: api.allowedMethods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
          timeoutMs: api.timeoutMs || 30000,
          maxRequestBytes: api.maxRequestBytes || 10485760,
          maxResponseBytes: api.maxResponseBytes || 10485760,
          status: api.status,
          cachePolicy: api.cachePolicy,
        };

        await this.redis.set(cacheKey, JSON.stringify(routeConfig), 'EX', 60);

        return { route: routeConfig, subPath: candidate.subPath };
      }
    }

    return null;
  }
}
