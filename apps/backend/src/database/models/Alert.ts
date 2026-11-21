import mongoose, { Schema, Document } from 'mongoose';

export type AlertType =
  | 'downtime'
  | 'error_spike'
  | 'traffic_anomaly'
  | 'key_sharing'
  | 'auth_bruteforce'
  | 'key_expired'
  | 'client_suspended'
  | 'quota_threshold'
  | 'resource_exhaustion'
  | 'ssl_expiring'
  | 'db_failure';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface IAlert {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: 'gateway' | 'backend' | 'worker' | 'system';
  affectedApi?: string;
  affectedClient?: string;
  relatedRequestId?: string;
  metadata?: Record<string, any>;
  status: AlertStatus;
  fingerprint: string; // Used for deduplication cooldown
  occurrencesCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertDocument extends IAlert, Document {}

const AlertSchema = new Schema<AlertDocument>(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'downtime',
        'error_spike',
        'traffic_anomaly',
        'key_sharing',
        'auth_bruteforce',
        'key_expired',
        'client_suspended',
        'quota_threshold',
        'resource_exhaustion',
        'ssl_expiring',
        'db_failure',
      ],
      index: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'warning', 'info'],
      default: 'warning',
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    source: {
      type: String,
      enum: ['gateway', 'backend', 'worker', 'system'],
      default: 'system',
    },
    affectedApi: { type: String, index: true },
    affectedClient: { type: String, index: true },
    relatedRequestId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
      index: true,
    },
    fingerprint: { type: String, required: true, index: true },
    occurrencesCount: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolutionNotes: { type: String },
  },
  { timestamps: true }
);

AlertSchema.index({ fingerprint: 1, status: 1 });

export const Alert = mongoose.model<AlertDocument>('Alert', AlertSchema, 'alerts');
