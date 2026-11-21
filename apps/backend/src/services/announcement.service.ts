import { Announcement, AnnouncementDocument } from '../database/models/Announcement.js';
import { getRedisClient } from './redis.service.js';
import { logAdminAction } from './audit.service.js';

export class AnnouncementService {
  private static CACHE_KEY = 'gateway:announcements:active';

  /**
   * Invalidate Gateway Redis Cache & Notify Cluster
   */
  static async invalidateCache(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.CACHE_KEY);
      await redis.publish(
        'pubsub:realtime',
        JSON.stringify({
          event: 'announcement_sync',
          timestamp: new Date().toISOString(),
        })
      );
    } catch (e: any) {
      console.warn('[AnnouncementService] Failed to clear Redis cache:', e.message);
    }
  }

  /**
   * List announcements with filtering and pagination
   */
  static async listAnnouncements(filters: {
    status?: string;
    type?: string;
    search?: string;
    targetScope?: string;
  }) {
    const query: any = {};
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters.type && filters.type !== 'all') {
      query.type = filters.type;
    }
    if (filters.targetScope && filters.targetScope !== 'all') {
      query.targetScope = filters.targetScope;
    }
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { message: { $regex: filters.search, $options: 'i' } },
        { announcementId: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return Announcement.find(query).sort({ priority: -1, createdAt: -1 }).lean();
  }

  /**
   * Create an announcement
   */
  static async createAnnouncement(
    data: any,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ): Promise<AnnouncementDocument> {
    const count = await Announcement.countDocuments();
    const announcementId = `ANN-${1000 + count + 1}`;

    const announcement = await Announcement.create({
      ...data,
      announcementId: data.announcementId || announcementId,
      status: data.status || 'draft',
      createdBy: adminUsername,
    });

    await this.invalidateCache();

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'ANNOUNCEMENT_CREATED',
      resourceType: 'announcement',
      resourceId: announcement.announcementId,
      afterState: announcement.toObject() as unknown as Record<string, unknown>,
      sourceIp,
      result: 'success',
    });

    return announcement;
  }

  /**
   * Get single announcement with acknowledgment telemetry
   */
  static async getAnnouncement(id: string) {
    const announcement = await Announcement.findOne({
      $or: [{ announcementId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    }).lean();

    return announcement;
  }

  /**
   * Update announcement
   */
  static async updateAnnouncement(
    id: string,
    data: any,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const existing = await Announcement.findOne({
      $or: [{ announcementId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!existing) {
      throw new Error(`Announcement ${id} not found.`);
    }

    const beforeState = existing.toObject();
    Object.assign(existing, data);
    await existing.save();

    await this.invalidateCache();

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'ANNOUNCEMENT_UPDATED',
      resourceType: 'announcement',
      resourceId: existing.announcementId,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: existing.toObject() as unknown as Record<string, unknown>,
      sourceIp,
      result: 'success',
    });

    return existing;
  }

  /**
   * Publish announcement immediately
   */
  static async publishAnnouncement(
    id: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const existing = await Announcement.findOne({
      $or: [{ announcementId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!existing) {
      throw new Error(`Announcement ${id} not found.`);
    }

    existing.status = 'published';
    if (!existing.startDate) {
      existing.startDate = new Date();
    }
    await existing.save();

    await this.invalidateCache();

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'ANNOUNCEMENT_PUBLISHED',
      resourceType: 'announcement',
      resourceId: existing.announcementId,
      afterState: { status: 'published' },
      sourceIp,
      result: 'success',
    });

    return existing;
  }

  /**
   * Pause announcement immediately
   */
  static async pauseAnnouncement(
    id: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const existing = await Announcement.findOne({
      $or: [{ announcementId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!existing) {
      throw new Error(`Announcement ${id} not found.`);
    }

    existing.status = 'paused';
    await existing.save();

    await this.invalidateCache();

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'ANNOUNCEMENT_PAUSED',
      resourceType: 'announcement',
      resourceId: existing.announcementId,
      afterState: { status: 'paused' },
      sourceIp,
      result: 'success',
    });

    return existing;
  }

  /**
   * Delete announcement
   */
  static async deleteAnnouncement(
    id: string,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const existing = await Announcement.findOne({
      $or: [{ announcementId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!existing) {
      throw new Error(`Announcement ${id} not found.`);
    }

    await Announcement.deleteOne({ _id: existing._id });
    await this.invalidateCache();

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'ANNOUNCEMENT_DELETED',
      resourceType: 'announcement',
      resourceId: existing.announcementId,
      sourceIp,
      result: 'success',
    });

    return { deleted: true, announcementId: existing.announcementId };
  }

  /**
   * Record client acknowledgment for an announcement
   */
  static async recordAcknowledgment(
    announcementId: string,
    ack: {
      clientId: string;
      customerUsername?: string;
      keyPrefix?: string;
      clientIp?: string;
    }
  ) {
    const announcement = await Announcement.findOne({
      $or: [
        { announcementId: announcementId },
        { _id: announcementId.match(/^[0-9a-fA-F]{24}$/) ? announcementId : null },
      ],
    });

    if (!announcement) {
      throw new Error(`Announcement ${announcementId} not found.`);
    }

    // Check if client already acknowledged
    const alreadyAcked = announcement.acknowledgments.some(
      (a) => a.clientId === ack.clientId
    );

    if (!alreadyAcked) {
      announcement.acknowledgments.push({
        clientId: ack.clientId,
        customerUsername: ack.customerUsername,
        keyPrefix: ack.keyPrefix,
        clientIp: ack.clientIp,
        acknowledgedAt: new Date(),
      });
      await announcement.save();
    }

    return {
      acknowledged: true,
      announcementId: announcement.announcementId,
      clientId: ack.clientId,
      client_id: ack.clientId,
      acknowledgedAt: new Date(),
    };
  }
}
