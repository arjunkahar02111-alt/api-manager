import { parseCurlCommand, ParsedCurl } from './curlParser.js';
import { parseOpenApiSpec } from './openApiParser.js';
import { parsePostmanCollection } from './postmanParser.js';
import type {
  ParameterDefinition,
  ParameterMapping,
  ProviderAuthConfig,
  ParameterLocation,
  ParameterDataType,
} from '@arjun/types';

export interface AnalyzedApiResult {
  name: string;
  slug: string;
  gatewayPath: string;
  method: string;
  upstreamBaseUrl: string;
  upstreamPath: string;
  requestBodyType: 'none' | 'json' | 'form-urlencoded' | 'multipart' | 'text' | 'xml';
  parameterDefinitions: ParameterDefinition[];
  parameterMappings: ParameterMapping[];
  authConfig: ProviderAuthConfig;
  sampleQueryParams?: Record<string, any>;
  sampleHeaders?: Record<string, string>;
  sampleBody?: any;
  cachePolicy: {
    enabled: boolean;
    ttlSeconds: number;
    cacheMethods: string[];
    respectUpstreamCacheControl: boolean;
  };
  responseEnvelope: 'preserve' | 'wrap' | 'header_only';
}

function detectDataType(value: any): ParameterDataType {
  if (value === null || value === undefined) return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  
  // Check if string can be parsed as number or boolean without losing falsy 0/false
  const str = String(value).trim();
  if (str === 'true' || str === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(str) && !isNaN(Number(str))) return 'number';
  
  return 'string';
}

function isLikelySecretKey(paramName: string): boolean {
  const lower = paramName.toLowerCase().replace(/[-_]/g, '');
  return (
    lower === 'key' ||
    lower === 'apikey' ||
    lower === 'xapikey' ||
    lower === 'token' ||
    lower === 'secret' ||
    lower === 'auth' ||
    lower === 'accesstoken' ||
    lower === 'authtoken' ||
    lower === 'xauthtoken' ||
    lower === 'clientsecret' ||
    lower === 'appkey' ||
    lower === 'rapidapikey' ||
    lower.includes('key') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('auth')
  );
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'api-service';
}

export class UniversalRequestAnalyzer {
  static analyze(
    rawInput: string,
    inputType: 'curl' | 'openapi' | 'postman' | 'url' | 'auto' = 'auto',
    sampleRequest?: Record<string, any>
  ): AnalyzedApiResult {
    const trimmed = rawInput.trim();

    // 1. Determine input format if auto
    let effectiveType = inputType;
    if (effectiveType === 'auto') {
      if (trimmed.toLowerCase().startsWith('curl ') || trimmed.includes(' -H ') || trimmed.includes(' -X ')) {
        effectiveType = 'curl';
      } else if (trimmed.startsWith('{') && (trimmed.includes('"openapi"') || trimmed.includes('"swagger"'))) {
        effectiveType = 'openapi';
      } else if (trimmed.startsWith('{') && trimmed.includes('"info"') && trimmed.includes('"schema"')) {
        effectiveType = 'postman';
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        effectiveType = 'url';
      } else {
        effectiveType = 'curl';
      }
    }

    if (effectiveType === 'openapi') {
      return this.analyzeOpenApi(trimmed);
    }

    if (effectiveType === 'postman') {
      return this.analyzePostman(trimmed);
    }

    // Default to cURL / URL analyzer
    const curlData = effectiveType === 'url' ? parseCurlCommand(`curl "${trimmed}"`) : parseCurlCommand(trimmed);

    return this.analyzeParsedCurl(curlData, sampleRequest);
  }

  private static analyzeParsedCurl(curl: ParsedCurl, extraSample?: Record<string, any>): AnalyzedApiResult {
    const upstreamBaseUrl = curl.origin;
    let upstreamPath = curl.pathname;

    const hostParts = new URL(curl.url).hostname.replace(/^www\./, '').split('.');
    const baseDomain = hostParts[0] === 'api' && hostParts[1] ? hostParts[1] : hostParts[0] || 'service';
    const pathLast = curl.pathname.split('/').filter(Boolean).pop() || 'endpoint';
    const name = `${baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1)} ${pathLast.charAt(0).toUpperCase() + pathLast.slice(1)}`;
    const slug = generateSlug(`${baseDomain}-${pathLast}`);
    const gatewayPath = `/${slug}`;

    const parameterDefinitions: ParameterDefinition[] = [];
    const parameterMappings: ParameterMapping[] = [];
    let detectedAuthConfig: ProviderAuthConfig = { type: 'none' };

    // Analyze Query Parameters
    const sampleQueryParams: Record<string, any> = { ...curl.queryParams };
    if (extraSample?.queryParams) {
      Object.assign(sampleQueryParams, extraSample.queryParams);
    }

    for (const [key, val] of Object.entries(sampleQueryParams)) {
      const isSecret = isLikelySecretKey(key);

      if (isSecret && detectedAuthConfig.type === 'none') {
        // Mark as provider secret key to be injected server-side
        detectedAuthConfig = {
          type: 'api_key_query',
          paramName: key,
          credentialPrefix: typeof val === 'string' && val.length > 8 ? `${val.substring(0, 4)}...${val.slice(-4)}` : '••••••••',
        };

        parameterMappings.push({
          clientName: key,
          clientIn: 'query',
          providerName: key,
          providerIn: 'query',
          isStatic: true,
          staticValue: val,
          isProviderCredential: true,
          required: true,
        });
      } else {
        const dataType = detectDataType(val);
        parameterDefinitions.push({
          name: key,
          in: 'query',
          type: dataType,
          required: true,
          defaultValue: undefined,
          sampleValue: val,
          description: `Query parameter: ${key}`,
        });

        parameterMappings.push({
          clientName: key,
          clientIn: 'query',
          providerName: key,
          providerIn: 'query',
          isStatic: false,
          required: true,
          defaultValue: undefined,
        });
      }
    }

    // Analyze Headers
    const sampleHeaders: Record<string, string> = { ...curl.headers };
    for (const [headerKey, headerVal] of Object.entries(sampleHeaders)) {
      const lower = headerKey.toLowerCase();
      if (lower === 'authorization') {
        if (headerVal.toLowerCase().startsWith('bearer ')) {
          detectedAuthConfig = {
            type: 'bearer_token',
            paramName: 'Authorization',
            credentialPrefix: 'Bearer ••••••••',
          };
        } else if (headerVal.toLowerCase().startsWith('basic ')) {
          detectedAuthConfig = {
            type: 'basic_auth',
            paramName: 'Authorization',
            credentialPrefix: 'Basic ••••••••',
          };
        }
      } else if (isLikelySecretKey(lower) && detectedAuthConfig.type === 'none') {
        detectedAuthConfig = {
          type: 'api_key_header',
          paramName: headerKey,
          credentialPrefix: headerVal.length > 8 ? `${headerVal.substring(0, 4)}...` : '••••••••',
        };
      }
    }

    // Analyze Body
    let sampleBody: any = undefined;
    let requestBodyType = curl.bodyType;

    if (curl.body) {
      if (curl.bodyType === 'json') {
        try {
          sampleBody = JSON.parse(curl.body);
          if (typeof sampleBody === 'object' && sampleBody !== null && !Array.isArray(sampleBody)) {
            for (const [bKey, bVal] of Object.entries(sampleBody)) {
              const bType = detectDataType(bVal);
              parameterDefinitions.push({
                name: bKey,
                in: 'body',
                type: bType,
                required: true,
                sampleValue: bVal,
                description: `Request body property: ${bKey}`,
              });

              parameterMappings.push({
                clientName: bKey,
                clientIn: 'body',
                providerName: bKey,
                providerIn: 'body',
                isStatic: false,
                required: true,
              });
            }
          }
        } catch {
          sampleBody = curl.body;
        }
      } else if (curl.bodyType === 'form-urlencoded') {
        const usp = new URLSearchParams(curl.body);
        const formObj: Record<string, string> = {};
        usp.forEach((val, key) => {
          formObj[key] = val;
          parameterDefinitions.push({
            name: key,
            in: 'body',
            type: 'string',
            required: true,
            sampleValue: val,
            description: `Form parameter: ${key}`,
          });

          parameterMappings.push({
            clientName: key,
            clientIn: 'body',
            providerName: key,
            providerIn: 'body',
            isStatic: false,
            required: true,
          });
        });
        sampleBody = formObj;
      } else {
        sampleBody = curl.body;
      }
    }

    return {
      name,
      slug,
      gatewayPath,
      method: curl.method,
      upstreamBaseUrl,
      upstreamPath,
      requestBodyType,
      parameterDefinitions,
      parameterMappings,
      authConfig: detectedAuthConfig,
      sampleQueryParams,
      sampleHeaders,
      sampleBody,
      cachePolicy: {
        enabled: true,
        ttlSeconds: 60,
        cacheMethods: ['GET'],
        respectUpstreamCacheControl: true,
      },
      responseEnvelope: 'preserve', // Default preserve so user receives exact original response
    };
  }

  private static analyzeOpenApi(rawSpec: string): AnalyzedApiResult {
    const parsed = parseOpenApiSpec(rawSpec);
    const endpoint = parsed.endpoints[0] || {
      path: '/api',
      method: 'GET',
      parameters: [],
    };

    const hostParts = parsed.baseUrl.replace(/^https?:\/\//, '').split('/')[0].split('.');
    const baseDomain = hostParts[0] || 'service';
    const slug = generateSlug(`${baseDomain}-${endpoint.path.replace(/\//g, '-')}`);

    const parameterDefinitions: ParameterDefinition[] = endpoint.parameters.map((p) => ({
      name: p.name,
      in: p.in as ParameterLocation,
      type: (p.type as ParameterDataType) || 'string',
      required: p.required,
      description: p.description,
    }));

    const parameterMappings: ParameterMapping[] = endpoint.parameters.map((p) => ({
      clientName: p.name,
      clientIn: p.in as ParameterLocation,
      providerName: p.name,
      providerIn: p.in as ParameterLocation,
      required: p.required,
    }));

    let authConfig: ProviderAuthConfig = { type: 'none' };
    const secKey = Object.keys(parsed.securitySchemes)[0];
    if (secKey) {
      const scheme = parsed.securitySchemes[secKey];
      if (scheme.type === 'apiKey') {
        authConfig = {
          type: scheme.in === 'header' ? 'api_key_header' : 'api_key_query',
          paramName: scheme.name || 'api_key',
        };
      } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        authConfig = { type: 'bearer_token', paramName: 'Authorization' };
      }
    }

    return {
      name: parsed.title,
      slug,
      gatewayPath: `/${slug}`,
      method: endpoint.method,
      upstreamBaseUrl: parsed.baseUrl,
      upstreamPath: endpoint.path,
      requestBodyType: endpoint.requestBodyType || 'none',
      parameterDefinitions,
      parameterMappings,
      authConfig,
      sampleBody: endpoint.sampleBody,
      cachePolicy: {
        enabled: true,
        ttlSeconds: 60,
        cacheMethods: ['GET'],
        respectUpstreamCacheControl: true,
      },
      responseEnvelope: 'preserve',
    };
  }

  private static analyzePostman(rawCollection: string): AnalyzedApiResult {
    const parsed = parsePostmanCollection(rawCollection);
    const endpoint = parsed.endpoints[0] || {
      name: 'Endpoint',
      method: 'GET',
      url: 'https://api.example.com',
      headers: {},
      queryParams: {},
      bodyType: 'none',
    };

    const curlString = `curl -X ${endpoint.method} "${endpoint.url}"`;
    return this.analyzeParsedCurl(parseCurlCommand(curlString));
  }
}
