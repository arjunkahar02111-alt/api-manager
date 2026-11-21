import mongoose, { Schema, Document } from 'mongoose';
import type { IUserDevice } from '@arjun/types';

export interface UserDeviceDocument extends Omit<IUserDevice, '_id'>, Document {}

const UserDeviceSchema = new Schema<UserDeviceDocument>(
  {
    userId: { type: Schema.Types.ObjectId as any, ref: 'Customer', required: true, index: true },
    deviceId: { type: String, required: true, index: true }, // fingerprint hash
    deviceName: { type: String, required: true },
    os: { type: String, default: 'Unknown OS' },
    browser: { type: String, default: 'Unknown Browser' },
    ipAddress: { type: String, required: true },
    isTrusted: { type: Boolean, default: true },
    firstLoginAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
  },
  { timestamps: true }
);

UserDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export const UserDevice = mongoose.model<UserDeviceDocument>('UserDevice', UserDeviceSchema, 'user_devices');
