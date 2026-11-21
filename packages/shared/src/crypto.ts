import crypto from 'node:crypto';

/**
 * Hash password using scrypt with random salt and timing-safe verification.
 * Standard Node.js crypto provides high memory-cost password hashing.
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return resolve(false);

    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return resolve(false);
      const keyBuffer = Buffer.from(key, 'hex');
      if (keyBuffer.length !== derivedKey.length) return resolve(false);
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

/**
 * Generate a cryptographically secure API key with at least 256 bits of entropy.
 * Format: arjun_live_<64-character-hex>
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const entropy = crypto.randomBytes(32).toString('hex'); // 256 bits
  const rawKey = `arjun_live_${entropy}`;
  const keyPrefix = rawKey.substring(0, 16); // e.g. arjun_live_a1b2
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyPrefix, keyHash };
}

/**
 * Hash an API key using SHA-256 for secure constant-time database matching.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Timing-safe string equality comparison
 */
export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Encrypt arbitrary secret text using AES-256-GCM.
 * Stored as: iv:authTag:encryptedCiphertext (hex encoded)
 */
export function encryptSecret(plainText: string, encryptionKeyHex?: string): string {
  const secretKey = encryptionKeyHex
    ? Buffer.from(encryptionKeyHex, 'hex')
    : crypto.createHash('sha256').update(process.env.DATA_ENCRYPTION_KEY || 'default-fallback-encryption-key-for-arjun-api-manager-32-chars!').digest();

  const iv = crypto.randomBytes(12); // standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey.subarray(0, 32), iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt text encrypted with AES-256-GCM.
 */
export function decryptSecret(encryptedPayload: string, encryptionKeyHex?: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, authTagHex, cipherTextHex] = parts as [string, string, string];
  const secretKey = encryptionKeyHex
    ? Buffer.from(encryptionKeyHex, 'hex')
    : crypto.createHash('sha256').update(process.env.DATA_ENCRYPTION_KEY || 'default-fallback-encryption-key-for-arjun-api-manager-32-chars!').digest();

  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey.subarray(0, 32), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate HMAC-SHA256 signature for outgoing webhook payload
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
