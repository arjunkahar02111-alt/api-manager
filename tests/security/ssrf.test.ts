import { describe, it, expect } from 'vitest';
import { validateUpstreamUrl } from '../../apps/gateway/src/security/ssrfGuard.js';

describe('Anti-SSRF Gateway Protection Suite', () => {
  it('should reject loopback URLs', async () => {
    await expect(validateUpstreamUrl('http://127.0.0.1/admin')).rejects.toThrow();
    await expect(validateUpstreamUrl('http://localhost:3000/api')).rejects.toThrow();
  });

  it('should reject private IP destinations', async () => {
    await expect(validateUpstreamUrl('http://192.168.1.100/data')).rejects.toThrow();
    await expect(validateUpstreamUrl('http://10.0.0.5/internal')).rejects.toThrow();
    await expect(validateUpstreamUrl('http://172.16.1.10/secrets')).rejects.toThrow();
  });

  it('should reject AWS / Cloud Metadata Service (169.254.169.254)', async () => {
    await expect(validateUpstreamUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow();
  });

  it('should reject non-HTTP protocols', async () => {
    await expect(validateUpstreamUrl('ftp://example.com/file')).rejects.toThrow();
    await expect(validateUpstreamUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(validateUpstreamUrl('gopher://example.com')).rejects.toThrow();
  });

  it('should accept valid public HTTPS destinations', async () => {
    await expect(validateUpstreamUrl('https://httpbin.org/get')).resolves.not.toThrow();
  });
});
