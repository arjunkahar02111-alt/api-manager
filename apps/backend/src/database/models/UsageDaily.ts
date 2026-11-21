import mongoose, { Schema, Document } from 'mongoose';
import type { IUsageDaily } from '@arjun/types';

export interface UsageDailyDocument extends Omit<IUsageDaily, '_id'>, Document {}

const UsageDailySchema = new Schema<UsageDailyDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true },
    apiId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'ApiCatalog', required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    requests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    bandwidthBytes: { type: Number, default: 0 },
  },
  { timestamps: false }
);

UsageDailySchema.index({ customerId: 1, apiId: 1, date: 1 }, { unique: true });
UsageDailySchema.index({ date: 1 });

export const UsageDaily = mongoose.model<UsageDailyDocument>('UsageDaily', UsageDailySchema, 'usage_daily');
