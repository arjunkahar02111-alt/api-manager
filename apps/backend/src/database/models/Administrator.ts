import mongoose, { Schema, Document } from 'mongoose';
import type { IAdministrator } from '@arjun/types';

export interface AdministratorDocument extends Omit<IAdministrator, '_id'>, Document {}

const AdministratorSchema = new Schema<AdministratorDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin'], default: 'super_admin' },
    totpEnabled: { type: Boolean, default: false },
    totpSecretEncrypted: { type: String },
    backupCodesHashed: { type: [String], default: [] },
    passwordChangedAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    activeSessionId: { type: String },
    currentLoginIp: { type: String },
    currentLoginUserAgent: { type: String },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
  },
  { timestamps: true }
);

export const Administrator = mongoose.model<AdministratorDocument>('Administrator', AdministratorSchema, 'administrators');
