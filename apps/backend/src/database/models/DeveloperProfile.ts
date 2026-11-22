import mongoose, { Schema, Document } from 'mongoose';
import type { IDeveloperProfile } from '@arjun/types';

export interface DeveloperProfileDocument extends Omit<IDeveloperProfile, '_id'>, Document {}

const DeveloperProfileSchema = new Schema<DeveloperProfileDocument>(
  {
    name: { type: String, required: true, default: 'DEV ARJUN' },
    role: { type: String, required: true, default: 'Developer & Founder' },
    product: { type: String, required: true, default: 'KARVION API MANAGER' },
    description: {
      type: String,
      required: true,
      default:
        'Building technology, automation systems and API solutions with a focus on performance, reliability and practical innovation.',
    },
    email: { type: String, required: true, default: 'kahararjun537@gmail.com' },
    telegram: { type: String, required: true, default: '@ArjunXploit' },
    telegramUrl: { type: String, required: true, default: 'https://t.me/ArjunXploit' },
    instagram: { type: String, required: true, default: '@arjunnn021' },
    instagramUrl: { type: String, required: true, default: 'https://www.instagram.com/arjunnn021/' },
    twitter: { type: String, required: true, default: '@ArjunKahar021' },
    twitterUrl: { type: String, required: true, default: 'https://x.com/ArjunKahar021' },
    portfolioUrl: { type: String, required: true, default: 'https://www.arjunkaharofficial.in/' },
    youtubeName: { type: String, required: true, default: 'Gaming Arjun' },
    youtubeUrl: { type: String, required: true, default: 'https://www.youtube.com/@GamingArjun' },
    avatarUrl: { type: String, default: '' },
    footerCreditText: { type: String, required: true, default: 'Developed & Maintained by DEV ARJUN' },
    enabled: { type: Boolean, default: true },
    socialLinks: {
      email: { type: Boolean, default: true },
      telegram: { type: Boolean, default: true },
      instagram: { type: Boolean, default: true },
      twitter: { type: Boolean, default: true },
      portfolio: { type: Boolean, default: true },
      youtube: { type: Boolean, default: true },
    },
    updatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

export const DeveloperProfile = mongoose.model<DeveloperProfileDocument>(
  'DeveloperProfile',
  DeveloperProfileSchema,
  'developer_profile'
);
