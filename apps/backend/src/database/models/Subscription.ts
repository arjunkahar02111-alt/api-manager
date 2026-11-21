import mongoose, { Schema, Document } from 'mongoose';
import type { ISubscription } from '@arjun/types';

export interface SubscriptionDocument extends Omit<ISubscription, '_id'>, Document {}

const SubscriptionSchema = new Schema<SubscriptionDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    planId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'SubscriptionPlan', required: true },
    startAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['trial', 'active', 'expired', 'suspended', 'cancelled'],
      default: 'active',
      index: true,
    },
    assignedBy: { type: String, required: true },
    internalNotes: { type: String },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<SubscriptionDocument>('Subscription', SubscriptionSchema, 'subscriptions');
