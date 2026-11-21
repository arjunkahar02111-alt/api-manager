import mongoose, { Schema, Document } from 'mongoose';

export interface IResponseConfig {
  configKey: string; // 'global' or route-specific slug
  includeEnvelope: boolean;
  includeAnnouncement: boolean;
  includeRequestId: boolean;
  includeApiVersion: boolean;
  includeRateLimit: boolean;
  includeTimestamp: boolean;
  customSuccessMessage?: string;
  customErrorMessage?: string;
  customHeaders?: Record<string, string>;
  errorTemplates?: Record<string, string>;
  deprecationNotice?: {
    enabled: boolean;
    sunsetDate?: Date;
    migrationDocUrl?: string;
    warningMessage?: string;
  };
  maintenanceEnvelope?: {
    statusCode: number;
    code: string;
    message: string;
    retryAfterSec: number;
  };
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponseConfigDocument extends IResponseConfig, Document {}

const ResponseConfigSchema = new Schema<ResponseConfigDocument>(
  {
    configKey: { type: String, required: true, unique: true, index: true },
    includeEnvelope: { type: Boolean, default: true },
    includeAnnouncement: { type: Boolean, default: true },
    includeRequestId: { type: Boolean, default: true },
    includeApiVersion: { type: Boolean, default: true },
    includeRateLimit: { type: Boolean, default: true },
    includeTimestamp: { type: Boolean, default: true },
    customSuccessMessage: { type: String },
    customErrorMessage: { type: String },
    customHeaders: { type: Map, of: String, default: {} },
    errorTemplates: { type: Map, of: String, default: {} },
    deprecationNotice: {
      enabled: { type: Boolean, default: false },
      sunsetDate: { type: Date },
      migrationDocUrl: { type: String },
      warningMessage: { type: String },
    },
    maintenanceEnvelope: {
      statusCode: { type: Number, default: 503 },
      code: { type: String, default: 'MAINTENANCE_ACTIVE' },
      message: { type: String, default: 'This API service is currently undergoing scheduled maintenance.' },
      retryAfterSec: { type: Number, default: 300 },
    },
    updatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

export const ResponseConfig = mongoose.model<ResponseConfigDocument>(
  'ResponseConfig',
  ResponseConfigSchema,
  'response_configs'
);
