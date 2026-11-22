import { ApiCatalog } from '../database/models/index.js';
import { NotFoundError, ConflictError, UniversalRequestAnalyzer, encryptSecret } from '@arjun/shared';
import { logAdminAction } from './audit.service.js';
import { getRedisClient } from './redis.service.js';
import { request } from 'undici';

export class CatalogService {
  static async listApis(filters: { category?: string; status?: string; search?: string } = {}) {
    const query: Record<string, unknown> = {};
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { gatewayPath: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }
    const apis = await ApiCatalog.find(query).sort({ createdAt: -1 }).lean();
    const redis = getRedisClient();
    for (const api of apis) {
      try {
        const cachedQuota = await redis.get(`gateway:upstream_quota:${api._id}`);
        if (cachedQuota) {
          (api as any).upstreamQuota = JSON.parse(cachedQuota);
        }
      } catch {}
    }
    return apis;
  }

  static async getApiById(id: string) {
    const api = await ApiCatalog.findById(id).lean();
    if (!api) throw new NotFoundError('API endpoint not found');
    const redis = getRedisClient();
    try {
      const cachedQuota = await redis.get(`gateway:upstream_quota:${api._id}`);
      if (cachedQuota) {
        (api as any).upstreamQuota = JSON.parse(cachedQuota);
      }
    } catch {}
    return api;
  }

  static async createApi(data: any, adminId: string, adminUsername: string, sourceIp: string) {
    const existing = await ApiCatalog.findOne({
      $or: [{ slug: data.slug.toLowerCase() }, { gatewayPath: data.gatewayPath }],
    });
    if (existing) {
      throw new ConflictError('An API with this slug or gateway path already exists');
    }

    const api = await ApiCatalog.create({
      ...data,
      slug: data.slug.toLowerCase(),
      gatewayPath: data.gatewayPath.startsWith('/') ? data.gatewayPath : `/${data.gatewayPath}`,
    });

    const redis = getRedisClient();
    await redis.del('gateway:catalog');

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'API_ENDPOINT_CREATED',
      resourceType: 'api_catalog',
      resourceId: api._id.toString(),
      afterState: { name: api.name, gatewayPath: api.gatewayPath },
      sourceIp,
      result: 'success',
    });

    return api;
  }

  static async updateApi(id: string, updates: any, adminId: string, adminUsername: string, sourceIp: string) {
    const api = await ApiCatalog.findById(id);
    if (!api) throw new NotFoundError('API endpoint not found');

    const beforeState = api.toObject() as any;
    Object.assign(api, updates);
    await api.save();

    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${api.gatewayPath}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'API_ENDPOINT_UPDATED',
      resourceType: 'api_catalog',
      resourceId: api._id.toString(),
      beforeState,
      afterState: api.toObject() as any,
      sourceIp,
      result: 'success',
    });

    return api;
  }

  static async deleteApi(id: string, adminId: string, adminUsername: string, sourceIp: string) {
    const api = await ApiCatalog.findById(id);
    if (!api) throw new NotFoundError('API endpoint not found');

    await ApiCatalog.findByIdAndDelete(id);

    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${api.gatewayPath}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'API_ENDPOINT_DELETED',
      resourceType: 'api_catalog',
      resourceId: id,
      sourceIp,
      result: 'success',
    });

    return { success: true };
  }

  static async toggleStatus(id: string, status: 'active' | 'disabled' | 'maintenance', adminId: string, adminUsername: string, sourceIp: string) {
    const api = await ApiCatalog.findById(id);
    if (!api) throw new NotFoundError('API endpoint not found');

    api.status = status;
    await api.save();

    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${api.gatewayPath}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: `API_ENDPOINT_STATUS_${status.toUpperCase()}`,
      resourceType: 'api_catalog',
      resourceId: id,
      sourceIp,
      result: 'success',
    });

    return api;
  }

  static async testConnectivity(id: string) {
    const api = await ApiCatalog.findById(id);
    if (!api) throw new NotFoundError('API endpoint not found');

    const targetUrl = `${api.upstreamBaseUrl.replace(/\/$/, '')}${api.upstreamPath || ''}`;
    const start = Date.now();

    try {
      const response = await request(targetUrl, {
        method: 'GET',
        headersTimeout: 5000,
        bodyTimeout: 5000,
      });

      const latencyMs = Date.now() - start;
      const isHealthy = response.statusCode >= 200 && response.statusCode < 500;

      api.healthCheck.lastStatus = isHealthy ? 'healthy' : 'unhealthy';
      api.healthCheck.lastLatencyMs = latencyMs;
      api.healthCheck.lastCheckedAt = new Date();
      await api.save();

      return {
        success: isHealthy,
        statusCode: response.statusCode,
        latencyMs,
        targetUrl,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      api.healthCheck.lastStatus = 'unhealthy';
      api.healthCheck.lastLatencyMs = latencyMs;
      api.healthCheck.lastCheckedAt = new Date();
      api.healthCheck.failureCount = (api.healthCheck.failureCount || 0) + 1;
      await api.save();

      return {
        success: false,
        error: err.message,
        latencyMs,
        targetUrl,
      };
    }
  }

  static async autoConnectApi(
    targetUrl: string,
    customName?: string,
    customCategory?: string,
    adminId = 'admin',
    adminUsername = 'admin',
    sourceIp = '127.0.0.1'
  ) {
    const rawInput = targetUrl.trim();
    if (!rawInput) {
      throw new Error('Please enter an API URL or cURL command.');
    }

    // 1. Analyze the input universally (URL, cURL, OpenAPI, with/without key)
    const analyzed = UniversalRequestAnalyzer.analyze(rawInput);

    const upstreamBaseUrl = analyzed.upstreamBaseUrl;
    const upstreamPath = analyzed.upstreamPath;

    let baseDomain = 'service';
    try {
      const parsedUrl = new URL(upstreamBaseUrl);
      const hostParts = parsedUrl.hostname.replace(/^www\./, '').split('.');
      baseDomain = hostParts[0] === 'api' && hostParts[1] ? hostParts[1] : hostParts[0] || 'service';
    } catch {}

    const name = customName && customName.trim()
      ? customName.trim()
      : (analyzed.name || `${baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1)} API`);

    let baseSlug = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!baseSlug) baseSlug = `${baseDomain.toLowerCase()}-api`;

    let slug = baseSlug;
    let gatewayPath = `/${slug}`;
    let counter = 1;

    while (await ApiCatalog.findOne({ $or: [{ slug }, { gatewayPath }] })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
      gatewayPath = `/${slug}`;
    }

    let authConfig = analyzed.authConfig;
    if (analyzed.parameterMappings) {
      const secretMapping = analyzed.parameterMappings.find(
        (m: any) => m.isProviderCredential && m.staticValue
      );
      if (secretMapping && secretMapping.staticValue) {
        authConfig = {
          type: secretMapping.providerIn === 'header' ? 'api_key_header' : 'api_key_query',
          paramName: secretMapping.providerName,
          encryptedCredential: encryptSecret(String(secretMapping.staticValue)),
          credentialPrefix: '••••••••',
        };
      }
    }

    const api = await ApiCatalog.create({
      name,
      slug,
      description: `Universal Gateway for ${upstreamBaseUrl}`,
      category: customCategory || 'Main APIs',
      version: 'v1',
      gatewayPath,
      upstreamBaseUrl,
      upstreamPath,
      upstreamMethod: (analyzed.method as any) || 'GET',
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      timeoutMs: 30000,
      status: 'active',
      authenticationRequired: true,
      allowedPlans: ['*'],
      authConfig,
      parameterDefinitions: analyzed.parameterDefinitions,
      parameterMappings: analyzed.parameterMappings,
      requestBodyType: analyzed.requestBodyType,
      originalCurl: rawInput.startsWith('curl') ? rawInput : `curl "${rawInput}"`,
      sampleRequest: {
        queryParams: analyzed.sampleQueryParams,
        headers: analyzed.sampleHeaders,
        body: analyzed.sampleBody,
      },
      cachePolicy: { enabled: true, ttlSeconds: 60, cacheMethods: ['GET'], respectUpstreamCacheControl: true },
      responseEnvelope: 'wrap',
    });

    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${gatewayPath}`);

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'API_ENDPOINT_CREATED',
      resourceType: 'api_catalog',
      resourceId: api._id.toString(),
      afterState: { name: api.name, gatewayPath: api.gatewayPath, upstreamBaseUrl },
      sourceIp,
      result: 'success',
    });

    return api;
  }
}
