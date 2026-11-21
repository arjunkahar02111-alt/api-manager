import { ResponseConfig, IResponseConfig } from '../database/models/index.js';
import { getRedisClient } from './redis.service.js';
import { SocketService } from './socket.service.js';
import { logAdminAction } from './audit.service.js';

export const DEFAULT_RESPONSE_CONFIG: Omit<IResponseConfig, 'createdAt' | 'updatedAt'> = {
  configKey: 'global',
  includeEnvelope: true,
  includeAnnouncement: true,
  includeRequestId: true,
  includeApiVersion: true,
  includeRateLimit: true,
  includeTimestamp: true,
  customSuccessMessage: 'Request executed successfully',
  customErrorMessage: 'Request processing error',
  customHeaders: {},
  errorTemplates: {},
  deprecationNotice: {
    enabled: false,
    warningMessage: 'This API version will be deprecated soon.',
  },
  maintenanceEnvelope: {
    statusCode: 503,
    code: 'MAINTENANCE_ACTIVE',
    message: 'This API service is currently undergoing scheduled maintenance.',
    retryAfterSec: 300,
  },
  updatedBy: 'system',
};

export class ResponseConfigService {
  private static readonly CACHE_TTL = 3600; // 1 hour

  /**
   * Fetch active response envelope configuration (Redis cached)
   */
  static async getConfig(configKey = 'global'): Promise<IResponseConfig> {
    const redis = getRedisClient();
    const cacheKey = `response:config:${configKey}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    let config = await ResponseConfig.findOne({ configKey }).lean();
    if (!config) {
      config = (await ResponseConfig.create({
        ...DEFAULT_RESPONSE_CONFIG,
        configKey,
      })) as any;
    }

    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
    } catch {}

    return config as IResponseConfig;
  }

  /**
   * Update response envelope configuration and invalidate Redis cache
   */
  static async updateConfig(
    configKey: string,
    data: Partial<IResponseConfig>,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ): Promise<IResponseConfig> {
    const updated = await ResponseConfig.findOneAndUpdate(
      { configKey },
      { ...data, updatedBy: adminUsername },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const redis = getRedisClient();
    const cacheKey = `response:config:${configKey}`;
    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(updated));
    } catch {}

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'RESPONSE_CONFIG_UPDATED',
      resourceType: 'response_config',
      resourceId: configKey,
      afterState: data as any,
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('response:config:updated', updated);
    return updated as IResponseConfig;
  }
}
