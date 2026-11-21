import mongoose, { Schema, Document } from 'mongoose';
import type { ISecurityAlertNotification } from '@arjun/types';

export interface SecurityNotificationDocument extends Omit<ISecurityAlertNotification, '_id'>, Document {}

const SecurityNotificationSchema = new Schema<SecurityNotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId as any, ref: 'Customer', index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
    read: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SecurityNotificationSchema.index({ createdAt: -1 });

export const SecurityNotification = mongoose.model<SecurityNotificationDocument>(
  'SecurityNotification',
  SecurityNotificationSchema,
  'security_notifications'
);
