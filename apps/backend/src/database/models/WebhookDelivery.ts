import mongoose, { Schema, Document } from 'mongoose';
import type { IWebhookDelivery } from '@arjun/types';

export interface WebhookDeliveryDocument extends Omit<IWebhookDelivery, '_id'>, Document {}

const WebhookDeliverySchema = new Schema<WebhookDeliveryDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    webhookId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'CustomerWebhook', required: true, index: true },
    event: { type: String, required: true, index: true },
    payloadReference: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'failed', 'retrying'],
      default: 'pending',
      index: true,
    },
    attemptCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, index: true },
    lastAttemptAt: { type: Date },
    responseStatus: { type: Number },
    responseBodySnippet: { type: String },
    error: { type: String },
  },
  { timestamps: true }
);

export const WebhookDelivery = mongoose.model<WebhookDeliveryDocument>(
  'WebhookDelivery',
  WebhookDeliverySchema,
  'webhook_deliveries'
);
