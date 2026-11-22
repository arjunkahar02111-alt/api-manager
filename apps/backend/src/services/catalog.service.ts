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
    return ApiCatalog.find(query).sort({ createdAt: -1 });
  }

  static async getApiById(id: string) {
    const api = await ApiCatalog.findById(id);
    if (!api) throw new NotFoundError('API endpoint not found');
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
    let urlObj: URL;
    try {
      urlObj = new URL(targetUrl.trim());
    } catch {
      throw new Error('Invalid URL. Please enter a valid HTTP/HTTPS URL (e.g. https://api.example.com/v1/resource)');
    }

    const upstreamBaseUrl = urlObj.origin;
    const upstreamPath = `${urlObj.pathname}${urlObj.search}`;

    const hostParts = urlObj.hostname.replace(/^www\./, '').split('.');
    const baseDomain = hostParts[0] || 'service';

    const name = customName && customName.trim()
      ? customName.trim()
      : `${baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1)} API`;

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

    const analyzed = UniversalRequestAnalyzer.analyze(targetUrl.trim());
    let authConfig = analyzed.authConfig;
    if (analyzed.parameterMappings) {
      const secretMapping = analyzed.parameterMappings.find(
        (m: any) => m.isProviderCredential && m.staticValue
      );
      if (secretMapping && secretMapping.staticValue) {
        authConfig = {
          type: 'api_key_query',
          paramName: secretMapping.providerName,
          encryptedCredential: encryptSecret(String(secretMapping.staticValue)),
          credentialPrefix: '••••••••',
        };
      }
    }

    const api = await ApiCatalog.create({
      name,
      slug,
      description: `Auto-connected gateway for ${upstreamBaseUrl}`,
      category: customCategory || 'Main APIs',
      version: 'v1',
      gatewayPath,
      upstreamBaseUrl,
      upstreamPath,
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      timeoutMs: 30000,
      status: 'active',
      authenticationRequired: true,
      allowedPlans: ['*'],
      authConfig,
      parameterDefinitions: analyzed.parameterDefinitions,
      parameterMappings: analyzed.parameterMappings,
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
