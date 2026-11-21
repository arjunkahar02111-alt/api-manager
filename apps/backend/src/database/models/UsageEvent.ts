import mongoose, { Schema, Document } from 'mongoose';
import type { IUsageEvent } from '@arjun/types';

export interface UsageEventDocument extends Omit<IUsageEvent, '_id'>, Document {}

const UsageEventSchema = new Schema<UsageEventDocument>(
  {
    requestId: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    apiId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'ApiCatalog', required: true },
    endpoint: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    bandwidthBytes: { type: Number, default: 0 },
    result: {
      type: String,
      enum: ['success', 'quota_exceeded', 'auth_failed', 'upstream_error', 'forbidden'],
      required: true,
      index: true,
    },
  },
  { timestamps: false }
);

export const UsageEvent = mongoose.model<UsageEventDocument>('UsageEvent', UsageEventSchema, 'usage_events');
