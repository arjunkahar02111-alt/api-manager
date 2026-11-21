import mongoose, { Schema, Document } from 'mongoose';
import type { ISubscriptionPlan } from '@arjun/types';

export interface SubscriptionPlanDocument extends Omit<ISubscriptionPlan, '_id'>, Document {}

const SubscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    durationDays: { type: Number, default: 30 },
    dailyLimit: { type: Number, default: 1000 },
    monthlyLimit: { type: Number, default: 30000 },
    lifetimeLimit: { type: Number, default: 100000 },
    bandwidthLimitBytes: { type: Number, default: 10737418240 }, // 10 GB
    concurrencyLimit: { type: Number, default: 10 },
    allowedApis: { type: [String], default: ['*'] },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  },
  { timestamps: true }
);

export const SubscriptionPlan = mongoose.model<SubscriptionPlanDocument>(
  'SubscriptionPlan',
  SubscriptionPlanSchema,
  'subscription_plans'
);
