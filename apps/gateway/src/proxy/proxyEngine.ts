import type { Request, Response } from 'express';
import { request } from 'undici';
import zlib from 'node:zlib';
import { decompress as decompressZstd } from 'fzstd';
import { RouteConfig } from '../routing/routeResolver.js';
import { validateUpstreamUrl } from '../security/ssrfGuard.js';
import { UpstreamError } from '@arjun/shared';

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
  const isPlainJsonOrText = first === 0x7b || first === 0x5b || first === 0x20 || first === 0x0a || first === 0x0d || first === 0x09 || first === 0x3c;
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
   */
  static async forwardRequest(
    req: Request,
    res: Response,
    route: RouteConfig,
    clientMeta?: ClientResponseMetadata,
    subPath?: string
  ): Promise<ProxyResult> {
    const start = Date.now();

    // 1. Construct destination URL: upstreamBaseUrl + upstreamPath + subPath + merged query parameters
    const baseUrl = route.upstreamBaseUrl.replace(/\/$/, '');
    let upstreamPath = route.upstreamPath || '';

    // Extract any existing query parameters from the upstreamPath
    let queryFromUpstream = '';
    const qIdx = upstreamPath.indexOf('?');
    if (qIdx !== -1) {
      queryFromUpstream = upstreamPath.substring(qIdx + 1);
      upstreamPath = upstreamPath.substring(0, qIdx);
    }

    // Append subPath if client requested a sub-resource
    if (subPath) {
      const cleanSub = subPath.startsWith('/') ? subPath : `/${subPath}`;
      upstreamPath = upstreamPath ? `${upstreamPath.replace(/\/$/, '')}${cleanSub}` : cleanSub;
    }

    if (!upstreamPath.startsWith('/')) {
      upstreamPath = `/${upstreamPath}`;
    }

    const urlObj = new URL(`${baseUrl}${upstreamPath}`);

    // Re-apply query parameters from upstream configuration
    if (queryFromUpstream) {
      const usp = new URLSearchParams(queryFromUpstream);
      for (const [k, v] of usp.entries()) {
        urlObj.searchParams.set(k, v);
      }
    }

    // Merge incoming query parameters from client
    const incomingQueryIdx = req.originalUrl.indexOf('?');
    if (incomingQueryIdx !== -1) {
      const incomingParams = new URLSearchParams(req.originalUrl.substring(incomingQueryIdx));
      for (const [key, value] of incomingParams.entries()) {
        const lowerKey = key.toLowerCase();
        // If this parameter is the client gateway auth key (e.g. ?key=arjun_live_... or ?api_key=...),
        // do not forward the internal gateway key or overwrite the upstream API's own secret key
        if (
          lowerKey === 'api_key' ||
          lowerKey === 'apikey' ||
          lowerKey === 'token' ||
          (lowerKey === 'key' && (value.startsWith('arjun_') || urlObj.searchParams.has('key')))
        ) {
          continue;
        }
        urlObj.searchParams.set(key, value);
      }
    }

    // Auto-map vehicle search parameters (vehicle_number, v_num, etc.) to query if not explicitly set
    if (!urlObj.searchParams.has('query')) {
      const altParam =
        urlObj.searchParams.get('vehicle_number') ||
        urlObj.searchParams.get('v_num') ||
        urlObj.searchParams.get('vehicle') ||
        urlObj.searchParams.get('rc') ||
        urlObj.searchParams.get('number');
      if (altParam) {
        urlObj.searchParams.set('query', altParam);
      }
    }
    const targetUrl = urlObj.toString();

    // 2. Enforce strict anti-SSRF validation
    await validateUpstreamUrl(targetUrl);

    // 3. Sanitize and filter forwarded headers
    const forwardedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lower) && typeof value === 'string') {
        forwardedHeaders[key] = value;
      }
    }
    // Universal compression support: tell upstream we accept all modern formats
    forwardedHeaders['accept-encoding'] = 'gzip, deflate, br, zstd';

    if (!forwardedHeaders['user-agent']) {
      forwardedHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    }
    forwardedHeaders['x-forwarded-for'] = req.ip || req.socket.remoteAddress || '127.0.0.1';
    forwardedHeaders['x-forwarded-proto'] = req.protocol;
    forwardedHeaders['x-gateway-id'] = 'arjun-api-manager';

    // 4. Prepare universal request payload (JSON, Form URL-encoded, Multipart, Text, XML, Binary)
    let requestBody: Buffer | undefined = undefined;
    let requestBytes = 0;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
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
          forwardedHeaders['content-type'] = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : 'application/x-www-form-urlencoded';
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
      const contentEncoding = (headers['content-encoding'] || headers['Content-Encoding']) as string | string[] | undefined;
      const decompressedBuffer = decompressBuffer(rawBuffer, contentEncoding);
      console.log(`[ProxyEngine] Decompressed upstream response (${rawBuffer.length} raw bytes -> ${decompressedBuffer.length} bytes)`);

      const upstreamContentType = String(headers['content-type'] || res.getHeader('content-type') || '').toLowerCase();
      const isJson = upstreamContentType.includes('application/json') || upstreamContentType.includes('+json') || (decompressedBuffer.length > 0 && (decompressedBuffer[0] === 0x7b || decompressedBuffer[0] === 0x5b));

      // Always inject standard metadata headers on every response (JSON, binary, streams, HEAD)
      const duration = Date.now() - start;
      res.setHeader('X-Developer', clientMeta?.developerTag || 'arjunkahar');
      if (clientMeta?.reqLeft !== undefined) res.setHeader('X-RateLimit-Remaining', String(clientMeta.reqLeft));
      if (clientMeta?.reqTotal !== undefined) res.setHeader('X-RateLimit-Limit', String(clientMeta.reqTotal));
      if (clientMeta?.expiresAt) res.setHeader('X-Expiry-Date', formatExpiryDate(clientMeta.expiresAt));
      res.setHeader('X-Response-Time', `${duration}ms`);

      let finalBody: Buffer | string = decompressedBuffer;

      if (isJson) {
        try {
          const text = decompressedBuffer.toString('utf-8');
          const json = JSON.parse(text);
          if (json && typeof json === 'object' && !Array.isArray(json)) {
            // Replace or set developer branding (customizable per user, default arjunkahar)
            json.developer = clientMeta?.developerTag || 'arjunkahar';

            // Inject customer quota stats
            if (clientMeta?.reqLeft !== undefined) {
              json.req_left = clientMeta.reqLeft;
            }
            if (clientMeta?.reqTotal !== undefined) {
              json.req_total = clientMeta.reqTotal;
            }
            if (clientMeta?.expiresAt) {
              json.expiry = formatExpiryDate(clientMeta.expiresAt);
            }

            // Inject duration and timing
            json.response_time = `${duration}ms`;
            json.response_time_seconds = Number((duration / 1000).toFixed(2));

            finalBody = JSON.stringify(json, null, 2);
            res.setHeader('content-type', 'application/json; charset=utf-8');
          } else {
            finalBody = text;
          }
        } catch {
          finalBody = decompressedBuffer.toString('utf-8');
        }
      }

      responseBytes = Buffer.isBuffer(finalBody) ? finalBody.length : Buffer.byteLength(finalBody);

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
