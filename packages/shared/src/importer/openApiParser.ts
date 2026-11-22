/**
 * OpenAPI & Swagger Specification Parser
 * Extracts endpoints, methods, parameters, and authentication schemes.
 */

export interface OpenApiEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters: {
    name: string;
    in: 'query' | 'header' | 'path' | 'body';
    required: boolean;
    type: string;
    description?: string;
  }[];
  requestBodyType?: 'none' | 'json' | 'form-urlencoded' | 'multipart' | 'text' | 'xml';
  sampleBody?: any;
}

export interface ParsedOpenApi {
  title: string;
  version: string;
  baseUrl: string;
  endpoints: OpenApiEndpoint[];
  securitySchemes: Record<string, any>;
}

export function parseOpenApiSpec(specJsonOrString: string | Record<string, any>): ParsedOpenApi {
  let spec: any;
  if (typeof specJsonOrString === 'string') {
    try {
      spec = JSON.parse(specJsonOrString);
    } catch {
      throw new Error('Invalid OpenAPI JSON specification.');
    }
  } else {
    spec = specJsonOrString;
  }

  const title = spec.info?.title || 'Imported API';
  const version = spec.info?.version || 'v1';

  // Extract Base URL
  let baseUrl = 'https://api.example.com';
  if (spec.servers && Array.isArray(spec.servers) && spec.servers.length > 0) {
    baseUrl = spec.servers[0].url || baseUrl;
  } else if (spec.host) {
    const scheme = spec.schemes && spec.schemes[0] ? spec.schemes[0] : 'https';
    const basePath = spec.basePath || '';
    baseUrl = `${scheme}://${spec.host}${basePath}`;
  }

  const endpoints: OpenApiEndpoint[] = [];
  const paths = spec.paths || {};

  for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
    const commonParams = pathItem.parameters || [];
    const supportedMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

    for (const method of supportedMethods) {
      if (pathItem[method]) {
        const op = pathItem[method];
        const allParams = [...commonParams, ...(op.parameters || [])];

        const parameters = allParams.map((p: any) => ({
          name: p.name,
          in: p.in || 'query',
          required: Boolean(p.required),
          type: p.schema?.type || p.type || 'string',
          description: p.description || '',
        }));

        let requestBodyType: OpenApiEndpoint['requestBodyType'] = 'none';
        let sampleBody: any = undefined;

        if (op.requestBody?.content) {
          const content = op.requestBody.content;
          if (content['application/json']) {
            requestBodyType = 'json';
            const schema = content['application/json'].schema;
            if (schema?.example) sampleBody = schema.example;
          } else if (content['application/x-www-form-urlencoded']) {
            requestBodyType = 'form-urlencoded';
          } else if (content['multipart/form-data']) {
            requestBodyType = 'multipart';
          }
        }

        endpoints.push({
          path: pathStr,
          method: method.toUpperCase(),
          summary: op.summary || `${method.toUpperCase()} ${pathStr}`,
          description: op.description || '',
          parameters,
          requestBodyType,
          sampleBody,
        });
      }
    }
  }

  const securitySchemes =
    spec.components?.securitySchemes ||
    spec.securityDefinitions ||
    {};

  return {
    title,
    version,
    baseUrl,
    endpoints,
    securitySchemes,
  };
}
