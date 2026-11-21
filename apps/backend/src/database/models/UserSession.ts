import mongoose, { Schema, Document } from 'mongoose';
import type { IUserSession } from '@arjun/types';

export interface UserSessionDocument extends Omit<IUserSession, '_id'>, Document {}

const UserSessionSchema = new Schema<UserSessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId as any, required: true, index: true },
    role: { type: String, enum: ['admin', 'customer'], default: 'customer' },
    sessionId: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String, index: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true, index: true },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserSession = mongoose.model<UserSessionDocument>('UserSession', UserSessionSchema, 'user_sessions');
