import net from 'node:net';

export function isValidIp(ip: string): boolean {
  return net.isIP(ip) !== 0;
}

export function isValidCidr(cidr: string): boolean {
  if (!cidr || typeof cidr !== 'string') return false;
  const parts = cidr.trim().split('/');
  if (parts.length === 1) {
    return isValidIp(parts[0] || '');
  }
  if (parts.length === 2) {
    const [ip, prefixStr] = parts;
    if (!ip || !prefixStr) return false;
    const ipVersion = net.isIP(ip);
    if (ipVersion === 0) return false;
    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix)) return false;
    if (ipVersion === 4) return prefix >= 0 && prefix <= 32;
    if (ipVersion === 6) return prefix >= 0 && prefix <= 128;
  }
  return false;
}

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0
  );
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const parts = cidr.split('/');
  const rangeIp = parts[0];
  if (!rangeIp) return false;

  const prefix = parts.length > 1 ? parseInt(parts[1] || '32', 10) : 32;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp);

  return (ipInt & mask) === (rangeInt & mask);
}

export function isIpAllowed(clientIp: string, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) {
    return true;
  }

  let normalizedIp = clientIp.trim();
  if (normalizedIp.startsWith('::ffff:')) {
    normalizedIp = normalizedIp.substring(7);
  }

  for (const entry of allowlist) {
    const trimmed = entry.trim();
    if (trimmed === '*' || trimmed === '0.0.0.0/0') {
      return true;
    }

    if (net.isIPv4(normalizedIp) && (trimmed.includes('.') || trimmed.includes('/'))) {
      try {
        if (isIpv4InCidr(normalizedIp, trimmed)) {
          return true;
        }
      } catch {}
    } else if (normalizedIp === trimmed) {
      return true;
    }
  }

  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  let normalized = ip.trim();
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.substring(7);
  }

  if (net.isIPv4(normalized)) {
    const unsignedInt = ipv4ToInt(normalized) >>> 0;

    // 127.0.0.0/8 (Loopback)
    if (((unsignedInt & 0xff000000) >>> 0) === 0x7f000000) return true;

    // 10.0.0.0/8 (Private)
    if (((unsignedInt & 0xff000000) >>> 0) === 0x0a000000) return true;

    // 172.16.0.0/12 (Private)
    if (((unsignedInt & 0xfff00000) >>> 0) === 0xac100000) return true;

    // 192.168.0.0/16 (Private)
    if (((unsignedInt & 0xffff0000) >>> 0) === 0xc0a80000) return true;

    // 169.254.0.0/16 (Link-local / AWS metadata 169.254.169.254)
    if (((unsignedInt & 0xffff0000) >>> 0) === 0xa9fe0000) return true;

    // 0.0.0.0/8 (Current network)
    if (((unsignedInt & 0xff000000) >>> 0) === 0x00000000) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (
      ((unsignedInt & 0xf0000000) >>> 0) === 0xe0000000 ||
      ((unsignedInt & 0xf0000000) >>> 0) === 0xf0000000
    ) {
      return true;
    }
  }

  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (lower === '::1') return true;
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true;
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  }

  return false;
}
