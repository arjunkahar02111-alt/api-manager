import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import {
  AnalyzeApiInputSchema,
  ValidateApiInputSchema,
  PublishImportedApiSchema,
} from '@arjun/schemas';
import {
  UniversalRequestAnalyzer,
  ClientPackageGenerator,
  encryptSecret,
  sendSuccess,
  NotFoundError,
  ConflictError,
  ResponseCacheManager,
} from '@arjun/shared';
import { ApiCatalog } from '../../database/models/index.js';
import { ApiValidationRunner } from '../../services/apiValidationRunner.js';
import { getRedisClient } from '../../services/redis.service.js';
import { logAdminAction } from '../../services/audit.service.js';

const router = Router();
router.use(requireAdminAuth);

/**
 * 1. Analyze cURL, OpenAPI, Postman, or URL input
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const validated = AnalyzeApiInputSchema.parse(req.body);
    const result = UniversalRequestAnalyzer.analyze(
      validated.rawInput,
      validated.inputType,
      validated.sampleRequest
    );
    return sendSuccess(res, result, 'API structure and parameters analyzed successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Pre-Flight Live Validation Runner
 */
router.post('/validate', async (req, res, next) => {
  try {
    const validated = ValidateApiInputSchema.parse(req.body);

    // If an unencrypted credential value was supplied in authConfig, encrypt it for the test
    let authConfig = validated.authConfig;
    if (authConfig && authConfig.credentialValue) {
      authConfig = {
        ...authConfig,
        encryptedCredential: encryptSecret(authConfig.credentialValue),
        credentialPrefix: authConfig.credentialValue.length > 8
          ? `${authConfig.credentialValue.substring(0, 4)}...${authConfig.credentialValue.slice(-4)}`
          : '••••••••',
      };
    }

    const report = await ApiValidationRunner.runValidation({
      name: validated.name,
      upstreamBaseUrl: validated.upstreamBaseUrl,
      upstreamPath: validated.upstreamPath,
      method: validated.method,
      authConfig,
      parameterMappings: validated.parameterMappings as any,
      requestBodyType: validated.requestBodyType,
      sampleBody: validated.sampleBody,
      sampleQueryParams: validated.sampleQueryParams,
      sampleHeaders: validated.sampleHeaders,
      timeoutMs: validated.timeoutMs,
    });

    return sendSuccess(res, report, 'Pre-flight validation completed');
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Publish Validated Endpoint
 */
router.post('/publish', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = PublishImportedApiSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Ensure slug and gatewayPath uniqueness
    let slug = validated.slug.toLowerCase();
    let gatewayPath = validated.gatewayPath.startsWith('/') ? validated.gatewayPath : `/${validated.gatewayPath}`;
    let counter = 1;
    const baseSlug = slug;

    while (await ApiCatalog.findOne({ $or: [{ slug }, { gatewayPath }] })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
      gatewayPath = `/${slug}`;
    }

    // Encrypt provider secret if present
    let authConfig = validated.authConfig;
    if (authConfig && authConfig.credentialValue) {
      authConfig = {
        type: authConfig.type,
        paramName: authConfig.paramName,
        encryptedCredential: encryptSecret(authConfig.credentialValue),
        credentialPrefix: authConfig.credentialValue.length > 8
          ? `${authConfig.credentialValue.substring(0, 4)}...${authConfig.credentialValue.slice(-4)}`
          : '••••••••',
        headerFormat: authConfig.headerFormat,
        basicUsername: authConfig.basicUsername,
      };
    }

    const newApi = await ApiCatalog.create({
      name: validated.name,
      slug,
      description: validated.description || `Imported API: ${validated.name}`,
      category: validated.category || 'Imported APIs',
      version: validated.version || 'v1',
      gatewayPath,
      upstreamBaseUrl: validated.upstreamBaseUrl,
      upstreamPath: validated.upstreamPath,
      allowedMethods: validated.allowedMethods,
      authConfig,
      parameterDefinitions: validated.parameterDefinitions,
      parameterMappings: validated.parameterMappings,
      requestBodyType: validated.requestBodyType,
      responseEnvelope: validated.responseEnvelope || 'preserve',
      cachePolicy: validated.cachePolicy,
      timeoutMs: validated.timeoutMs,
      originalCurl: validated.originalCurl,
      sampleRequest: validated.sampleRequest,
      sampleResponse: validated.sampleResponse,
      status: 'active',
      allowedPlans: validated.allowedPlans || ['*'],
    });

    // Invalidate Redis Route Cache
    const redis = getRedisClient();
    await redis.del('gateway:catalog');
    await redis.del(`gateway:api:${gatewayPath}`);

    // Generate Client Delivery Package
    const clientPackage = ClientPackageGenerator.generate({
      apiName: newApi.name,
      slug: newApi.slug,
      gatewayPath: newApi.gatewayPath,
      method: newApi.allowedMethods[0] || 'GET',
      parameterDefinitions: (newApi.parameterDefinitions as any) || [],
      sampleBody: newApi.sampleRequest,
      sampleResponse: newApi.sampleResponse,
      cacheEnabled: newApi.cachePolicy?.enabled,
      cacheTtlSeconds: newApi.cachePolicy?.ttlSeconds,
    });

    await logAdminAction({
      administratorId: req.admin!.id,
      administratorUsername: req.admin!.username,
      action: 'API_ENDPOINT_IMPORTED',
      resourceType: 'api_catalog',
      resourceId: newApi._id.toString(),
      afterState: { name: newApi.name, slug: newApi.slug, gatewayPath: newApi.gatewayPath },
      sourceIp: clientIp,
      result: 'success',
    });

    return sendSuccess(
      res,
      {
        api: newApi,
        clientPackage,
      },
      'API successfully imported and generated on Karvion Gateway',
      201
    );
  } catch (err) {
    next(err);
  }
});

/**
 * 4. Purge Cache for specific API
 */
router.post('/:id/cache/purge', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const api = await ApiCatalog.findById(req.params.id);
    if (!api) throw new NotFoundError('API endpoint not found');

    const redis = getRedisClient();
    const purgedCount = await ResponseCacheManager.purge(redis, api.slug);

    return sendSuccess(res, { purgedCount }, `Cache purged successfully (${purgedCount} keys removed)`);
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Get Client Delivery Package
 */
router.get('/:id/package', async (req, res, next) => {
  try {
    const api = await ApiCatalog.findById(req.params.id);
    if (!api) throw new NotFoundError('API endpoint not found');

    const clientPackage = ClientPackageGenerator.generate({
      apiName: api.name,
      slug: api.slug,
      gatewayPath: api.gatewayPath,
      method: api.allowedMethods[0] || 'GET',
      parameterDefinitions: (api.parameterDefinitions as any) || [],
      sampleBody: api.sampleRequest,
      sampleResponse: api.sampleResponse,
      cacheEnabled: api.cachePolicy?.enabled,
      cacheTtlSeconds: api.cachePolicy?.ttlSeconds,
    });

    return sendSuccess(res, clientPackage);
  } catch (err) {
    next(err);
  }
});

export default router;
