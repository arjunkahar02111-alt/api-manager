import mongoose, { Schema, Document } from 'mongoose';
import type { IManualPayment } from '@arjun/types';

export interface ManualPaymentDocument extends Omit<IManualPayment, '_id'>, Document {}

const ManualPaymentSchema = new Schema<ManualPaymentDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Subscription' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    paymentMethod: { type: String, required: true },
    reference: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'refunded'],
      default: 'pending',
      index: true,
    },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ManualPayment = mongoose.model<ManualPaymentDocument>('ManualPayment', ManualPaymentSchema, 'manual_payments');
