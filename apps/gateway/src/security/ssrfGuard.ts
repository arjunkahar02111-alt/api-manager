import dns from 'node:dns/promises';
import { isPrivateOrReservedIp, ForbiddenError } from '@arjun/shared';
import { config } from '../config/index.js';

/**
 * Anti-SSRF Guard
 * Strictly verifies that upstream URLs resolve to legitimate public hosts,
 * preventing loopback, local network, and cloud metadata exploits.
 */
export async function validateUpstreamUrl(urlStr: string): Promise<void> {
  if (config.proxy.allowPrivateIps) {
    return; // Development override only
  }

  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ForbiddenError('Upstream protocol must be HTTP or HTTPS', 'INVALID_PROTOCOL');
  }

  const hostname = parsed.hostname;

  // Reject raw IP literals that are private
  if (isPrivateOrReservedIp(hostname)) {
    throw new ForbiddenError(
      'Access to private, loopback, or metadata addresses is strictly prohibited',
      'SSRF_PREVENTED'
    );
  }

  // Resolve hostname DNS to check resolved destination IPs
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateOrReservedIp(record.address)) {
        throw new ForbiddenError(
          `Destination host ${hostname} resolves to prohibited address ${record.address}`,
          'SSRF_PREVENTED'
        );
      }
    }
  } catch (err: any) {
    if (err instanceof ForbiddenError) throw err;
    throw new ForbiddenError(`Failed to resolve upstream host ${hostname}`, 'DNS_RESOLUTION_FAILED');
  }
}
