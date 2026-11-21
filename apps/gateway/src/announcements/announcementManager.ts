import type { Redis } from 'ioredis';
import mongoose from 'mongoose';

export interface ActiveAnnouncementPayload {
  id: string;
  active: boolean;
  type: string;
  severity: string;
  title: string;
  message: string;
  action_url?: string;
  docs_url?: string;
  recommended_action?: string;
  published_at?: string;
  expires_at?: string;
  acknowledgment_required: boolean;
}

export interface MatchContext {
  apiId?: string;
  routeSlug?: string;
  gatewayPath?: string;
  customerId?: string;
  customerUsername?: string;
  keyPrefix?: string;
  apiVersion?: string;
}

export class AnnouncementManager {
  private static CACHE_KEY = 'gateway:announcements:active';

  /**
   * Retrieve active published announcements from Redis cache or MongoDB source of truth
   */
  static async getActiveAnnouncements(redis: Redis): Promise<any[]> {
    try {
      const cached = await redis.get(this.CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Fallback to database
    }

    try {
      const db = mongoose.connection.db;
      if (!db) return [];

      const now = new Date();
      const rawList = await db
        .collection('announcements')
        .find({
          status: 'published',
          $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }],
          $and: [{ $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] }],
        })
        .sort({ priority: -1 })
        .toArray();

      // Cache for 30 seconds
      if (redis) {
        await redis.setex(this.CACHE_KEY, 30, JSON.stringify(rawList)).catch(() => {});
      }

      return rawList;
    } catch (e: any) {
      console.warn('[AnnouncementManager] Error fetching active announcements:', e.message);
      return [];
    }
  }

  /**
   * Match most relevant announcement based on deterministic targeting rules and priority
   */
  static matchAnnouncement(
    announcements: any[],
    context: MatchContext
  ): ActiveAnnouncementPayload | null {
    if (!announcements || announcements.length === 0) return null;

    const matches = announcements.filter((ann) => {
      const scope = ann.targetScope || 'global';

      switch (scope) {
        case 'global':
          return true;
        case 'api':
          return (
            (context.apiId && ann.targetApiId === context.apiId) ||
            (context.routeSlug && ann.targetApiId === context.routeSlug)
          );
        case 'endpoint':
          return (
            context.gatewayPath &&
            ann.targetEndpoint &&
            (context.gatewayPath === ann.targetEndpoint ||
              context.gatewayPath.startsWith(ann.targetEndpoint))
          );
        case 'client':
          return (
            (context.customerId && ann.targetClientId === context.customerId) ||
            (context.customerUsername && ann.targetClientId === context.customerUsername)
          );
        case 'apiKey':
          return context.keyPrefix && ann.targetApiKey === context.keyPrefix;
        case 'version':
          return context.apiVersion && ann.targetVersion === context.apiVersion;
        default:
          return false;
      }
    });

    if (matches.length === 0) return null;

    // Sort by priority descending
    matches.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const selected = matches[0];

    return {
      id: selected.announcementId || String(selected._id),
      active: true,
      type: selected.type || 'general',
      severity: selected.severity || 'information',
      title: selected.title,
      message: selected.message,
      action_url: selected.actionUrl || undefined,
      docs_url: selected.docsUrl || undefined,
      recommended_action: selected.recommendedAction || undefined,
      published_at: selected.createdAt ? new Date(selected.createdAt).toISOString() : undefined,
      expires_at: selected.expiresAt ? new Date(selected.expiresAt).toISOString() : undefined,
      acknowledgment_required: !!selected.acknowledgmentRequired,
    };
  }
}
