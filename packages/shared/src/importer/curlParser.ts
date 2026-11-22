/**
 * Robust cURL Command Parser
 * Parses bash, zsh, and powershell formatted cURL commands.
 */

export interface ParsedCurl {
  method: string;
  url: string;
  origin: string;
  pathname: string;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
  bodyType: 'none' | 'json' | 'form-urlencoded' | 'multipart' | 'text' | 'xml';
  auth?: {
    type: 'bearer' | 'basic' | 'api_key_header' | 'api_key_query' | 'custom_header';
    keyName?: string;
    value?: string;
  };
}

export function parseCurlCommand(rawCommand: string): ParsedCurl {
  const cleaned = rawCommand
    .replace(/\\\r?\n/g, ' ') // join backslash escaped newlines
    .replace(/\^\r?\n/g, ' ') // join powershell caret newlines
    .replace(/[\r\n]+/g, ' ')
    .trim();

  // Tokenize arguments handling both single and double quotes
  const tokens: string[] = [];
  let currentToken = '';
  let inQuote: '"' | "'" | null = null;
  let escapeNext = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      currentToken += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        currentToken += char;
      }
    } else {
      if (char === '"' || char === "'") {
        inQuote = char;
      } else if (/\s/.test(char)) {
        if (currentToken.length > 0) {
          tokens.push(currentToken);
          currentToken = '';
        }
      } else {
        currentToken += char;
      }
    }
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  // Filter out leading "curl" command if present
  if (tokens.length > 0 && tokens[0].toLowerCase() === 'curl') {
    tokens.shift();
  }

  let method = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];
  let hasData = false;
  let isForm = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      if (i + 1 < tokens.length) {
        method = tokens[++i].toUpperCase();
      }
    } else if (token === '-H' || token === '--header') {
      if (i + 1 < tokens.length) {
        const headerStr = tokens[++i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx !== -1) {
          const key = headerStr.substring(0, colonIdx).trim().toLowerCase();
          const val = headerStr.substring(colonIdx + 1).trim();
          headers[key] = val;
        }
      }
    } else if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-ascii' ||
      token === '--data-binary'
    ) {
      hasData = true;
      if (i + 1 < tokens.length) {
        dataParts.push(tokens[++i]);
      }
    } else if (token === '--data-urlencode') {
      hasData = true;
      if (i + 1 < tokens.length) {
        dataParts.push(tokens[++i]);
      }
    } else if (token === '-F' || token === '--form') {
      hasData = true;
      isForm = true;
      if (i + 1 < tokens.length) {
        dataParts.push(tokens[++i]);
      }
    } else if (token === '-u' || token === '--user') {
      if (i + 1 < tokens.length) {
        const userPass = tokens[++i];
        headers['authorization'] = `Basic ${Buffer.from(userPass).toString('base64')}`;
      }
    } else if (token === '-A' || token === '--user-agent') {
      if (i + 1 < tokens.length) {
        headers['user-agent'] = tokens[++i];
      }
    } else if (token === '--url') {
      if (i + 1 < tokens.length) {
        url = tokens[++i];
      }
    } else if (!token.startsWith('-') && !url) {
      // First non-flag argument is the target URL
      url = token;
    }
  }

  // If method was not explicitly given but body was supplied, default method to POST
  if (method === 'GET' && hasData) {
    method = 'POST';
  }

  // Clean URL and parse URL object
  url = url.replace(/^['"]|['"]$/g, '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  let origin = '';
  let pathname = '/';
  const queryParams: Record<string, string> = {};

  try {
    const parsedUrl = new URL(url);
    origin = parsedUrl.origin;
    pathname = parsedUrl.pathname || '/';
    parsedUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });
  } catch {
    origin = url;
  }

  const rawBody = dataParts.join('&');
  let bodyType: ParsedCurl['bodyType'] = 'none';

  if (hasData) {
    const contentType = headers['content-type']?.toLowerCase() || '';
    if (isForm || contentType.includes('multipart/form-data')) {
      bodyType = 'multipart';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      bodyType = 'form-urlencoded';
    } else if (contentType.includes('application/json')) {
      bodyType = 'json';
    } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      bodyType = 'xml';
    } else if (rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
      bodyType = 'json';
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    } else if (rawBody.includes('=')) {
      bodyType = 'form-urlencoded';
      if (!headers['content-type']) {
        headers['content-type'] = 'application/x-www-form-urlencoded';
      }
    } else {
      bodyType = 'text';
    }
  }

  // Detect Authentication Placement
  let auth: ParsedCurl['auth'] | undefined;
  if (headers['authorization']) {
    const authVal = headers['authorization'];
    if (authVal.toLowerCase().startsWith('bearer ')) {
      auth = { type: 'bearer', value: authVal.substring(7).trim() };
    } else if (authVal.toLowerCase().startsWith('basic ')) {
      auth = { type: 'basic', value: authVal.substring(6).trim() };
    } else {
      auth = { type: 'custom_header', keyName: 'authorization', value: authVal };
    }
  } else {
    // Check known API key headers
    const keyHeaderCandidates = [
      'x-api-key',
      'api-key',
      'apikey',
      'x-auth-token',
      'x-rapidapi-key',
      'secret-key',
      'token',
    ];
    for (const h of keyHeaderCandidates) {
      if (headers[h]) {
        auth = { type: 'api_key_header', keyName: h, value: headers[h] };
        break;
      }
    }

    // Check query params if not found in headers
    if (!auth) {
      const keyQueryCandidates = ['key', 'api_key', 'apikey', 'token', 'secret', 'auth', 'access_token'];
      for (const q of keyQueryCandidates) {
        if (queryParams[q]) {
          auth = { type: 'api_key_query', keyName: q, value: queryParams[q] };
          break;
        }
      }
    }
  }

  return {
    method,
    url,
    origin,
    pathname,
    queryParams,
    headers,
    body: rawBody || undefined,
    bodyType,
    auth,
  };
}
