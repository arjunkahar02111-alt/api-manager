import { describe, it, expect } from 'vitest';
import {
  isValidIp,
  isValidCidr,
  isIpAllowed,
  isPrivateOrReservedIp,
} from '../../packages/shared/src/ip.js';

describe('IP Security & CIDR Matching Suite', () => {
  it('should validate IPv4 and IPv6 addresses', () => {
    expect(isValidIp('192.168.1.1')).toBe(true);
    expect(isValidIp('8.8.8.8')).toBe(true);
    expect(isValidIp('2001:db8::1')).toBe(true);
    expect(isValidIp('invalid_ip')).toBe(false);
    expect(isValidIp('999.999.999.999')).toBe(false);
  });

  it('should validate CIDR blocks', () => {
    expect(isValidCidr('192.168.1.0/24')).toBe(true);
    expect(isValidCidr('10.0.0.0/8')).toBe(true);
    expect(isValidCidr('203.0.113.195/32')).toBe(true);
    expect(isValidCidr('203.0.113.195')).toBe(true);
    expect(isValidCidr('192.168.1.0/35')).toBe(false); // Invalid prefix > 32
  });

  it('should correctly evaluate IP allowlist with CIDR matching', () => {
    const allowlist = ['198.51.100.0/24', '203.0.113.50'];

    expect(isIpAllowed('198.51.100.25', allowlist)).toBe(true);
    expect(isIpAllowed('198.51.100.1', allowlist)).toBe(true);
    expect(isIpAllowed('203.0.113.50', allowlist)).toBe(true);

    // Block unapproved IP
    expect(isIpAllowed('203.0.113.51', allowlist)).toBe(false);
    expect(isIpAllowed('1.1.1.1', allowlist)).toBe(false);
  });

  it('should detect private, loopback, and cloud metadata IPs (Anti-SSRF)', () => {
    // Loopback
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('127.1.2.3')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);

    // Private networks
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);

    // AWS / Cloud Metadata (169.254.169.254)
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);

    // Public IPs (Permitted)
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('104.26.4.195')).toBe(false);
  });
});
