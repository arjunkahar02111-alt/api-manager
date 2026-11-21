import mongoose, { Schema, Document } from 'mongoose';
import type { ISystemSettings } from '@arjun/types';

export interface SystemSettingsDocument extends Omit<ISystemSettings, '_id'>, Document {}

const SystemSettingsSchema = new Schema<SystemSettingsDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    valueEncrypted: { type: String, required: true },
    description: { type: String, default: '' },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model<SystemSettingsDocument>('SystemSettings', SystemSettingsSchema, 'system_settings');
