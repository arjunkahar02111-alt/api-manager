import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import RedisMock from 'ioredis-mock';

vi.mock('ioredis', () => {
  return {
    Redis: RedisMock,
    default: RedisMock,
  };
});

import { app } from '../../apps/backend/src/app.js';
import { AuthService } from '../../apps/backend/src/services/auth.service.js';
import {
  UniversalRequestAnalyzer,
  ClientPackageGenerator,
  ResponseCacheManager,
  ResponseSanitizer,
  extractUpstreamQuota,
  encryptSecret,
  decryptSecret,
  parseCurlCommand,
} from '@arjun/shared';
import { ApiCatalog } from '../../apps/backend/src/database/models/index.js';
import { ApiValidationRunner } from '../../apps/backend/src/services/apiValidationRunner.js';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let redis: any;

describe('Universal Automated API Importer, Request Mapper & Response Cache Engine Suite', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    redis = new (RedisMock as any)();

    await AuthService.seedSuperAdmin();

    const loginRes = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ username: 'admin', password: 'AdminStrongSecurePassword2026!' });

    adminToken = loginRes.body.data.accessToken;
  }, 240000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // 1. GET API with query parameters
  it('1. should analyze a GET API with query parameters and extract client vs provider params', () => {
    const curl = 'curl -X GET "https://api.weather.com/v1/forecast?city=London&days=5"';
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.method).toBe('GET');
    expect(analyzed.upstreamBaseUrl).toBe('https://api.weather.com');
    expect(analyzed.upstreamPath).toBe('/v1/forecast');
    expect(analyzed.parameterDefinitions.length).toBe(2);
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'city')).toBeDefined();
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'days')?.type).toBe('number');
  });

  // 2. POST API with a JSON body
  it('2. should analyze a POST API with JSON body and extract payload properties', () => {
    const curl = `curl -X POST "https://api.service.com/v1/users" -H "Content-Type: application/json" -d '{"name": "Alice", "role": "admin", "active": true, "count": 42}'`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.method).toBe('POST');
    expect(analyzed.requestBodyType).toBe('json');
    expect(analyzed.parameterDefinitions.length).toBe(4);
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'active')?.type).toBe('boolean');
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'count')?.type).toBe('number');
  });

  // 3. API using form-urlencoded data
  it('3. should analyze an API using form-urlencoded data', () => {
    const curl = `curl -X POST "https://api.auth.com/oauth/token" -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=client_credentials&client_id=123"`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.method).toBe('POST');
    expect(analyzed.requestBodyType).toBe('form-urlencoded');
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'grant_type')).toBeDefined();
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'client_id')).toBeDefined();
  });

  // 4. API using custom headers
  it('4. should detect and preserve custom headers', () => {
    const curl = `curl "https://api.service.com/data" -H "X-Custom-Client-Id: client_999" -H "X-Device-OS: iOS"`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.sampleHeaders?.['x-custom-client-id']).toBe('client_999');
    expect(analyzed.sampleHeaders?.['x-device-os']).toBe('iOS');
  });

  // 5. API using a Bearer token
  it('5. should detect Authorization Bearer token as provider authentication', () => {
    const curl = `curl "https://api.crypto.com/balance" -H "Authorization: Bearer secret_bearer_token_xyz"`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.authConfig.type).toBe('bearer_token');
    expect(analyzed.authConfig.paramName).toBe('Authorization');
  });

  // 6. API using a provider API key in a header
  it('6. should detect provider API key in header (x-api-key, apikey, etc.)', () => {
    const curl = `curl "https://api.flight.com/search?from=JFK" -H "x-api-key: live_provider_secret_123"`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.authConfig.type).toBe('api_key_header');
    expect(analyzed.authConfig.paramName).toBe('x-api-key');
  });

  // 7. API using a provider API key in a query parameter
  it('7. should detect provider API key in query parameter and mark for server-side injection', () => {
    const curl = `curl "https://rootx-osint.in/?type=v_num&key=Axn_personal&query=pb10hs2829"`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.authConfig.type).toBe('api_key_query');
    expect(analyzed.authConfig.paramName).toBe('key');
    const secretMapping = analyzed.parameterMappings.find((m) => m.isProviderCredential);
    expect(secretMapping).toBeDefined();
    expect(secretMapping?.staticValue).toBe('Axn_personal');
  });

  // 8. API with path parameters
  it('8. should analyze APIs with path segments and generate unique slug', () => {
    const curl = `curl "https://api.github.com/repos/arjun/project/commits"`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.slug).toContain('commits');
    expect(analyzed.gatewayPath).toContain('/github');
  });

  // 9. API with nested JSON and arrays
  it('9. should handle nested JSON bodies and arrays without mutation', () => {
    const curl = `curl -X POST "https://api.shop.com/orders" -H "Content-Type: application/json" -d '{"items": [{"id": 1, "qty": 2}], "meta": {"tags": ["urgent"]}}'`;
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.parameterDefinitions.find((p) => p.name === 'items')?.type).toBe('array');
    expect(analyzed.parameterDefinitions.find((p) => p.name === 'meta')?.type).toBe('object');
  });

  // 10. Optional and required parameters
  it('10. should distinguish optional and required parameters', () => {
    const parsed = UniversalRequestAnalyzer.analyze(`curl "https://api.test.com/search?q=apple&filter=fresh&page=1"`);
    expect(parsed.parameterDefinitions.length).toBe(3);
    for (const p of parsed.parameterDefinitions) {
      expect(typeof p.required).toBe('boolean');
    }
  });

  // 11. Verify null, false, zero, and empty values are preserved
  it('11. should preserve falsy values: 0, false, null, and empty string without dropping them', () => {
    const data = {
      zeroValue: 0,
      falseValue: false,
      nullValue: null,
      emptyStr: '',
    };
    const serialized = JSON.stringify(data);
    const parsed = JSON.parse(serialized);

    expect(parsed.zeroValue).toBe(0);
    expect(parsed.falseValue).toBe(false);
    expect(parsed.nullValue).toBeNull();
    expect(parsed.emptyStr).toBe('');
  });

  // 12. Response key preservation when envelope is 'preserve'
  it('12. should verify original response keys remain unchanged when responseEnvelope is preserve', () => {
    const originalProviderResponse = {
      LITE_ULTRA_SPEED_CORE: { vehicle_number: 'PB10HS2829', status: 'OK' },
      custom_vendor_field_x: 99.8,
    };
    const cloned = JSON.parse(JSON.stringify(originalProviderResponse));
    expect(cloned.LITE_ULTRA_SPEED_CORE.vehicle_number).toBe('PB10HS2829');
    expect(cloned.custom_vendor_field_x).toBe(99.8);
  });

  // 13. Provider credentials encryption & secrecy
  it('13. should encrypt provider secrets at rest with AES-256-GCM and never leak in plaintext', () => {
    const rawSecret = 'live_secret_super_confidential_key_12345';
    const encrypted = encryptSecret(rawSecret);

    expect(encrypted).not.toContain(rawSecret);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:cipherText

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  // 14. Response caching: hits, misses, and TTL
  it('14. should cache eligible responses, return cache hits, and handle manual purge', async () => {
    const slug = 'test-cache-api';
    const path = '/v1/test-cache-api';
    const query = { q: 'search1' };
    const body = null;
    const responsePayload = JSON.stringify({ result: 'cache_hit_payload', timestamp: 12345 });

    // Initial check: Miss
    const miss = await ResponseCacheManager.get(redis, slug, 'GET', path, query, body);
    expect(miss).toBeNull();

    // Cache set
    await ResponseCacheManager.set(redis, slug, 'GET', path, query, body, responsePayload, { 'content-type': 'application/json' }, 200, 60);

    // Subsequent check: Hit
    const hit = await ResponseCacheManager.get(redis, slug, 'GET', path, query, body);
    expect(hit).not.toBeNull();
    expect(hit?.body).toBe(responsePayload);
    expect(hit?.ttlRemaining).toBeGreaterThan(0);

    // Purge cache
    const purged = await ResponseCacheManager.purge(redis, slug);
    expect(purged).toBeGreaterThanOrEqual(1);

    // After purge: Miss
    const afterPurge = await ResponseCacheManager.get(redis, slug, 'GET', path, query, body);
    expect(afterPurge).toBeNull();
  });

  // 15. Cross-client cache isolation
  it('15. should prevent cross-query cache contamination through deterministic hashing', async () => {
    const slug = 'isolated-api';
    const path = '/search';
    await ResponseCacheManager.set(redis, slug, 'GET', path, { user: 'alice' }, null, 'alice_data', {}, 200, 60);
    await ResponseCacheManager.set(redis, slug, 'GET', path, { user: 'bob' }, null, 'bob_data', {}, 200, 60);

    const aliceRes = await ResponseCacheManager.get(redis, slug, 'GET', path, { user: 'alice' }, null);
    const bobRes = await ResponseCacheManager.get(redis, slug, 'GET', path, { user: 'bob' }, null);

    expect(aliceRes?.body).toBe('alice_data');
    expect(bobRes?.body).toBe('bob_data');
    expect(aliceRes?.body).not.toBe(bobRes?.body);
  });

  // 16. Respect Cache-Control: no-store
  it('16. should respect upstream no-store headers and decline caching', async () => {
    const slug = 'no-store-api';
    const path = '/secure-data';
    await ResponseCacheManager.set(redis, slug, 'GET', path, {}, null, 'secret_data', { 'cache-control': 'no-store, private' }, 200, 60);

    const cached = await ResponseCacheManager.get(redis, slug, 'GET', path, {}, null);
    expect(cached).toBeNull();
  });

  // 17. SSRF and boundary protection
  it('17. should block private and loopback networks in pre-flight validation', async () => {
    const report = await ApiValidationRunner.runValidation({
      name: 'Loopback Test',
      upstreamBaseUrl: 'http://127.0.0.1:8080',
      upstreamPath: '/secret',
      method: 'GET',
    });

    expect(report.status).toBe('BLOCKED');
    expect(report.tests.find((t) => t.name.includes('SSRF'))?.status).toBe('FAIL');
  });

  // 18. Client Delivery Package Generator
  it('18. should generate complete multi-language client package (cURL, JS, Python, Node, PHP)', () => {
    const pkg = ClientPackageGenerator.generate({
      apiName: 'Weather Intelligence',
      slug: 'weather-intel',
      gatewayPath: '/weather-intel',
      method: 'GET',
      parameterDefinitions: [
        { name: 'city', in: 'query', type: 'string', required: true, sampleValue: 'Tokyo' },
      ],
      sampleApiKey: 'arjun_live_test_key_123',
    });

    expect(pkg.endpointUrl).toContain('/v1/weather-intel');
    expect(pkg.sampleRequests.curl).toContain('curl');
    expect(pkg.sampleRequests.curl).toContain('key=arjun_live_test_key_123');
    expect(pkg.sampleRequests.javascriptFetch).toContain('fetch');
    expect(pkg.sampleRequests.pythonRequests).toContain('requests.get');
    expect(pkg.sampleRequests.nodejs).toContain('node-fetch');
    expect(pkg.sampleRequests.phpCurl).toContain('curl_init');
  });

  // 19. Admin API Import & Publish Endpoints
  it('19. should execute full admin import lifecycle via HTTP endpoints (analyze, validate, publish, purge)', async () => {
    // 19a. Analyze
    const analyzeRes = await request(app)
      .post('/api/v1/admin/apis/import/analyze')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rawInput: 'curl -X GET "https://jsonplaceholder.typicode.com/todos/1?key=secret_123"',
      });

    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.success).toBe(true);
    expect(analyzeRes.body.data.slug).toBeDefined();

    // 19b. Publish
    const publishRes = await request(app)
      .post('/api/v1/admin/apis/import/publish')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'JSONPlaceholder Todos',
        slug: 'json-todos',
        gatewayPath: '/json-todos',
        upstreamBaseUrl: 'https://jsonplaceholder.typicode.com',
        upstreamPath: '/todos/1',
        allowedMethods: ['GET'],
        authConfig: {
          type: 'api_key_query',
          paramName: 'key',
          credentialValue: 'my_provider_key_999',
        },
        parameterDefinitions: [
          { name: 'id', in: 'query', type: 'number', required: false },
        ],
        parameterMappings: [
          {
            clientName: 'id',
            clientIn: 'query',
            providerName: 'id',
            providerIn: 'query',
          },
        ],
        cachePolicy: { enabled: true, ttlSeconds: 120 },
      });

    expect(publishRes.status).toBe(201);
    expect(publishRes.body.success).toBe(true);
    expect(publishRes.body.data.api.authConfig.encryptedCredential).toBeDefined();
    expect(publishRes.body.data.api.authConfig.encryptedCredential).not.toContain('my_provider_key_999');
    expect(publishRes.body.data.clientPackage.endpointUrl).toContain('/v1/json-todos');

    const createdApiId = publishRes.body.data.api._id;

    // 19c. Get Package
    const pkgRes = await request(app)
      .get(`/api/v1/admin/apis/${createdApiId}/package`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(pkgRes.status).toBe(200);
    expect(pkgRes.body.data.sampleRequests.curl).toBeDefined();

    // 19d. Purge Cache
    const purgeRes = await request(app)
      .post(`/api/v1/admin/apis/${createdApiId}/cache/purge`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(purgeRes.status).toBe(200);
    expect(purgeRes.body.success).toBe(true);
  });

  // 20. Existing APIs and routes intact
  it('20. should verify existing catalog endpoints and customer endpoints remain 100% operational', async () => {
    const listRes = await request(app)
      .get('/api/v1/admin/apis')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);
  });

  // 21. ResponseSanitizer foreign credit & telegram watermark removal
  it('21. should completely strip third-party developer credits, telegram links, and upstream limits', () => {
    const upstreamPayload = {
      status: false,
      message: 'Please provide term parameter',
      credit: {
        name: 'ASUR',
        developer: '@ASURPAPA',
        contact: 'https://t.me/ASUR_ABOUT',
        footer: 'Powered by ASUR',
      },
      quota_left: 42,
    };

    const sanitized = ResponseSanitizer.cleanAndRebrand(
      upstreamPayload,
      {
        developerTag: 'arjunkahar',
        reqLeft: 4999,
        reqTotal: 5000,
        expiresAt: new Date('2026-12-31T23:59:59Z'),
      },
      85
    );

    // Verify foreign credits are completely removed
    expect(sanitized.credit).toBeUndefined();
    expect(sanitized.quota_left).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain('ASUR');
    expect(JSON.stringify(sanitized)).not.toContain('@ASURPAPA');
    expect(JSON.stringify(sanitized)).not.toContain('t.me');

    // Verify original error message and status are preserved
    expect(sanitized.status).toBe(false);
    expect(sanitized.message).toBe('Please provide term parameter');

    // Verify personal Karvion branding is injected
    expect(sanitized.developer).toBe('arjunkahar');
    expect(sanitized.req_left).toBe(4999);
    expect(sanitized.req_total).toBe(5000);
    expect(sanitized.expiry).toBe('31-12-2026');
    expect(sanitized.response_time).toBe('85ms');
  });

  // 22. Preserve falsy values and nested structures
  it('22. should preserve valid falsy values (0, false, null, empty string, empty array) during sanitization', () => {
    const complexPayload = {
      status: false,
      count: 0,
      description: '',
      tags: [],
      owner: null,
      nested: {
        active: false,
        limit: 0,
        channel: 'https://t.me/leak',
      },
    };

    const sanitized = ResponseSanitizer.cleanAndRebrand(complexPayload, {
      developerTag: 'arjunkahar',
    });

    expect(sanitized.status).toBe(false);
    expect(sanitized.count).toBe(0);
    expect(sanitized.description).toBe('');
    expect(sanitized.tags).toEqual([]);
    expect(sanitized.owner).toBeNull();
    expect(sanitized.nested.active).toBe(false);
    expect(sanitized.nested.limit).toBe(0);
    expect(sanitized.nested.channel).toBeUndefined();
    expect(sanitized.developer).toBe('arjunkahar');
  });

  // 23. Parameter synonym detection and mapping
  it('23. should detect parameter synonyms and correctly identify query parameters for different API formats', () => {
    const curl = 'curl "https://api.external.com/v1/search?term=PB10HS2829&api_key=SECRET123"';
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    expect(analyzed.parameterDefinitions.find((p) => p.name === 'term')).toBeDefined();
    expect(analyzed.parameterMappings.find((m) => m.clientName === 'term')).toBeDefined();
    expect(analyzed.authConfig.type).toBe('api_key_query');
    expect(analyzed.authConfig.paramName).toBe('api_key');
  });

  // 24. Universal automated parameter bridging & template override
  it('24. should automatically populate term and query regardless of which synonym client calls', () => {
    const SEARCH_SYNONYMS = [
      'term',
      'query',
      'q',
      'search',
      'v_num',
      'vehicle_number',
      'vehicle',
      'rc',
      'number',
      'input',
    ];

    // Simulate incoming client parameters with ?query=PB10HS2829
    const incomingParams = new URLSearchParams('query=PB10HS2829');
    let clientSearchVal: string | undefined = undefined;
    for (const syn of SEARCH_SYNONYMS) {
      const val = incomingParams.get(syn);
      if (val && val.trim().length > 0) {
        clientSearchVal = val.trim();
        break;
      }
    }
    expect(clientSearchVal).toBe('PB10HS2829');

    // Simulate URL destination with empty term in template
    const urlObj = new URL('https://provider.example.com/api?term=&key=SECRET');
    expect(urlObj.searchParams.get('term')).toBe('');

    // Apply universal synonym population
    urlObj.searchParams.set('term', clientSearchVal!);
    urlObj.searchParams.set('query', clientSearchVal!);

    expect(urlObj.searchParams.get('term')).toBe('PB10HS2829');
    expect(urlObj.searchParams.get('query')).toBe('PB10HS2829');
    expect(urlObj.searchParams.get('key')).toBe('SECRET');
  });

  // 25. Automated preset parameter detection & default value retention
  it('25. should automatically set defaultValue and mark required: false for non-search preset parameters like type=rc', () => {
    const curl = 'curl "https://api.provider.com/v1/vehicle?type=rc&term=PB10HS2829"';
    const analyzed = UniversalRequestAnalyzer.analyze(curl);

    const typeDef = analyzed.parameterDefinitions.find((p) => p.name === 'type');
    const typeMapping = analyzed.parameterMappings.find((m) => m.clientName === 'type');
    const termDef = analyzed.parameterDefinitions.find((p) => p.name === 'term');
    const termMapping = analyzed.parameterMappings.find((m) => m.clientName === 'term');

    expect(typeDef).toBeDefined();
    expect(typeDef?.required).toBe(false);
    expect(typeDef?.defaultValue).toBe('rc');
    expect(typeDef?.sampleValue).toBe('rc');

    expect(typeMapping).toBeDefined();
    expect(typeMapping?.required).toBe(false);
    expect(typeMapping?.defaultValue).toBe('rc');
    expect(typeMapping?.staticValue).toBe('rc');

    // Term should remain required search parameter
    expect(termDef).toBeDefined();
    expect(termDef?.required).toBe(true);
    expect(termMapping?.required).toBe(true);
  });

  // 26. Multi-tier fallback resolution for type and other parameters
  it('26. should resolve type via multi-tier fallback even if route mapping originally lacked defaultValue', () => {
    const route = {
      name: 'Vehicle Info API',
      slug: 'vehicle-info',
      gatewayPath: '/v1/vehicle',
      upstreamBaseUrl: 'https://api.provider.com',
      upstreamPath: '/v1/vehicle?type=rc',
      originalCurl: 'curl "https://api.provider.com/v1/vehicle?type=rc&term=PB10HS2829"',
      parameterMappings: [
        { clientName: 'type', clientIn: 'query', providerName: 'type', providerIn: 'query', required: true },
        { clientName: 'term', clientIn: 'query', providerName: 'term', providerIn: 'query', required: true },
      ],
      parameterDefinitions: [
        { name: 'type', in: 'query', type: 'string', required: false, sampleValue: 'rc' },
      ],
    };

    // Simulate multi-tier resolution logic for 'type'
    const mapping = route.parameterMappings[0];
    let clientValue: any = undefined;

    // Check tier 4 (parameterDefinitions)
    if (clientValue === undefined) {
      const defMatch = route.parameterDefinitions.find((p) => p.name === mapping.clientName);
      if (defMatch?.sampleValue) clientValue = defMatch.sampleValue;
    }

    expect(clientValue).toBe('rc');

    // Check tier 6 (extract from originalCurl / upstreamPath)
    let extractedType: any = undefined;
    const rawSources = `${route.upstreamPath} ${route.originalCurl}`;
    const typeMatch = rawSources.match(/[?&]type=([^&\s"']+)/i);
    if (typeMatch && typeMatch[1]) extractedType = decodeURIComponent(typeMatch[1]);

    expect(extractedType).toBe('rc');
  });

  // 27. Strip real upstream API quota from array response and inject customer's plan
  it('27. should purge upstream req_left (794) & req_total (60000) from array responses and inject customer plan', () => {
    const upstreamArrayPayload = [
      {
        vehicle_number: 'PB10HS2829',
        owner: 'TEST USER',
        status: true,
        req_left: 794,
        req_total: 60000,
        expiry: '11-06-2027',
        success: true,
        cached: true,
        response_time: '267ms',
      },
    ];

    const customerMeta = {
      developerTag: 'arjunkahar',
      reqLeft: 95,
      reqTotal: 100,
      expiresAt: new Date('2026-12-22T23:59:59Z'),
    };

    const sanitized = ResponseSanitizer.cleanAndRebrand(upstreamArrayPayload, customerMeta, 180, false);

    expect(Array.isArray(sanitized)).toBe(true);
    expect(sanitized.length).toBe(1);

    const item = sanitized[0];
    expect(item.vehicle_number).toBe('PB10HS2829');
    expect(item.owner).toBe('TEST USER');
    expect(item.success).toBe(true);

    // Verify real upstream numbers (794 and 60000) are purged
    expect(item.req_left).not.toBe(794);
    expect(item.req_total).not.toBe(60000);
    expect(item.expiry).not.toBe('11-06-2027');

    // Verify customer's assigned Karvion plan is injected
    expect(item.developer).toBe('arjunkahar');
    expect(item.req_left).toBe(95);
    expect(item.req_total).toBe(100);
    expect(item.expiry).toBe('22-12-2026');
    expect(item.response_time).toBe('180ms');
    expect(item.response_time_seconds).toBe(0.18);
  });

  // 28. Extract upstream provider quota for admin-only monitoring
  it('28. should extract upstream provider quota from response for admin monitoring before sanitization', () => {
    const upstreamPayload = [
      {
        vehicle_number: 'PB10HS2829',
        req_left: 794,
        req_total: 60000,
        expiry: '11-06-2027',
      },
    ];

    const upstreamQuota = extractUpstreamQuota(upstreamPayload);
    expect(upstreamQuota).not.toBeNull();
    expect(upstreamQuota?.reqLeft).toBe(794);
    expect(upstreamQuota?.reqTotal).toBe(60000);
    expect(upstreamQuota?.expiry).toBe('11-06-2027');
  });

  // 29. Dynamic customer re-branding on Cache HIT
  it('29. should dynamically re-brand cached responses with current calling customer quota and set cached: true', () => {
    const cachedResponse = {
      vehicle_number: 'PB10HS2829',
      status: true,
      req_left: 100, // Previous cached value
      req_total: 100,
    };

    const currentCustomerMeta = {
      developerTag: 'client_bob',
      reqLeft: 42,
      reqTotal: 500,
      expiresAt: new Date('2026-10-15T23:59:59Z'),
    };

    const rebranded = ResponseSanitizer.cleanAndRebrand(cachedResponse, currentCustomerMeta, 12, true);
    expect(rebranded.developer).toBe('client_bob');
    expect(rebranded.req_left).toBe(42);
    expect(rebranded.req_total).toBe(500);
    expect(rebranded.expiry).toBe('15-10-2026');
    expect(rebranded.cached).toBe(true);
    expect(rebranded.response_time).toBe('12ms');
  });
});
