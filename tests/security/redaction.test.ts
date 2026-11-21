import { describe, it, expect } from 'vitest';
import { redactSensitiveData } from '../../packages/shared/src/redact.js';

describe('Data Redaction & Secret Leakage Prevention Suite', () => {
  it('should redact sensitive keys from objects', () => {
    const payload = {
      username: 'client_user',
      apiKey: 'arjun_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      password: 'MySecretPassword123!',
      token: 'jwt.token.here',
      nested: {
        authorization: 'Bearer secret_bearer_token',
        secret: 'confidential_key',
        safeProperty: 'public_value',
      },
    };

    const redacted = redactSensitiveData(payload) as any;

    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.authorization).toBe('[REDACTED]');
    expect(redacted.nested.secret).toBe('[REDACTED]');
    expect(redacted.nested.safeProperty).toBe('public_value');
    expect(redacted.username).toBe('client_user');
  });

  it('should redact raw API keys appearing in arbitrary string messages', () => {
    const logMessage = 'Request failed with key arjun_live_1234567890abcdef1234567890abcdef at route /v1/user/info';
    const redacted = redactSensitiveData(logMessage) as string;

    expect(redacted).not.toContain('1234567890abcdef');
    expect(redacted).toContain('arjun_live_[REDACTED]');
  });
});
