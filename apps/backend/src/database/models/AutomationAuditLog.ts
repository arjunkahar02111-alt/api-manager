import mongoose, { Schema, Document } from 'mongoose';

export interface IAutomationAuditLog {
  jobName: string;
  status: 'success' | 'warning' | 'failure';
  durationMs: number;
  itemsProcessed: number;
  actionsTaken: string[];
  errorMessage?: string;
  errorStack?: string;
  metadata?: Record<string, any>;
  executedAt: Date;
}

export interface AutomationAuditLogDocument extends IAutomationAuditLog, Document {}

const AutomationAuditLogSchema = new Schema<AutomationAuditLogDocument>(
  {
    jobName: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['success', 'warning', 'failure'],
      required: true,
      index: true,
    },
    durationMs: { type: Number, default: 0 },
    itemsProcessed: { type: Number, default: 0 },
    actionsTaken: { type: [String], default: [] },
    errorMessage: { type: String },
    errorStack: { type: String },
    metadata: { type: Schema.Types.Mixed },
    executedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AutomationAuditLog = mongoose.model<AutomationAuditLogDocument>(
  'AutomationAuditLog',
  AutomationAuditLogSchema,
  'automation_audit_logs'
);
