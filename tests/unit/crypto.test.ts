import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  hashPassword,
  verifyPassword,
  encryptSecret,
  decryptSecret,
  timingSafeCompare,
  signWebhookPayload,
} from '../../packages/shared/src/crypto.js';

describe('Cryptography & Security Suite', () => {
  it('should generate cryptographically secure API keys with 256 bits entropy', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    expect(key1.rawKey.startsWith('arjun_live_')).toBe(true);
    expect(key1.rawKey.length).toBeGreaterThan(60);
    expect(key1.keyPrefix).toBe(key1.rawKey.substring(0, 16));
    expect(key1.keyHash).toBe(hashApiKey(key1.rawKey));

    // Ensure uniqueness
    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  it('should securely hash passwords and verify correctly', async () => {
    const password = 'SuperSecureAdminPassword2026!';
    const hash = await hashPassword(password);

    expect(hash).toContain(':');
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('should encrypt and decrypt secrets with AES-256-GCM', () => {
    const plainText = 'whsec_secret_key_for_client_hmac_verification';
    const encrypted = encryptSecret(plainText);

    expect(encrypted).toContain(':');
    expect(encrypted).not.toContain('whsec_');

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should perform timing-safe string comparison', () => {
    expect(timingSafeCompare('arjun_live_token123', 'arjun_live_token123')).toBe(true);
    expect(timingSafeCompare('arjun_live_token123', 'arjun_live_token999')).toBe(false);
  });

  it('should generate consistent HMAC signatures for webhooks', () => {
    const payload = JSON.stringify({ event: 'quota.daily_warning', timestamp: '2026-11-20' });
    const secret = 'whsec_test_secret';

    const sig1 = signWebhookPayload(payload, secret);
    const sig2 = signWebhookPayload(payload, secret);
    const sig3 = signWebhookPayload(payload, 'different_secret');

    expect(sig1).toBe(sig2);
    expect(sig1).not.toBe(sig3);
  });
});
