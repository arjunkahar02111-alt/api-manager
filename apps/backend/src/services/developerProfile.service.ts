import { DeveloperProfile, DeveloperProfileDocument } from '../database/models/DeveloperProfile.js';
import { getRedisClient } from './redis.service.js';
import { logAdminAction } from './audit.service.js';
import type { IDeveloperProfile } from '@arjun/types';

export const DEFAULT_DEVELOPER_PROFILE: Omit<IDeveloperProfile, '_id' | 'createdAt' | 'updatedAt'> = {
  name: 'DEV ARJUN',
  role: 'Developer & Founder',
  product: 'KARVION API MANAGER',
  description:
    'Building technology, automation systems and API solutions with a focus on performance, reliability and practical innovation.',
  email: 'kahararjun537@gmail.com',
  telegram: '@ArjunXploit',
  telegramUrl: 'https://t.me/ArjunXploit',
  instagram: '@arjunnn021',
  instagramUrl: 'https://www.instagram.com/arjunnn021/',
  twitter: '@ArjunKahar021',
  twitterUrl: 'https://x.com/ArjunKahar021',
  portfolioUrl: 'https://www.arjunkaharofficial.in/',
  youtubeName: 'Gaming Arjun',
  youtubeUrl: 'https://www.youtube.com/@GamingArjun',
  avatarUrl: '',
  footerCreditText: 'Developed & Maintained by DEV ARJUN',
  enabled: true,
  socialLinks: {
    email: true,
    telegram: true,
    instagram: true,
    twitter: true,
    portfolio: true,
    youtube: true,
  },
  updatedBy: 'system',
};

const REDIS_KEY = 'system:developer_profile';

export class DeveloperProfileService {
  /**
   * Retrieves active developer profile with Redis caching
   */
  static async getProfile(): Promise<IDeveloperProfile> {
    const redis = getRedisClient();

    try {
      const cached = await redis.get(REDIS_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err: any) {
      console.warn('[DeveloperProfile] Redis cache read error:', err.message);
    }

    let profile: any = await DeveloperProfile.findOne().lean();

    if (!profile) {
      const created = await DeveloperProfile.create(DEFAULT_DEVELOPER_PROFILE);
      profile = created.toObject();
    }

    try {
      await redis.set(REDIS_KEY, JSON.stringify(profile), 'EX', 300);
    } catch (err: any) {
      console.warn('[DeveloperProfile] Redis cache write error:', err.message);
    }

    return profile as unknown as IDeveloperProfile;
  }

  /**
   * Updates developer profile with validation, cache invalidation, and audit logging
   */
  static async updateProfile(
    data: Partial<IDeveloperProfile>,
    adminId = 'admin',
    adminUsername = 'admin',
    sourceIp = '127.0.0.1'
  ): Promise<IDeveloperProfile> {
    const updated = await DeveloperProfile.findOneAndUpdate(
      {},
      {
        ...data,
        updatedBy: adminUsername,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    const redis = getRedisClient();
    try {
      await redis.set(REDIS_KEY, JSON.stringify(updated), 'EX', 300);
    } catch (err: any) {
      console.warn('[DeveloperProfile] Redis cache update error:', err.message);
    }

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'DEVELOPER_PROFILE_UPDATED',
      resourceType: 'system_settings',
      resourceId: 'developer_profile',
      afterState: {
        name: updated?.name,
        role: updated?.role,
        email: updated?.email,
        telegram: updated?.telegram,
      },
      sourceIp,
      result: 'success',
    });

    return updated as unknown as IDeveloperProfile;
  }
}
