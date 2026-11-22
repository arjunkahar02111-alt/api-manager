import type { Request, Response } from 'express';
import { request } from 'undici';
import zlib from 'node:zlib';
import { decompress as decompressZstd } from 'fzstd';
import { RouteConfig } from '../routing/routeResolver.js';
import { validateUpstreamUrl } from '../security/ssrfGuard.js';
import { UpstreamError, decryptSecret, ResponseSanitizer, extractUpstreamQuota, buildGatewayErrorResponse, formatExpiryDate } from '@arjun/shared';
import { ResponseCacheManager } from '../cache/responseCacheManager.js';
import type { Redis } from 'ioredis';

// Hop-by-hop and transport headers that must never be forwarded
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-api-key',
  'host',
  'expect',
  'content-length',
  'content-encoding',
  'alt-svc',
  'nel',
  'report-to',
]);

// Headers from upstream response that must be stripped to prevent ERR_CONTENT_DECODING_FAILED
const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'alt-svc',
  'nel',
  'report-to',
  'strict-transport-security',
]);

// Search and query parameter synonyms for automatic bridging across diverse API formats
const SEARCH_SYNONYMS = [
  'term',
  'query',
  'q',
  'search',
  'v_num',
  'vehicle_number',
  'vehicle',
  'rc',
  'rc_number',
  'rc_num',
  'rcno',
  'number',
  'num',
  'id',
  'input',
  'keyword',
  'text',
  'license',
  'reg_no',
  'regno',
  'reg_num',
  'registration_number',
  'challan_no',
  'challan',
  'challan_number',
  'dl_no',
  'dl',
  'dlno',
  'driving_license',
  'pan_no',
  'pan',
  'panno',
  'aadhaar',
  'aadhar',
  'aadhaar_no',
  'uid',
  'epic',
  'voter_id',
  'voter',
  'mobile',
  'phone',
  'phone_number',
  'fastag',
  'car_number',
  'car_no',
  'vehicleno',
  'vehicle_num',
  'target',
  'data',
  'value',
  'val',
];

// Decompress upstream binary response (zstd, brotli, gzip, deflate) into a clean Buffer
function decompressBuffer(buffer: Buffer, encodingHeader?: string | string[]): Buffer {
  if (!buffer || buffer.length === 0) return buffer;
  const enc = Array.isArray(encodingHeader)
    ? encodingHeader.join(' ').toLowerCase()
    : String(encodingHeader || '').toLowerCase();

  // 1. Explicit Zstandard (Chrome 123+ & Cloudflare default)
  if (enc.includes('zstd')) {
    try {
      const decomp = decompressZstd(new Uint8Array(buffer));
      return Buffer.from(decomp);
    } catch (e: any) {
      console.warn('[ProxyEngine] Zstd decompress error:', e.message);
    }
  }

  // 2. Explicit Brotli
  if (enc.includes('br') || enc.includes('brotli')) {
    try {
      return zlib.brotliDecompressSync(buffer);
    } catch (e: any) {
      console.warn('[ProxyEngine] Brotli decompress error:', e.message);
    }
  }

  // 3. Explicit Gzip (header or magic bytes 0x1f 0x8b)
  if (enc.includes('gzip') || (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b)) {
    try {
      return zlib.gunzipSync(buffer);
    } catch (e: any) {
      console.warn('[ProxyEngine] Gunzip error:', e.message);
    }
  }

  // 4. Explicit Deflate (header or zlib header bytes)
  if (enc.includes('deflate') || (buffer.length >= 2 && buffer[0] === 0x78)) {
    try {
      return zlib.inflateSync(buffer);
    } catch (e: any) {
      console.warn('[ProxyEngine] Inflate error:', e.message);
    }
  }

  // 5. Universal Auto-Detection: If payload is compressed binary (does not start with valid JSON '{' or '[')
  const first = buffer[0];
  const isPlainJsonOrText =
    first === 0x7b ||
    first === 0x5b ||
    first === 0x20 ||
    first === 0x0a ||
    first === 0x0d ||
    first === 0x09 ||
    first === 0x3c;
  if (!isPlainJsonOrText) {
    try {
      return Buffer.from(decompressZstd(new Uint8Array(buffer)));
    } catch {}
    try {
      return zlib.brotliDecompressSync(buffer);
    } catch {}
    try {
      return zlib.gunzipSync(buffer);
    } catch {}
    try {
      return zlib.inflateSync(buffer);
    } catch {}
  }

  return buffer;
}

export interface ClientResponseMetadata {
  developerTag?: string;
  reqLeft?: number;
  reqTotal?: number;
  expiresAt?: Date | string | null;
  announcement?: any;
}

export interface ProxyResult {
  statusCode: number;
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  upstreamStatus: number;
}

export class ProxyEngine {
  /**
   * Proxies validated customer request to administrator-configured upstream service.
   * Supports ALL HTTP methods, ALL request body formats (JSON, Form URL-encoded, Multipart, Text, XML, Binary),
   * and ALL response types (JSON, Images, PDFs, Audio, Video, CSV, Streaming).
   * Features: Intelligent Response Caching, Universal Parameter Mapping & Server-Side Credential Injection.
   */
  static async forwardRequest(
    req: Request,
    res: Response,
    route: RouteConfig,
    clientMeta?: ClientResponseMetadata,
    subPath?: string,
    redis?: Redis
  ): Promise<ProxyResult> {
    const start = Date.now();

    // 0. Cache Check for eligible requests (GET by default)
    const cacheConfig = route.cachePolicy;
    const isCachingEligible =
      cacheConfig?.enabled &&
      (cacheConfig.cacheMethods || ['GET']).includes(req.method.toUpperCase());

    const clientBypassCache =
      req.headers['cache-control']?.includes('no-cache') ||
      req.headers['x-cache-bypass'] === 'true';

    if (isCachingEligible && !clientBypassCache) {
      const cached = await ResponseCacheManager.get(
        redis,
        route.slug,
        req.method,
        req.path,
        req.query,
        req.body
      );

      if (cached) {
        const duration = Date.now() - start;
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', String(cached.ttlRemaining));
        res.setHeader('X-Developer', clientMeta?.developerTag || 'arjunkahar');
        if (clientMeta?.reqLeft !== undefined) res.setHeader('X-RateLimit-Remaining', String(clientMeta.reqLeft));
        if (clientMeta?.reqTotal !== undefined) res.setHeader('X-RateLimit-Limit', String(clientMeta.reqTotal));
        if (clientMeta?.expiresAt) res.setHeader('X-Expiry-Date', formatExpiryDate(clientMeta.expiresAt));
        res.setHeader('X-Response-Time', `${duration}ms`);

        for (const [k, v] of Object.entries(cached.headers)) {
          if (!res.getHeader(k)) res.setHeader(k, v);
        }

        let cacheBody = cached.body;
        // Dynamically re-brand cached JSON with the current calling client's quota!
        try {
          const rawStr = Buffer.isBuffer(cacheBody) ? cacheBody.toString('utf-8') : String(cacheBody);
          if (rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[')) {
            const parsed = JSON.parse(rawStr);
            const rebranded = ResponseSanitizer.cleanAndRebrand(parsed, clientMeta, duration, true);
            cacheBody = JSON.stringify(rebranded, null, 2);
          }
        } catch {}

        res.status(cached.statusCode).send(cacheBody);
        return {
          statusCode: cached.statusCode,
          durationMs: duration,
          requestBytes: 0,
          responseBytes: Buffer.isBuffer(cacheBody) ? cacheBody.length : Buffer.byteLength(String(cacheBody)),
          upstreamStatus: cached.statusCode,
        };
      }
    }

    // 1. Construct destination URL: upstreamBaseUrl + upstreamPath + subPath + mapped query parameters
    const baseUrl = route.upstreamBaseUrl.replace(/\/$/, '');
    let upstreamPath = route.upstreamPath || '';

    let queryFromUpstream = '';
    const qIdx = upstreamPath.indexOf('?');
    if (qIdx !== -1) {
      queryFromUpstream = upstreamPath.substring(qIdx + 1);
      upstreamPath = upstreamPath.substring(0, qIdx);
    }

    if (subPath) {
      const cleanSub = subPath.startsWith('/') ? subPath : `/${subPath}`;
      upstreamPath = upstreamPath ? `${upstreamPath.replace(/\/$/, '')}${cleanSub}` : cleanSub;
    }

    if (!upstreamPath.startsWith('/')) {
      upstreamPath = `/${upstreamPath}`;
    }

    const urlObj = new URL(`${baseUrl}${upstreamPath}`);

    // Re-apply static query parameters from upstream path configuration
    if (queryFromUpstream) {
      const usp = new URLSearchParams(queryFromUpstream);
      for (const [k, v] of usp.entries()) {
        urlObj.searchParams.set(k, v);
      }
    }

    // Prepare headers container
    const forwardedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lower) && typeof value === 'string') {
        forwardedHeaders[key] = value;
      }
    }
    forwardedHeaders['accept-encoding'] = 'gzip, deflate, br, zstd';
    if (!forwardedHeaders['user-agent']) {
      forwardedHeaders['user-agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    }
    forwardedHeaders['x-forwarded-for'] = req.ip || req.socket.remoteAddress || '127.0.0.1';
    forwardedHeaders['x-forwarded-proto'] = req.protocol;
    forwardedHeaders['x-gateway-id'] = 'arjun-api-manager';

    // Parse incoming client query parameters from originalUrl and Express req.query
    const incomingQueryIdx = req.originalUrl.indexOf('?');
    const incomingClientParams = new URLSearchParams(
      incomingQueryIdx !== -1 ? req.originalUrl.substring(incomingQueryIdx) : ''
    );
    if (req.query && typeof req.query === 'object') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string' && !incomingClientParams.has(k)) {
          incomingClientParams.set(k, v);
        }
      }
    }

    // Parse incoming request body if JSON
    let parsedJsonBody: any = undefined;
    let isJsonRequestBody = false;
    if (req.body) {
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        parsedJsonBody = { ...req.body };
        isJsonRequestBody = true;
      } else {
        const rawStr = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : String(req.body);
        if (rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[')) {
          try {
            parsedJsonBody = JSON.parse(rawStr);
            isJsonRequestBody = typeof parsedJsonBody === 'object' && parsedJsonBody !== null;
          } catch {}
        }
      }
    }

    // Comprehensive client search parameter extraction across synonyms, arbitrary query keys, body, and subPath
    let clientSearchVal: string | undefined = undefined;

    // 1. Check known search synonyms in client request query parameters
    for (const syn of SEARCH_SYNONYMS) {
      const val = incomingClientParams.get(syn);
      if (typeof val === 'string' && val.trim().length > 0 && !val.startsWith('arjun_')) {
        clientSearchVal = val.trim();
        break;
      }
    }

    // 2. Check if client passed any single non-auth query parameter (e.g. ?car=... or ?license=...)
    if (!clientSearchVal) {
      for (const [k, v] of incomingClientParams.entries()) {
        const lk = k.toLowerCase().replace(/[-_]/g, '');
        if (
          lk !== 'api_key' &&
          lk !== 'apikey' &&
          lk !== 'key' &&
          lk !== 'token' &&
          lk !== 'secret' &&
          lk !== 'auth' &&
          lk !== 'authorization' &&
          lk !== 'k'
        ) {
          if (typeof v === 'string' && v.trim().length > 0 && !v.startsWith('arjun_')) {
            clientSearchVal = v.trim();
            break;
          }
        }
      }
    }

    // 3. Check if search parameter was passed via JSON request body
    if (!clientSearchVal && isJsonRequestBody && parsedJsonBody && typeof parsedJsonBody === 'object') {
      for (const syn of SEARCH_SYNONYMS) {
        if (parsedJsonBody[syn] !== undefined && typeof parsedJsonBody[syn] === 'string' && parsedJsonBody[syn].trim().length > 0) {
          clientSearchVal = parsedJsonBody[syn].trim();
          break;
        }
      }
      if (!clientSearchVal) {
        for (const [bk, bv] of Object.entries(parsedJsonBody)) {
          const lbk = bk.toLowerCase().replace(/[-_]/g, '');
          if (
            lbk !== 'api_key' &&
            lbk !== 'apikey' &&
            lbk !== 'key' &&
            lbk !== 'token' &&
            lbk !== 'secret' &&
            lbk !== 'auth' &&
            lbk !== 'authorization' &&
            lbk !== 'k'
          ) {
            if (typeof bv === 'string' && bv.trim().length > 0 && !bv.startsWith('arjun_')) {
              clientSearchVal = bv.trim();
              break;
            }
          }
        }
      }
    }

    // 4. Check if search parameter was passed via path segment (e.g. /v1/vehicle/PB10HS2829)
    if (!clientSearchVal && subPath && subPath.trim().length > 1) {
      const pathSegment = subPath.replace(/^\/+/, '').split('/')[0];
      if (pathSegment && pathSegment.trim().length > 0 && !pathSegment.startsWith('arjun_')) {
        clientSearchVal = pathSegment.trim();
      }
    }

    // 2. Decrypt Provider Secret if configured
    let decryptedSecret: string | undefined = undefined;
    if (route.authConfig?.encryptedCredential) {
      try {
        decryptedSecret = decryptSecret(route.authConfig.encryptedCredential);
      } catch (err: any) {
        console.warn('[ProxyEngine] Failed to decrypt provider credential:', err.message);
      }
    }

    // 3. Universal Parameter Mapping Engine
    const parameterMappings = route.parameterMappings || [];
    const mappedClientQueryKeys = new Set<string>();

    for (const mapping of parameterMappings) {
      if (mapping.clientIn === 'query') {
        mappedClientQueryKeys.add(mapping.clientName);
      }

      // Case A: Server-Side Injected Provider Credential
      if (mapping.isProviderCredential) {
        const secretVal = decryptedSecret || mapping.staticValue || '';
        if (mapping.providerIn === 'query') {
          urlObj.searchParams.set(mapping.providerName, String(secretVal));
        } else if (mapping.providerIn === 'header') {
          forwardedHeaders[mapping.providerName.toLowerCase()] = String(secretVal);
        } else if (mapping.providerIn === 'body' && isJsonRequestBody) {
          parsedJsonBody[mapping.providerName] = secretVal;
        }
        continue;
      }

      // Case B: Static Server Parameter
      if (mapping.isStatic) {
        const staticVal = mapping.staticValue;
        if (mapping.providerIn === 'query') {
          urlObj.searchParams.set(mapping.providerName, String(staticVal ?? ''));
        } else if (mapping.providerIn === 'header') {
          forwardedHeaders[mapping.providerName.toLowerCase()] = String(staticVal ?? '');
        } else if (mapping.providerIn === 'body' && isJsonRequestBody) {
          parsedJsonBody[mapping.providerName] = staticVal;
        }
        continue;
      }

      // Case C: Client Parameter -> Provider Parameter Mapping
      let clientValue: any = undefined;

      if (mapping.clientIn === 'query') {
        if (incomingClientParams.has(mapping.clientName)) {
          clientValue = incomingClientParams.get(mapping.clientName);
        } else {
          // Check search synonyms for resilient parameter mapping
          const lowerName = mapping.clientName.toLowerCase();
          const isSearchSynonym = SEARCH_SYNONYMS.includes(lowerName);
          if (isSearchSynonym) {
            for (const syn of SEARCH_SYNONYMS) {
              if (incomingClientParams.has(syn)) {
                clientValue = incomingClientParams.get(syn);
                break;
              }
            }
          }
        }
      } else if (mapping.clientIn === 'header') {
        clientValue = req.headers[mapping.clientName.toLowerCase()];
      } else if (mapping.clientIn === 'body') {
        if (isJsonRequestBody && parsedJsonBody[mapping.clientName] !== undefined) {
          clientValue = parsedJsonBody[mapping.clientName];
        } else if (isJsonRequestBody && SEARCH_SYNONYMS.includes(mapping.clientName.toLowerCase())) {
          for (const syn of SEARCH_SYNONYMS) {
            if (parsedJsonBody[syn] !== undefined) {
              clientValue = parsedJsonBody[syn];
              break;
            }
          }
        }
      }

      // Automated Multi-Tier Parameter Resolution for clientValue
      if (clientValue === undefined) {
        // Tier 1: Cross-location lookup (e.g. client sent query param for body mapping or body field for query mapping)
        if (mapping.clientIn === 'query') {
          if (isJsonRequestBody && parsedJsonBody?.[mapping.clientName] !== undefined) {
            clientValue = parsedJsonBody[mapping.clientName];
          } else if (req.headers[mapping.clientName.toLowerCase()] !== undefined) {
            clientValue = req.headers[mapping.clientName.toLowerCase()];
          }
        } else if (mapping.clientIn === 'body') {
          if (incomingClientParams.has(mapping.clientName)) {
            clientValue = incomingClientParams.get(mapping.clientName);
          } else if (req.headers[mapping.clientName.toLowerCase()] !== undefined) {
            clientValue = req.headers[mapping.clientName.toLowerCase()];
          }
        }

        // Tier 2: Check search synonyms if search term was provided anywhere in request
        if (clientValue === undefined) {
          const lowerClient = mapping.clientName.toLowerCase();
          const lowerProvider = mapping.providerName.toLowerCase();
          if ((SEARCH_SYNONYMS.includes(lowerClient) || SEARCH_SYNONYMS.includes(lowerProvider)) && clientSearchVal) {
            clientValue = clientSearchVal;
          }
        }

        // Tier 3: Explicit defaultValue, staticValue, or sampleValue on mapping
        if (clientValue === undefined) {
          if (mapping.defaultValue !== undefined && mapping.defaultValue !== null && mapping.defaultValue !== '') {
            clientValue = mapping.defaultValue;
          } else if (mapping.staticValue !== undefined && mapping.staticValue !== null && mapping.staticValue !== '') {
            clientValue = mapping.staticValue;
          } else if ((mapping as any).sampleValue !== undefined && (mapping as any).sampleValue !== null && (mapping as any).sampleValue !== '') {
            clientValue = (mapping as any).sampleValue;
          }
        }

        // Tier 4: Look up defaultValue or sampleValue in route.parameterDefinitions
        if (clientValue === undefined && Array.isArray((route as any).parameterDefinitions)) {
          const defMatch = (route as any).parameterDefinitions.find(
            (p: any) => p && (
              (p.name && p.name.toLowerCase() === mapping.clientName.toLowerCase()) ||
              (p.name && p.name.toLowerCase() === mapping.providerName.toLowerCase())
            )
          );
          if (defMatch) {
            if (defMatch.defaultValue !== undefined && defMatch.defaultValue !== null && defMatch.defaultValue !== '') {
              clientValue = defMatch.defaultValue;
            } else if (defMatch.sampleValue !== undefined && defMatch.sampleValue !== null && defMatch.sampleValue !== '') {
              clientValue = defMatch.sampleValue;
            }
          }
        }

        // Tier 5: Upstream URL searchParams from upstreamPath / queryFromUpstream
        if (clientValue === undefined && mapping.providerIn === 'query') {
          if (urlObj.searchParams.has(mapping.providerName) && urlObj.searchParams.get(mapping.providerName)) {
            clientValue = urlObj.searchParams.get(mapping.providerName);
          } else if (urlObj.searchParams.has(mapping.clientName) && urlObj.searchParams.get(mapping.clientName)) {
            clientValue = urlObj.searchParams.get(mapping.clientName);
          }
        }

        // Tier 6: Extract parameter value from raw upstream URL / cURL text
        if (clientValue === undefined) {
          const rawSources = [
            queryFromUpstream,
            route.upstreamPath || '',
            route.upstreamBaseUrl || '',
            (route as any).originalCurl || '',
            JSON.stringify((route as any).sampleRequest || ''),
          ].join(' ');

          const escapeReg = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const pRegex = new RegExp(`[?&]${escapeReg(mapping.providerName)}=([^&\\s"']+)`, 'i');
          const pMatch = rawSources.match(pRegex);
          if (pMatch && pMatch[1]) {
            clientValue = decodeURIComponent(pMatch[1]);
          } else {
            const cRegex = new RegExp(`[?&]${escapeReg(mapping.clientName)}=([^&\\s"']+)`, 'i');
            const cMatch = rawSources.match(cRegex);
            if (cMatch && cMatch[1]) {
              clientValue = decodeURIComponent(cMatch[1]);
            }
          }
        }

        // Tier 7: Smart Contextual Fallback for 'type' and standard provider parameters
        if (clientValue === undefined) {
          const lowerClient = mapping.clientName.toLowerCase();
          const lowerProvider = mapping.providerName.toLowerCase();

          if (lowerClient === 'type' || lowerProvider === 'type') {
            const contextText = `${route.name || ''} ${route.slug || ''} ${route.gatewayPath || ''} ${route.upstreamPath || ''} ${route.upstreamBaseUrl || ''} ${(route as any).description || ''} ${(route as any).originalCurl || ''}`.toLowerCase();
            if (contextText.includes('challan')) {
              clientValue = 'challan';
            } else if (contextText.includes('dl') || contextText.includes('driving')) {
              clientValue = 'dl';
            } else if (contextText.includes('pan')) {
              clientValue = 'pan';
            } else if (contextText.includes('aadhaar') || contextText.includes('aadhar')) {
              clientValue = 'aadhaar';
            } else if (contextText.includes('voter') || contextText.includes('epic')) {
              clientValue = 'voter';
            } else if (contextText.includes('fastag')) {
              clientValue = 'fastag';
            } else if (contextText.includes('passport')) {
              clientValue = 'passport';
            } else if (contextText.includes('ifsc') || contextText.includes('bank')) {
              clientValue = 'ifsc';
            } else if (contextText.includes('gst')) {
              clientValue = 'gst';
            } else {
              clientValue = 'rc';
            }
          } else if (lowerClient === 'format' || lowerClient === 'response_format' || lowerClient === 'output') {
            clientValue = 'json';
          } else if (lowerClient === 'lang' || lowerClient === 'language') {
            clientValue = 'en';
          } else if (lowerClient === 'source') {
            clientValue = 'api';
          } else if (lowerClient === 'action' || lowerClient === 'op') {
            clientValue = 'search';
          } else if (lowerClient === 'mode') {
            clientValue = 'live';
          } else if (lowerClient === 'limit') {
            clientValue = '10';
          } else if (lowerClient === 'page') {
            clientValue = '1';
          }
        }

        // Tier 8: Required Validation Guard
        // Only trigger MISSING_REQUIRED_PARAMETER if it is genuinely a search/lookup parameter and no input was provided
        if (clientValue === undefined && mapping.required) {
          const isSearchParam = SEARCH_SYNONYMS.includes(mapping.clientName.toLowerCase());
          if (isSearchParam && !clientSearchVal) {
            const durationMs = Date.now() - start;
            res.status(400).json(buildGatewayErrorResponse({
              code: 'MISSING_REQUIRED_PARAMETER',
              message: `Required parameter '${mapping.clientName}' is missing from request.`,
              developerTag: clientMeta?.developerTag,
              reqLeft: clientMeta?.reqLeft,
              reqTotal: clientMeta?.reqTotal,
              expiresAt: clientMeta?.expiresAt,
              announcement: clientMeta?.announcement,
              durationMs,
            }));
            return {
              statusCode: 400,
              durationMs,
              requestBytes: 0,
              responseBytes: 0,
              upstreamStatus: 400,
            };
          }
        }
      }

      // Preserve valid falsy values (0, false, null, empty string)
      if (clientValue !== undefined) {
        if (mapping.transform === 'trim' && typeof clientValue === 'string') clientValue = clientValue.trim();
        if (mapping.transform === 'lowercase' && typeof clientValue === 'string') clientValue = clientValue.toLowerCase();
        if (mapping.transform === 'uppercase' && typeof clientValue === 'string') clientValue = clientValue.toUpperCase();

        if (mapping.providerIn === 'query') {
          urlObj.searchParams.set(mapping.providerName, String(clientValue));
        } else if (mapping.providerIn === 'header') {
          forwardedHeaders[mapping.providerName.toLowerCase()] = String(clientValue);
        } else if (mapping.providerIn === 'body' && isJsonRequestBody) {
          parsedJsonBody[mapping.providerName] = clientValue;
        }
      }
    }

    // 4. Forward remaining client query parameters (excluding internal gateway keys)
    for (const [key, value] of incomingClientParams.entries()) {
      const lowerKey = key.toLowerCase();
      // Never forward internal Karvion auth tokens to the external provider
      if (
        lowerKey === 'api_key' ||
        lowerKey === 'apikey' ||
        (lowerKey === 'key' && (value.startsWith('arjun_') || urlObj.searchParams.has('key'))) ||
        (lowerKey === 'k' && (value.startsWith('arjun_') || urlObj.searchParams.has('k'))) ||
        (lowerKey === 'token' && value.startsWith('arjun_'))
      ) {
        continue;
      }

      // Client-provided parameters always override template/placeholder values
      if (!mappedClientQueryKeys.has(key)) {
        urlObj.searchParams.set(key, value);
      }
    }

    // 5. Inject Provider AuthConfig if not handled via parameter mappings
    if (route.authConfig && route.authConfig.type !== 'none' && decryptedSecret) {
      const { type, paramName } = route.authConfig;
      if (type === 'api_key_query') {
        urlObj.searchParams.set(paramName || 'key', decryptedSecret);
      } else if (type === 'api_key_header') {
        forwardedHeaders[(paramName || 'x-api-key').toLowerCase()] = decryptedSecret;
      } else if (type === 'bearer_token') {
        forwardedHeaders['authorization'] = `Bearer ${decryptedSecret}`;
      } else if (type === 'basic_auth') {
        forwardedHeaders['authorization'] = `Basic ${Buffer.from(decryptedSecret).toString('base64')}`;
      } else if (type === 'custom_header' && paramName) {
        forwardedHeaders[paramName.toLowerCase()] = decryptedSecret;
      }
    }

    // 6. Universal Search & Query Parameter Synonym Bridging
    // Automatically populate and bridge parameters across formats (term, query, q, search, v_num, etc.)
    if (clientSearchVal) {
      // 1. If urlObj.searchParams already contains any search synonym, update it with clientSearchVal
      for (const [paramKey] of Array.from(urlObj.searchParams.entries())) {
        if (SEARCH_SYNONYMS.includes(paramKey.toLowerCase())) {
          urlObj.searchParams.set(paramKey, clientSearchVal);
        }
      }

      // 2. Replace path template placeholders ({term}, :term, {rc_num}, :v_num, etc.) in pathname
      urlObj.pathname = urlObj.pathname
        .replace(/\{(\w+)\}/gi, clientSearchVal)
        .replace(/:(\w+)/gi, clientSearchVal);

      const upstreamText = `${route.upstreamBaseUrl || ''} ${route.upstreamPath || ''} ${(route.parameterMappings || []).map((m: any) => `${m.providerName} ${m.clientName}`).join(' ')}`.toLowerCase();

      // Set any synonym mentioned in the upstream configuration
      for (const syn of SEARCH_SYNONYMS) {
        if (upstreamText.includes(syn)) {
          urlObj.searchParams.set(syn, clientSearchVal);
        }
      }

      // Universal bidirectional safeguard:
      // Always populate BOTH 'term' AND 'query' with clientSearchVal so neither can ever be missing or empty!
      urlObj.searchParams.set('term', clientSearchVal);
      urlObj.searchParams.set('query', clientSearchVal);
    }

    // Universal upstream safeguard for 'type' parameter:
    if (!urlObj.searchParams.has('type') || !urlObj.searchParams.get('type')) {
      const fullUpstreamText = `${route.upstreamBaseUrl || ''} ${route.upstreamPath || ''} ${(route.parameterMappings || []).map((m: any) => `${m.providerName} ${m.clientName}`).join(' ')} ${(route as any).originalCurl || ''}`.toLowerCase();
      if (fullUpstreamText.includes('type')) {
        let detectedType = 'rc';
        const typeMatch = fullUpstreamText.match(/[?&]type=([^&\s"']+)/i);
        if (typeMatch && typeMatch[1]) {
          detectedType = decodeURIComponent(typeMatch[1]);
        } else if (fullUpstreamText.includes('challan')) {
          detectedType = 'challan';
        } else if (fullUpstreamText.includes('dl') || fullUpstreamText.includes('driving')) {
          detectedType = 'dl';
        } else if (fullUpstreamText.includes('pan')) {
          detectedType = 'pan';
        }
        urlObj.searchParams.set('type', detectedType);
      }
    }

    if (isJsonRequestBody && parsedJsonBody && typeof parsedJsonBody === 'object' && !Array.isArray(parsedJsonBody)) {
      if (clientSearchVal) {
        parsedJsonBody.term = clientSearchVal;
        parsedJsonBody.query = clientSearchVal;
        const upstreamText = `${route.upstreamBaseUrl || ''} ${route.upstreamPath || ''} ${(route.parameterMappings || []).map((m: any) => `${m.providerName} ${m.clientName}`).join(' ')}`.toLowerCase();
        if (parsedJsonBody.search !== undefined || upstreamText.includes('search')) {
          parsedJsonBody.search = clientSearchVal;
        }
        if (parsedJsonBody.v_num !== undefined || upstreamText.includes('v_num')) {
          parsedJsonBody.v_num = clientSearchVal;
        }
      }
      if (!parsedJsonBody.type) {
        const fullUpstreamText = `${route.upstreamBaseUrl || ''} ${route.upstreamPath || ''} ${(route.parameterMappings || []).map((m: any) => `${m.providerName} ${m.clientName}`).join(' ')} ${(route as any).originalCurl || ''}`.toLowerCase();
        if (fullUpstreamText.includes('type')) {
          let detectedType = 'rc';
          const typeMatch = fullUpstreamText.match(/[?&]type=([^&\s"']+)/i);
          if (typeMatch && typeMatch[1]) {
            detectedType = decodeURIComponent(typeMatch[1]);
          } else if (fullUpstreamText.includes('challan')) {
            detectedType = 'challan';
          } else if (fullUpstreamText.includes('dl') || fullUpstreamText.includes('driving')) {
            detectedType = 'dl';
          }
          parsedJsonBody.type = detectedType;
        }
      }
    }

    const targetUrl = urlObj.toString();

    // Strict Anti-SSRF Validation
    await validateUpstreamUrl(targetUrl);

    // 7. Universal Method & Body Bridging
    // Determine the upstream dispatch HTTP method:
    let upstreamMethod = (req.method || 'GET').toUpperCase();
    const configuredUpstreamMethod = ((route as any).upstreamMethod || '').toUpperCase();
    const origCurl = ((route as any).originalCurl || '').toUpperCase();

    if (configuredUpstreamMethod && configuredUpstreamMethod !== 'GET') {
      upstreamMethod = configuredUpstreamMethod;
    } else if (
      origCurl.includes('-X POST') ||
      origCurl.includes('--REQUEST POST') ||
      origCurl.includes('-D ') ||
      origCurl.includes('--DATA') ||
      origCurl.includes('--JSON')
    ) {
      upstreamMethod = 'POST';
    } else if (origCurl.includes('-X PUT') || origCurl.includes('--REQUEST PUT')) {
      upstreamMethod = 'PUT';
    } else if (origCurl.includes('-X DELETE') || origCurl.includes('--REQUEST DELETE')) {
      upstreamMethod = 'DELETE';
    } else if (route.requestBodyType === 'json' || route.requestBodyType === 'form-urlencoded') {
      upstreamMethod = 'POST';
    }

    // Bidirectional Bridging:
    // If upstream expects POST/PUT with body, but client called via GET or sent query params without body:
    if ((upstreamMethod === 'POST' || upstreamMethod === 'PUT') && (!isJsonRequestBody || !parsedJsonBody)) {
      if (!parsedJsonBody) {
        parsedJsonBody = {};
      }
      for (const [k, v] of incomingClientParams.entries()) {
        const lowerKey = k.toLowerCase();
        if (
          lowerKey !== 'api_key' &&
          lowerKey !== 'apikey' &&
          lowerKey !== 'token' &&
          !(lowerKey === 'key' && v.startsWith('arjun_')) &&
          !(lowerKey === 'k' && v.startsWith('arjun_'))
        ) {
          parsedJsonBody[k] = v;
        }
      }
      const sampleBody = (route as any).sampleRequest?.body;
      if (sampleBody && typeof sampleBody === 'object') {
        for (const [sk, sv] of Object.entries(sampleBody)) {
          if (parsedJsonBody[sk] === undefined) {
            parsedJsonBody[sk] = sv;
          }
        }
      }
      if (clientSearchVal) {
        parsedJsonBody.term = clientSearchVal;
        parsedJsonBody.query = clientSearchVal;
        parsedJsonBody.search = clientSearchVal;
        parsedJsonBody.v_num = clientSearchVal;
        parsedJsonBody.rc = clientSearchVal;
        parsedJsonBody.rc_num = clientSearchVal;
        parsedJsonBody.number = clientSearchVal;
        parsedJsonBody.input = clientSearchVal;
        parsedJsonBody.q = clientSearchVal;
      }
      if (!parsedJsonBody.type && urlObj.searchParams.has('type')) {
        parsedJsonBody.type = urlObj.searchParams.get('type');
      }
      isJsonRequestBody = true;
    }

    // Vice-versa: If upstream expects GET (no body), but client sent POST with JSON body:
    if (upstreamMethod === 'GET' && isJsonRequestBody && parsedJsonBody) {
      for (const [bk, bv] of Object.entries(parsedJsonBody)) {
        const lowerKey = bk.toLowerCase();
        if (
          lowerKey !== 'api_key' &&
          lowerKey !== 'apikey' &&
          lowerKey !== 'token' &&
          !(lowerKey === 'key' && String(bv).startsWith('arjun_')) &&
          !(lowerKey === 'k' && String(bv).startsWith('arjun_'))
        ) {
          if (typeof bv === 'string' || typeof bv === 'number' || typeof bv === 'boolean') {
            urlObj.searchParams.set(bk, String(bv));
          }
        }
      }
    }

    // Prepare universal request payload
    let requestBody: Buffer | undefined = undefined;
    let requestBytes = 0;

    if (upstreamMethod !== 'GET' && upstreamMethod !== 'HEAD') {
      if (isJsonRequestBody && parsedJsonBody !== undefined) {
        const updatedJsonStr = JSON.stringify(parsedJsonBody);
        requestBody = Buffer.from(updatedJsonStr);
        requestBytes = requestBody.length;
        forwardedHeaders['content-type'] = 'application/json';
        forwardedHeaders['content-length'] = String(requestBytes);
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        requestBody = req.body;
        requestBytes = req.body.length;
        if (typeof req.headers['content-type'] === 'string') {
          forwardedHeaders['content-type'] = req.headers['content-type'];
        }
        forwardedHeaders['content-length'] = String(requestBytes);
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        requestBody = Buffer.from(req.body);
        requestBytes = requestBody.length;
        if (typeof req.headers['content-type'] === 'string') {
          forwardedHeaders['content-type'] = req.headers['content-type'];
        }
        forwardedHeaders['content-length'] = String(requestBytes);
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'].toLowerCase() : '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const formStr = new URLSearchParams(req.body as any).toString();
          requestBody = Buffer.from(formStr);
          forwardedHeaders['content-type'] = 'application/x-www-form-urlencoded';
          forwardedHeaders['content-length'] = String(requestBody.length);
        } else {
          requestBody = Buffer.from(JSON.stringify(req.body));
          forwardedHeaders['content-type'] = 'application/json';
          forwardedHeaders['content-length'] = String(requestBody.length);
        }
        requestBytes = requestBody.length;
      }
    } else {
      delete forwardedHeaders['content-type'];
      delete forwardedHeaders['content-length'];
    }

    let responseBytes = 0;
    let upstreamStatus = 502;
    const abortController = new AbortController();
    const timeoutMs = route.timeoutMs || 30000;
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      console.log(`[ProxyEngine] Dispatching to upstream [${upstreamMethod}]: ${targetUrl}`);
      const { statusCode, headers, body } = await request(targetUrl, {
        method: upstreamMethod as any,
        headers: forwardedHeaders,
        body: requestBody,
        signal: abortController.signal,
      });

      upstreamStatus = statusCode;

      // Copy permitted response headers, stripping transport and encoding headers
      for (const [key, value] of Object.entries(headers)) {
        const lower = key.toLowerCase();
        if (
          !HOP_BY_HOP_HEADERS.has(lower) &&
          !STRIPPED_RESPONSE_HEADERS.has(lower) &&
          typeof value === 'string'
        ) {
          res.setHeader(key, value);
        }
      }

      // Collect raw response chunks safely
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      clearTimeout(timeoutId);

      const rawBuffer = Buffer.concat(chunks);
      const contentEncoding = (headers['content-encoding'] || headers['Content-Encoding']) as
        | string
        | string[]
        | undefined;
      const decompressedBuffer = decompressBuffer(rawBuffer, contentEncoding);

      const upstreamContentType = String(headers['content-type'] || res.getHeader('content-type') || '').toLowerCase();
      const isJson =
        upstreamContentType.includes('application/json') ||
        upstreamContentType.includes('+json') ||
        (decompressedBuffer.length > 0 &&
          (decompressedBuffer[0] === 0x7b || decompressedBuffer[0] === 0x5b));

      const duration = Date.now() - start;

      // Always inject standard metadata in HTTP response headers
      res.setHeader('X-Developer', clientMeta?.developerTag || 'arjunkahar');
      if (clientMeta?.reqLeft !== undefined) res.setHeader('X-RateLimit-Remaining', String(clientMeta.reqLeft));
      if (clientMeta?.reqTotal !== undefined) res.setHeader('X-RateLimit-Limit', String(clientMeta.reqTotal));
      if (clientMeta?.expiresAt) res.setHeader('X-Expiry-Date', formatExpiryDate(clientMeta.expiresAt));
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('X-Cache', 'MISS');
      if (clientMeta?.announcement) {
        res.setHeader('X-Karvion-Announcement', clientMeta.announcement.id);
        if (clientMeta.announcement.acknowledgment_required) {
          res.setHeader('X-Karvion-Ack-Required', 'true');
          res.setHeader('X-Karvion-Ack-Url', `/api/v1/announcements/${clientMeta.announcement.id}/acknowledge`);
        }
      }

      let finalBody: Buffer | string = decompressedBuffer;

      // Response Sanitization & White-Label Rebranding Handling:
      // Recursively strips foreign third-party credits (e.g. ASUR, telegram links, upstream limits)
      // and injects the personal developer branding and customer metadata.
      if (isJson) {
        try {
          const text = decompressedBuffer.toString('utf-8');
          const json = JSON.parse(text);
          if (json && typeof json === 'object') {
            // Extract the real upstream API quota so that ONLY Admin can monitor it
            const upstreamQuota = extractUpstreamQuota(json);
            if (upstreamQuota && (upstreamQuota.reqLeft !== undefined || upstreamQuota.reqTotal !== undefined)) {
              if (redis) {
                redis.set(
                  `gateway:upstream_quota:${route.id}`,
                  JSON.stringify({
                    ...upstreamQuota,
                    lastSyncedAt: new Date().toISOString(),
                  }),
                  'EX',
                  86400 * 7
                ).catch(() => {});
              }
            }

            // Clean foreign credits and real upstream limits, and inject the calling client's plan!
            const cleaned = ResponseSanitizer.cleanAndRebrand(json, clientMeta, duration, false);
            finalBody = JSON.stringify(cleaned, null, 2);
            res.setHeader('content-type', 'application/json; charset=utf-8');
          }
        } catch {
          finalBody = decompressedBuffer.toString('utf-8');
        }
      }

      responseBytes = Buffer.isBuffer(finalBody) ? finalBody.length : Buffer.byteLength(String(finalBody));

      // Save to response cache if caching is active
      if (isCachingEligible && statusCode >= 200 && statusCode < 300) {
        const ttl = cacheConfig?.ttlSeconds || 60;
        await ResponseCacheManager.set(
          redis,
          route.slug,
          req.method,
          req.path,
          req.query,
          req.body,
          finalBody,
          headers,
          statusCode,
          ttl
        );
      }

      // Check max response byte limit
      if (route.maxResponseBytes && responseBytes > route.maxResponseBytes) {
        throw new UpstreamError('Upstream response exceeded configured maximum size limit', 502);
      }

      res.status(statusCode).send(finalBody);

      return {
        statusCode,
        durationMs: Date.now() - start,
        requestBytes,
        responseBytes,
        upstreamStatus,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[ProxyEngine] Upstream error occurred:', err);
      const durationMs = Date.now() - start;
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        res.status(504).json(buildGatewayErrorResponse({
          code: 'UPSTREAM_TIMEOUT',
          message: `Upstream service timed out after ${route.timeoutMs}ms.`,
          developerTag: clientMeta?.developerTag,
          reqLeft: clientMeta?.reqLeft,
          reqTotal: clientMeta?.reqTotal,
          expiresAt: clientMeta?.expiresAt,
          announcement: clientMeta?.announcement,
          durationMs,
        }));
        return {
          statusCode: 504,
          durationMs,
          requestBytes,
          responseBytes: 0,
          upstreamStatus: 504,
        };
      }

      res.status(502).json(buildGatewayErrorResponse({
        code: 'UPSTREAM_ERROR',
        message: 'Failed to communicate with configured upstream destination.',
        details: err.message,
        developerTag: clientMeta?.developerTag,
        reqLeft: clientMeta?.reqLeft,
        reqTotal: clientMeta?.reqTotal,
        expiresAt: clientMeta?.expiresAt,
        announcement: clientMeta?.announcement,
        durationMs,
      }));

      return {
        statusCode: 502,
        durationMs,
        requestBytes,
        responseBytes: 0,
        upstreamStatus: 502,
      };
    }
  }
}
