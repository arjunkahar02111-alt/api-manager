import { describe, it, expect } from 'vitest';
import {
  buildGatewayErrorResponse,
  formatExpiryDate,
  ResponseSanitizer,
  extractUpstreamQuota,
} from '@arjun/shared';

describe('Karvion Gateway Response & Developer Metadata Engine', () => {
  describe('1. formatExpiryDate formatting', () => {
    it('should format Date objects to DD-MM-YYYY', () => {
      const d = new Date(Date.UTC(2026, 11, 22)); // 2026-12-22
      expect(formatExpiryDate(d)).toBe('22-12-2026');
    });

    it('should pass through already-formatted DD-MM-YYYY strings without mangling', () => {
      expect(formatExpiryDate('11-06-2027')).toBe('11-06-2027');
      expect(formatExpiryDate('22-12-2026')).toBe('22-12-2026');
    });

    it('should return 31-12-2099 for null or undefined dates', () => {
      expect(formatExpiryDate(null)).toBe('31-12-2099');
      expect(formatExpiryDate(undefined)).toBe('31-12-2099');
    });
  });

  describe('2. buildGatewayErrorResponse on Quota Exceeded & Errors', () => {
    it('should construct branded error response on DAILY_QUOTA_EXCEEDED', () => {
      const res = buildGatewayErrorResponse({
        code: 'DAILY_QUOTA_EXCEEDED',
        message: 'Your daily API request quota has been exceeded.',
        developerTag: 'arjunkahar',
        reqLeft: 0,
        reqTotal: 100,
        expiresAt: new Date(Date.UTC(2026, 11, 22)),
        durationMs: 14,
      });

      expect(res.status).toBe(false);
      expect(res.success).toBe(false);
      expect(res.message).toBe('Your daily API request quota has been exceeded.');
      expect(res.error).toEqual({
        code: 'DAILY_QUOTA_EXCEEDED',
        message: 'Your daily API request quota has been exceeded.',
      });
      expect(res.developer).toBe('arjunkahar');
      expect(res.req_left).toBe(0);
      expect(res.req_total).toBe(100);
      expect(res.expiry).toBe('22-12-2026');
      expect(res.response_time).toBe('14ms');
      expect(res.response_time_seconds).toBe(0.01);
    });

    it('should construct branded error response on MISSING_REQUIRED_PARAMETER', () => {
      const res = buildGatewayErrorResponse({
        code: 'MISSING_REQUIRED_PARAMETER',
        message: "Required parameter 'type' is missing from request query.",
        developerTag: 'arjunkahar',
        reqLeft: 794,
        reqTotal: 1000,
        expiresAt: '22-12-2026',
        durationMs: 25,
      });

      expect(res.status).toBe(false);
      expect(res.success).toBe(false);
      expect(res.error.code).toBe('MISSING_REQUIRED_PARAMETER');
      expect(res.developer).toBe('arjunkahar');
      expect(res.req_left).toBe(794);
      expect(res.req_total).toBe(1000);
      expect(res.expiry).toBe('22-12-2026');
      expect(res.response_time).toBe('25ms');
    });

    it('should construct branded error response on unauthenticated / public errors', () => {
      const res = buildGatewayErrorResponse({
        code: 'MISSING_API_KEY',
        message: 'API Key missing.',
        durationMs: 5,
      });

      expect(res.status).toBe(false);
      expect(res.success).toBe(false);
      expect(res.developer).toBe('arjunkahar');
      expect(res.response_time).toBe('5ms');
      expect(res.response_time_seconds).toBe(0.01);
    });
  });

  describe('3. ResponseSanitizer.cleanAndRebrand with customer plan injection', () => {
    it('should clean foreign credits and inject customer quota onto upstream response', () => {
      const upstreamRaw = [
        {
          rc_number: 'DL01AB1234',
          owner_name: 'John Doe',
          credit: 'Powered by ForeignAPI',
          telegram: 'https://t.me/random_dev',
          req_left: 999999, // upstream secret limit
          req_total: 1000000,
          expiry: '01-01-2099',
        },
      ];

      // Extract upstream quota for Admin-only monitoring
      const extracted = extractUpstreamQuota(upstreamRaw);
      expect(extracted?.reqLeft).toBe(999999);
      expect(extracted?.reqTotal).toBe(1000000);

      // Sanitize for client
      const sanitized = ResponseSanitizer.cleanAndRebrand(
        upstreamRaw,
        {
          developerTag: 'arjunkahar',
          reqLeft: 42,
          reqTotal: 100,
          expiresAt: '22-12-2026',
        },
        123,
        false
      );

      expect(Array.isArray(sanitized)).toBe(true);
      const item = sanitized[0];
      expect(item.credit).toBeUndefined();
      expect(item.telegram).toBeUndefined();
      expect(item.developer).toBe('arjunkahar');
      expect(item.req_left).toBe(42);
      expect(item.req_total).toBe(100);
      expect(item.expiry).toBe('22-12-2026');
      expect(item.response_time).toBe('123ms');
      expect(item.response_time_seconds).toBe(0.12);
    });
  });
});
