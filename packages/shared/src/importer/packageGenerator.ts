import type { ClientDeliveryPackage, ParameterDefinition } from '@arjun/types';

export class ClientPackageGenerator {
  static generate(params: {
    apiName: string;
    slug: string;
    gatewayPath: string;
    method: string;
    parameterDefinitions: ParameterDefinition[];
    sampleBody?: any;
    sampleResponse?: any;
    cacheEnabled?: boolean;
    cacheTtlSeconds?: number;
    sampleApiKey?: string;
  }): ClientDeliveryPackage {
    const canonicalDomain = process.env.CANONICAL_DOMAIN || 'https://api.karviontechnologies.in';
    const cleanGatewayPath = params.gatewayPath.startsWith('/') ? params.gatewayPath : `/${params.gatewayPath}`;
    const endpointUrl = `${canonicalDomain}/v1${cleanGatewayPath}`;
    const apiKey = params.sampleApiKey || 'YOUR_KARVION_API_KEY';
    const method = params.method.toUpperCase();

    const queryParams = params.parameterDefinitions.filter((p) => p.in === 'query');
    const bodyParams = params.parameterDefinitions.filter((p) => p.in === 'body');
    const headerParams = params.parameterDefinitions.filter((p) => p.in === 'header');

    // Build sample query string
    const sampleQueryList: string[] = [`key=${apiKey}`];
    for (const qp of queryParams) {
      const val = qp.sampleValue !== undefined ? encodeURIComponent(String(qp.sampleValue)) : `sample_${qp.name}`;
      sampleQueryList.push(`${qp.name}=${val}`);
    }
    const sampleQueryString = sampleQueryList.join('&');
    const sampleFullUrl = `${endpointUrl}?${sampleQueryString}`;

    // Build sample body JSON
    let sampleBodyObj: Record<string, any> = {};
    if (params.sampleBody) {
      sampleBodyObj = params.sampleBody;
    } else if (bodyParams.length > 0) {
      for (const bp of bodyParams) {
        sampleBodyObj[bp.name] = bp.sampleValue !== undefined ? bp.sampleValue : 'sample_value';
      }
    }
    const sampleBodyJson = JSON.stringify(sampleBodyObj, null, 2);

    // 1. cURL Code Snippet
    let curlSnippet = '';
    if (method === 'GET' || method === 'DELETE') {
      curlSnippet = `curl "${sampleFullUrl}"`;
    } else {
      curlSnippet = `curl -X ${method} "${endpointUrl}?key=${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '${sampleBodyJson}'`;
    }

    // 2. JavaScript Fetch Code Snippet
    let jsFetchSnippet = '';
    if (method === 'GET') {
      jsFetchSnippet = `const response = await fetch("${sampleFullUrl}");\nconst data = await response.json();\nconsole.log(data);`;
    } else {
      jsFetchSnippet = `const response = await fetch("${endpointUrl}?key=${apiKey}", {\n  method: "${method}",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${sampleBodyJson})\n});\nconst data = await response.json();\nconsole.log(data);`;
    }

    // 3. Node.js Code Snippet
    let nodeSnippet = '';
    if (method === 'GET') {
      nodeSnippet = `import fetch from 'node-fetch';\n\nconst url = "${sampleFullUrl}";\nconst res = await fetch(url);\nconst json = await res.json();\nconsole.log(json);`;
    } else {
      nodeSnippet = `import fetch from 'node-fetch';\n\nconst url = "${endpointUrl}?key=${apiKey}";\nconst res = await fetch(url, {\n  method: "${method}",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${sampleBodyJson})\n});\nconst json = await res.json();\nconsole.log(json);`;
    }

    // 4. Python Requests Code Snippet
    let pythonSnippet = '';
    if (method === 'GET') {
      const pyParams = queryParams.map((p) => `    "${p.name}": "${p.sampleValue || 'sample'}"`).join(',\n');
      pythonSnippet = `import requests\n\nurl = "${endpointUrl}"\nparams = {\n    "key": "${apiKey}",\n${pyParams}\n}\nresponse = requests.get(url, params=params)\nprint(response.json())`;
    } else {
      pythonSnippet = `import requests\n\nurl = "${endpointUrl}"\nparams = { "key": "${apiKey}" }\npayload = ${sampleBodyJson}\nheaders = { "Content-Type": "application/json" }\nresponse = requests.post(url, params=params, json=payload, headers=headers)\nprint(response.json())`;
    }

    // 5. PHP cURL Code Snippet
    let phpSnippet = '';
    if (method === 'GET') {
      phpSnippet = `<?php\n$curl = curl_init();\ncurl_setopt_array($curl, [\n  CURLOPT_URL => "${sampleFullUrl}",\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_FOLLOWLOCATION => true,\n  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\n  CURLOPT_CUSTOMREQUEST => "GET",\n]);\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;\n?>`;
    } else {
      phpSnippet = `<?php\n$curl = curl_init();\ncurl_setopt_array($curl, [\n  CURLOPT_URL => "${endpointUrl}?key=${apiKey}",\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_CUSTOMREQUEST => "${method}",\n  CURLOPT_POSTFIELDS => '${sampleBodyJson}',\n  CURLOPT_HTTPHEADER => [\n    'Content-Type: application/json'\n  ],\n]);\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;\n?>`;
    }

    return {
      apiName: params.apiName,
      endpointUrl,
      gatewayPath: cleanGatewayPath,
      httpMethod: method,
      parameters: params.parameterDefinitions,
      authentication: {
        type: 'Karvion API Key',
        header: 'X-API-Key: arjun_live_...',
        queryParam: '?key=arjun_live_...',
        note: 'Provide your assigned Karvion API key either in the query string (?key=...) or via HTTP header (X-API-Key: ...).',
      },
      caching: {
        enabled: Boolean(params.cacheEnabled),
        ttlSeconds: params.cacheTtlSeconds || 60,
        bypassHeader: 'Cache-Control: no-cache',
      },
      sampleRequests: {
        curl: curlSnippet,
        javascriptFetch: jsFetchSnippet,
        nodejs: nodeSnippet,
        pythonRequests: pythonSnippet,
        phpCurl: phpSnippet,
      },
      sampleResponse: params.sampleResponse,
    };
  }
}
