import mongoose, { Schema, Document } from 'mongoose';
import type { IUsageMonthly } from '@arjun/types';

export interface UsageMonthlyDocument extends Omit<IUsageMonthly, '_id'>, Document {}

const UsageMonthlySchema = new Schema<UsageMonthlyDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true },
    apiId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'ApiCatalog', required: true },
    month: { type: String, required: true }, // Format: YYYY-MM
    requests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    bandwidthBytes: { type: Number, default: 0 },
  },
  { timestamps: false }
);

UsageMonthlySchema.index({ customerId: 1, apiId: 1, month: 1 }, { unique: true });
UsageMonthlySchema.index({ month: 1 });

export const UsageMonthly = mongoose.model<UsageMonthlyDocument>('UsageMonthly', UsageMonthlySchema, 'usage_monthly');
