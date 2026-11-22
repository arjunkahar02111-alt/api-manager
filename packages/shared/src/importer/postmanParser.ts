/**
 * Postman Collection v2 / v2.1 Parser
 */

export interface PostmanEndpoint {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body?: string;
  bodyType: 'none' | 'json' | 'form-urlencoded' | 'raw';
}

export interface ParsedPostman {
  name: string;
  endpoints: PostmanEndpoint[];
}

export function parsePostmanCollection(collectionJsonOrString: string | Record<string, any>): ParsedPostman {
  let collection: any;
  if (typeof collectionJsonOrString === 'string') {
    try {
      collection = JSON.parse(collectionJsonOrString);
    } catch {
      throw new Error('Invalid Postman Collection JSON.');
    }
  } else {
    collection = collectionJsonOrString;
  }

  const name = collection.info?.name || 'Imported Postman Collection';
  const endpoints: PostmanEndpoint[] = [];

  function traverseItems(items: any[]) {
    for (const item of items) {
      if (item.item && Array.isArray(item.item)) {
        traverseItems(item.item);
      } else if (item.request) {
        const req = item.request;
        const method = (req.method || 'GET').toUpperCase();

        let rawUrl = '';
        const queryParams: Record<string, string> = {};

        if (typeof req.url === 'string') {
          rawUrl = req.url;
        } else if (req.url && typeof req.url === 'object') {
          rawUrl = req.url.raw || '';
          if (Array.isArray(req.url.query)) {
            for (const q of req.url.query) {
              if (q.key) queryParams[q.key] = q.value || '';
            }
          }
        }

        const headers: Record<string, string> = {};
        if (Array.isArray(req.header)) {
          for (const h of req.header) {
            if (h.key && !h.disabled) {
              headers[h.key.toLowerCase()] = h.value || '';
            }
          }
        }

        let body = '';
        let bodyType: PostmanEndpoint['bodyType'] = 'none';

        if (req.body) {
          const mode = req.body.mode;
          if (mode === 'raw') {
            body = req.body.raw || '';
            bodyType = body.trim().startsWith('{') || body.trim().startsWith('[') ? 'json' : 'raw';
          } else if (mode === 'urlencoded' && Array.isArray(req.body.urlencoded)) {
            bodyType = 'form-urlencoded';
            const params = new URLSearchParams();
            for (const p of req.body.urlencoded) {
              if (p.key && !p.disabled) params.append(p.key, p.value || '');
            }
            body = params.toString();
          }
        }

        endpoints.push({
          name: item.name || `${method} ${rawUrl}`,
          method,
          url: rawUrl,
          headers,
          queryParams,
          body: body || undefined,
          bodyType,
        });
      }
    }
  }

  if (Array.isArray(collection.item)) {
    traverseItems(collection.item);
  }

  return { name, endpoints };
}
