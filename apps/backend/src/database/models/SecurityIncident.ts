import mongoose, { Schema, Document } from 'mongoose';
import type { ISecurityIncident, SecurityIncidentType, SecuritySeverity } from '@arjun/types';

export interface SecurityIncidentDocument extends Omit<ISecurityIncident, '_id'>, Document {}

const SecurityIncidentSchema = new Schema<SecurityIncidentDocument>(
  {
    incidentType: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
      index: true,
    },
    sourceIp: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId as any, ref: 'Customer', index: true },
    customerUsername: { type: String, index: true },
    keyPrefix: { type: String, index: true },
    endpoint: { type: String },
    method: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
    actionTaken: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SecurityIncidentSchema.index({ createdAt: -1 });

export const SecurityIncident = mongoose.model<SecurityIncidentDocument>(
  'SecurityIncident',
  SecurityIncidentSchema,
  'security_incidents'
);
