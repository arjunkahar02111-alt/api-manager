import mongoose, { Schema, Document } from 'mongoose';
import type { IIpBlacklist } from '@arjun/types';

export interface IpBlacklistDocument extends Omit<IIpBlacklist, '_id'>, Document {}

const IpBlacklistSchema = new Schema<IpBlacklistDocument>(
  {
    ip: { type: String, required: true, unique: true, trim: true, index: true },
    reason: { type: String, required: true },
    blockedBy: { type: String, default: 'SYSTEM_AUTO_BAN' },
    expiresAt: { type: Date, index: true }, // null = permanent ban
    isActive: { type: Boolean, default: true, index: true },
    incidentCount: { type: Number, default: 1 },
    lastTriggeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

IpBlacklistSchema.index({ ip: 1, isActive: 1 });

export const IpBlacklist = mongoose.model<IpBlacklistDocument>(
  'IpBlacklist',
  IpBlacklistSchema,
  'ip_blacklists'
);
