const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'x-api-key',
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'cookie',
  'totpsecret',
  'encryptedsecret',
  'privatekey'
]);

/**
 * Deeply redacts sensitive keys from objects before logging
 */
export function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact raw keys appearing in strings
    if (obj.includes('arjun_live_')) {
      return obj.replace(/arjun_live_[a-zA-Z0-9_-]{20,}/g, 'arjun_live_[REDACTED]');
    }
    if (obj.startsWith('Bearer ')) {
      return 'Bearer [REDACTED]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_KEYS.has(lowerKey)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return redacted;
  }

  return obj;
}
