import mongoose, { Schema, Document } from 'mongoose';
import type { IAdminAuditLog } from '@arjun/types';

export interface AdminAuditLogDocument extends Omit<IAdminAuditLog, '_id'>, Document {}

const AdminAuditLogSchema = new Schema<AdminAuditLogDocument>(
  {
    administratorId: { type: String, required: true, index: true },
    administratorUsername: { type: String, required: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: String, required: true, index: true },
    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed },
    sourceIp: { type: String, required: true },
    userAgent: { type: String },
    result: { type: String, enum: ['success', 'failure'], default: 'success' },
    errorMessage: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AdminAuditLog = mongoose.model<AdminAuditLogDocument>('AdminAuditLog', AdminAuditLogSchema, 'admin_audit_logs');
