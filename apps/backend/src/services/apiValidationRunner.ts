import { request } from 'undici';
import { decryptSecret, redactSensitiveData } from '@arjun/shared';
import type { ApiValidationReport, ProviderAuthConfig, ParameterMapping } from '@arjun/types';

export interface ValidationTestOptions {
  name: string;
  upstreamBaseUrl: string;
  upstreamPath: string;
  method: string;
  authConfig?: ProviderAuthConfig;
  parameterMappings?: ParameterMapping[];
  requestBodyType?: string;
  sampleBody?: any;
  sampleQueryParams?: Record<string, any>;
  sampleHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export class ApiValidationRunner {
  static async runValidation(opts: ValidationTestOptions): Promise<ApiValidationReport> {
    const start = Date.now();
    const tests: ApiValidationReport['tests'] = [];
    let overallStatus: ApiValidationReport['status'] = 'PASS';
    let statusCode: number | undefined;
    let targetUrl: string = '';
    let sampleResponseSnippet: string | undefined;

    // 1. DNS & URL Structure Validation
    let urlObj: URL;
    try {
      const cleanBase = opts.upstreamBaseUrl.replace(/\/$/, '');
      let cleanPath = opts.upstreamPath || '';
      if (!cleanPath.startsWith('/') && cleanPath) cleanPath = `/${cleanPath}`;
      targetUrl = `${cleanBase}${cleanPath}`;
      urlObj = new URL(targetUrl);

      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        tests.push({
          name: 'Protocol & DNS Format',
          status: 'FAIL',
          message: `Unsupported protocol: ${urlObj.protocol}. Only http and https are permitted.`,
        });
        overallStatus = 'FAIL';
      } else {
        tests.push({
          name: 'Protocol & DNS Format',
          status: 'PASS',
          message: `Target URL protocol (${urlObj.protocol}) and host (${urlObj.hostname}) are valid.`,
        });
      }
    } catch (err: any) {
      tests.push({
        name: 'Protocol & DNS Format',
        status: 'FAIL',
        message: `Invalid URL format: ${err.message}`,
      });
      return {
        status: 'FAIL',
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        tests,
      };
    }

    // 2. SSRF & Security Boundary Check
    const hostname = urlObj.hostname.toLowerCase();
    const isPrivate =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local');

    if (isPrivate) {
      tests.push({
        name: 'SSRF & Boundary Protection',
        status: 'FAIL',
        message: `Destination host '${hostname}' points to a private, loopback, or metadata network. Access blocked.`,
      });
      overallStatus = 'BLOCKED';
      return {
        status: 'BLOCKED',
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        tests,
        targetUrl,
      };
    } else {
      tests.push({
        name: 'SSRF & Boundary Protection',
        status: 'PASS',
        message: `Host '${hostname}' verified as public routable network destination.`,
      });
    }

    // 3. Credential Decryption
    let rawSecret: string | undefined = undefined;
    if (opts.authConfig?.encryptedCredential) {
      try {
        rawSecret = decryptSecret(opts.authConfig.encryptedCredential);
        tests.push({
          name: 'Credential Vault Decryption',
          status: 'PASS',
          message: 'Provider credentials decrypted cleanly from AES-256 vault.',
        });
      } catch (err: any) {
        tests.push({
          name: 'Credential Vault Decryption',
          status: 'WARNING',
          message: `Could not decrypt credential: ${err.message}`,
        });
      }
    } else if (opts.authConfig?.type && opts.authConfig.type !== 'none') {
      tests.push({
        name: 'Credential Vault Decryption',
        status: 'WARNING',
        message: 'No encrypted credential stored in vault yet.',
      });
    }

    // 4. Parameter Mapping & Injection
    const forwardedHeaders: Record<string, string> = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KarvionApiValidator/2.0',
      accept: '*/*',
    };

    if (opts.sampleHeaders) {
      Object.assign(forwardedHeaders, opts.sampleHeaders);
    }

    // Apply sample query parameters
    if (opts.sampleQueryParams) {
      for (const [k, v] of Object.entries(opts.sampleQueryParams)) {
        if (v !== undefined && v !== null) {
          urlObj.searchParams.set(k, String(v));
        }
      }
    }

    // Inject Credential if specified
    if (opts.authConfig && opts.authConfig.type !== 'none' && rawSecret) {
      const { type, paramName } = opts.authConfig;
      if (type === 'api_key_query') {
        urlObj.searchParams.set(paramName || 'key', rawSecret);
      } else if (type === 'api_key_header') {
        forwardedHeaders[(paramName || 'x-api-key').toLowerCase()] = rawSecret;
      } else if (type === 'bearer_token') {
        forwardedHeaders['authorization'] = `Bearer ${rawSecret}`;
      } else if (type === 'basic_auth') {
        forwardedHeaders['authorization'] = `Basic ${Buffer.from(rawSecret).toString('base64')}`;
      } else if (type === 'custom_header' && paramName) {
        forwardedHeaders[paramName.toLowerCase()] = rawSecret;
      }
    }

    // Apply mappings static values
    if (opts.parameterMappings) {
      for (const m of opts.parameterMappings) {
        if (m.isProviderCredential && rawSecret) {
          if (m.providerIn === 'query') urlObj.searchParams.set(m.providerName, rawSecret);
          if (m.providerIn === 'header') forwardedHeaders[m.providerName.toLowerCase()] = rawSecret;
        } else if (m.isStatic && m.staticValue !== undefined) {
          if (m.providerIn === 'query') urlObj.searchParams.set(m.providerName, String(m.staticValue));
          if (m.providerIn === 'header') forwardedHeaders[m.providerName.toLowerCase()] = String(m.staticValue);
        } else if (m.defaultValue !== undefined && !urlObj.searchParams.has(m.providerName)) {
          if (m.providerIn === 'query') urlObj.searchParams.set(m.providerName, String(m.defaultValue));
          if (m.providerIn === 'header') forwardedHeaders[m.providerName.toLowerCase()] = String(m.defaultValue);
        }
      }
    }

    tests.push({
      name: 'Parameter & Credential Injection',
      status: 'PASS',
      message: `Injected mapped parameters and authentication credentials for outbound call.`,
    });

    // 5. Connectivity & Live Response Check
    targetUrl = urlObj.toString();
    const timeoutMs = opts.timeoutMs || 15000;
    const abortCtrl = new AbortController();
    const timer = setTimeout(() => abortCtrl.abort(), timeoutMs);

    let requestBody: string | undefined = undefined;
    if (opts.method !== 'GET' && opts.method !== 'HEAD') {
      if (opts.sampleBody) {
        requestBody = typeof opts.sampleBody === 'string' ? opts.sampleBody : JSON.stringify(opts.sampleBody);
        forwardedHeaders['content-type'] = 'application/json';
      }
    }

    try {
      const res = await request(targetUrl, {
        method: opts.method as any,
        headers: forwardedHeaders,
        body: requestBody,
        signal: abortCtrl.signal,
      });

      clearTimeout(timer);
      statusCode = res.statusCode;

      const chunks: Buffer[] = [];
      for await (const chunk of res.body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');

      // Check Status Code
      if (statusCode >= 200 && statusCode < 300) {
        tests.push({
          name: 'Upstream HTTP Status',
          status: 'PASS',
          message: `Provider returned HTTP ${statusCode} (Success).`,
        });
      } else if (statusCode >= 400 && statusCode < 500) {
        tests.push({
          name: 'Upstream HTTP Status',
          status: 'WARNING',
          message: `Provider returned client error HTTP ${statusCode}. Check required parameters or provider credentials.`,
        });
        if (overallStatus !== 'FAIL') overallStatus = 'WARNING';
      } else {
        tests.push({
          name: 'Upstream HTTP Status',
          status: 'FAIL',
          message: `Provider returned server error HTTP ${statusCode}.`,
        });
        overallStatus = 'FAIL';
      }

      // Check Response Parsing
      try {
        const parsed = JSON.parse(rawBody);
        tests.push({
          name: 'Response Payload Parsing',
          status: 'PASS',
          message: 'Valid JSON response payload successfully parsed.',
        });
        sampleResponseSnippet = JSON.stringify(redactSensitiveData(parsed), null, 2).substring(0, 1000);
      } catch {
        tests.push({
          name: 'Response Payload Parsing',
          status: 'PASS',
          message: `Received text/raw response payload (${rawBody.length} bytes).`,
        });
        sampleResponseSnippet = rawBody.substring(0, 500);
      }

      // Credential Redaction Check: verify secret was NOT echoed back
      if (rawSecret && rawSecret.length > 5 && rawBody.includes(rawSecret)) {
        tests.push({
          name: 'Secret Leakage Prevention',
          status: 'FAIL',
          message: 'Provider response echoed raw secret key in response body! Verify upstream configuration.',
        });
        overallStatus = 'FAIL';
      } else {
        tests.push({
          name: 'Secret Leakage Prevention',
          status: 'PASS',
          message: 'Verified provider secret was not reflected in client response.',
        });
      }
    } catch (err: any) {
      clearTimeout(timer);
      tests.push({
        name: 'Upstream HTTP Status',
        status: 'FAIL',
        message: `Failed to connect to upstream destination: ${err.message}`,
      });
      overallStatus = 'FAIL';
    }

    return {
      status: overallStatus,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      tests,
      statusCode,
      targetUrl,
      sampleResponseSnippet,
    };
  }
}
