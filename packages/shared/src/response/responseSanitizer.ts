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
  // Upstream / Real API metadata keys that must never leak to end clients
  'req_left',
  'req_total',
  'requests_total',
  'total_requests',
  'remaining_requests',
  'remaining_quota',
  'req_limit',
  'rate_limit',
  'upstream_quota',
  'upstream_plan',
  'expiry',
  'cached',
  'response_time',
  'response_time_seconds',
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

export function formatExpiryDate(d?: Date | string | null): string {
  if (!d) return '31-12-2099';
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) return '31-12-2099';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export interface GatewayErrorPayloadOptions {
  code: string;
  message: string;
  details?: any;
  developerTag?: string;
  reqLeft?: number;
  reqTotal?: number;
  expiresAt?: Date | string | null;
  durationMs?: number;
  announcement?: any;
  usage?: any;
  extra?: Record<string, any>;
}

/**
 * Standardized Karvion API Gateway Error Response Builder
 * Ensures that EVERY error response (quota exceeded, parameter missing, access denied, etc.)
 * is fully branded with developer metadata, user plan telemetry (req_left, req_total, expiry),
 * response latency, and error details.
 */
export function buildGatewayErrorResponse(options: GatewayErrorPayloadOptions): Record<string, any> {
  const duration = options.durationMs ?? 0;
  const payload: Record<string, any> = {
    status: false,
    success: false,
    message: options.message,
    error: {
      code: options.code,
      message: options.message,
      ...(options.details !== undefined ? { details: options.details } : {}),
    },
    developer: options.developerTag || 'arjunkahar',
  };

  if (options.announcement) {
    payload.announcement = options.announcement;
  }

  // Quota & telemetry
  if (options.reqLeft !== undefined) {
    payload.req_left = options.reqLeft;
  } else if (
    options.code.includes('QUOTA') ||
    options.code === 'DAILY_QUOTA_EXCEEDED' ||
    options.code === 'MONTHLY_QUOTA_EXCEEDED' ||
    options.code === 'LIFETIME_QUOTA_EXCEEDED'
  ) {
    payload.req_left = 0;
  }

  if (options.reqTotal !== undefined) {
    payload.req_total = options.reqTotal;
  } else if (payload.req_left !== undefined) {
    payload.req_total = 100;
  }

  if (options.expiresAt) {
    payload.expiry = formatExpiryDate(options.expiresAt);
  } else if (payload.req_left !== undefined) {
    payload.expiry = '31-12-2099';
  }

  payload.response_time = `${duration}ms`;
  payload.response_time_seconds = Number((duration / 1000).toFixed(2));

  if (options.usage) {
    payload.usage = options.usage;
  }

  if (options.extra) {
    Object.assign(payload, options.extra);
  }

  return payload;
}

export interface ExtractedUpstreamQuota {
  reqLeft?: number;
  reqTotal?: number;
  expiry?: string;
}

/**
 * Extracts the real upstream provider quota from raw response data
 * so it can be monitored ONLY by Super Administrators in the dashboard.
 */
export function extractUpstreamQuota(rawJson: any): ExtractedUpstreamQuota | null {
  if (!rawJson) return null;
  const target = Array.isArray(rawJson) ? rawJson[0] : rawJson;
  if (!target || typeof target !== 'object') return null;

  const reqLeft = target.req_left ?? target.requests_left ?? target.credits_left ?? target.remaining_credits;
  const reqTotal = target.req_total ?? target.requests_total ?? target.total_requests;
  const expiry = target.expiry ?? target.expires_at ?? target.valid_till;

  if (reqLeft !== undefined || reqTotal !== undefined || expiry !== undefined) {
    return {
      reqLeft: typeof reqLeft === 'number' ? reqLeft : (!isNaN(Number(reqLeft)) ? Number(reqLeft) : undefined),
      reqTotal: typeof reqTotal === 'number' ? reqTotal : (!isNaN(Number(reqTotal)) ? Number(reqTotal) : undefined),
      expiry: typeof expiry === 'string' ? expiry : undefined,
    };
  }
  return null;
}

export class ResponseSanitizer {
  /**
   * Cleans foreign developer credits and Telegram watermarks,
   * completely strips real upstream provider quotas,
   * and injects the user's personal Karvion branding and assigned plan.
   */
  static cleanAndRebrand(
    rawJson: any,
    meta?: SanitizerMeta,
    durationMs = 0,
    isCache = false
  ): any {
    if (!rawJson || typeof rawJson !== 'object') {
      return rawJson;
    }

    // Step 1: Recursively strip all foreign credits, telegram handles, and upstream limits
    const cleaned = recursiveClean(rawJson);

    // Helper to inject customer Karvion branding & quota onto a target object
    const injectCustomerPlan = (targetObj: Record<string, any>) => {
      targetObj.developer = meta?.developerTag || 'arjunkahar';

      if (meta?.announcement) {
        targetObj.announcement = meta.announcement;
      }

      if (meta?.reqLeft !== undefined) {
        targetObj.req_left = meta.reqLeft;
      }
      if (meta?.reqTotal !== undefined) {
        targetObj.req_total = meta.reqTotal;
      } else if (meta?.reqLeft !== undefined && targetObj.req_total === undefined) {
        targetObj.req_total = 100;
      }
      if (meta?.expiresAt) {
        targetObj.expiry = formatExpiryDate(meta.expiresAt);
      } else if (meta?.reqLeft !== undefined && !targetObj.expiry) {
        targetObj.expiry = '31-12-2099';
      }

      targetObj.response_time = `${durationMs}ms`;
      targetObj.response_time_seconds = Number((durationMs / 1000).toFixed(2));
      if (isCache) {
        targetObj.cached = true;
      }

      if (targetObj.status === undefined && typeof targetObj.success === 'boolean') {
        targetObj.status = targetObj.success;
      }
      if (targetObj.success === undefined && typeof targetObj.status === 'boolean') {
        targetObj.success = targetObj.status;
      }
    };

    // If cleaned is an Array (e.g. [ { ... } ]), inject customer plan into the target item(s)
    if (Array.isArray(cleaned)) {
      if (cleaned.length > 0) {
        // First item (common in vehicle/lookup APIs that return a single-item array)
        if (typeof cleaned[0] === 'object' && cleaned[0] !== null) {
          injectCustomerPlan(cleaned[0]);
        }
        // If there are multiple items and the last item is a metadata object
        if (cleaned.length > 1 && typeof cleaned[cleaned.length - 1] === 'object' && cleaned[cleaned.length - 1] !== null) {
          injectCustomerPlan(cleaned[cleaned.length - 1]);
        }
      }
      return cleaned;
    }

    // If cleaned is an Object
    if (typeof cleaned === 'object' && cleaned !== null) {
      injectCustomerPlan(cleaned);
      return cleaned;
    }

    return cleaned;
  }
}
