/**
 * Universal Response Sanitizer & White-Label Rebranding Engine
 * Strips third-party developer credits, telegram links, upstream limits, and injects Karvion branding.
 */

export interface SanitizerMeta {
  developerTag?: string;
  reqLeft?: number;
  reqTotal?: number;
  expiresAt?: Date | string | null;
  announcement?: any;
}

const FORBIDDEN_CREDIT_KEYS = new Set([
  'credit',
  'credits',
  'contact',
  'contact_us',
  'contact_info',
  'footer',
  'footer_text',
  'telegram',
  'tg',
  'tg_channel',
  'telegram_channel',
  'tg_bot',
  'channel',
  'channel_link',
  'telegram_link',
  'api_owner',
  'api_developer',
  'admin_contact',
  'support_channel',
  'watermark',
  'requests_left',
  'credits_left',
  'remaining_credits',
  'quota_left',
  'api_limit',
  'upstream_limit',
  'balance',
  'vendor_credit',
  'source_credit',
  'dev',
  'developer_contact',
]);

function isTelegramOrCreditString(val: any): boolean {
  if (typeof val !== 'string') return false;
  const lower = val.toLowerCase();
  return (
    lower.includes('t.me/') ||
    lower.includes('telegram.me/') ||
    lower.startsWith('@') ||
    lower.includes('powered by')
  );
}

function recursiveClean(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(recursiveClean);
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 1. Strip blacklisted credit & branding keys
      if (FORBIDDEN_CREDIT_KEYS.has(lowerKey)) {
        continue;
      }

      // 2. Strip developer / dev / author / owner key if it contains foreign branding or telegram handles
      if (
        lowerKey === 'developer' ||
        lowerKey === 'dev' ||
        lowerKey === 'author' ||
        lowerKey === 'owner'
      ) {
        if (typeof value === 'object' && value !== null && isTelegramOrCreditString(JSON.stringify(value))) {
          continue;
        }
        if (isTelegramOrCreditString(value)) {
          continue;
        }
      }

      // 3. Strip any field whose value is an external Telegram link or @channel
      if (
        (lowerKey.includes('contact') ||
          lowerKey.includes('channel') ||
          lowerKey.includes('telegram') ||
          lowerKey.includes('footer') ||
          lowerKey.includes('credit') ||
          lowerKey.includes('dev')) &&
        isTelegramOrCreditString(value)
      ) {
        continue;
      }

      // 4. Strip any field where value is a string containing t.me / telegram.me link
      if (
        typeof value === 'string' &&
        (value.toLowerCase().includes('t.me/') || value.toLowerCase().includes('telegram.me/'))
      ) {
        continue;
      }

      cleaned[key] = recursiveClean(value);
    }

    return cleaned;
  }

  return obj;
}

function formatExpiryDate(d?: Date | string | null): string {
  if (!d) return '31-12-2099';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '31-12-2099';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export class ResponseSanitizer {
  /**
   * Cleans foreign developer credits and Telegram watermarks,
   * and injects the user's personal Karvion branding.
   */
  static cleanAndRebrand(
    rawJson: any,
    meta?: SanitizerMeta,
    durationMs = 0
  ): any {
    if (!rawJson || typeof rawJson !== 'object') {
      return rawJson;
    }

    // Step 1: Recursively strip all foreign credits, telegram handles, and upstream limits
    const cleaned = recursiveClean(rawJson);

    // If cleaned is an array, return cleaned array
    if (Array.isArray(cleaned)) {
      return cleaned;
    }

    // Step 2: Inject personal developer branding and customer quota stats
    cleaned.developer = meta?.developerTag || 'arjunkahar';

    if (meta?.announcement) {
      cleaned.announcement = meta.announcement;
    }

    if (meta?.reqLeft !== undefined) {
      cleaned.req_left = meta.reqLeft;
    }
    if (meta?.reqTotal !== undefined) {
      cleaned.req_total = meta.reqTotal;
    }
    if (meta?.expiresAt) {
      cleaned.expiry = formatExpiryDate(meta.expiresAt);
    }

    cleaned.response_time = `${durationMs}ms`;
    cleaned.response_time_seconds = Number((durationMs / 1000).toFixed(2));

    return cleaned;
  }
}
