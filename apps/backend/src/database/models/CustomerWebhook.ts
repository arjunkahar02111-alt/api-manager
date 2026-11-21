import mongoose, { Schema, Document } from 'mongoose';
import type { ICustomerWebhook } from '@arjun/types';

export interface CustomerWebhookDocument extends Omit<ICustomerWebhook, '_id'>, Document {}

const CustomerWebhookSchema = new Schema<CustomerWebhookDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    url: { type: String, required: true, trim: true },
    encryptedSecret: { type: String, required: true },
    events: { type: [String], required: true },
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const CustomerWebhook = mongoose.model<CustomerWebhookDocument>(
  'CustomerWebhook',
  CustomerWebhookSchema,
  'customer_webhooks'
);
