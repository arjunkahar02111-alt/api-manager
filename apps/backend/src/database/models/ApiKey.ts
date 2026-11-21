import mongoose, { Schema, Document } from 'mongoose';
import type { IApiKey } from '@arjun/types';

export interface ApiKeyDocument extends Omit<IApiKey, '_id'>, Document {}

const ApiKeySchema = new Schema<ApiKeyDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId as unknown as typeof String,
      ref: 'Customer',
      required: true,
    },
    keyHash: { type: String, required: true, unique: true, index: true },
    keyPrefix: { type: String, required: true },
    keyId: { type: String, index: true },
    name: { type: String, default: 'Production Key' },
    riskScore: { type: Number, default: 0 },
    lastUsedIp: { type: String },
    lastUsedUserAgent: { type: String },
    allowedIps: { type: [String], default: [] },
    boundIp: { type: String },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active', index: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
    replacedBy: { type: Schema.Types.ObjectId, ref: 'ApiKey' },
  },
  { timestamps: true }
);

// One active key per customer rule
ApiKeySchema.index(
  { customerId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export const ApiKey = mongoose.model<ApiKeyDocument>('ApiKey', ApiKeySchema, 'api_keys');
