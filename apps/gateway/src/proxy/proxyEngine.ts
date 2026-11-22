import type { Request, Response } from 'express';
import { request } from 'undici';
import zlib from 'node:zlib';
import { decompress as decompressZstd } from 'fzstd';
import { RouteConfig } from '../routing/routeResolver.js';
import { validateUpstreamUrl } from '../security/ssrfGuard.js';
import { UpstreamError, decryptSecret, ResponseSanitizer } from '@arjun/shared';
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
  'number',
  'input',
  'keyword',
  'text',
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

function formatExpiryDate(d?: Date | string | null): string {
  if (!d) return '31-12-2099';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '31-12-2099';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
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

        res.status(cached.statusCode).send(cached.body);
        return {
          statusCode: cached.statusCode,
          durationMs: duration,
          requestBytes: 0,
          responseBytes: Buffer.isBuffer(cached.body) ? cached.body.length : Buffer.byteLength(String(cached.body)),
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

    // Parse incoming client query parameters
    const incomingQueryIdx = req.originalUrl.indexOf('?');
    const incomingClientParams = new URLSearchParams(
      incomingQueryIdx !== -1 ? req.originalUrl.substring(incomingQueryIdx) : ''
    );

    // Parse incoming request body if JSON
    let parsedJsonBody: any = undefined;
    let isJsonRequestBody = false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const cType = String(req.headers['content-type'] || '').toLowerCase();
      if (cType.includes('application/json') && req.body) {
        try {
          const rawStr = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : String(req.body);
          if (rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[')) {
            parsedJsonBody = JSON.parse(rawStr);
            isJsonRequestBody = typeof parsedJsonBody === 'object' && parsedJsonBody !== null;
          }
        } catch {}
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

      // Check required validation
      if (clientValue === undefined) {
        if (mapping.defaultValue !== undefined) {
          clientValue = mapping.defaultValue;
        } else if (mapping.required) {
          res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_REQUIRED_PARAMETER',
              message: `Required parameter '${mapping.clientName}' is missing from request ${mapping.clientIn}.`,
            },
          });
          return {
            statusCode: 400,
            durationMs: Date.now() - start,
            requestBytes: 0,
            responseBytes: 0,
            upstreamStatus: 400,
          };
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
        (lowerKey === 'token' && value.startsWith('arjun_'))
      ) {
        continue;
      }

      // If already explicitly mapped, do not duplicate unless permitted
      if (!mappedClientQueryKeys.has(key) && !urlObj.searchParams.has(key)) {
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

    // Universal Search & Query Parameter Synonym Bridging
    // E.g. Client passes query=..., v_num=..., rc=..., search=..., but upstream expects term=..., q=..., etc.
    const detectedSearchVal = SEARCH_SYNONYMS.map(
      (k) => urlObj.searchParams.get(k) || (incomingClientParams.get(k) || undefined)
    ).find((v) => typeof v === 'string' && v.trim().length > 0);

    if (detectedSearchVal) {
      const upstreamText = `${route.upstreamBaseUrl || ''} ${route.upstreamPath || ''} ${(route.parameterMappings || []).map((m: any) => m.providerName).join(' ')}`.toLowerCase();

      // If upstream specifically contains 'term' (like ?term= or path with term)
      if (upstreamText.includes('term') && !urlObj.searchParams.has('term')) {
        urlObj.searchParams.set('term', detectedSearchVal);
      }
      // If upstream specifically contains 'query'
      if (upstreamText.includes('query') && !urlObj.searchParams.has('query')) {
        urlObj.searchParams.set('query', detectedSearchVal);
      }
      // If upstream specifically contains 'q'
      if (upstreamText.includes('q=') && !urlObj.searchParams.has('q')) {
        urlObj.searchParams.set('q', detectedSearchVal);
      }
      // If upstream specifically contains 'search'
      if (upstreamText.includes('search') && !urlObj.searchParams.has('search')) {
        urlObj.searchParams.set('search', detectedSearchVal);
      }

      // Universal bidirectional fallback:
      // Ensure the standard parameters 'query' and 'term' are both populated if not already set,
      // so whatever the external API reads (query, term, v_num), it receives the value!
      if (!urlObj.searchParams.has('query')) {
        urlObj.searchParams.set('query', detectedSearchVal);
      }
      if (!urlObj.searchParams.has('term')) {
        urlObj.searchParams.set('term', detectedSearchVal);
      }
    }

    if (isJsonRequestBody && parsedJsonBody && typeof parsedJsonBody === 'object' && !Array.isArray(parsedJsonBody)) {
      const bodySearchVal = SEARCH_SYNONYMS.map((k) => parsedJsonBody[k]).find(
        (v) => typeof v === 'string' && v.trim().length > 0
      );
      if (bodySearchVal) {
        if (!parsedJsonBody.query && !parsedJsonBody.term) {
          parsedJsonBody.query = bodySearchVal;
          parsedJsonBody.term = bodySearchVal;
        } else if (!parsedJsonBody.query) {
          parsedJsonBody.query = bodySearchVal;
        } else if (!parsedJsonBody.term) {
          parsedJsonBody.term = bodySearchVal;
        }
      }
    }

    const targetUrl = urlObj.toString();

    // 6. Strict Anti-SSRF Validation
    await validateUpstreamUrl(targetUrl);

    // 7. Prepare universal request payload
    let requestBody: Buffer | undefined = undefined;
    let requestBytes = 0;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (isJsonRequestBody && parsedJsonBody !== undefined) {
        const updatedJsonStr = JSON.stringify(parsedJsonBody);
        requestBody = Buffer.from(updatedJsonStr);
        requestBytes = requestBody.length;
        forwardedHeaders['content-type'] = 'application/json';
      } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        requestBody = req.body;
        requestBytes = req.body.length;
        if (typeof req.headers['content-type'] === 'string') {
          forwardedHeaders['content-type'] = req.headers['content-type'];
        }
      } else if (typeof req.body === 'string' && req.body.length > 0) {
        requestBody = Buffer.from(req.body);
        requestBytes = requestBody.length;
        if (typeof req.headers['content-type'] === 'string') {
          forwardedHeaders['content-type'] = req.headers['content-type'];
        }
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'].toLowerCase() : '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          requestBody = Buffer.from(new URLSearchParams(req.body as any).toString());
          forwardedHeaders['content-type'] =
            typeof req.headers['content-type'] === 'string'
              ? req.headers['content-type']
              : 'application/x-www-form-urlencoded';
        } else {
          requestBody = Buffer.from(JSON.stringify(req.body));
          forwardedHeaders['content-type'] = 'application/json';
        }
        requestBytes = requestBody.length;
      }
    }

    let responseBytes = 0;
    let upstreamStatus = 502;
    const abortController = new AbortController();
    const timeoutMs = route.timeoutMs || 30000;
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      console.log(`[ProxyEngine] Dispatching to upstream: ${targetUrl}`);
      const { statusCode, headers, body } = await request(targetUrl, {
        method: req.method as any,
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
            const cleaned = ResponseSanitizer.cleanAndRebrand(json, clientMeta, duration);
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
        res.status(504).json({
          success: false,
          error: {
            code: 'UPSTREAM_TIMEOUT',
            message: `Upstream service timed out after ${route.timeoutMs}ms.`,
          },
        });
        return {
          statusCode: 504,
          durationMs,
          requestBytes,
          responseBytes: 0,
          upstreamStatus: 504,
        };
      }

      res.status(502).json({
        success: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to communicate with configured upstream destination.',
          details: err.message,
        },
      });

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
