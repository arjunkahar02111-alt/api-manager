import { Redis } from 'ioredis';
import mongoose from 'mongoose';

import type {
  ProviderAuthConfig,
  ParameterMapping,
  ParameterDefinition,
  CachePolicyConfig,
} from '@arjun/types';

export interface RouteConfig {
  id: string;
  name: string;
  slug: string;
  version?: string;
  gatewayPath: string;
  upstreamBaseUrl: string;
  upstreamPath: string;
  upstreamMethod?: string;
  allowedMethods: string[];
  timeoutMs: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  status: 'active' | 'disabled' | 'maintenance';
  cachePolicy?: CachePolicyConfig;
  authConfig?: ProviderAuthConfig;
  parameterMappings?: ParameterMapping[];
  parameterDefinitions?: ParameterDefinition[];
  requestBodyType?: string;
  responseEnvelope?: 'preserve' | 'wrap' | 'header_only';
  originalCurl?: string;
  sampleRequest?: any;
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
          upstreamMethod: api.upstreamMethod || (api.allowedMethods?.[0] ?? 'GET'),
          allowedMethods: api.allowedMethods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
          timeoutMs: api.timeoutMs || 30000,
          maxRequestBytes: api.maxRequestBytes || 10485760,
          maxResponseBytes: api.maxResponseBytes || 10485760,
          status: api.status,
          cachePolicy: api.cachePolicy,
          authConfig: api.authConfig,
          parameterMappings: api.parameterMappings,
          parameterDefinitions: api.parameterDefinitions,
          requestBodyType: api.requestBodyType,
          responseEnvelope: api.responseEnvelope || 'preserve',
          originalCurl: api.originalCurl,
          sampleRequest: api.sampleRequest,
        };

        await this.redis.set(cacheKey, JSON.stringify(routeConfig), 'EX', 60);

        return { route: routeConfig, subPath: candidate.subPath };
      }
    }

    // 3. Resilient Alias Resolution for Vehicle Intelligence endpoints:
    // Seamlessly resolves /vehicle2-n, /v2nn, /v2n-2, /v2n, /vehicle2n, /osint/vehicle across all catalog representations
    const VEHICLE_ALIASES = new Set(['/vehicle2-n', '/vehicle2n', '/v2nn', '/v2n-2', '/v2n', '/osint/vehicle', '/vehicle']);
    for (const candidate of candidatePaths) {
      if (VEHICLE_ALIASES.has(candidate.path)) {
        const api = await db.collection('api_catalog').findOne({
          $or: [
            { gatewayPath: { $in: Array.from(VEHICLE_ALIASES) } },
            { slug: { $in: ['vehicle2-n', 'vehicle2n', 'v2nn', 'v2n-2', 'rootx-vehicle-osint', 'v2n'] } },
          ],
        });

        if (api) {
          const routeConfig: RouteConfig = {
            id: api._id.toString(),
            name: api.name,
            slug: api.slug,
            gatewayPath: candidate.path,
            upstreamBaseUrl: api.upstreamBaseUrl,
            upstreamPath: api.upstreamPath || '',
            allowedMethods: api.allowedMethods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
            timeoutMs: api.timeoutMs || 30000,
            maxRequestBytes: api.maxRequestBytes || 10485760,
            maxResponseBytes: api.maxResponseBytes || 10485760,
            status: api.status,
            cachePolicy: api.cachePolicy,
          };

          await this.redis.set(`gateway:api:${candidate.path}`, JSON.stringify(routeConfig), 'EX', 60);
          return { route: routeConfig, subPath: candidate.subPath };
        } else {
          // Default fallback configuration when database seed is pending
          const defaultRouteConfig: RouteConfig = {
            id: 'rootx-vehicle-osint',
            name: 'RootX Vehicle Intelligence OSINT (Vehicle2-N)',
            slug: 'vehicle2-n',
            gatewayPath: candidate.path,
            upstreamBaseUrl: 'https://rootx-osint.in',
            upstreamPath: '/?type=v_num&key=Axn_personal',
            allowedMethods: ['GET', 'POST', 'OPTIONS'],
            timeoutMs: 30000,
            maxRequestBytes: 10485760,
            maxResponseBytes: 10485760,
            status: 'active',
          };

          await this.redis.set(`gateway:api:${candidate.path}`, JSON.stringify(defaultRouteConfig), 'EX', 60);
          return { route: defaultRouteConfig, subPath: candidate.subPath };
        }
      }
    }

    return null;
  }
}
