import mongoose, { Schema, Document } from 'mongoose';

export interface IAcknowledgment {
  clientId: string;
  customerUsername?: string;
  keyPrefix?: string;
  clientIp?: string;
  acknowledgedAt: Date;
}

export interface IAnnouncement {
  announcementId: string;
  title: string;
  message: string;
  type:
    | 'general'
    | 'maintenance'
    | 'warning'
    | 'update'
    | 'version_update'
    | 'endpoint_change'
    | 'security'
    | 'restriction'
    | 'interruption'
    | 'restored'
    | 'deprecation'
    | 'custom';
  severity: 'information' | 'success' | 'warning' | 'critical';
  priority: number;
  status: 'draft' | 'published' | 'paused' | 'expired';
  targetScope: 'global' | 'api' | 'endpoint' | 'client' | 'apiKey' | 'version';
  targetApiId?: string;
  targetEndpoint?: string;
  targetClientId?: string;
  targetApiKey?: string;
  targetVersion?: string;
  startDate?: Date;
  expiresAt?: Date;
  actionUrl?: string;
  docsUrl?: string;
  recommendedAction?: string;
  acknowledgmentRequired: boolean;
  acknowledgments: IAcknowledgment[];
  deliveryCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnnouncementDocument extends Document, Omit<IAnnouncement, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

const AcknowledgmentSchema = new Schema<IAcknowledgment>(
  {
    clientId: { type: String, required: true },
    customerUsername: { type: String },
    keyPrefix: { type: String },
    clientIp: { type: String },
    acknowledgedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AnnouncementSchema = new Schema<AnnouncementDocument>(
  {
    announcementId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        'general',
        'maintenance',
        'warning',
        'update',
        'version_update',
        'endpoint_change',
        'security',
        'restriction',
        'interruption',
        'restored',
        'deprecation',
        'custom',
      ],
      default: 'general',
      index: true,
    },
    severity: {
      type: String,
      enum: ['information', 'success', 'warning', 'critical'],
      default: 'information',
      index: true,
    },
    priority: { type: Number, default: 1, index: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'paused', 'expired'],
      default: 'draft',
      index: true,
    },
    targetScope: {
      type: String,
      enum: ['global', 'api', 'endpoint', 'client', 'apiKey', 'version'],
      default: 'global',
      index: true,
    },
    targetApiId: { type: String, index: true },
    targetEndpoint: { type: String, index: true },
    targetClientId: { type: String, index: true },
    targetApiKey: { type: String, index: true },
    targetVersion: { type: String, index: true },
    startDate: { type: Date },
    expiresAt: { type: Date, index: true },
    actionUrl: { type: String },
    docsUrl: { type: String },
    recommendedAction: { type: String },
    acknowledgmentRequired: { type: Boolean, default: false },
    acknowledgments: { type: [AcknowledgmentSchema], default: [] },
    deliveryCount: { type: Number, default: 0 },
    createdBy: { type: String, default: 'admin' },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model<AnnouncementDocument>(
  'Announcement',
  AnnouncementSchema,
  'announcements'
);
