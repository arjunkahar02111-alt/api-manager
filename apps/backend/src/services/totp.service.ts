import crypto from 'node:crypto';

export class TotpService {
  /**
   * Generates a 32-character Base32 TOTP Secret
   */
  static generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.randomBytes(20);
    let secret = '';
    for (let i = 0; i < bytes.length; i++) {
      secret += chars[bytes[i]! % chars.length];
    }
    return secret;
  }

  /**
   * Generates otpauth URI for Google Authenticator / Authy QR code
   */
  static generateOtpauthUri(username: string, secret: string, issuer = 'Arjun Api Manager'): string {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generates current 6-digit TOTP code for a secret (for testing or validation)
   */
  static generateCurrentToken(secret: string): string {
    const timeStep = 30;
    const currentStep = Math.floor(Date.now() / 1000 / timeStep);
    return this.generateTokenForStep(secret, currentStep);
  }

  /**
   * Generates 8 single-use backup recovery codes and their hashes
   */
  static generateBackupCodes(): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < 8; i++) {
      const code = `${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      plainCodes.push(code);
      hashedCodes.push(crypto.createHash('sha256').update(code).digest('hex'));
    }

    return { plainCodes, hashedCodes };
  }

  /**
   * Validates a backup recovery code against stored hashed codes
   */
  static consumeBackupCode(providedCode: string, storedHashedCodes: string[]): { valid: boolean; remainingCodes: string[] } {
    const targetHash = crypto.createHash('sha256').update(providedCode.trim().toUpperCase()).digest('hex');
    const index = storedHashedCodes.indexOf(targetHash);
    if (index === -1) {
      return { valid: false, remainingCodes: storedHashedCodes };
    }

    const remainingCodes = [...storedHashedCodes];
    remainingCodes.splice(index, 1);
    return { valid: true, remainingCodes };
  }

  /**
   * Verifies a 6-digit TOTP code with time-step drift tolerance (±1 step = 30s)
   */
  static verifyTotp(secret: string, token: string): boolean {
    if (!token || token.length !== 6 || !secret) return false;

    const timeStep = 30;
    const currentStep = Math.floor(Date.now() / 1000 / timeStep);

    // Check previous step (-30s), current step, and next step (+30s)
    for (let offset = -1; offset <= 1; offset++) {
      const step = currentStep + offset;
      const expectedToken = this.generateTokenForStep(secret, step);
      if (expectedToken === token.trim()) {
        return true;
      }
    }

    return false;
  }

  private static generateTokenForStep(secret: string, step: number): string {
    const key = this.base32Decode(secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(step));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1]! & 0xf;
    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  private static base32Decode(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    const cleaned = base32.toUpperCase().replace(/=+$/, '');
    for (let i = 0; i < cleaned.length; i++) {
      const index = alphabet.indexOf(cleaned[i]!);
      if (index === -1) continue;
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }
}
